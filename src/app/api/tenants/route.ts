import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import { withAuth } from "@/utils/api-handler";

// Authenticated GET endpoint for tenants
export const GET = withAuth(async (req: NextRequest) => {
  console.log("GET /api/tenants - Authenticated request received");
  
  if (!container) {
    console.error("GET /api/tenants error: Database container not initialized");
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }
  
  // Query tenant records where id equals tenant_id.
  const query = `SELECT * FROM c WHERE c.id = c.tenant_id`;
  
  try {
    const { resources } = await container.items.query({ query }).fetchAll();
    console.log(`GET /api/tenants - Found ${resources.length} tenants`);
    return NextResponse.json(resources);
  } catch (error) {
    console.error("GET /api/tenants error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenants" },
      { status: 500 }
    );
  }
});

// Authenticated POST endpoint for creating tenants
export const POST = withAuth(async (req: NextRequest) => {
  if (!container) {
    console.error("POST /api/tenants error: Database container not initialized");
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }
  
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
});
