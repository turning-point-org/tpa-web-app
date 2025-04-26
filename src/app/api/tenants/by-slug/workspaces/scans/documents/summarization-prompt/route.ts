import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { searchSimilarDocuments, retrieveAllScanChunks } from "@/lib/vectordb";
import { generateEmbeddings } from "@/lib/openai";
import { summarizeDocument, getCompanyInfoForScan, calculateCosineSimilarity } from "@/lib/documentSummary";

// Get OpenAI settings from environment variables
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const chatDeploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT_NAME || "gpt-35-turbo";

// Create OpenAI client
let client: OpenAIClient | null = null;

if (endpoint && apiKey) {
  client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
} else {
  console.warn('Missing Azure OpenAI environment variables. Document summarization feature will not work.');
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
    const {
      tenant_slug,
      workspace_id,
      scan_id,
      document_type,
      document_id,
      summarization_prompt,
    } = body;

    if (!tenant_slug || !workspace_id || !scan_id || !document_type) {
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

    // Find document by type if no document_id provided, or by id if provided
    let query = `
      SELECT * FROM c 
      WHERE c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "document"
    `;
    
    const queryParams = [
      { name: "@scan_id", value: scan_id },
      { name: "@workspace_id", value: workspace_id },
      { name: "@tenant_slug", value: tenant_slug },
    ];

    if (document_id) {
      query += " AND c.id = @document_id";
      queryParams.push({ name: "@document_id", value: document_id });
    } else if (document_type) {
      query += " AND c.document_type = @document_type";
      queryParams.push({ name: "@document_type", value: document_type });
    }

    const { resources: documents } = await container.items
      .query({
        query,
        parameters: queryParams,
      })
      .fetchAll();

    // If we have a document, update its summarization prompt
    if (documents.length > 0) {
      const document = documents[0];
      
      // Update the document with the new summarization prompt
      const updatedDocument = {
        ...document,
        summarization_prompt,
        updated_at: new Date().toISOString(),
      };
      
      // If a file is already uploaded, generate a new summary
      if (document.file_url) {
        // Check if document is already processed and has chunks
        const queryEmbedding = await generateEmbeddings(
          `Document type: ${document.document_type}. Document name: ${document.file_name}`
        );
        
        // Get company information for this scan
        let companyInfo = null;
        try {
          companyInfo = await getCompanyInfoForScan(tenant_slug, workspace_id, scan_id);
          console.log(`Retrieved company info for scan ${scan_id}: ${companyInfo ? companyInfo.name : 'None found'}`);
        } catch (error) {
          console.warn("Failed to retrieve company information:", error);
          // Continue even if company info retrieval fails
        }
        
        // Search for similar document chunks
        let similarDocuments = await searchSimilarDocuments(
          queryEmbedding,
          scan_id,
          5 // Limit to 5 chunks
        );
        
        // Filter document chunks to only include those from this specific document
        // First, retrieve all chunks for this scan
        const allScanDocuments = await retrieveAllScanChunks(scan_id);
        
        // Filter to only include chunks from the specific document we're summarizing
        const documentChunks = allScanDocuments.filter(chunk => chunk.document_id === document.id);
        
        if (documentChunks.length === 0) {
          console.log(`No document chunks found for document ${document.id}. Using general search results.`);
          // Use the general search results if no document-specific chunks found
        } else {
          console.log(`Found ${documentChunks.length} chunks specific to document ${document.id}.`);
          
          // Calculate relevance scores for document-specific chunks
          const scoredChunks = documentChunks
            .map((chunk: {text: string, embedding: number[]}) => {
              const similarity = chunk.embedding && queryEmbedding ? 
                                calculateCosineSimilarity(queryEmbedding, chunk.embedding) :
                                0;
              
              return {
                text: chunk.text,
                score: similarity
              };
            })
            .sort((a: {score: number}, b: {score: number}) => b.score - a.score)
            .slice(0, 5);
          
          // Use document-specific chunks instead of general search results
          similarDocuments = scoredChunks;
        }
        
        // Compile the text from document chunks
        const documentContent = similarDocuments.map(d => d.text).join("\n\n");
        
        // Summarize the document content with the new custom prompt
        const summary = await summarizeDocument(
          document.document_type,
          document.file_name,
          documentContent,
          summarization_prompt,
          companyInfo,
          document.document_agent_role || ''
        );
        
        // Update the document with the new summary
        updatedDocument.summary = summary;
      }
      
      // Update the document in Cosmos DB
      await container.item(document.id, tenant_id).replace(updatedDocument);
      
      return NextResponse.json({
        success: true,
        message: "Summarization prompt updated successfully",
        document: {
          id: updatedDocument.id,
          document_type: updatedDocument.document_type,
          summarization_prompt: updatedDocument.summarization_prompt,
          summary: updatedDocument.summary,
        },
      });
    } else {
      // If document doesn't exist yet, store the prompt for future use
      
      // First check if document settings already exist for this document type
      const settingsQuery = `
        SELECT * FROM c 
        WHERE c.scan_id = @scan_id 
        AND c.workspace_id = @workspace_id 
        AND c.tenant_slug = @tenant_slug 
        AND c.type = "document_settings"
        AND c.document_type = @document_type
      `;
      
      const { resources: existingSettings } = await container.items
        .query({
          query: settingsQuery,
          parameters: [
            { name: "@scan_id", value: scan_id },
            { name: "@workspace_id", value: workspace_id },
            { name: "@tenant_slug", value: tenant_slug },
            { name: "@document_type", value: document_type },
          ],
        })
        .fetchAll();
      
      if (existingSettings.length > 0) {
        // Update existing settings
        const existingSetting = existingSettings[0];
        const updatedSettings = {
          ...existingSetting,
          summarization_prompt,
          updated_at: new Date().toISOString(),
        };
        
        await container.item(existingSetting.id, tenant_id).replace(updatedSettings);
        
        return NextResponse.json({
          success: true,
          message: "Summarization prompt updated successfully",
          settings: {
            document_type,
            summarization_prompt,
          },
        });
      } else {
        // Create new settings
        const newPromptSettings = {
          id: document_id || `prompt-${document_type.replace(/\s+/g, '-').toLowerCase()}-${scan_id}`,
          tenant_id,
          type: "document_settings",
          tenant_slug,
          workspace_id,
          scan_id,
          document_type,
          summarization_prompt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await container.items.create(newPromptSettings);
        
        return NextResponse.json({
          success: true,
          message: "Summarization prompt saved for future document",
          settings: {
            document_type,
            summarization_prompt,
          },
        });
      }
    }
  } catch (error: any) {
    console.error("Error updating summarization prompt:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update summarization prompt" },
      { status: 500 }
    );
  }
} 