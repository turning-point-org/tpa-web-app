import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";

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

// GET endpoint to fetch a transcription
export const GET = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const lifecycleId = searchParams.get("lifecycle_id");

    if (!tenantSlug || !workspaceId || !scanId || !lifecycleId) {
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

    // Query for the transcription record
    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_point_transcription" 
      AND c.tenant_slug = @tenantSlug
      AND c.workspace_id = @workspaceId
      AND c.scan_id = @scanId
      AND c.lifecycle_id = @lifecycleId
    `;

    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@tenantSlug", value: tenantSlug },
          { name: "@workspaceId", value: workspaceId },
          { name: "@scanId", value: scanId },
          { name: "@lifecycleId", value: lifecycleId }
        ]
      })
      .fetchAll();

    if (resources.length === 0) {
      return NextResponse.json(
        { message: "No transcription found for this lifecycle" },
        { status: 404 }
      );
    }

    // Return the most recent transcription if multiple exist
    const sortedResources = resources.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    // Add cache control headers to prevent caching
    return NextResponse.json(sortedResources[0], {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error("Error fetching transcription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch transcription" },
      { status: 500 }
    );
  }
});

// POST endpoint to create or update a transcription
export const POST = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
  try {
    const body = await req.json();
    const { transcription, tenantSlug, workspaceId, scanId, lifecycleId } = body;

    if (!transcription || !tenantSlug || !workspaceId || !scanId || !lifecycleId) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
      tenant_id = await getTenantIdFromSlug(tenantSlug);
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to find tenant" },
        { status: 404 }
      );
    }

    // Query for existing transcription
    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_point_transcription" 
      AND c.tenant_slug = @tenantSlug
      AND c.workspace_id = @workspaceId
      AND c.scan_id = @scanId
      AND c.lifecycle_id = @lifecycleId
    `;

    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@tenantSlug", value: tenantSlug },
          { name: "@workspaceId", value: workspaceId },
          { name: "@scanId", value: scanId },
          { name: "@lifecycleId", value: lifecycleId }
        ]
      })
      .fetchAll();

    const timestamp = new Date().toISOString();

    if (resources.length > 0) {
      // Update existing record
      const existingItem = resources[0];
      existingItem.transcription = transcription;
      existingItem.updated_at = timestamp;

      await container.item(existingItem.id, tenant_id).replace(existingItem);
      return NextResponse.json({ 
        success: true, 
        message: "Transcription updated successfully",
        id: existingItem.id
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
      // Create new record
      const newId = uuidv4();
      const newItem = {
        id: newId,
        tenant_id,
        type: "pain_point_transcription",
        tenant_slug: tenantSlug,
        workspace_id: workspaceId,
        scan_id: scanId,
        lifecycle_id: lifecycleId,
        transcription,
        created_at: timestamp,
        updated_at: timestamp
      };

      await container.items.create(newItem);
      return NextResponse.json({ 
        success: true, 
        message: "Transcription created successfully",
        id: newId
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
  } catch (error: any) {
    console.error("Error saving transcription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save transcription" },
      { status: 500 }
    );
  }
});

// DELETE endpoint to remove a transcription
export const DELETE = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const lifecycleId = searchParams.get("lifecycle_id");

    if (!tenantSlug || !workspaceId || !scanId || !lifecycleId) {
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
      const tenantQuery = `
        SELECT * FROM c 
        WHERE c.type = "tenant" 
        AND LOWER(c.slug) = @slug 
        AND c.id = c.tenant_id
      `;
      
      const { resources: tenantResources } = await container.items
        .query({
          query: tenantQuery,
          parameters: [{ name: "@slug", value: tenantSlug.toLowerCase() }],
        })
        .fetchAll();
      
      if (tenantResources.length === 0) {
        return NextResponse.json(
          { error: "Tenant not found" },
          { status: 404 }
        );
      }
      
      tenant_id = tenantResources[0].id;
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to find tenant" },
        { status: 500 }
      );
    }

    // Query for the transcription record
    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_point_transcription" 
      AND c.tenant_slug = @tenantSlug
      AND c.workspace_id = @workspaceId
      AND c.scan_id = @scanId
      AND c.lifecycle_id = @lifecycleId
    `;

    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@tenantSlug", value: tenantSlug },
          { name: "@workspaceId", value: workspaceId },
          { name: "@scanId", value: scanId },
          { name: "@lifecycleId", value: lifecycleId }
        ]
      })
      .fetchAll();

    if (resources.length === 0) {
      return NextResponse.json(
        { message: "No transcription found to delete" },
        { status: 404 }
      );
    }

    // Delete all matching records
    for (const item of resources) {
      await container.item(item.id, tenant_id).delete();
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${resources.length} transcription record(s)`
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error("Error deleting transcription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete transcription" },
      { status: 500 }
    );
  }
}); 