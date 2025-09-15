import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";

import { withTenantAuth } from "@/utils/tenant-auth";
// GET: Retrieve scenario planning data for a scan
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

    // Check if container is initialized
    if (!container) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // First fetch the scan details
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

    if (scanResources.length === 0) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 }
      );
    }

    const scanData = scanResources[0];

    // Check if scenario planning data exists for this scan
    const scenarioQuery = `
      SELECT * FROM c 
      WHERE c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "scenario_planning"
    `;
    
    const { resources: scenarioResources } = await container.items
      .query({
        query: scenarioQuery,
        parameters: [
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    // Fetch company information for this scan
    const companyQuery = `
      SELECT * FROM c 
      WHERE c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "company_info"
    `;
    
    const { resources: companyResources } = await container.items
      .query({
        query: companyQuery,
        parameters: [
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    // Return combined data
    return NextResponse.json({
      scan: scanData,
      scenarioPlanning: scenarioResources.length > 0 ? scenarioResources[0] : null,
      companyInfo: companyResources.length > 0 ? companyResources[0] : null
    });
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans/scenario-planning error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scenario planning data" },
      { status: 500 }
    );
  }
}); 