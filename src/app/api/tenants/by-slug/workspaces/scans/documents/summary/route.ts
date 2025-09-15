import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";

import { withTenantAuth } from "@/utils/tenant-auth";
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
    const {
      tenant_slug,
      workspace_id,
      scan_id,
      document_type,
      document_id,
      summary,
    } = body;

    if (!tenant_slug || !workspace_id || !scan_id || !document_id) {
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

    // Find document by id
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
          { name: "@document_id", value: document_id },
          { name: "@scan_id", value: scan_id },
          { name: "@workspace_id", value: workspace_id },
          { name: "@tenant_slug", value: tenant_slug },
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
    
    // Update the document with the new summary
    const updatedDocument = {
      ...document,
      summary,
      updated_at: new Date().toISOString(),
    };
    
    // Update the document in Cosmos DB
    await container.item(document.id, tenant_id).replace(updatedDocument);
    
    return NextResponse.json({
      success: true,
      message: "Summary updated successfully",
      document: {
        id: updatedDocument.id,
        document_type: updatedDocument.document_type,
        summary: updatedDocument.summary,
      },
    });
    
  } catch (error) {
    console.error("POST /api/tenants/by-slug/workspaces/scans/documents/summary error:", error);
    return NextResponse.json(
      { error: "Failed to update document summary", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}); 