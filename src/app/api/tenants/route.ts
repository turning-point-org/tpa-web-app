import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import { withAuth } from "@/utils/api-handler";

/**
 * Helper function to check if user is a super user (admin)
 */
function isSuperUser(email: string): boolean {
  return email.toLowerCase().endsWith('@turningpointadvisory.com.au');
}

// Authenticated GET endpoint for tenants
export const GET = withAuth(async (req: NextRequest, user?: any) => {
  console.log("GET /api/tenants - Authenticated request received");
  
  if (!user?.email) {
    console.error("GET /api/tenants error: User email not found");
    return NextResponse.json(
      { error: "User email not found" },
      { status: 401 }
    );
  }
  
  console.log("User details:", {
    userId: user.userId,
    email: user.email,
    name: user.name,
    isSuperUser: isSuperUser(user.email)
  });
  
  if (!container) {
    console.error("GET /api/tenants error: Database container not initialized");
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }
  
  try {
    let tenants = [];
    
    if (isSuperUser(user.email)) {
      // Super users can see all tenants
      console.log("Super user detected - returning all tenants");
      const query = `SELECT * FROM c WHERE c.id = c.tenant_id`;
      const { resources } = await container.items.query({ query }).fetchAll();
      tenants = resources;
    } else {
      // Regular users can only see tenants they have permission to access
      console.log("Regular user detected - filtering tenants by permissions");
      
      // First, get all tenant permissions for this user
      const permissionQuery = `
        SELECT * FROM c 
        WHERE c.type = "tenant_user" 
        AND LOWER(c.email) = @email
      `;
      
      const { resources: permissions } = await container.items.query({
        query: permissionQuery,
        parameters: [{ name: "@email", value: user.email.toLowerCase() }]
      }).fetchAll();
      
      console.log(`Found ${permissions.length} tenant permissions for user ${user.email}`);
      
      if (permissions.length > 0) {
        // Get the tenant IDs the user has access to
        const tenantIds = permissions.map(p => p.tenant_id);
        
        // Build a query to get all tenants the user has access to
        const tenantQuery = `
          SELECT * FROM c 
          WHERE c.id = c.tenant_id 
          AND c.id IN (${tenantIds.map((_, index) => `@tenantId${index}`).join(', ')})
        `;
        
        const tenantParameters = tenantIds.map((id, index) => ({
          name: `@tenantId${index}`,
          value: id
        }));
        
        const { resources } = await container.items.query({
          query: tenantQuery,
          parameters: tenantParameters
        }).fetchAll();
        
        tenants = resources;
      }
    }
    
    console.log(`GET /api/tenants - Returning ${tenants.length} tenants for user ${user.email}`);
    return NextResponse.json(tenants);
  } catch (error) {
    console.error("GET /api/tenants error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenants" },
      { status: 500 }
    );
  }
});

// Authenticated POST endpoint for creating tenants
export const POST = withAuth(async (req: NextRequest, user?: any) => {
  console.log("POST /api/tenants - Create tenant request received");
  
  if (!user?.email) {
    console.error("POST /api/tenants error: User email not found");
    return NextResponse.json(
      { error: "User email not found" },
      { status: 401 }
    );
  }
  
  // Only super users can create tenants
  if (!isSuperUser(user.email)) {
    console.log(`POST /api/tenants - Access denied for user ${user.email} - not a super user`);
    return NextResponse.json(
      { error: "Unauthorized - Only administrators can create tenants" },
      { status: 403 }
    );
  }
  
  console.log(`POST /api/tenants - Super user ${user.email} creating tenant`);
  
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
