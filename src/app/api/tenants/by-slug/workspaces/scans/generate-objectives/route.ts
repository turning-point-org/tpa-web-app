import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { getCompanyInfoForScan } from "@/lib/documentSummary";

// Define types for objectives
type StrategicObjective = {
  name: string;
  description: string;
  status: "to be approved" | "approved";
};

// Get OpenAI settings from environment variables
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const chatDeploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT_NAME || "gpt-35-turbo";

// Create OpenAI client
let client: OpenAIClient | null = null;

if (endpoint && apiKey) {
  client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
} else {
  console.warn('Missing Azure OpenAI environment variables. Generate objectives feature will not work.');
}

// Function to get tenant_id from tenant_slug
async function getTenantIdFromSlug(tenantSlug: string): Promise<string> {
  // Check if container is initialized
  if (!container) {
    throw new Error("Database connection not available");
  }
  
  // Query for the tenant record using the provided slug
  const query = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id`;
  const { resources } = await container.items
    .query({
      query,
      parameters: [{ name: "@slug", value: tenantSlug.toLowerCase() }],
    })
    .fetchAll();

  if (resources.length === 0) {
    throw new Error("Tenant not found");
  }

  return resources[0].tenant_id;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_slug, workspace_id, scan_id } = body;

    if (!tenant_slug || !workspace_id || !scan_id) {
      return NextResponse.json(
        { error: "Missing tenant slug, workspace id, or scan id" },
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
        { error: "OpenAI client not initialized" },
        { status: 503 }
      );
    }

    // Get tenant_id from tenant_slug
    let tenant_id;
    try {
      tenant_id = await getTenantIdFromSlug(tenant_slug);
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to find tenant" },
        { status: 404 }
      );
    }

    // Get company information for this scan
    let companyInfo;
    try {
      companyInfo = await getCompanyInfoForScan(tenant_slug, workspace_id, scan_id);
      console.log(`Retrieved company info for scan ${scan_id}: ${companyInfo ? companyInfo.name : 'None found'}`);
      
      if (!companyInfo) {
        return NextResponse.json(
          { error: "Company information not found for this scan" },
          { status: 404 }
        );
      }
    } catch (error) {
      console.error("Failed to retrieve company information:", error);
      return NextResponse.json(
        { error: "Failed to retrieve company information" },
        { status: 500 }
      );
    }

    // Get all lifecycles for this scan
    const lifecyclesQuery = `
      SELECT * FROM c 
      WHERE c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "lifecycle"
      ORDER BY c.position ASC
    `;
    
    const { resources: lifecycles } = await container.items
      .query({
        query: lifecyclesQuery,
        parameters: [
          { name: "@scan_id", value: scan_id },
          { name: "@workspace_id", value: workspace_id },
          { name: "@tenant_slug", value: tenant_slug },
        ],
      })
      .fetchAll();

    // Prepare context for the OpenAI prompt
    const companyInfoSection = companyInfo ? 
      `Company Information:
      Name: ${companyInfo.name || 'Not specified'}
      Industry: ${companyInfo.industry || 'Not specified'}
      Country: ${companyInfo.country || 'Not specified'}
      Description: ${companyInfo.description || 'Not specified'}
      Website: ${companyInfo.website || 'Not specified'}` : 
      'No company information available';

    // Prepare lifecycles context
    let lifecyclesSection = "No business lifecycles available";
    if (lifecycles && lifecycles.length > 0) {
      lifecyclesSection = "Business Lifecycles:\n";
      lifecycles.forEach((lifecycle, index) => {
        lifecyclesSection += `${index + 1}. ${lifecycle.name}\n`;
        lifecyclesSection += `   Description: ${lifecycle.description}\n\n`;
      });
    }

    // Create the prompt for generating strategic objectives
    const prompt = `You are an expert business consultant specializing in creating strategic objectives for organizations. Based on the company information and business lifecycles provided below, generate 4-8 strategic objectives for this organization.

${companyInfoSection}

${lifecyclesSection}

For each strategic objective:
1. Provide a clear, concise name that captures the essence of the objective
2. Write a description (2-4 sentences) that explains what this objective aims to achieve, why it's important, and how it aligns with the company's specific context, industry, and business lifecycles.

Your objectives should:
- Be specific, measurable, achievable, relevant, and time-bound (SMART)
- Align with the company's business lifecycles and core operations
- Address various aspects of the business (operational excellence, customer experience, innovation, growth, etc.)
- Consider industry-specific challenges and opportunities
- Be appropriate for the company's size, location, and maturity level
- Each objective MUST have a unique name that is clear and descriptive

Respond in the following JSON format only:
{
  "objectives": [
    {
      "name": "Objective Name",
      "description": "Objective description",
      "status": "to be approved"
    },
    ...
  ]
}`;

    const messages = [
      { role: "system", content: "You are a business strategy expert specialized in creating strategic objectives for organizations in various industries." },
      { role: "user", content: prompt }
    ];

    const result = await client.getChatCompletions(chatDeploymentName, messages);
    
    if (!result || !result.choices || result.choices.length === 0) {
      throw new Error("No completion result returned from Azure OpenAI");
    }
    
    const responseText = result.choices[0].message?.content || "";
    
    // Parse JSON response
    let objectives: StrategicObjective[];
    try {
      // Find the JSON part in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        objectives = JSON.parse(jsonMatch[0]).objectives;
      } else {
        throw new Error("Could not find valid JSON in the response");
      }
    } catch (error) {
      console.error("Error parsing OpenAI response:", error);
      return NextResponse.json(
        { error: "Failed to parse objectives from AI response" },
        { status: 500 }
      );
    }

    // Ensure all objectives have unique names
    const objectiveNames = new Set<string>();
    const uniqueObjectives = objectives.filter(obj => {
      if (objectiveNames.has(obj.name)) {
        return false;
      }
      objectiveNames.add(obj.name);
      return true;
    });

    // Update the company_info record with the new strategic objectives
    companyInfo.strategic_objectives = uniqueObjectives;
    companyInfo.updated_at = new Date().toISOString();

    await container
      .item(companyInfo.id, companyInfo.tenant_id)
      .replace(companyInfo);

    return NextResponse.json({
      success: true,
      objectives: uniqueObjectives
    });
  } catch (error: any) {
    console.error("Error generating strategic objectives:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate strategic objectives" },
      { status: 500 }
    );
  }
} 