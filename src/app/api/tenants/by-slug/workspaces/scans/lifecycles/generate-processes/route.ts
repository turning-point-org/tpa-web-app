import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";

// Get OpenAI settings from environment variables
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const chatDeploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT_NAME || "gpt-35-turbo";

// Create OpenAI client
let client: OpenAIClient | null = null;

if (endpoint && apiKey) {
  client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
} else {
  console.warn('Missing Azure OpenAI environment variables. Generate processes feature will not work.');
}

// Function to get company information for a scan
async function getCompanyInfoForScan(tenant_slug: string, workspace_id: string, scan_id: string): Promise<any> {
  if (!container) {
    throw new Error("Database connection not available");
  }
  
  const query = `
    SELECT * FROM c 
    WHERE c.scan_id = @scan_id 
    AND c.workspace_id = @workspace_id 
    AND c.tenant_slug = @tenant_slug 
    AND c.type = "company_info"
  `;
  
  const { resources } = await container.items
    .query({
      query,
      parameters: [
        { name: "@scan_id", value: scan_id },
        { name: "@workspace_id", value: workspace_id },
        { name: "@tenant_slug", value: tenant_slug },
      ],
    })
    .fetchAll();

  return resources.length > 0 ? resources[0] : null;
}

// Function to generate process categories and process groups for a lifecycle
async function generateProcesses(lifecycleName: string, lifecycleDescription: string, companyInfo: any = null) {
  if (!client) {
    throw new Error("OpenAI client not initialized");
  }

  const companyInfoSection = companyInfo ? 
    `Company Information:
    Name: ${companyInfo.name || 'Not specified'}
    Industry: ${companyInfo.industry || 'Not specified'}
    Country: ${companyInfo.country || 'Not specified'}
    Description: ${companyInfo.description || 'Not specified'}
    Website: ${companyInfo.website || 'Not specified'}` : 
    'No company information available';

  const processGenerationPrompt = `
You are a business process expert specializing in organizational process design.
Your task is to generate a comprehensive list of process categories and their process groups that would be relevant to the following business lifecycle:

${companyInfoSection}

Lifecycle Name: ${lifecycleName}
Lifecycle Description: ${lifecycleDescription}

Please follow these instructions:
1. Reference information from the APQC Process Classification Framework appropriate for the company's industry.
2. Create a logical structure with process categories and nested process groups.
3. Each process group should have a short description that explains its purpose.
4. Focus on processes that are highly relevant to the specific lifecycle described above.
5. Output the result as a valid JSON object in the following structure:

{
  "process_categories": [
    {
      "name": "Category Name",
      "description": "Brief description of this category",
      "score": 0,
      "process_groups": [
        {
          "name": "Process Group Name",
          "description": "Description of what this process group entails",
          "score": 0
        }
      ]
    }
  ]
}

Generate between 5-7 process categories, each containing 3-7 process groups that make the most sense for this lifecycle.
Each category and process group should include a "score" attribute initialized to 0.
Ensure your response is ONLY the valid JSON object, nothing else.
`;

  const messages = [
    { role: "system", content: "You are a business process expert specializing in organizational process design across various industries." },
    { role: "user", content: processGenerationPrompt }
  ];

  const result = await client.getChatCompletions(chatDeploymentName, messages);
  
  if (!result || !result.choices || result.choices.length === 0) {
    throw new Error("No process generation result returned from Azure OpenAI");
  }
  
  const response = result.choices[0].message?.content || "";
  
  try {
    // Extract JSON from response - this handles cases where the model might add text around the JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in the response");
    }
    
    const processesJson = JSON.parse(jsonMatch[0]);
    return processesJson;
  } catch (err) {
    console.error("Error parsing generated processes JSON:", err);
    throw new Error("Failed to parse generated processes data");
  }
}

// Function to validate the processes JSON structure
function validateProcessesJson(data: any): { valid: boolean; error?: string } {
  try {
    // Check if it's an object
    if (!data || typeof data !== 'object') {
      return { 
        valid: false, 
        error: "Generated data is not a valid object" 
      };
    }

    // Check if it has the process_categories array
    if (!Array.isArray(data.process_categories)) {
      return { 
        valid: false, 
        error: "Missing or invalid process_categories array" 
      };
    }

    // Check if each category has the required properties
    for (const category of data.process_categories) {
      if (typeof category.name !== 'string' || !category.name.trim()) {
        return { 
          valid: false, 
          error: "Category missing valid name property" 
        };
      }

      if (typeof category.score !== 'number') {
        // Initialize score to 0 if missing
        category.score = 0;
      }

      if (!Array.isArray(category.process_groups)) {
        return { 
          valid: false, 
          error: "Category missing valid process_groups array" 
        };
      }

      // Check each process group
      for (const group of category.process_groups) {
        if (typeof group.name !== 'string' || !group.name.trim()) {
          return { 
            valid: false, 
            error: "Process group missing valid name property" 
          };
        }

        if (typeof group.description !== 'string') {
          return { 
            valid: false, 
            error: "Process group missing valid description property" 
          };
        }

        if (typeof group.score !== 'number') {
          // Initialize score to 0 if missing
          group.score = 0;
        }
      }
    }

    return { valid: true };
  } catch (err) {
    return { 
      valid: false, 
      error: `Validation error: ${err instanceof Error ? err.message : String(err)}` 
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { 
      tenant_slug, 
      workspace_id, 
      scan_id, 
      lifecycle_id,
      lifecycle_name,
      lifecycle_description
    } = await req.json();

    if (!tenant_slug || !workspace_id || !scan_id || !lifecycle_id || !lifecycle_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if container is initialized
    if (!container) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Check if OpenAI client is initialized
    if (!client) {
      return NextResponse.json(
        { error: "OpenAI client not initialized. Check environment variables." },
        { status: 503 }
      );
    }

    // Get company information for this scan
    let companyInfo;
    try {
      companyInfo = await getCompanyInfoForScan(tenant_slug, workspace_id, scan_id);
      console.log(`Retrieved company info for scan ${scan_id}: ${companyInfo ? companyInfo.name : 'None found'}`);
    } catch (error) {
      console.warn("Failed to retrieve company information:", error);
      // Continue even if company info retrieval fails
      companyInfo = null;
    }

    // Find the tenant ID from the tenant slug for partition key
    const tenantQuery = `
      SELECT * FROM c 
      WHERE LOWER(c.slug) = @tenant_slug 
      AND c.id = c.tenant_id
    `;
    
    const { resources: tenants } = await container.items
      .query({
        query: tenantQuery,
        parameters: [{ name: "@tenant_slug", value: tenant_slug.toLowerCase() }],
      })
      .fetchAll();

    if (!tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const tenant_id = tenants[0].id;

    // Find the lifecycle item
    const lifecycleQuery = `
      SELECT * FROM c 
      WHERE c.id = @lifecycle_id 
      AND c.type = "lifecycle"
      AND c.scan_id = @scan_id
      AND c.workspace_id = @workspace_id
      AND c.tenant_slug = @tenant_slug
    `;
    
    const { resources: lifecycles } = await container.items
      .query({
        query: lifecycleQuery,
        parameters: [
          { name: "@lifecycle_id", value: lifecycle_id },
          { name: "@scan_id", value: scan_id },
          { name: "@workspace_id", value: workspace_id },
          { name: "@tenant_slug", value: tenant_slug },
        ],
      })
      .fetchAll();

    if (!lifecycles || lifecycles.length === 0) {
      return NextResponse.json(
        { error: "Lifecycle not found" },
        { status: 404 }
      );
    }

    // Generate processes based on lifecycle name and description
    const processesData = await generateProcesses(lifecycle_name, lifecycle_description || "", companyInfo);

    // Validate the generated processes data
    const validation = validateProcessesJson(processesData);
    if (!validation.valid) {
      console.error("Invalid processes data:", validation.error, processesData);
      return NextResponse.json(
        { error: `Failed to generate valid processes: ${validation.error}` },
        { status: 400 }
      );
    }

    // Update the lifecycle item with the generated processes
    const lifecycleItem = lifecycles[0];
    lifecycleItem.processes = processesData;
    lifecycleItem.updated_at = new Date().toISOString();
    
    // Update the item in Cosmos DB
    await container.item(lifecycleItem.id, tenant_id).replace(lifecycleItem);

    return NextResponse.json({
      success: true,
      message: "Processes generated successfully",
      lifecycle_id: lifecycle_id,
      processes: processesData
    });
  } catch (error: any) {
    console.error("POST /api/tenants/by-slug/workspaces/scans/lifecycles/generate-processes error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate processes" },
      { status: 500 }
    );
  }
} 