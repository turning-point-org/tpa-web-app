import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { container } from "@/lib/cosmos";
import { uploadToBlobStorage, ensureContainerExists } from "@/lib/blobStorage";
import { processDocument } from "@/lib/openai";
import { storeDocumentChunks } from "@/lib/vectordb";
import { extractTextFromFile } from "@/lib/documentParser";
import { Readable } from "stream";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";

export const config = {
  api: {
    bodyParser: false, // Required for handling file uploads
    responseLimit: '50mb', // Set response limit higher for file uploads
  },
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
  console.warn('Missing Azure OpenAI environment variables. Document summarization feature will not work.');
}

// Function to buffer the file stream
async function bufferFile(readable: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  return Buffer.concat(chunks);
}

// Function to parse multipart/form-data
async function parseFormData(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const documentType = formData.get('documentType') as string | null;
  const existingDocumentId = formData.get('documentId') as string | null; // Get document ID if replacing
  
  if (!file) {
    throw new Error('No file provided');
  }
  
  return { file, documentType, existingDocumentId };
}

// Add a helper function to get a friendly file type description
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function getFileType(contentType: string, filename: string): string {
  const extension = getFileExtension(filename);
  
  // Map of content types to friendly names
  const contentTypeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/csv': 'CSV',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel'
  };
  
  // If we have a direct mapping, use it
  if (contentType in contentTypeMap) {
    return contentTypeMap[contentType];
  }
  
  // Fallbacks based on extension if content-type is not recognized
  const extensionMap: Record<string, string> = {
    'pdf': 'PDF',
    'csv': 'CSV',
    'xls': 'Excel',
    'xlsx': 'Excel'
  };
  
  if (extension in extensionMap) {
    return extensionMap[extension];
  }
  
  // If we can't determine the type, return the raw content type
  return contentType;
}

// Add a helper function to determine if embeddings should be generated for this file type
function shouldProcessForEmbeddings(contentType: string): boolean {
  const supportedTypes = [
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword"
  ];
  return supportedTypes.includes(contentType);
}

// Function to summarize a document using OpenAI
async function summarizeDocument(documentType: string, fileName: string, documentContent: string, customPrompt: string) {
  if (!client) {
    throw new Error("OpenAI client not initialized");
  }

  // Use the custom prompt if provided, otherwise use a default prompt
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

// Function to get or create summarization prompt
async function getSummarizationPrompt(tenantSlug: string, workspaceId: string, scanId: string, documentType: string) {
  // Try to find document settings with a summarization prompt
  const query = `
    SELECT * FROM c 
    WHERE c.scan_id = @scan_id 
    AND c.workspace_id = @workspace_id 
    AND c.tenant_slug = @tenant_slug 
    AND ((c.type = "document_settings" AND c.document_type = @document_type) 
         OR (c.type = "document" AND c.document_type = @document_type))
  `;
  
  if (!container) {
    throw new Error("Database connection not available");
  }
  
  const { resources } = await container.items
    .query({
      query,
      parameters: [
        { name: "@scan_id", value: scanId },
        { name: "@workspace_id", value: workspaceId },
        { name: "@tenant_slug", value: tenantSlug },
        { name: "@document_type", value: documentType },
      ],
    })
    .fetchAll();
  
  // Check for any document or settings with a prompt
  const defaultPrompts: Record<string, string> = {
    "HRIS Reports": "Focus on extracting key information about employee roles, departments, reporting structures, and headcount metrics. Identify organizational patterns and employee distribution.",
    "Business Strategy Documents": "Extract the company's mission, vision, strategic goals, key performance indicators, and priority initiatives. Focus on timeframes and success metrics.",
    "Financial Documents": "Summarize major expense categories, cost centers, budget allocations, and spending patterns. Highlight significant financial insights and trends.",
    "Technology Roadmaps": "Identify current technology systems, planned implementations, integration points, and timelines. Focus on strategic technology initiatives and dependencies.",
    "Pain Points": "Identify key challenges, obstacles, and pain points mentioned across the organization. Focus on operational bottlenecks, process inefficiencies, and areas of improvement."
  };
  
  // First check for document_settings
  for (const resource of resources) {
    if (resource.type === 'document_settings' && resource.summarization_prompt) {
      return resource.summarization_prompt;
    }
  }
  
  // Then check for document with prompt
  for (const resource of resources) {
    if (resource.type === 'document' && resource.summarization_prompt) {
      return resource.summarization_prompt;
    }
  }
  
  // If not found, return default prompt based on document type
  return defaultPrompts[documentType] || 
    "Provide a comprehensive summary of this document, focusing on key information relevant to business processes, operations, and organizational structure.";
}

// Add document record interface with required fields
interface DocumentRecord {
  id: string;
  tenant_id: string;
  type: string;
  tenant_slug: string;
  workspace_id: string;
  scan_id: string;
  document_type: string;
  file_name: string;
  file_size: number;
  content_type: string;
  file_type: string;
  file_extension: string;
  file_url: string;
  created_at: string;
  updated_at: string;
  summary?: string;
  summarization?: string;
  summarization_prompt?: string;
  status: string;
}

export async function POST(req: NextRequest) {
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

    // First, verify that the scan exists
    const scanQuery = `SELECT * FROM c WHERE c.id = @id AND c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND c.type = "scan"`;
    const { resources: scanResources } = await container.items
      .query({
        query: scanQuery,
        parameters: [
          { name: "@id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (!scanResources.length) {
      return NextResponse.json(
        { error: "Parent scan not found" },
        { status: 404 }
      );
    }
    const scanRecord = scanResources[0];
    
    try {
      // Parse the multipart/form-data request
      const { file, documentType, existingDocumentId } = await parseFormData(req);
      
      // Check if this is a replacement (update) or a new document
      let existingDocument = null;
      
      if (existingDocumentId) {
        // Find the existing document to update
        const { resources } = await container.items
          .query({
            query: "SELECT * FROM c WHERE c.id = @id AND c.scan_id = @scan_id AND c.type = 'document'",
            parameters: [
              { name: "@id", value: existingDocumentId },
              { name: "@scan_id", value: scanId },
            ],
          })
          .fetchAll();
        
        if (resources.length > 0) {
          existingDocument = resources[0];
        }
      } else if (documentType) {
        // Find an existing document with this type for this scan (either a placeholder or a previously uploaded one)
        const { resources } = await container.items
          .query({
            query: "SELECT * FROM c WHERE c.scan_id = @scan_id AND c.document_type = @document_type AND c.type = 'document'",
            parameters: [
              { name: "@scan_id", value: scanId },
              { name: "@document_type", value: documentType },
            ],
          })
          .fetchAll();
        
        if (resources.length > 0) {
          // Use the existing document (placeholder or previous upload)
          existingDocument = resources[0];
          console.log(`Found existing document/placeholder for type ${documentType}: ${existingDocument.id}`);
        }
      }
      
      // Generate a unique ID for the document if no existing document was found
      // This should rarely happen since placeholders are created during scan creation
      const newDocumentId = existingDocument ? existingDocument.id : uuidv4();
      const fileExtension = file.name.split('.').pop() || 'pdf';
      const blobName = `${tenantSlug}/${workspaceId}/${scanId}/${newDocumentId}.${fileExtension}`;
      
      // Ensure the blob storage container exists
      await ensureContainerExists();
      
      // Convert the file to a Buffer
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      
      // Upload the file to Azure Blob Storage
      const fileUrl = await uploadToBlobStorage(
        fileBuffer,
        blobName,
        file.type
      );
      
      if (existingDocument) {
        // Update the existing document record (could be a placeholder or previous upload)
        const updatedDocument: DocumentRecord = {
          ...existingDocument,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
          file_type: getFileType(file.type, file.name),
          file_extension: getFileExtension(file.name),
          file_url: fileUrl.split('?')[0], // Store URL without SAS token
          updated_at: new Date().toISOString(),
          status: "uploaded", // Update status from pending to uploaded
        };
        
        // Process the updated document for embeddings if it's a supported type
        if (shouldProcessForEmbeddings(file.type)) {
          try {
            console.log(`Starting embedding generation for document: ${file.name} (${file.type})`);
            
            // Extract text from document
            const text = await extractTextFromFile(fileBuffer, file.type);
            
            if (text) {
              console.log(`Successfully extracted ${text.length} characters of text from document`);
              console.log(`Generating embeddings using Azure OpenAI (${process.env.AZURE_OPENAI_DEPLOYMENT_NAME})`);
              
              // Process document with OpenAI to generate embeddings
              const chunks = await processDocument(text);
              console.log(`Generated embeddings for ${chunks.length} chunks`);
              
              // Store embeddings in Cosmos DB vector container
              console.log(`Storing embeddings in Cosmos DB (${process.env.COSMOS_DB_RAG_CONTAINER})`);
              await storeDocumentChunks(
                chunks,
                existingDocument.id, 
                scanId
              );
              
              console.log(`Updated embeddings for document: ${file.name}`);
              
              // Generate document summary using custom prompt
              try {
                const summarizationPrompt = await getSummarizationPrompt(
                  tenantSlug, 
                  workspaceId, 
                  scanId, 
                  documentType || existingDocument.document_type
                );
                
                const documentContent = chunks.map(chunk => chunk.text).join("\n\n");
                const summary = await summarizeDocument(
                  documentType || existingDocument.document_type,
                  file.name,
                  documentContent,
                  summarizationPrompt
                );
                
                // Add summary to the updated document
                updatedDocument.summary = summary;
                updatedDocument.summarization = summary;
                updatedDocument.summarization_prompt = summarizationPrompt;
                
                console.log(`Generated summary for document: ${file.name}`);
              } catch (summaryError) {
                console.error("Error generating document summary:", summaryError);
                // Don't fail if summarization fails
              }
            } else {
              console.log(`Failed to extract text from ${file.name} (${file.type})`);
            }
          } catch (err) {
            // Log but don't fail the upload if embedding generation fails
            console.error("Error updating embeddings:", err);
          }
        }
        
        const { resource } = await container.item(existingDocument.id, existingDocument.tenant_id)
          .replace(updatedDocument);
        
        return NextResponse.json({
          id: resource?.id || existingDocument.id,
          document_type: resource?.document_type || existingDocument.document_type,
          file_name: resource?.file_name || file.name,
          file_url: fileUrl, // Return URL with SAS token
          uploaded_at: resource?.updated_at || updatedDocument.updated_at,
          summary: updatedDocument.summary,
          summarization: updatedDocument.summarization,
          isReplacement: true
        });
      } else {
        // Create the new document record in Cosmos DB
        const documentRecord: DocumentRecord = {
          id: newDocumentId,
          tenant_id: scanRecord.tenant_id, // Use the scan's tenant_id for consistency
          type: "document",
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          document_type: documentType || 'Unknown',
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
          file_type: getFileType(file.type, file.name),
          file_extension: getFileExtension(file.name),
          file_url: fileUrl.split('?')[0], // Store URL without SAS token
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "uploaded"
        };

        const { resource } = await container.items.create(documentRecord, {
          partitionKey: scanRecord.tenant_id,
        } as any);

        // Process the document for embeddings if it's a supported type
        if (shouldProcessForEmbeddings(file.type)) {
          try {
            console.log(`Starting embedding generation for document: ${file.name} (${file.type})`);
            
            // Extract text from document
            const text = await extractTextFromFile(fileBuffer, file.type);
            
            if (text) {
              console.log(`Successfully extracted ${text.length} characters of text from document`);
              console.log(`Generating embeddings using Azure OpenAI (${process.env.AZURE_OPENAI_DEPLOYMENT_NAME})`);
              
              // Process document with OpenAI to generate embeddings
              const chunks = await processDocument(text);
              console.log(`Generated embeddings for ${chunks.length} chunks`);
              
              // Store embeddings in Cosmos DB vector container
              console.log(`Storing embeddings in Cosmos DB (${process.env.COSMOS_DB_RAG_CONTAINER})`);
              await storeDocumentChunks(
                chunks,
                newDocumentId, 
                scanId
              );
              
              console.log(`Stored embeddings for document: ${file.name}`);
              
              // Generate document summary using custom prompt
              try {
                const summarizationPrompt = await getSummarizationPrompt(
                  tenantSlug, 
                  workspaceId, 
                  scanId, 
                  documentType || 'Unknown'
                );
                
                const documentContent = chunks.map(chunk => chunk.text).join("\n\n");
                const summary = await summarizeDocument(
                  documentType || 'Unknown',
                  file.name,
                  documentContent,
                  summarizationPrompt
                );
                
                // Add summary to the document record
                documentRecord.summary = summary;
                documentRecord.summarization = summary;
                documentRecord.summarization_prompt = summarizationPrompt;
                
                console.log(`Generated summary for document: ${file.name}`);
              } catch (summaryError) {
                console.error("Error generating document summary:", summaryError);
                // Don't fail if summarization fails
              }
            } else {
              console.log(`Failed to extract text from ${file.name} (${file.type})`);
            }
          } catch (err) {
            // Log but don't fail the upload if embedding generation fails
            console.error("Error generating embeddings:", err);
          }
        } else {
          console.log(`Skipping embeddings for unsupported file type: ${file.type}`);
        }

        return NextResponse.json({
          id: resource?.id || newDocumentId,
          document_type: resource?.document_type || documentRecord.document_type,
          file_name: resource?.file_name || documentRecord.file_name,
          file_url: fileUrl, // Return URL with SAS token
          uploaded_at: resource?.created_at || documentRecord.created_at,
          summary: documentRecord.summary,
          summarization: documentRecord.summarization,
          isNew: true
        });
      }
    } catch (err: any) {
      console.error("Error processing file upload:", err);
      return NextResponse.json(
        { error: err.message || "Error processing file upload" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("POST /api/tenants/by-slug/workspaces/scans/documents/upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
} 