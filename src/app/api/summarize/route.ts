import { NextResponse } from 'next/server';
import { generateChatCompletion } from '@/lib/openai';
import { container } from '@/lib/cosmos';
import { v4 as uuidv4 } from 'uuid';

interface PainPoint {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  score?: number;
  cost_to_serve: string;
}

interface SummaryData {
  pain_points: PainPoint[];
  overallSummary: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, tenantSlug, workspaceId, scanId, lifecycleId, saveToDatabase = false } = body;
    
    if (!text || typeof text !== 'string') {
      console.error('Invalid request body:', body);
      return NextResponse.json(
        { error: 'Invalid request body. "text" field is required and must be a string.' },
        { status: 400 }
      );
    }
    
    // Validate required IDs if we're saving to database
    if (saveToDatabase && (!tenantSlug || !workspaceId || !scanId || !lifecycleId)) {
      console.error('Missing required IDs for saving to Cosmos DB:', { tenantSlug, workspaceId, scanId, lifecycleId });
      return NextResponse.json(
        { error: 'Missing tenant slug, workspace ID, scan ID, or lifecycle ID.' },
        { status: 400 }
      );
    }
    
    console.log(`Received text of length: ${text.length}`);
    
    // Default values for empty or minimal conversation
    let defaultSummaryData: SummaryData = {
      pain_points: [],
      overallSummary: "Waiting for conversation to identify pain points."
    };
    
    if (text.trim().length < 10) {
      console.log('Text too short for summarization, returning default message');
      
      // Save the default summary to Cosmos DB if requested
      if (saveToDatabase) {
        try {
          await saveSummaryToCosmosDB(defaultSummaryData, tenantSlug, workspaceId, scanId, lifecycleId);
        } catch (error) {
          console.warn('Failed to save default summary to database:', error);
        }
      }
      
      return NextResponse.json({ summary: defaultSummaryData }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    // Count the number of speaker turns to determine if there's enough conversation
    const speakerTurns = text.split('\n').filter(line => line.trim().startsWith('[')).length;
    console.log(`Detected ${speakerTurns} speaker turns`);
    
    if (speakerTurns < 2) {
      console.log('Not enough speaker turns for a meaningful summary');
      const initialSummaryData: SummaryData = {
        pain_points: [],
        overallSummary: "The conversation is just starting. Pain points will be identified as the discussion progresses."
      };
      
      // Save the initial summary to Cosmos DB if requested
      if (saveToDatabase) {
        try {
          await saveSummaryToCosmosDB(initialSummaryData, tenantSlug, workspaceId, scanId, lifecycleId);
        } catch (error) {
          console.warn('Failed to save initial summary to database:', error);
        }
      }
      
      return NextResponse.json({ summary: initialSummaryData }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    // Fetch existing pain points to include as context
    let existingPainPoints: PainPoint[] = [];
    let existingOverallSummary = "";
    
    // Fetch lifecycle data to get process categories
    let lifecycleProcessCategories: any[] = [];
    
    try {
      if (lifecycleId) {
        // Fetch existing summary data
        const existingSummary = await fetchExistingSummary(tenantSlug, workspaceId, scanId, lifecycleId);
        if (existingSummary) {
          // Handle both old and new property name formats
          existingPainPoints = existingSummary.pain_points || 
            (existingSummary as any).painPoints || [];
          existingOverallSummary = existingSummary.overallSummary || "";
          console.log(`Found ${existingPainPoints.length} existing pain points to preserve`);
        }
        
        // Fetch lifecycle data for process categories
        try {
          const lifecycle = await fetchLifecycleData(tenantSlug, workspaceId, scanId, lifecycleId);
          if (lifecycle && lifecycle.processes && lifecycle.processes.process_categories) {
            lifecycleProcessCategories = lifecycle.processes.process_categories;
            console.log(`Found ${lifecycleProcessCategories.length} process categories in lifecycle`);
          }
        } catch (lifecycleError) {
          console.warn('Failed to fetch lifecycle data for categories:', lifecycleError);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch existing pain points:', error);
      // Continue with empty array if fetching fails
    }

    // Generate a flat list of all available process groups
    const processGroupsText = (() => {
      // Check if we have categories with process groups
      if (lifecycleProcessCategories.length === 0) {
        return 'No process groups are available for this lifecycle.';
      }

      // Collect all process groups from all categories
      const allProcessGroups: Array<{ name: string, description?: string }> = [];
      
      lifecycleProcessCategories.forEach(category => {
        if (category.process_groups && category.process_groups.length > 0) {
          category.process_groups.forEach((group: { name: string, description?: string }) => {
            allProcessGroups.push(group);
          });
        }
      });
      
      // If no process groups were found
      if (allProcessGroups.length === 0) {
        return 'No process groups are available for this lifecycle.';
      }
      
      // Create the text listing all process groups
      return `Available process groups for this lifecycle:
${allProcessGroups.map(group => `- "${group.name}": ${group.description || 'No description provided'}`).join('\n')}`;
    })();

    // Use the OpenAI integration to generate structured pain point data
    const prompt = `You are Ora, an AI assistant that analyzes conversations about business pain points and extracts structured data. Users may also refer to you as "Aura" or "Aurah" in the transcript.

Below is a conversation transcript with timestamps discussing business pain points:

${text}

${existingPainPoints.length > 0 ? `
IMPORTANT: There are ${existingPainPoints.length} previously identified pain points that should be PRESERVED unless there's a specific request to remove them in the transcript:
${JSON.stringify(existingPainPoints, null, 2)}

Your task is to MAINTAIN these existing pain points while adding any new ones identified in the transcript, with these special instructions:

1. If you see any requests in the transcript to DELETE a specific pain point (like "please delete pain point X" or "remove the pain point about Y"), remove that pain point from the pain_points JSON list
2. If you see requests to MODIFY a pain point (like "change the score of pain point X"), update that pain point accordingly
3. If you see requests to ADD a new pain point explicitly (like "add a pain point about X"), make sure to add it
4. For any other pain points mentioned in the conversation, maintain the existing ones and add any new ones identified

Assign new IDs to new pain points (use a consistent format like 'pp-N' where N is a number greater than the highest existing ID).
`: 'No existing pain points have been identified yet. Extract them from the conversation.'}

${processGroupsText}

Please structure your response as a valid JSON object with this structure:
{
  "pain_points": [
    {
      "id": "unique-id-1",
      "name": "Brief name of the pain point (5-10 words)",
      "description": "Detailed description of the pain point (1-3 sentences)",
      "assigned_process_group": "Name of most relevant process group (must be an exact process group name from the list above)",
      "score": 0-3 (where 3 is most painful/severe, and 0 is not applicable),
      "cost_to_serve": 10000
    },
    {
      "id": "unique-id-2",
      "name": "Brief name of another pain point",
      "description": "Detailed description of this pain point",
      "assigned_process_group": "Unassigned",
      "score": 7,
      "cost_to_serve": 30000
    }
  ],
  "overallSummary": "A brief overall summary of the key points from the conversation (1-2 sentences)"
}

Rules:
1. PRESERVE all existing pain points UNLESS there's a specific request to remove them in the transcript
2. Only update existing pain point attributes if requested or if significantly better information is available
3. Add new pain points for newly identified issues in the transcript
4. Assign new unique IDs to new pain points (pp-X where X > highest existing ID)
5. For the "assigned_process_group" field:
   - ONLY use an EXACT process group name from the list (the names in quotes)
   - If no relevant process group is found, use "Unassigned"
   - Verify that your selected group name exactly matches one from the provided list
6. Focus on actual pain points, not general discussion topics
7. If no NEW pain points were identified, keep the existing ones (modified as requested) 
8. The response MUST be valid JSON that can be parsed with JSON.parse()
9. Do not include any explanatory text outside the JSON object
10. Ensure each pain point has at least a name and description
11. Score pain points on a scale of 0-3, where 3 indicates the most severe/painful issues, and 0 is not applicable.
12. Provide a cost_to_serve estimate for each pain point based on industry standards and the complexity of the issue. Use integer values representing the estimated cost in dollars (e.g., 5000, 25000, 100000, 300000).

Make sure your response is ONLY the JSON object, nothing else.`;
    
    console.log('Sending to OpenAI for structured pain point extraction');
    
    let summaryJson;
    let summaryData: SummaryData;
    
    try {
      const aiResponse = await generateChatCompletion(
        prompt,
        '', // No additional context needed
        [] // No conversation history needed
      );
      
      console.log('Received response from OpenAI, attempting to parse as JSON');
      
      try {
        // Extract JSON from the response - it might be wrapped in backticks or have additional text
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
        
        summaryJson = JSON.parse(jsonString);
        
        // Validate the structure and handle both property names
        if ((!summaryJson.pain_points && !summaryJson.painPoints) || 
            (!Array.isArray(summaryJson.pain_points) && !Array.isArray(summaryJson.painPoints))) {
          throw new Error('Invalid response structure: missing pain_points array');
        }
        
        // Normalize the property name
        const painPoints = summaryJson.pain_points || summaryJson.painPoints || [];
        
        // Ensure each pain point has the required fields
        const normalizedPainPoints = painPoints.map((point: any, index: number) => {
          return {
            id: point.id || `pp-${index + 1}`,
            name: point.name || 'Untitled Pain Point',
            description: point.description || 'No description provided',
            assigned_process_group: point.assigned_process_group || 'Unassigned',  // Default to Unassigned if not provided
            score: point.score || 5,
            cost_to_serve: point.cost_to_serve || 30000 // Default cost estimate if not provided
          };
        });
        
        summaryData = {
          pain_points: normalizedPainPoints,
          overallSummary: summaryJson.overallSummary || 'Pain points have been identified from the conversation.'
        };
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        
        // If parsing fails but we have existing pain points, preserve them
        if (existingPainPoints.length > 0) {
          summaryData = {
            pain_points: existingPainPoints,
            overallSummary: existingOverallSummary || 'Failed to extract new pain points, preserving existing ones.'
          };
        } else {
          // Fallback to an error object on parsing failure with no existing data
          summaryData = {
            pain_points: [],
            overallSummary: 'Failed to extract structured pain points. Please try again later.'
          };
        }
      }
    } catch (error) {
      console.error('Error calling OpenAI for summarization:', error);
      
      // If API call fails but we have existing pain points, preserve them
      if (existingPainPoints.length > 0) {
        summaryData = {
          pain_points: existingPainPoints,
          overallSummary: existingOverallSummary || 'Unable to analyze new conversation, preserving existing pain points.'
        };
      } else {
        // Fallback to an empty summary when OpenAI fails with no existing data
        summaryData = {
          pain_points: [],
          overallSummary: 'Unable to analyze the conversation at this time. Please try again later.'
        };
      }
    }
    
    console.log(`Extracted ${summaryData.pain_points.length} pain points`);
    
    // Save the structured data to Cosmos DB if requested
    if (saveToDatabase) {
      try {
        console.log('Saving structured pain points to database');
        await saveSummaryToCosmosDB(summaryData, tenantSlug, workspaceId, scanId, lifecycleId);
        console.log('Pain points saved successfully');
        
        // Update the lifecycle process group scores based on pain points
        try {
          // Call the dedicated API endpoint to sync scores
          const syncResponse = await fetch(
            `${process.env.NEXTAUTH_URL || ''}/api/tenants/by-slug/workspaces/scans/pain-points/sync-scores?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            }
          );
          
          if (syncResponse.ok) {
            console.log('Lifecycle scores updated successfully via API');
          } else {
            console.warn('Failed to update lifecycle scores via API:', await syncResponse.text());
          }
        } catch (scoreError) {
          console.warn('Failed to update lifecycle scores:', scoreError);
        }
      } catch (error) {
        console.warn('Failed to save generated pain points to database:', error);
      }
    }
    
    return NextResponse.json({ summary: summaryData }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error generating pain point summary:', error);
    return NextResponse.json(
      { error: 'Failed to extract pain points', details: error instanceof Error ? error.message : String(error) },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

/**
 * Fetch the existing summary from Cosmos DB
 */
async function fetchExistingSummary(
  tenantSlug: string,
  workspaceId: string,
  scanId: string,
  lifecycleId: string
): Promise<SummaryData | null> {
  if (!container) {
    console.warn('Cosmos DB container is not initialized');
    return null;
  }
  
  // Query for the summary record
  const query = `
    SELECT * FROM c 
    WHERE c.type = "pain_point_summary" 
    AND c.tenant_slug = @tenantSlug
    AND c.workspace_id = @workspaceId
    AND c.scan_id = @scanId
    AND c.lifecycle_id = @lifecycleId
  `;
  
  const { resources } = await container.items
    .query({
      query,
      parameters: [
        { name: "@tenantSlug", value: tenantSlug },
        { name: "@workspaceId", value: workspaceId },
        { name: "@scanId", value: scanId },
        { name: "@lifecycleId", value: lifecycleId }
      ]
    })
    .fetchAll();
  
  if (resources.length === 0) {
    return null;
  }
  
  // Return the most recent summary if multiple exist
  const sortedResources = resources.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  
  return sortedResources[0];
}

/**
 * Save the summary data to Cosmos DB
 * @param summaryData The structured pain points data
 * @param tenantSlug The tenant slug
 * @param workspaceId The workspace ID
 * @param scanId The scan ID
 * @param lifecycleId The lifecycle ID
 */
async function saveSummaryToCosmosDB(
  summaryData: SummaryData,
  tenantSlug: string, 
  workspaceId: string, 
  scanId: string,
  lifecycleId: string
): Promise<void> {
  try {
    console.log('Saving pain points to Cosmos DB...');
    
    // Check if container is available
    if (!container) {
      throw new Error('Cosmos DB container is not initialized. Check your environment variables.');
    }
    
    // First, fetch the tenant record to get the tenant_id for partitioning
    const tenantQuery = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id`;
    const { resources: tenantResources } = await container.items
      .query({
        query: tenantQuery,
        parameters: [{ name: "@slug", value: tenantSlug.toLowerCase() }],
      })
      .fetchAll();
    
    if (tenantResources.length === 0) {
      throw new Error(`Tenant not found with slug: ${tenantSlug}`);
    }
    
    const tenantId = tenantResources[0].id;
    
    // Check if a summary already exists for this lifecycle
    const summaryQuery = `
      SELECT * FROM c 
      WHERE c.type = "pain_point_summary" 
      AND c.tenant_slug = @tenantSlug
      AND c.workspace_id = @workspaceId
      AND c.scan_id = @scanId
      AND c.lifecycle_id = @lifecycleId
    `;
    
    const { resources: existingSummaries } = await container.items
      .query({
        query: summaryQuery,
        parameters: [
          { name: "@tenantSlug", value: tenantSlug },
          { name: "@workspaceId", value: workspaceId },
          { name: "@scanId", value: scanId },
          { name: "@lifecycleId", value: lifecycleId }
        ],
      })
      .fetchAll();
    
    if (existingSummaries.length > 0) {
      // Update the existing summary
      const existingSummary = existingSummaries[0];
      
      // Handle transition from painPoints to pain_points
      if (existingSummary.painPoints && !existingSummary.pain_points) {
        // Migrate from old property name to new property name
        existingSummary.pain_points = summaryData.pain_points;
        delete existingSummary.painPoints;
      } else {
        // Just update with the new data using the new property name
        existingSummary.pain_points = summaryData.pain_points;
      }
      
      existingSummary.overallSummary = summaryData.overallSummary;
      existingSummary.updated_at = new Date().toISOString();
      
      await container
        .item(existingSummary.id, tenantId)
        .replace(existingSummary);
        
      console.log(`Updated existing pain points summary with ID: ${existingSummary.id}`);
    } else {
      // Create a new summary document
      const summaryDocument = {
        id: uuidv4(),
        tenant_id: tenantId,
        tenant_slug: tenantSlug,
        workspace_id: workspaceId,
        scan_id: scanId,
        lifecycle_id: lifecycleId,
        type: "pain_point_summary",
        pain_points: summaryData.pain_points,
        overallSummary: summaryData.overallSummary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await container.items.create(summaryDocument);
      console.log(`Created new pain points summary document with ID: ${summaryDocument.id}`);
    }
  } catch (error) {
    console.error('Error saving pain points to Cosmos DB:', error);
    throw error;
  }
}

/**
 * Fetch lifecycle data from Cosmos DB
 */
async function fetchLifecycleData(
  tenantSlug: string,
  workspaceId: string,
  scanId: string,
  lifecycleId: string
): Promise<any | null> {
  if (!container) {
    console.warn('Cosmos DB container is not initialized');
    return null;
  }
  
  // Query for the lifecycle record
  const query = `
    SELECT * FROM c 
    WHERE c.type = "lifecycle" 
    AND c.tenant_slug = @tenantSlug
    AND c.workspace_id = @workspaceId
    AND c.scan_id = @scanId
    AND c.id = @lifecycleId
  `;
  
  try {
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@tenantSlug", value: tenantSlug },
          { name: "@workspaceId", value: workspaceId },
          { name: "@scanId", value: scanId },
          { name: "@lifecycleId", value: lifecycleId }
        ]
      })
      .fetchAll();
    
    if (resources.length === 0) {
      return null;
    }
    
    return resources[0];
  } catch (error) {
    console.error('Error fetching lifecycle data:', error);
    return null;
  }
} 