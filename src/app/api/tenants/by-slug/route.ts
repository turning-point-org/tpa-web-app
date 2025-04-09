import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";

// GET: Return a tenant using its slug (case-insensitive) and ensuring it's an actual tenant record.
export async function GET(req: NextRequest) {
  try {
    // Get the slug from query parameters
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    // Query for the tenant where the slug (case-insensitive) matches and ensure it's an actual tenant record (c.id = c.tenant_id).
    const query = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [{ name: "@slug", value: slug.toLowerCase() }],
      })
      .fetchAll();

    if (!resources.length) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json(resources[0]);
  } catch (error) {
    console.error("GET /api/tenants/by-slug error:", error);
    return NextResponse.json({ error: "Failed to fetch tenant" }, { status: 500 });
  }
}

// PATCH: Update the tenant's description.
// Expected request body: { slug: string, description: string }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, description } = body;

    if (!slug) {
      return NextResponse.json({ error: "Tenant slug is required" }, { status: 400 });
    }

    // Query for the tenant record using the provided slug.
    const query = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [{ name: "@slug", value: slug.toLowerCase() }],
      })
      .fetchAll();

    if (resources.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenant = resources[0];
    tenant.description = description || "";

    // Update the record in Cosmos. Use tenant.tenant_id as the partition key.
    const { resource } = await container
      .item(tenant.id, tenant.tenant_id)
      .replace(tenant);

    return NextResponse.json(resource);
  } catch (error) {
    console.error("PATCH /api/tenants/by-slug error:", error);
    return NextResponse.json({ error: "Failed to update tenant" }, { status: 500 });
  }
}
