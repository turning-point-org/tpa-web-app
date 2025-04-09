import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { generateSasToken, deleteFromBlobStorage } from "@/lib/blobStorage";
import { removeEmbeddings } from "@/lib/vectordb";

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

    // Execute the query
    const { resources: documents } = await container.items
      .query({
        query,
        parameters: queryParams,
      })
      .fetchAll();

    // Generate fresh SAS tokens for each document URL
    const documentsWithSas = documents.map(doc => {
      // Extract the blob name from the file_url
      const blobPath = doc.file_url.split('?')[0].split(`${doc.tenant_slug}/`)[1];
      const blobName = `${doc.tenant_slug}/${blobPath}`;
      
      // Generate a fresh SAS token
      try {
        const sasUrl = generateSasToken(blobName);
        return {
          ...doc,
          file_url: sasUrl,
          // Ensure consistent date format
          created_at: doc.created_at || new Date().toISOString(),
          updated_at: doc.updated_at || new Date().toISOString(),
          // Add an explicitly named upload date field
          uploaded_at: doc.created_at || new Date().toISOString()
        };
      } catch (error) {
        console.error("Error generating SAS token:", error);
        return doc;
      }
    });

    return NextResponse.json(documentsWithSas);
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans/documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
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
      // Continue with deleting the document record even if blob deletion fails
    }
    
    // Delete the document from CosmosDB
    await container.item(documentId, document.tenant_id).delete();

    // Also remove embeddings from the vector database
    try {
      await removeEmbeddings(documentId);
      console.log(`Removed embeddings for document ${documentId}`);
    } catch (embeddingError) {
      console.error("Failed to remove document embeddings:", embeddingError);
      // Continue even if embedding deletion fails
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully"
    });
  } catch (error) {
    console.error("DELETE /api/tenants/by-slug/workspaces/scans/documents error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
} 