import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";

export async function GET(req: NextRequest) {
  // Query tenant records where id equals tenant_id.
  const query = `SELECT * FROM c WHERE c.id = c.tenant_id`;
  const { resources } = await container.items.query({ query }).fetchAll();

  return NextResponse.json(resources);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const slug = slugify(name, { lower: true, strict: true });

    // Prevent duplicate tenants by slug (case-insensitive)
    const query = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id`;
    const { resources: existing } = await container.items
      .query({
        query,
        parameters: [{ name: "@slug", value: slug.toLowerCase() }],
      })
      .fetchAll();

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Tenant with this name already exists" },
        { status: 409 }
      );
    }

    const tenant_id = uuidv4();
    const newTenant = {
      id: tenant_id,
      tenant_id,
      name,
      slug,
      description: body.description?.trim() || "",
      region: body.region || "",
    };

    const { resource } = await container.items.create(newTenant, {
      partitionKey: tenant_id,
    } as any);

    return NextResponse.json(resource);
  } catch (error) {
    console.error("POST /api/tenants error:", error);
    return NextResponse.json(
      { error: "Failed to create tenant" },
      { status: 500 }
    );
  }
}
