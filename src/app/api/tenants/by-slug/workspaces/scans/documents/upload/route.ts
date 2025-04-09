import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { container } from "@/lib/cosmos";
import { uploadToBlobStorage, ensureContainerExists } from "@/lib/blobStorage";
import { processDocument } from "@/lib/openai";
import { storeEmbeddings } from "@/lib/vectordb";
import { extractTextFromFile } from "@/lib/documentParser";
import { Readable } from "stream";

export const config = {
  api: {
    bodyParser: false, // Required for handling file uploads
    responseLimit: '50mb', // Set response limit higher for file uploads
  },
};

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
        // Check if there's already a document with this type for this scan
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
          existingDocument = resources[0];
        }
      }
      
      // Generate a unique ID for the document if it's new
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
        // Update the existing document record
        const updatedDocument = {
          ...existingDocument,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
          file_type: getFileType(file.type, file.name),
          file_extension: getFileExtension(file.name),
          file_url: fileUrl.split('?')[0], // Store URL without SAS token
          updated_at: new Date().toISOString(),
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
              await storeEmbeddings(
                existingDocument.id, 
                scanId,
                existingDocument.tenant_id,
                workspaceId,
                existingDocument.document_type || documentType || "Unknown",
                file.name,
                chunks
              );
              
              console.log(`Updated embeddings for document: ${file.name}`);
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
          isReplacement: true
        });
      } else {
        // Create new document record in CosmosDB
        const documentRecord = {
          id: newDocumentId,
          scan_id: scanId,
          workspace_id: workspaceId,
          tenant_slug: tenantSlug,
          tenant_id: scanRecord.tenant_id,
          type: "document",
          document_type: documentType || "Unknown",
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
          file_type: getFileType(file.type, file.name),
          file_extension: getFileExtension(file.name),
          file_url: fileUrl.split('?')[0], // Store URL without SAS token
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
              await storeEmbeddings(
                newDocumentId, 
                scanId,
                scanRecord.tenant_id,
                workspaceId,
                documentType || "Unknown",
                file.name,
                chunks
              );
              
              console.log(`Successfully stored embeddings for document: ${file.name}`);
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