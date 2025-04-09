import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";

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

    // First, fetch the parent workspace to ensure it exists and get its tenant_id
    const workspaceQuery = `SELECT * FROM c WHERE c.id = @id AND c.tenant_slug = @tenant_slug AND c.type = "workspace"`;
    const { resources: workspaceResources } = await container.items
      .query({
        query: workspaceQuery,
        parameters: [
          { name: "@id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (!workspaceResources.length) {
      return NextResponse.json(
        { error: "Parent workspace not found" },
        { status: 404 }
      );
    }
    const workspaceRecord = workspaceResources[0];

    // Check for duplicate scan names within this workspace
    const dupQuery = `SELECT * FROM c WHERE c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND LOWER(c.name) = @name AND c.type = "scan"`;
    const { resources: existing } = await container.items
      .query({
        query: dupQuery,
        parameters: [
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
          { name: "@name", value: name.toLowerCase() },
        ],
      })
      .fetchAll();

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Scan with this name already exists" },
        { status: 409 }
      );
    }

    const scan_id = uuidv4();
    const newScan = {
      id: scan_id,
      workspace_id: workspaceId,
      tenant_slug: tenantSlug,
      tenant_id: workspaceRecord.tenant_id,
      name,
      description,
      type: "scan",
      status,
      website,
      country,
      industry,
      created_at: new Date().toISOString(),
    };

    const { resource } = await container.items.create(newScan, {
      partitionKey: workspaceRecord.tenant_id,
    } as any);

    return NextResponse.json(resource);
  } catch (error) {
    console.error("POST /api/tenants/by-slug/workspaces/scans error:", error);
    return NextResponse.json(
      { error: "Failed to create scan" },
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
    await container.item(scan.id, scan.tenant_id).delete();
    return NextResponse.json({ success: true });
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