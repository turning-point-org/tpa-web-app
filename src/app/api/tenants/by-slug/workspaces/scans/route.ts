import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";
import { deleteAllScanChunks } from "@/lib/vectordb";
import { 
  REQUIRED_DOCUMENT_TYPES, 
  DEFAULT_PROMPTS, 
  DOCUMENT_AGENT_ROLES, 
  DOCUMENT_DESCRIPTIONS,
  DocumentType 
} from "@/lib/document-config";

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

// GET: Return all scans for a workspace
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("id");

    if (!tenantSlug || !workspaceId) {
      return NextResponse.json(
        { error: "Missing tenant slug or workspace id" },
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

    if (scanId) {
      // Return a single scan
      const query = `SELECT * FROM c WHERE c.id = @id AND c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND c.type = "scan"`;
      const { resources } = await container.items
        .query({
          query,
          parameters: [
            { name: "@id", value: scanId },
            { name: "@workspace_id", value: workspaceId },
            { name: "@tenant_slug", value: tenantSlug },
          ],
        })
        .fetchAll();

      if (resources.length === 0) {
        return NextResponse.json(
          { error: "Scan not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(resources[0]);
    } else {
      // Return all scans for this workspace
      const query = `SELECT * FROM c WHERE c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND c.type = "scan"`;
      const { resources: scans } = await container.items
        .query({
          query,
          parameters: [
            { name: "@workspace_id", value: workspaceId },
            { name: "@tenant_slug", value: tenantSlug },
          ],
        })
        .fetchAll();

      return NextResponse.json(scans);
    }
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scans" },
      { status: 500 }
    );
  }
}

// POST: Create a new scan
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");

    if (!tenantSlug || !workspaceId) {
      return NextResponse.json(
        { error: "Missing tenant slug or workspace id" },
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

    const body = await req.json();
    const name = body.name?.trim();
    const description = body.description?.trim() || "";
    const status = body.status || "pending";
    const website = body.website?.trim() || "";
    const country = body.country?.trim() || "";
    const industry = body.industry?.trim() || "";

    if (!name) {
      return NextResponse.json(
        { error: "Scan name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate scan names within this workspace
    const query = `SELECT * FROM c WHERE c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND LOWER(c.name) = @name AND c.type = "scan"`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
          { name: "@name", value: name.toLowerCase() },
        ],
      })
      .fetchAll();

    if (resources.length > 0) {
      return NextResponse.json(
        { error: "Scan with this name already exists" },
        { status: 409 }
      );
    }

    // Get the tenant_id (UUID) for partitioning
    const tenant_id = await getTenantIdFromSlug(tenantSlug);

    // Create the scan record
    const newScanId = uuidv4();
    const newScan = {
      id: newScanId,
      type: "scan",
      name,
      description,
      status,
      tenant_slug: tenantSlug,
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      tenant_id,  // Use the UUID instead of the slug
      website,
      country,
      industry,
    };

    const { resource: createdScan } = await container.items.create(newScan);

    // Create placeholder document records
    const placeholderDocuments = [];
    let placeholdersCreated = 0;
    
    try {
      for (const docType of REQUIRED_DOCUMENT_TYPES) {
        const defaultPrompt = DEFAULT_PROMPTS[docType] || "Summarize the key information from this document.";
        const description = DOCUMENT_DESCRIPTIONS[docType] || "";
        
        const placeholderId = uuidv4();
        const placeholderDocument = {
          id: placeholderId,
          type: "document",
          document_type: docType,
          description: description,
          scan_id: newScanId,
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          status: "placeholder",
          summarization_prompt: defaultPrompt,
          summarization: "No summary available yet. Upload a document to generate a summary.",
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          tenant_id, // Use the UUID instead of the slug
          document_agent_role: DOCUMENT_AGENT_ROLES[docType] || ""
        };
        
        const { resource: createdPlaceholder } = await container.items.create(placeholderDocument);
        placeholderDocuments.push(createdPlaceholder);
        placeholdersCreated++;
      }
      
      console.log(`Created ${placeholdersCreated} placeholder documents for scan ${newScanId}`);
      
      // Create default company_info record
      try {
        const companyInfoId = uuidv4();
        const defaultCompanyInfo = {
          id: companyInfoId,
          scan_id: newScanId,
          workspace_id: workspaceId,
          tenant_slug: tenantSlug,
          tenant_id, // Use the same tenant_id as the scan
          type: "company_info",
          name: name, // Use the scan name as the default company name
          website: website || "",
          country: country || "",
          industry: industry || "",
          description: description || "",
          research: "Ora has done no company research yet.",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await container.items.create(defaultCompanyInfo);
        console.log(`Created default company_info record for scan ${newScanId}`);
      } catch (companyInfoError) {
        // Log the error but don't fail the scan creation
        console.error("Error creating default company_info record:", companyInfoError);
      }
    } catch (placeholderError) {
      // Log the error but don't fail the scan creation
      console.error("Error creating placeholder documents:", placeholderError);
    }

    return NextResponse.json(createdScan);
  } catch (error) {
    console.error("POST /api/tenants/by-slug/workspaces/scans error:", error);
    return NextResponse.json(
      { error: "Failed to create scan: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

// DELETE: Delete a scan
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("id");

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

    // Fetch the scan to delete
    const query = `SELECT * FROM c WHERE c.id = @id AND c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND c.type = "scan"`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (!resources.length) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 }
      );
    }
    
    const scan = resources[0];
    
    // First, delete all related items that have this scan_id
    const relatedItemsQuery = `SELECT * FROM c WHERE c.scan_id = @scan_id AND c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug`;
    const { resources: relatedItems } = await container.items
      .query({
        query: relatedItemsQuery,
        parameters: [
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();
    
    // Delete all related items
    const deletionPromises = relatedItems.map(item => 
      container?.item(item.id, item.tenant_id).delete()
    );
    
    await Promise.all(deletionPromises);
    
    // Also delete all chunks from the vector database (RAG container)
    let vectorDbDeleteSuccess = false;
    try {
      await deleteAllScanChunks(scanId);
      vectorDbDeleteSuccess = true;
    } catch (vectorDbError) {
      console.error("Error deleting vector database chunks:", vectorDbError);
      // Continue with deleting the scan even if vector DB deletion fails
    }
    
    // Then delete the scan itself
    await container.item(scan.id, scan.tenant_id).delete();
    
    return NextResponse.json({ 
      success: true,
      message: `Deleted scan, ${relatedItems.length} related items, and ${vectorDbDeleteSuccess ? 'all vector embeddings' : 'failed to delete vector embeddings'}`
    });
  } catch (error) {
    console.error("DELETE /api/tenants/by-slug/workspaces/scans error:", error);
    return NextResponse.json(
      { error: "Failed to delete scan" },
      { status: 500 }
    );
  }
}

// PATCH: Update a scan
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("id");

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

    const body = await req.json();
    const name = body.name?.trim();
    const description = body.description?.trim() || "";
    const status = body.status || "pending";
    const website = body.website?.trim() || "";
    const country = body.country?.trim() || "";
    const industry = body.industry?.trim() || "";

    if (!name) {
      return NextResponse.json(
        { error: "Scan name is required" },
        { status: 400 }
      );
    }

    // First, fetch the scan to update
    const query = `SELECT * FROM c WHERE c.id = @id AND c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND c.type = "scan"`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (!resources.length) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 }
      );
    }
    const scan = resources[0];

    // Check for duplicate scan names within this workspace (excluding current scan)
    const dupQuery = `SELECT * FROM c WHERE c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND LOWER(c.name) = @name AND c.id != @id AND c.type = "scan"`;
    const { resources: existing } = await container.items
      .query({
        query: dupQuery,
        parameters: [
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
          { name: "@name", value: name.toLowerCase() },
          { name: "@id", value: scanId },
        ],
      })
      .fetchAll();

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Scan with this name already exists" },
        { status: 409 }
      );
    }

    scan.name = name;
    scan.description = description;
    scan.status = status;
    scan.website = website;
    scan.country = country;
    scan.industry = industry;

    const { resource } = await container
      .item(scan.id, scan.tenant_id)
      .replace(scan);
    return NextResponse.json(resource);
  } catch (error) {
    console.error("PATCH /api/tenants/by-slug/workspaces/scans error:", error);
    return NextResponse.json(
      { error: "Failed to update scan" },
      { status: 500 }
    );
  }
} 