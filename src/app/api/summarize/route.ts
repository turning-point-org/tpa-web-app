import { NextResponse } from 'next/server';
import { generateChatCompletion } from '@/lib/openai';
import { container } from '@/lib/cosmos';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, tenantSlug, workspaceId, scanId, saveToDatabase = false } = body;
    
    if (!text || typeof text !== 'string') {
      console.error('Invalid request body:', body);
      return NextResponse.json(
        { error: 'Invalid request body. "text" field is required and must be a string.' },
        { status: 400 }
      );
    }
    
    // Validate required IDs if we're saving to database
    if (saveToDatabase && (!tenantSlug || !workspaceId || !scanId)) {
      console.error('Missing required IDs for saving to Cosmos DB:', { tenantSlug, workspaceId, scanId });
      return NextResponse.json(
        { error: 'Missing tenant slug, workspace ID, or scan ID.' },
        { status: 400 }
      );
    }
    
    console.log(`Received text of length: ${text.length}`);
    
    if (text.trim().length < 10) {
      console.log('Text too short for summarization, returning default message');
      const defaultSummary = "## Waiting for Conversation\n\nNot enough conversation to summarize yet. As participants speak, key points will be summarized here automatically.";
      
      // Save the default summary to Cosmos DB if requested
      if (saveToDatabase) {
        try {
          await saveSummaryToCosmosDB(defaultSummary, tenantSlug, workspaceId, scanId);
        } catch (error) {
          console.warn('Failed to save default summary to database:', error);
          // Continue anyway since we have a default summary to return
        }
      }
      
      return NextResponse.json({ summary: defaultSummary });
    }
    
    // Count the number of speaker turns to determine if there's enough conversation
    const speakerTurns = text.split('\n').filter(line => line.includes(':')).length;
    console.log(`Detected ${speakerTurns} speaker turns`);
    
    if (speakerTurns < 2) {
      console.log('Not enough speaker turns for a meaningful summary');
      const initialSummary = "## Initial Conversation\n\nThe conversation is just starting. More detailed summary will appear as the discussion progresses.";
      
      // Save the initial summary to Cosmos DB if requested
      if (saveToDatabase) {
        try {
          await saveSummaryToCosmosDB(initialSummary, tenantSlug, workspaceId, scanId);
        } catch (error) {
          console.warn('Failed to save initial summary to database:', error);
          // Continue anyway since we have an initial summary to return
        }
      }
      
      return NextResponse.json({ summary: initialSummary });
    }
    
    // Use the existing OpenAI integration to generate a summary
    const prompt = `You are an assistant that summarizes ongoing conversations about pain points in a business context.
    
Below is a conversation transcript with multiple speakers discussing business pain points:

${text}

Please provide a concise, up-to-date summary of:
1. The key pain points mentioned so far
2. Any potential solutions discussed
3. Areas of agreement or disagreement between speakers

FORMAT YOUR RESPONSE AS FOLLOWS:
- Use markdown formatting
- Use ## headings for main sections
- Use bullet points for lists
- Use **bold** for emphasis
- Include a brief "Summary" section at the top

Your summary should focus on the most important points and try to keep it concise.`;
    
    console.log('Sending to OpenAI for summarization');
    
    let summaryText;
    try {
      summaryText = await generateChatCompletion(
        prompt,
        '', // No additional context needed
        [] // No conversation history needed
      );
    } catch (error) {
      console.error('Error calling OpenAI for summarization:', error);
      // Fallback to a generic summary when OpenAI fails
      summaryText = "## Summary\n\nUnable to generate a detailed summary at this time. Please try again later.";
    }
    
    console.log('Received summary from OpenAI');
    
    // Ensure there's always a summary section even if the AI doesn't provide one
    let formattedSummary = summaryText;
    if (!formattedSummary.includes('#')) {
      formattedSummary = `## Summary\n\n${formattedSummary}`;
    }
    
    // Save the summary to Cosmos DB if requested
    if (saveToDatabase) {
      try {
        console.log('Saving summary to database');
        await saveSummaryToCosmosDB(formattedSummary, tenantSlug, workspaceId, scanId);
        console.log('Summary saved successfully');
      } catch (error) {
        console.warn('Failed to save generated summary to database:', error);
        // Continue anyway since we have a summary to return
      }
    }
    
    return NextResponse.json({ summary: formattedSummary });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Save the summary to Cosmos DB
 * @param summary The summary text to save
 * @param tenantSlug The tenant slug
 * @param workspaceId The workspace ID
 * @param scanId The scan ID
 */
async function saveSummaryToCosmosDB(
  summary: string, 
  tenantSlug: string, 
  workspaceId: string, 
  scanId: string
): Promise<void> {
  try {
    console.log('Saving summary to Cosmos DB...');
    
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
    
    // Check if a summary already exists for this scan
    const summaryQuery = `SELECT * FROM c WHERE c.type = "pain_points_summary" AND c.scan_id = @scanId AND c.workspace_id = @workspaceId AND c.tenant_slug = @tenantSlug`;
    const { resources: existingSummaries } = await container.items
      .query({
        query: summaryQuery,
        parameters: [
          { name: "@scanId", value: scanId },
          { name: "@workspaceId", value: workspaceId },
          { name: "@tenantSlug", value: tenantSlug }
        ],
      })
      .fetchAll();
    
    if (existingSummaries.length > 0) {
      // Update the existing summary
      const existingSummary = existingSummaries[0];
      existingSummary.summary = summary;
      existingSummary.updated_at = new Date().toISOString();
      
      await container
        .item(existingSummary.id, tenantId)
        .replace(existingSummary);
        
      console.log(`Updated existing summary with ID: ${existingSummary.id}`);
    } else {
      // Create a new summary document
      const summaryDocument = {
        id: uuidv4(),
        tenant_id: tenantId,
        tenant_slug: tenantSlug,
        workspace_id: workspaceId,
        scan_id: scanId,
        type: "pain_points_summary",
        summary: summary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await container.items.create(summaryDocument);
      console.log(`Created new summary document with ID: ${summaryDocument.id}`);
    }
  } catch (error) {
    console.error('Error saving summary to Cosmos DB:', error);
    throw error;
  }
} 