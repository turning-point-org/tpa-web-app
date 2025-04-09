import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";

// GET: Retrieve a pain points summary for a specific scan
export async function GET(req: NextRequest) {
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

    // Query for the pain points summary document
    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_points_summary" 
      AND c.scan_id = @scanId 
      AND c.workspace_id = @workspaceId 
      AND c.tenant_slug = @tenantSlug
    `;
    
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@scanId", value: scanId },
          { name: "@workspaceId", value: workspaceId },
          { name: "@tenantSlug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (resources.length === 0) {
      return NextResponse.json(
        { 
          summary: null,
          message: "No summary found"
        }
      );
    }

    return NextResponse.json({
      summary: resources[0].summary,
      updated_at: resources[0].updated_at
    });
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans/pain-points-summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pain points summary" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a summary
export async function DELETE(req: NextRequest) {
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

    // First, fetch the tenant record to get the tenant_id for partitioning
    const tenantQuery = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id`;
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
    
    const tenantId = tenantResources[0].id;

    // Query for the summary document
    const summaryQuery = `
      SELECT * FROM c 
      WHERE c.type = "pain_points_summary" 
      AND c.scan_id = @scanId 
      AND c.workspace_id = @workspaceId 
      AND c.tenant_slug = @tenantSlug
    `;
    
    const { resources: summaries } = await container.items
      .query({
        query: summaryQuery,
        parameters: [
          { name: "@scanId", value: scanId },
          { name: "@workspaceId", value: workspaceId },
          { name: "@tenantSlug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (summaries.length === 0) {
      return NextResponse.json(
        { 
          success: true,
          message: "No summary found to delete"
        }
      );
    }

    // Delete the summary
    const summary = summaries[0];
    await container.item(summary.id, tenantId).delete();
    
    console.log(`Deleted summary with ID: ${summary.id}`);

    return NextResponse.json({
      success: true,
      message: "Summary deleted successfully"
    });
  } catch (error) {
    console.error("DELETE /api/tenants/by-slug/workspaces/scans/pain-points-summary error:", error);
    return NextResponse.json(
      { error: "Failed to delete summary", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 