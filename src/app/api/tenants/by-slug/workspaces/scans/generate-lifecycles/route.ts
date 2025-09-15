import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { getCompanyInfoForScan } from "@/lib/documentSummary";

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
  console.warn('Missing Azure OpenAI environment variables. Generate lifecycles feature will not work.');
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
    } catch (error) {
      console.warn("Failed to retrieve company information:", error);
      // Continue even if company info retrieval fails
      companyInfo = null;
    }

    // 1. Get all documents for this scan
    const documentsQuery = `
      SELECT * FROM c 
      WHERE c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "document"
      AND (c.file_url <> '' OR c.summary <> '')
    `;
    
    const { resources: documents } = await container.items
      .query({
        query: documentsQuery,
        parameters: [
          { name: "@scan_id", value: scan_id },
          { name: "@workspace_id", value: workspace_id },
          { name: "@tenant_slug", value: tenant_slug },
        ],
      })
      .fetchAll();

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "No valid documents found for this scan" },
        { status: 404 }
      );
    }

    // Filter out document placeholders without files or with status="placeholder"
    const completedDocuments = documents.filter(doc => 
      (doc.status === "uploaded" || doc.file_url) && 
      doc.status !== "placeholder"
    );
    
    if (completedDocuments.length === 0) {
      return NextResponse.json(
        { error: "No uploaded documents found for this scan. Please upload files first." },
        { status: 404 }
      );
    }

    // Check how many documents already have summaries
    const noSummaryPlaceholder = "No summary available yet. Upload a document to generate a summary.";
    const documentsWithSummaries = completedDocuments.filter(doc => 
      (doc.summary && doc.summary !== noSummaryPlaceholder) || 
      (doc.summarization && doc.summarization !== noSummaryPlaceholder)
    );
    
    console.log(`Found ${documentsWithSummaries.length} documents with valid summaries out of ${completedDocuments.length} uploaded documents.`);

    // Require a minimum number of documents with summaries to proceed
    if (documentsWithSummaries.length < 1) {
      return NextResponse.json(
        { 
          error: "Not enough documents with summaries found. Please ensure documents are uploaded and properly summarized first.",
          documents_count: completedDocuments.length,
          documents_with_summaries: documentsWithSummaries.length 
        },
        { status: 400 }
      );
    }

    // 2. Get document summaries - only use pre-existing ones
    const documentSummaries: string[] = [];
    
    // Use all the pre-computed summaries
    for (const doc of documentsWithSummaries) {
      // Use summary field if available, otherwise use summarization field
      const summaryText = doc.summary || doc.summarization;
      documentSummaries.push(`Document: ${doc.document_type} - ${doc.file_name || "Unnamed document"}\n${summaryText}`);
      console.log(`Using pre-computed summary for document: ${doc.document_type}`);
    }
    
    // Skip documents without summaries
    const skippedDocs = completedDocuments.length - documentsWithSummaries.length;
    if (skippedDocs > 0) {
      console.warn(`Skipping ${skippedDocs} documents without valid summaries.`);
    }

    // 3. Generate lifecycles using OpenAI with the document summaries
    const companyInfoSection = companyInfo ? 
      `Company Information:
      Name: ${companyInfo.name || 'Not specified'}
      Industry: ${companyInfo.industry || 'Not specified'}
      Country: ${companyInfo.country || 'Not specified'}
      Description: ${companyInfo.description || 'Not specified'}
      Website: ${companyInfo.website || 'Not specified'}` : 
      'No company information available';

    const prompt = `You are an expert business process architect with deep knowledge of the APQC Process Classification Framework (PCF). You are analyzing business documents to identify the key business lifecycles for the following company:

${companyInfoSection}

Based on this company information and the document summaries provided below, generate 3-6 business lifecycles that represent the core operational processes of the organization. These lifecycles should reflect the company's unique operating model and strategic context.

For each lifecycle:
1. Provide a clear, concise name that captures the essence of the business process
2. Write a summary description (3-5 sentences) that explains what this lifecycle encompasses, why it's important to the business, and how it aligns with the company's specific context and industry.

Your analysis should:
- Draw from APQC PCF categories.
- Adapt these standard frameworks to match the company's unique processes evident in the documents and the type of industry the company is in.
- Focus on end-to-end business processes that span multiple functions, not just departmental activities
- Consider both operational and management processes
- Reflect industry-specific nuances apparent in the document summaries

Here are the document summaries to assist with your analysis:

${documentSummaries.join("\n\n========\n\n")}

Respond in the following JSON format only:
{
  "lifecycles": [
    {
      "name": "Lifecycle Name",
      "description": "Lifecycle description"
    },
    ...
  ]
}`;

    const messages = [
      { role: "system", content: "You are a business process design expert specialized in applying the APQC Process Classification Framework to identify core business lifecycles for organizations specific to their industry." },
      { role: "user", content: prompt }
    ];

    const result = await client.getChatCompletions(chatDeploymentName, messages);
    
    if (!result || !result.choices || result.choices.length === 0) {
      throw new Error("No completion result returned from Azure OpenAI");
    }
    
    const responseText = result.choices[0].message?.content || "";
    
    // Parse JSON response
    let lifecycles;
    try {
      // Find the JSON part in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        lifecycles = JSON.parse(jsonMatch[0]).lifecycles;
      } else {
        throw new Error("Could not find valid JSON in the response");
      }
    } catch (error) {
      console.error("Error parsing OpenAI response:", error);
      return NextResponse.json(
        { error: "Failed to parse lifecycles from AI response" },
        { status: 500 }
      );
    }

    // 4. Delete any existing lifecycles for this scan
    const deleteExistingLifecyclesQuery = `
      SELECT * FROM c 
      WHERE c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "lifecycle"
    `;
    
    const { resources: existingLifecycles } = await container.items
      .query({
        query: deleteExistingLifecyclesQuery,
        parameters: [
          { name: "@scan_id", value: scan_id },
          { name: "@workspace_id", value: workspace_id },
          { name: "@tenant_slug", value: tenant_slug },
        ],
      })
      .fetchAll();
    
    // Delete each existing lifecycle
    for (const lifecycle of existingLifecycles) {
      await container.item(lifecycle.id, tenant_id).delete();
    }

    // 5. Save lifecycles to Cosmos DB
    const savedLifecycles = [];
    
    for (let i = 0; i < lifecycles.length; i++) {
      const lifecycle = lifecycles[i];
      const lifecycleId = uuidv4();
      
      const lifecycleItem = {
        id: lifecycleId,
        tenant_id,  // Add tenant_id as partition key
        type: "lifecycle",
        tenant_slug,
        workspace_id,
        scan_id,
        name: lifecycle.name,
        description: lifecycle.description,
        position: i,  // Add position based on array index
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Save to Cosmos DB, passing tenant_id as partition key
      await container.items.create(lifecycleItem);
      savedLifecycles.push(lifecycleItem);
    }

    return NextResponse.json({
      success: true,
      lifecycles: savedLifecycles
    });
  } catch (error: any) {
    console.error("Error generating lifecycles:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate lifecycles" },
      { status: 500 }
    );
  }
}); 