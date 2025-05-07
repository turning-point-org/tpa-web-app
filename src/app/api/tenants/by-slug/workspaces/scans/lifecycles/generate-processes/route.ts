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

// Function to get employee data from HRIS Reports
async function getEmployeeData(tenant_slug: string, workspace_id: string, scan_id: string): Promise<any[]> {
  if (!container) {
    throw new Error("Database connection not available");
  }
  
  const query = `
    SELECT * FROM c 
    WHERE c.scan_id = @scan_id 
    AND c.workspace_id = @workspace_id 
    AND c.tenant_slug = @tenant_slug 
    AND c.type = "document"
    AND c.document_type = "HRIS Reports"
    AND IS_DEFINED(c.employees)
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

  if (resources.length > 0 && Array.isArray(resources[0].employees) && resources[0].employees.length > 1) {
    return resources[0].employees;
  }
  
  return [];
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
    Website: ${companyInfo.website || 'Not specified'}
    Research: ${companyInfo.research || 'Not specified'}` : 
    'No company information available';

  const processGenerationPrompt = `
You are a business process expert specializing in organizational process design.

Your task is to generate a comprehensive list of process categories and their process groups that would be relevant to the following company lifecycle:

Lifecycle Name: ${lifecycleName}
Lifecycle Description: ${lifecycleDescription}

Also here is some information about the company that may help you generate the lifecycle processes:

${companyInfoSection}

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
      "process_groups": [
        {
          "name": "Process Group Name",
          "description": "Description of what this process group entails"
        }
      ]
    }
  ]
}

Generate between 5-7 process categories, each containing 3-7 process groups that make the most sense for this lifecycle.
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

// Function to suggest stakeholders for a lifecycle based on generated processes
async function suggestStakeholders(
  lifecycleName: string, 
  lifecycleDescription: string, 
  processesData: any, 
  employees: any[], 
  companyInfo: any = null
) {
  if (!client) {
    throw new Error("OpenAI client not initialized");
  }

  if (!employees || employees.length < 2) {
    return []; // Not enough employees to suggest stakeholders
  }

  const companyInfoSection = companyInfo ? 
    `Company Information:
    Name: ${companyInfo.name || 'Not specified'}
    Industry: ${companyInfo.industry || 'Not specified'}
    Country: ${companyInfo.country || 'Not specified'}
    Description: ${companyInfo.description || 'Not specified'}
    Website: ${companyInfo.website || 'Not specified'}
    Research: ${companyInfo.research || 'Not specified'}` : 
    'No company information available';

  // Format employees as JSON string but limit to relevant fields to avoid token limits
  const employeesData = employees.map(emp => ({
    id: emp.id,
    name: emp.name,
    role: emp.role || emp.title || emp.position || emp.job_title
  }));

  const stakeholderPrompt = `
You are an organizational development expert with deep knowledge of business processes and roles.

Your task is to identify the most relevant employees to serve as stakeholders for a particular business lifecycle, based on their roles and the processes involved.

Lifecycle Name: ${lifecycleName}
Lifecycle Description: ${lifecycleDescription}

Company Context:
${companyInfoSection}

The lifecycle involves the following process categories and groups:
${JSON.stringify(processesData.process_categories, null, 2)}

Available Employees:
${JSON.stringify(employeesData, null, 2)}

Please follow these instructions:
1. Review the lifecycle description and processes to understand the core functions and responsibilities.
2. Analyze the employee roles to identify those most relevant to the lifecycle.
3. Select 2-4 employees whose roles best align with the key processes in this lifecycle.
4. Select employees with roles that complement each other, representing different aspects of the lifecycle.
5. Output the result as a valid JSON array in the following structure:

[
  {
    "id": "employee_id",
    "name": "Employee Name",
    "role": "Employee Role"
  }
]

Ensure your response is ONLY the valid JSON array, nothing else.
`;

  const messages = [
    { role: "system", content: "You are an organizational development expert specializing in matching roles with business processes." },
    { role: "user", content: stakeholderPrompt }
  ];

  const result = await client.getChatCompletions(chatDeploymentName, messages);
  
  if (!result || !result.choices || result.choices.length === 0) {
    throw new Error("No stakeholder suggestion result returned from Azure OpenAI");
  }
  
  const response = result.choices[0].message?.content || "";
  
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in the stakeholder response");
    }
    
    const stakeholdersJson = JSON.parse(jsonMatch[0]);
    return stakeholdersJson;
  } catch (err) {
    console.error("Error parsing stakeholders JSON:", err);
    // Return empty array instead of throwing, to avoid breaking the main process
    return [];
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

    // Get employee data for this scan
    let employees: any[] = [];
    try {
      employees = await getEmployeeData(tenant_slug, workspace_id, scan_id);
      console.log(`Retrieved ${employees.length} employees from HRIS Reports for scan ${scan_id}`);
    } catch (error) {
      console.warn("Failed to retrieve employee data:", error);
      // Continue even if employee data retrieval fails
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
    
    // If we have enough employees, suggest stakeholders
    if (employees.length > 1) {
      try {
        const stakeholders = await suggestStakeholders(
          lifecycle_name, 
          lifecycle_description || "", 
          processesData, 
          employees, 
          companyInfo
        );
        
        if (stakeholders && stakeholders.length > 0) {
          lifecycleItem.stakeholders = stakeholders;
          console.log(`Added ${stakeholders.length} stakeholders to lifecycle ${lifecycle_id}`);
        }
      } catch (error) {
        console.warn("Failed to suggest stakeholders:", error);
        // Continue even if stakeholder suggestion fails
      }
    }
    
    lifecycleItem.updated_at = new Date().toISOString();
    
    // Update the item in Cosmos DB
    await container.item(lifecycleItem.id, tenant_id).replace(lifecycleItem);

    return NextResponse.json({
      success: true,
      message: "Processes generated successfully",
      lifecycle_id: lifecycle_id,
      processes: processesData,
      stakeholders: lifecycleItem.stakeholders || []
    });
  } catch (error: any) {
    console.error("POST /api/tenants/by-slug/workspaces/scans/lifecycles/generate-processes error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate processes" },
      { status: 500 }
    );
  }
} 