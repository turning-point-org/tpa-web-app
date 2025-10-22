import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { getCompanyInfoForScan } from "@/lib/documentSummary";
import { withTenantAuth } from "@/utils/tenant-auth";

// Get OpenAI settings from environment variables
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const chatDeploymentName = process.env.AZURE_OPENAI_LOW_LATENCY_CHAT_DEPLOYMENT_NAME || "gpt-5";

// Create OpenAI client
let client: OpenAIClient | null = null;

if (endpoint && apiKey) {
  client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
} else {
  console.warn('Missing Azure OpenAI environment variables. Generate scoring criteria feature will not work.');
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

export const POST = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
  try {
    const body = await req.json();
    const { tenant_slug, workspace_id, scan_id, objective_name, objective_description } = body;

    if (!tenant_slug || !workspace_id || !scan_id || !objective_name || !objective_description) {
      return NextResponse.json(
        { error: "Missing required parameters" },
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

    // Get business strategy documents for this scan
    let strategyDocs = [];
    try {
      const strategyDocsQuery = `
        SELECT * FROM c 
        WHERE c.scan_id = @scan_id 
        AND c.workspace_id = @workspace_id 
        AND c.tenant_slug = @tenant_slug 
        AND c.type = "document"
        AND c.document_type = "Business Strategy Documents"
        AND IS_DEFINED(c.summarization)
      `;
      
      const { resources: docs } = await container.items
        .query({
          query: strategyDocsQuery,
          parameters: [
            { name: "@scan_id", value: scan_id },
            { name: "@workspace_id", value: workspace_id },
            { name: "@tenant_slug", value: tenant_slug },
          ],
        })
        .fetchAll();
      
      strategyDocs = docs;
      console.log(`Found ${strategyDocs.length} business strategy documents for scan ${scan_id}`);
    } catch (error) {
      console.error("Error fetching business strategy documents:", error);
      console.log("Continuing without business strategy documents");
    }

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

    // Prepare business strategy documents context
    let strategyDocsSection = "No business strategy documents available";
    if (strategyDocs && strategyDocs.length > 0) {
      strategyDocsSection = "Business Strategy Documents:\n\n";
      strategyDocs.forEach((doc, index) => {
        strategyDocsSection += `Document ${index + 1}: ${doc.file_name || 'Unnamed document'}\n`;
        strategyDocsSection += `Summary: ${doc.summarization}\n\n`;
      });
    }

    // Create the prompt for generating scoring criteria
    const prompt = `You are an expert business consultant specializing in strategic objective evaluation. Based on the strategic objective and company context provided below, generate specific scoring criteria that define what constitutes low, medium, and high impact for this objective.

${companyInfoSection}

${lifecyclesSection}

${strategyDocsSection}

Strategic Objective:
Title: ${objective_name}
Description: ${objective_description}

For each impact level, provide:
- Low Impact (Score: 1): Describe minimal or negligible impact on this objective
- Medium Impact (Score: 2): Describe moderate or noticeable impact on this objective  
- High Impact (Score: 3): Describe significant or transformative impact on this objective

The scoring criteria should:
- Be 1-2 sentences that explain what a low, medium, and high impact looks like if this objective were achieved or addressed.  
- Be specific to the objective's context and measurable outcomes
- Use quantifiable examples where possible (e.g., % change, time reduction, cost savings)
- Be relevant to the objective's focus area (operational, financial, customer, etc.)
- Provide clear differentiation between the three impact levels
- Be actionable and realistic for business evaluation
- Consider the company's industry, size, and business lifecycles when defining impact levels
- Align with the company's strategic context and business operations

Respond only in the following JSON format:
{
  "scoring_criteria": {
    "low": "Specific description of low impact for this objective",
    "medium": "Specific description of medium impact for this objective", 
    "high": "Specific description of high impact for this objective"
  }
}`;

    const messages = [
      { role: "system", content: "You are a business strategy expert specialized in creating evaluation criteria for strategic objectives." },
      { role: "user", content: prompt }
    ];

    const result = await client.getChatCompletions(chatDeploymentName, messages);
    
    if (!result || !result.choices || result.choices.length === 0) {
      throw new Error("No completion result returned from Azure OpenAI");
    }
    
    const responseText = result.choices[0].message?.content || "";
    
    // Parse JSON response
    let scoringCriteria;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scoringCriteria = JSON.parse(jsonMatch[0]).scoring_criteria;
      } else {
        throw new Error("Could not find valid JSON in the response");
      }
    } catch (error) {
      console.error("Error parsing OpenAI response:", error);
      return NextResponse.json(
        { error: "Failed to parse scoring criteria from AI response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scoring_criteria: scoringCriteria
    });
  } catch (error: any) {
    console.error("Error generating scoring criteria:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate scoring criteria" },
      { status: 500 }
    );
  }
});
