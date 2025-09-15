import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";

import { withTenantAuth } from "@/utils/tenant-auth";
// PUT: Update strategic objectives in company info record
export const PUT = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
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

    if (!container) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 }
      );
    }

    // Fetch the existing company info record
    const query = `SELECT * FROM c WHERE c.scan_id = @scan_id AND c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND c.type = "company_info"`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (resources.length === 0) {
      return NextResponse.json(
        { error: "Company information not found" },
        { status: 404 }
      );
    }

    const companyInfo = resources[0];
    const body = await req.json();
    const { strategic_objectives } = body;

    if (!Array.isArray(strategic_objectives)) {
      return NextResponse.json(
        { error: "Invalid strategic_objectives data" },
        { status: 400 }
      );
    }

    // Update the company info record with strategic objectives
    companyInfo.strategic_objectives = strategic_objectives;
    companyInfo.updated_at = new Date().toISOString();

    const { resource } = await container
      .item(companyInfo.id, companyInfo.tenant_id)
      .replace(companyInfo);

    return NextResponse.json(resource);
  } catch (error) {
    console.error("PUT /api/tenants/by-slug/workspaces/scans/strategic-objectives error:", error);
    return NextResponse.json(
      { error: "Failed to update strategic objectives" },
      { status: 500 }
    );
  }
});

// GET: Retrieve strategic objectives from company info record
export const GET = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
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

    if (!container) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 }
      );
    }

    // Fetch the company info record for this scan
    const query = `SELECT * FROM c WHERE c.scan_id = @scan_id AND c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND c.type = "company_info"`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (resources.length === 0) {
      return NextResponse.json(
        { error: "Company information not found" },
        { status: 404 }
      );
    }

    const companyInfo = resources[0];
    
    // If strategic_objectives doesn't exist yet, return an empty array
    const strategic_objectives = companyInfo.strategic_objectives || [];

    return NextResponse.json(strategic_objectives);
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans/strategic-objectives error:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategic objectives" },
      { status: 500 }
    );
  }
}); 