import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { generateSasToken, deleteFromBlobStorage } from "@/lib/blobStorage";
import { deleteDocumentChunks } from "@/lib/vectordb";

// Import the container name for consistency in path parsing
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const documentType = searchParams.get("document_type");

    if (!tenantSlug || !workspaceId || !scanId) {
      return NextResponse.json(
        { error: "Missing tenant slug, workspace id, or scan id" },
        { status: 400 }
      );
    }

    // Check if container is initialized
    if (!container) {
      console.error("Database connection not available. Check COSMOS_DB_ENDPOINT and COSMOS_DB_KEY environment variables.");
      return NextResponse.json(
        { error: "Database connection not available. Check environment variables." },
        { status: 503 }
      );
    }

    // Query to find documents for this scan
    let query = `
      SELECT * FROM c 
      WHERE c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "document"
    `;
    
    const queryParams = [
      { name: "@scan_id", value: scanId },
      { name: "@workspace_id", value: workspaceId },
      { name: "@tenant_slug", value: tenantSlug },
    ];

    // If document type is specified, filter by that too
    if (documentType) {
      query += " AND c.document_type = @document_type";
      queryParams.push({ name: "@document_type", value: documentType });
    }

    try {
      // Execute the query
      const { resources: documents } = await container.items
        .query({
          query,
          parameters: queryParams,
        })
        .fetchAll();

      // If no documents found, return empty array instead of processing further
      if (!documents || documents.length === 0) {
        return NextResponse.json([]);
      }

      // Generate fresh SAS tokens for each document URL
      const documentsWithSas = [];
      
      for (const doc of documents) {
        try {
          // Skip if file_url is missing
          if (!doc.file_url) {
            console.warn(`Document ${doc.id} has no file_url, skipping SAS generation`);
            documentsWithSas.push({
              ...doc,
              created_at: doc.created_at || new Date().toISOString(),
              updated_at: doc.updated_at || new Date().toISOString(),
              uploaded_at: doc.created_at || new Date().toISOString()
            });
            continue;
          }
          
          // Extract the blob name from the file_url
          const blobPath = doc.file_url.split('?')[0];
          
          // Make sure tenantSlug is in the path - if not, handle gracefully
          let blobName;
          if (blobPath.includes(`${doc.tenant_slug}/`)) {
            blobName = `${doc.tenant_slug}/${blobPath.split(`${doc.tenant_slug}/`)[1]}`;
          } else {
            // Fallback if path doesn't include tenant slug
            blobName = blobPath.split('/').slice(-3).join('/');
          }
          
          // Generate a fresh SAS token
          const sasUrl = generateSasToken(blobName);
          documentsWithSas.push({
            ...doc,
            file_url: sasUrl,
            // Ensure consistent date format
            created_at: doc.created_at || new Date().toISOString(),
            updated_at: doc.updated_at || new Date().toISOString(),
            // Add an explicitly named upload date field
            uploaded_at: doc.created_at || new Date().toISOString()
          });
        } catch (docError) {
          console.error("Error processing document:", docError);
          // Include the document even if SAS generation fails, just without updating the URL
          documentsWithSas.push({
            ...doc,
            created_at: doc.created_at || new Date().toISOString(),
            updated_at: doc.updated_at || new Date().toISOString(),
            uploaded_at: doc.created_at || new Date().toISOString()
          });
        }
      }

      return NextResponse.json(documentsWithSas);
    } catch (queryError) {
      console.error("Error querying documents:", queryError);
      return NextResponse.json(
        { error: "Error querying documents from database" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans/documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const documentId = searchParams.get("document_id");

    if (!tenantSlug || !workspaceId || !scanId || !documentId) {
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

    // First check if document exists
    const query = `
      SELECT * FROM c 
      WHERE c.id = @document_id
      AND c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "document"
    `;
    
    const { resources: documents } = await container.items
      .query({
        query,
        parameters: [
          { name: "@document_id", value: documentId },
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const document = documents[0];
    
    try {
      // Extract the blob name from the file_url to delete the file from blob storage
      if (document.file_url) {
        // The file_url stored in Cosmos DB doesn't include SAS token
        const blobPath = document.file_url.split('?')[0]; // Remove any query parameters if present
        
        // Extract the path after the container name
        // URL format is like: https://storageaccount.blob.core.windows.net/containername/path/to/blob
        const urlParts = blobPath.split('/');
        const containerIndex = urlParts.findIndex((part: string) => part === containerName);
        let blobName;
        
        if (containerIndex !== -1 && containerIndex < urlParts.length - 1) {
          // If container name is in the URL, extract everything after it
          blobName = urlParts.slice(containerIndex + 1).join('/');
        } else {
          // Otherwise try to parse the expected format: tenant/workspace/scan/document.ext
          blobName = `${tenantSlug}/${workspaceId}/${scanId}/${documentId}.${document.file_url.split('.').pop()}`;
        }
        
        // Delete the blob from Azure Storage
        await deleteFromBlobStorage(blobName);
      }
    } catch (blobError) {
      console.error("Failed to delete blob from storage:", blobError);
      // Continue with updating the document record even if blob deletion fails
    }
    
    // Also remove embeddings from the vector database
    try {
      await deleteDocumentChunks(documentId, scanId);
      console.log(`Removed embeddings for document ${documentId}`);
    } catch (embeddingError) {
      console.error("Failed to remove document embeddings:", embeddingError);
      // Continue even if embedding deletion fails
    }
    
    // Instead of deleting the document, reset it to placeholder state
    // Preserve the document_type and summarization_prompt
    const documentType = document.document_type;
    const summarizationPrompt = document.summarization_prompt;
    
    // Update the document in CosmosDB
    const resetDocument = {
      ...document,
      status: "placeholder",
      file_name: undefined, // Remove filename
      file_url: undefined,  // Remove file URL
      file_size: undefined, // Remove file size
      file_type: undefined, // Remove file type
      content_type: undefined, // Remove content type
      summary: undefined, // Remove summary
      // Explicitly keep the summarization_prompt if it exists
      summarization_prompt: summarizationPrompt || undefined,
      summarization: "No summary available yet. Upload a document to generate a summary.",
      updated_at: new Date().toISOString()
    };
    
    // If this is an HRIS Reports document, reset the employees array
    if (documentType === "HRIS Reports") {
      console.log(`Resetting employees data for HRIS Reports document ${documentId}`);
      resetDocument.employees = [];
    }
    
    // Remove undefined fields (they would be stored as null otherwise)
    Object.keys(resetDocument).forEach(key => {
      if (resetDocument[key] === undefined) {
        delete resetDocument[key];
      }
    });
    
    console.log(`Preserving summarization_prompt for document ${documentId}: ${summarizationPrompt}`);
    
    // Update the document in CosmosDB
    await container.item(documentId, document.tenant_id).replace(resetDocument);

    return NextResponse.json({
      success: true,
      message: "Document reset to placeholder state"
    });
  } catch (error) {
    console.error("DELETE /api/tenants/by-slug/workspaces/scans/documents error:", error);
    return NextResponse.json(
      { error: "Failed to reset document" },
      { status: 500 }
    );
  }
} 