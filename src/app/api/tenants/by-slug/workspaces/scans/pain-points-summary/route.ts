import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";

import { withTenantAuth } from "@/utils/tenant-auth";
// Define the PainPoint interface
interface PainPoint {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  score?: number;
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

// GET endpoint to fetch a summary
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

    // Query for the summary record
    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_point_summary" 
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
        { message: "No summary found for this lifecycle" },
        { status: 404 }
      );
    }

    // Return the most recent summary if multiple exist
    const sortedResources = resources.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    // Normalize the structure to ensure pain_points is used
    let result = sortedResources[0];
    
    // Handle transition: if has painPoints but not pain_points, copy it
    if (result.painPoints && !result.pain_points) {
      result.pain_points = result.painPoints;
    }
    
    // Add cache control headers to prevent caching
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error("Error fetching summary:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch summary" },
      { status: 500 }
    );
  }
});

// POST endpoint to create or update a summary
export const POST = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
  try {
    const body = await req.json();
    const { summary, tenantSlug, workspaceId, scanId, lifecycleId } = body;

    if (!summary || !tenantSlug || !workspaceId || !scanId || !lifecycleId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update property name if using the old format
    let updatedSummary = summary;
    if (summary.painPoints && !summary.pain_points) {
      updatedSummary = {
        ...summary,
        pain_points: summary.painPoints
      };
      // Delete the old property
      delete updatedSummary.painPoints;
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

    // Query for existing summary
    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_point_summary" 
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
      
      // Handle transition from painPoints to pain_points
      if (existingItem.painPoints && !existingItem.pain_points) {
        // Create the new field, keep the old one temporarily for backward compatibility
        existingItem.pain_points = updatedSummary.pain_points || existingItem.painPoints;
      } else {
        // Just update with new field
        existingItem.pain_points = updatedSummary.pain_points;
      }
      
      // If there's still the old property, keep it updated for backward compatibility
      if ('painPoints' in existingItem) {
        existingItem.painPoints = updatedSummary.pain_points;
      }
      
      // Update other fields
      if (updatedSummary.summary) existingItem.summary = updatedSummary.summary;
      if (updatedSummary.overallSummary) existingItem.overallSummary = updatedSummary.overallSummary;
      existingItem.updated_at = timestamp;

      await container.item(existingItem.id, tenant_id).replace(existingItem);
      return NextResponse.json({ 
        success: true, 
        message: "Summary updated successfully",
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
        type: "pain_point_summary",
        tenant_slug: tenantSlug,
        workspace_id: workspaceId,
        scan_id: scanId,
        lifecycle_id: lifecycleId,
        pain_points: updatedSummary.pain_points || [],
        overallSummary: updatedSummary.overallSummary || "",
        summary: updatedSummary.summary, // Keep for backward compatibility if present
        created_at: timestamp,
        updated_at: timestamp
      };

      await container.items.create(newItem);
      return NextResponse.json({ 
        success: true, 
        message: "Summary created successfully",
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
    console.error("Error saving summary:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save summary" },
      { status: 500 }
    );
  }
});

// DELETE endpoint to remove a summary
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
      tenant_id = await getTenantIdFromSlug(tenantSlug);
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to find tenant" },
        { status: 404 }
      );
    }

    // Query for the summary record
    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_point_summary" 
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
        { message: "No summary found to delete" },
        { status: 404 }
      );
    }

    // Delete all matching records
    for (const item of resources) {
      await container.item(item.id, tenant_id).delete();
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${resources.length} summary record(s)`
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error("Error deleting summary:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete summary" },
      { status: 500 }
    );
  }
}); 