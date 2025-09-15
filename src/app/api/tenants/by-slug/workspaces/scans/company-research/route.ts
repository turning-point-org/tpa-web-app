import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";

import { withTenantAuth } from "@/utils/tenant-auth";
// Get OpenAI settings from environment variables
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const chatDeploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT_NAME || "gpt-35-turbo";

// Create OpenAI client
let client: OpenAIClient | null = null;

if (endpoint && apiKey) {
  client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
} else {
  console.warn('Missing Azure OpenAI environment variables. Company research feature will not work.');
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

// Function to generate company research
async function generateCompanyResearch(companyInfo: any): Promise<string> {
  if (!client) {
    throw new Error("OpenAI client not initialized");
  }

  const companyResearchPrompt = `
Act as an expert business analyst specializing in company research and corporate profiling. Your task is to discover, summarize, and organize detailed information about a specific company using publicly available sources such as their website, press releases, investor reports, and other online content. Present your findings clearly under the following high-level sections:

Company Overview
Company History & Milestones
Industry & Market Position
Size & Structure
Products & Services
Recent News & Strategic Initiatives
Customer Support Insights
Resources & Process Documentation
Quality Certifications or Standards

Here's information about the company to research:
Name: ${companyInfo.name}
Website: ${companyInfo.website || 'Not provided'}
Country: ${companyInfo.country || 'Not provided'}
Industry: ${companyInfo.industry || 'Not provided'}
Description: ${companyInfo.description || 'Not provided'}

Please provide a comprehensive research analysis between 500-800 words.
`;

  const messages = [
    { role: "system", content: "You are an expert business analyst specializing in company research and corporate profiling." },
    { role: "user", content: companyResearchPrompt }
  ];

  const result = await client.getChatCompletions(chatDeploymentName, messages);
  
  if (!result || !result.choices || result.choices.length === 0) {
    throw new Error("No research result returned from Azure OpenAI");
  }
  
  return result.choices[0].message?.content || "No research could be generated at this time.";
}

export const POST = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");

    if (!tenantSlug || !workspaceId || !scanId) {
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
        { error: "OpenAI client not initialized. Check environment variables." },
        { status: 503 }
      );
    }

    // Get company information for this scan
    const companyInfo = await getCompanyInfoForScan(tenantSlug, workspaceId, scanId);
    
    if (!companyInfo) {
      return NextResponse.json(
        { error: "Company information not found" },
        { status: 404 }
      );
    }

    // Generate research based on company info
    const research = await generateCompanyResearch(companyInfo);

    // Update the company info record with the research
    companyInfo.research = research;
    companyInfo.updated_at = new Date().toISOString();
    
    // Update the item in Cosmos DB
    await container.item(companyInfo.id, companyInfo.tenant_id).replace(companyInfo);

    return NextResponse.json({
      success: true,
      message: "Company research generated successfully",
      research: research
    });
  } catch (error: any) {
    console.error("POST /api/tenants/by-slug/workspaces/scans/company-research error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate company research" },
      { status: 500 }
    );
  }
}); 