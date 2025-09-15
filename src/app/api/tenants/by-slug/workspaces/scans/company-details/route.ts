import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";

import { withTenantAuth } from "@/utils/tenant-auth";
// GET: Retrieve company information for a scan
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

    return NextResponse.json(resources[0]);
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans/company-details error:", error);
    return NextResponse.json(
      { error: "Failed to fetch company information" },
      { status: 500 }
    );
  }
});

// POST: Create company information for a scan
export const POST = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
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

    // Check if company info already exists for this scan
    const existingQuery = `SELECT * FROM c WHERE c.scan_id = @scan_id AND c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND c.type = "company_info"`;
    const { resources: existingResources } = await container.items
      .query({
        query: existingQuery,
        parameters: [
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (existingResources.length > 0) {
      return NextResponse.json(
        { error: "Company information already exists for this scan" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const { name, website, country, industry, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const companyInfoId = uuidv4();
    const newCompanyInfo = {
      id: companyInfoId,
      scan_id: scanId,
      workspace_id: workspaceId,
      tenant_slug: tenantSlug,
      tenant_id: scanRecord.tenant_id,
      type: "company_info",
      name,
      website: website || "",
      country: country || "",
      industry: industry || "",
      description: description || "",
      research: "Ora has done no company research yet.",
      strategic_objectives: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { resource } = await container.items.create(newCompanyInfo, {
      partitionKey: scanRecord.tenant_id,
    } as any);

    return NextResponse.json(resource);
  } catch (error) {
    console.error("POST /api/tenants/by-slug/workspaces/scans/company-details error:", error);
    return NextResponse.json(
      { error: "Failed to create company information" },
      { status: 500 }
    );
  }
});

// PATCH: Update company information for a scan
export const PATCH = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
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
    const { name, website, country, industry, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    // Update the company info record
    companyInfo.name = name;
    companyInfo.website = website || "";
    companyInfo.country = country || "";
    companyInfo.industry = industry || "";
    companyInfo.description = description || "";
    // preserve existing research field - don't update it here
    companyInfo.updated_at = new Date().toISOString();

    const { resource } = await container
      .item(companyInfo.id, companyInfo.tenant_id)
      .replace(companyInfo);

    return NextResponse.json(resource);
  } catch (error) {
    console.error("PATCH /api/tenants/by-slug/workspaces/scans/company-details error:", error);
    return NextResponse.json(
      { error: "Failed to update company information" },
      { status: 500 }
    );
  }
});

// DELETE: Delete company information for a scan
export const DELETE = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
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

    // Fetch the company info record to delete
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
    await container.item(companyInfo.id, companyInfo.tenant_id).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tenants/by-slug/workspaces/scans/company-details error:", error);
    return NextResponse.json(
      { error: "Failed to delete company information" },
      { status: 500 }
    );
  }
}); 