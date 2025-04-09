import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";

// GET: Return all workspaces for the tenant identified by the slug query parameter.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("id");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "Missing tenant slug" },
        { status: 400 }
      );
    }

    if (workspaceId) {
      // Return the single workspace.
      const query = `SELECT * FROM c WHERE c.id = @id AND c.tenant_slug = @tenant_slug AND c.type = "workspace"`;
      const { resources } = await container.items
        .query({
          query,
          parameters: [
            { name: "@id", value: workspaceId },
            { name: "@tenant_slug", value: tenantSlug },
          ],
        })
        .fetchAll();

      if (resources.length === 0) {
        return NextResponse.json(
          { error: "Workspace not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(resources[0]);
    } else {
      // Return all workspaces for this tenant.
      const query = `SELECT * FROM c WHERE c.tenant_slug = @tenant_slug AND c.type = "workspace"`;
      const { resources: workspaces } = await container.items
        .query({
          query,
          parameters: [{ name: "@tenant_slug", value: tenantSlug }],
        })
        .fetchAll();

      return NextResponse.json(workspaces);
    }
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}

// POST: Create a new workspace for the tenant.
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "Missing tenant slug" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const name = body.name?.trim();
    const description = body.description?.trim() || "";

    if (!name) {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate workspace names (case-insensitive) for this tenant.
    const dupQuery = `SELECT * FROM c WHERE c.tenant_slug = @tenant_slug AND LOWER(c.name) = @name AND NOT IS_DEFINED(c.type)`;
    const { resources: existing } = await container.items
      .query({
        query: dupQuery,
        parameters: [
          { name: "@tenant_slug", value: tenantSlug },
          { name: "@name", value: name.toLowerCase() },
        ],
      })
      .fetchAll();

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Workspace with this name already exists" },
        { status: 409 }
      );
    }

    // Fetch parent tenant record to get tenant_id.
    const tenantQuery = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id AND NOT IS_DEFINED(c.type)`;
    const { resources: tenantResources } = await container.items
      .query({
        query: tenantQuery,
        parameters: [{ name: "@slug", value: tenantSlug.toLowerCase() }],
      })
      .fetchAll();

    if (!tenantResources.length) {
      return NextResponse.json(
        { error: "Parent tenant not found" },
        { status: 404 }
      );
    }
    const tenantRecord = tenantResources[0];

    const workspace_id = uuidv4();
    const newWorkspace = {
      id: workspace_id,
      tenant_slug: tenantSlug,
      tenant_id: tenantRecord.tenant_id,
      name,
      description,
      type: "workspace", // Explicitly set type
      created_at: new Date().toISOString(), // Add creation timestamp
    };

    const { resource } = await container.items.create(newWorkspace, {
      partitionKey: tenantRecord.tenant_id,
    } as any);

    return NextResponse.json(resource);
  } catch (error) {
    console.error("POST /api/tenants/by-slug/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}

// PATCH: Update an existing workspace's name and description.
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("id");

    if (!tenantSlug || !workspaceId) {
      return NextResponse.json(
        { error: "Missing tenant slug or workspace id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const newName = body.name?.trim();
    const newDescription = body.description?.trim() || "";

    if (!newName) {
      return NextResponse.json(
        { error: "New workspace name is required" },
        { status: 400 }
      );
    }

    // Fetch the workspace to update.
    const query = `SELECT * FROM c WHERE c.id = @id AND c.tenant_slug = @tenant_slug`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (!resources.length) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }
    const workspace = resources[0];
    workspace.name = newName;
    workspace.description = newDescription;

    // Replace the item using the parent's tenant_id as partition key.
    const { resource } = await container
      .item(workspace.id, workspace.tenant_id)
      .replace(workspace);
    return NextResponse.json(resource);
  } catch (error) {
    console.error("PATCH /api/tenants/by-slug/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to update workspace" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a workspace.
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("id");

    if (!tenantSlug || !workspaceId) {
      return NextResponse.json(
        { error: "Missing tenant slug or workspace id" },
        { status: 400 }
      );
    }

    // Fetch the workspace to delete.
    const query = `SELECT * FROM c WHERE c.id = @id AND c.tenant_slug = @tenant_slug`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (!resources.length) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }
    const workspace = resources[0];

    // First, delete all scans belonging to this workspace
    const scansQuery = `SELECT * FROM c WHERE c.workspace_id = @workspace_id AND c.tenant_slug = @tenant_slug AND c.type = "scan"`;
    const { resources: scans } = await container.items
      .query({
        query: scansQuery,
        parameters: [
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    // Delete each scan
    for (const scan of scans) {
      await container.item(scan.id, scan.tenant_id).delete();
    }

    // Finally, delete the workspace itself
    await container.item(workspace.id, workspace.tenant_id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tenants/by-slug/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 }
    );
  }
}
