import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { searchSimilarDocuments, retrieveAllScanChunks } from "@/lib/vectordb";
import { generateEmbeddings } from "@/lib/openai";

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

// Function to summarize a document using OpenAI
async function summarizeDocument(documentType: string, fileName: string, documentContent: string, customPrompt: string = '') {
  if (!client) {
    throw new Error("OpenAI client not initialized");
  }

  const summarizationPrompt = `
Please provide a concise summary of the following document.
Document Type: ${documentType}
Document Name: ${fileName}

${customPrompt || 'Focus on key information relevant to business processes, operations, and organizational structure.'}
Limit your summary to 300-500 words highlighting only the most essential points.

Document Content:
${documentContent}
`;

  const messages = [
    { role: "system", content: "You are a business analyst who extracts and summarizes key information from business documents." },
    { role: "user", content: summarizationPrompt }
  ];

  const result = await client.getChatCompletions(chatDeploymentName, messages);
  
  if (!result || !result.choices || result.choices.length === 0) {
    throw new Error("No summary result returned from Azure OpenAI");
  }
  
  return result.choices[0].message?.content || "";
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

// Function to calculate cosine similarity between two vectors
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  try {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    // Cosine similarity formula: dot(A, B) / (|A| * |B|)
    return dotProduct / (normA * normB);
  } catch (error) {
    console.error('Error calculating cosine similarity:', error);
    return 0;
  }
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

    const completedDocuments = documents.filter(doc => doc.status === "uploaded" || doc.summary);
    
    if (completedDocuments.length === 0) {
      return NextResponse.json(
        { error: "No completed documents found for this scan. Please upload files first." },
        { status: 404 }
      );
    }

    // 2. Get document summaries
    const documentSummaries: string[] = [];
    
    // Process each document to get its vector embeddings and summary
    // First, get all the document chunk embeddings for this scan in a single query
    let allScanDocuments: Array<{text: string, embedding: number[], document_id: string}> = [];
    try {
      // Retrieve all document chunks for this scan in one query
      allScanDocuments = await retrieveAllScanChunks(scan_id);
      console.log(`Retrieved ${allScanDocuments.length} document chunks for scan ${scan_id} in a single query`);
      
      if (allScanDocuments.length === 0) {
        console.log('No document chunks found for this scan. Ensure documents have been properly vectorized.');
        return NextResponse.json(
          { 
            error: "No document chunks found for this scan. Make sure documents have been properly processed for vector search.",
            documents_count: documents.length
          },
          { status: 404 }
        );
      }
    } catch (error) {
      console.warn("Failed to retrieve document chunks in a batch. Falling back to individual queries:", error);
    }
    
    // Process each document to get its summary
    for (const doc of completedDocuments) {
      // Use the pre-computed summary if available (most common case now)
      if (doc.summary) {
        documentSummaries.push(`Document: ${doc.document_type} - ${doc.file_name || "Unnamed document"}\n${doc.summary}`);
        console.log(`Using pre-computed summary for document: ${doc.document_type}`);
        continue;
      }
      
      // If no pre-computed summary exists, generate one on-the-fly (rare case - fallback)
      console.log(`No pre-computed summary found for ${doc.document_type}. Generating on-the-fly.`);
      
      // Generate a query embedding for the document title/type
      const queryEmbedding = await generateEmbeddings(
        `Document type: ${doc.document_type}. Document name: ${doc.file_name}`
      );
      
      let similarDocuments;
      
      // If we have all documents already, filter and score them in memory
      if (allScanDocuments.length > 0) {
        // Filter chunks relevant to this document
        const relevantChunks = allScanDocuments
          .map((chunk) => {
            // Calculate cosine similarity if both embeddings exist
            const similarity = chunk.embedding && queryEmbedding ? 
                               calculateCosineSimilarity(queryEmbedding, chunk.embedding) :
                               0;
            
            return {
              text: chunk.text,
              score: similarity
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        
        similarDocuments = relevantChunks;
      } else {
        // Fall back to individual queries if batch fetching failed
        similarDocuments = await searchSimilarDocuments(
          queryEmbedding,
          scan_id,
          5 // Limit to 5 chunks per document
        );
      }
      
      // Compile the text from similar documents
      const documentContent = similarDocuments.map(d => d.text).join("\n\n");
      
      // Use the document's custom prompt if available, otherwise use default
      const customPrompt = doc.summarization_prompt || '';
      
      // Summarize the document content
      const summary = await summarizeDocument(
        doc.document_type,
        doc.file_name,
        documentContent,
        customPrompt
      );
      
      // Add the document summary to the collection
      documentSummaries.push(`Document: ${doc.document_type} - ${doc.file_name}\n${summary}`);
      
      // Update the document with the generated summary for future use
      try {
        const updatedDoc = {
          ...doc,
          summary,
          updated_at: new Date().toISOString()
        };
        
        await container.item(doc.id, tenant_id).replace(updatedDoc);
        console.log(`Updated document ${doc.id} with generated summary`);
      } catch (updateError) {
        console.error(`Failed to update document ${doc.id} with summary:`, updateError);
        // Continue with lifecycle generation even if summary update fails
      }
    }

    // 3. Generate lifecycles using OpenAI with the document summaries
    const prompt = `You are an expert business process architect with deep knowledge of the APQC Process Classification Framework (PCF). You are analyzing business documents to identify the key business lifecycles for a company.

Based on the document summaries provided, generate 3-6 business lifecycles that represent the core operational processes of the organization. These lifecycles should reflect the company's unique operating model and strategic context.

For each lifecycle:
1. Provide a clear, concise name that captures the essence of the business process
2. Write a summary description (3-5 sentences) that explains what this lifecycle encompasses, why it's important to the business, and how it aligns with the company's specific context

Your analysis should:
- Draw from APQC PCF categories such as: Develop Vision and Strategy, Develop and Manage Products/Services, Market and Sell Products/Services, Deliver Products/Services, Manage Customer Service, Develop and Manage Human Capital, Manage Information Technology, Manage Financial Resources, etc.
- Adapt these standard frameworks to match the company's unique processes evident in the documents
- Focus on end-to-end business processes that span multiple functions, not just departmental activities
- Consider both operational and management processes
- Reflect industry-specific nuances apparent in the document summaries

Here are the document summaries to analyze:

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
      { role: "system", content: "You are a business process design expert specialized in applying the APQC Process Classification Framework to identify core business lifecycles for organizations." },
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
} 