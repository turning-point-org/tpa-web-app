import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";
import { withAuth } from "@/utils/api-handler";
import { TenantUser } from "@/types";

import { withTenantAuth } from "@/utils/tenant-auth";
// Helper function to check if user is admin (has @turningpointadvisory.com.au email)
function isAdmin(email: string): boolean {
  const lowerCaseEmail = email.toLowerCase();
  
  return (
    lowerCaseEmail.endsWith('@turningpointadvisory.com.au') ||
    lowerCaseEmail.endsWith('@novigi.com.au')
  );
}

// GET: Get all users for a tenant
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  return withAuth(async (request: NextRequest, user?: { userId: string; email: string; name: string }) => {
    try {
      const resolvedParams = await params;
      const tenantId = resolvedParams.tenantId;

      if (!user?.email) {
        return NextResponse.json({ error: "User email not found" }, { status: 401 });
      }

      // Only admins can view tenant users
      if (!isAdmin(user.email)) {
        return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 });
      }

      if (!container) {
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      // Query for tenant users
      const query = `SELECT * FROM c WHERE c.tenant_id = @tenantId AND c.type = "tenant_user"`;
      const { resources } = await container.items
        .query({
          query,
          parameters: [{ name: "@tenantId", value: tenantId }],
        })
        .fetchAll();

      return NextResponse.json(resources);
    } catch (error) {
      console.error("GET /api/tenants/[tenantId]/users error:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
  })(req);
}

// POST: Add a user to a tenant
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  return withAuth(async (request: NextRequest, user?: { userId: string; email: string; name: string }) => {
    try {
      const resolvedParams = await params;
      const tenantId = resolvedParams.tenantId;
      const body = await req.json();

      if (!user?.email) {
        return NextResponse.json({ error: "User email not found" }, { status: 401 });
      }

      // Only admins can add tenant users
      if (!isAdmin(user.email)) {
        return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 });
      }

      const { email, permission } = body;

      if (!email || !permission) {
        return NextResponse.json({ error: "Email and permission are required" }, { status: 400 });
      }

      if (!['Read', 'Write'].includes(permission)) {
        return NextResponse.json({ error: "Permission must be 'Read' or 'Write'" }, { status: 400 });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      if (!container) {
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      // Check if user already exists for this tenant
      const existingQuery = `SELECT * FROM c WHERE c.tenant_id = @tenantId AND c.email = @email AND c.type = "tenant_user"`;
      const { resources: existingUsers } = await container.items
        .query({
          query: existingQuery,
          parameters: [
            { name: "@tenantId", value: tenantId },
            { name: "@email", value: email.toLowerCase() }
          ],
        })
        .fetchAll();

      if (existingUsers.length > 0) {
        return NextResponse.json({ error: "User already exists for this tenant" }, { status: 409 });
      }

      // Create new tenant user record
      const newTenantUser: TenantUser = {
        id: uuidv4(),
        tenant_id: tenantId,
        email: email.toLowerCase(),
        permission,
        added_by: user.email,
        added_at: new Date().toISOString(),
        type: 'tenant_user'
      };

      const { resource } = await container.items.create(newTenantUser, {
        partitionKey: tenantId,
      });

      return NextResponse.json(resource);
    } catch (error) {
      console.error("POST /api/tenants/[tenantId]/users error:", error);
      return NextResponse.json({ error: "Failed to add user" }, { status: 500 });
    }
  })(req);
}

// DELETE: Remove a user from a tenant
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  return withAuth(async (request: NextRequest, user?: { userId: string; email: string; name: string }) => {
    try {
      const resolvedParams = await params;
      const tenantId = resolvedParams.tenantId;
      const { searchParams } = new URL(req.url);
      const userEmail = searchParams.get("email");

      if (!user?.email) {
        return NextResponse.json({ error: "User email not found" }, { status: 401 });
      }

      // Only admins can remove tenant users
      if (!isAdmin(user.email)) {
        return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 });
      }

      if (!userEmail) {
        return NextResponse.json({ error: "User email is required" }, { status: 400 });
      }

      if (!container) {
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      // Find the user record
      const query = `SELECT * FROM c WHERE c.tenant_id = @tenantId AND c.email = @email AND c.type = "tenant_user"`;
      const { resources } = await container.items
        .query({
          query,
          parameters: [
            { name: "@tenantId", value: tenantId },
            { name: "@email", value: userEmail.toLowerCase() }
          ],
        })
        .fetchAll();

      if (resources.length === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const userRecord = resources[0];

      // Delete the user record
      await container.item(userRecord.id, tenantId).delete();

      return NextResponse.json({ message: "User removed successfully" });
    } catch (error) {
      console.error("DELETE /api/tenants/[tenantId]/users error:", error);
      return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
    }
  })(req);
}

// PATCH: Update user permission
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  return withAuth(async (request: NextRequest, user?: { userId: string; email: string; name: string }) => {
    try {
      const resolvedParams = await params;
      const tenantId = resolvedParams.tenantId;
      const body = await req.json();

      if (!user?.email) {
        return NextResponse.json({ error: "User email not found" }, { status: 401 });
      }

      // Only admins can update tenant users
      if (!isAdmin(user.email)) {
        return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 });
      }

      const { email, permission } = body;

      if (!email || !permission) {
        return NextResponse.json({ error: "Email and permission are required" }, { status: 400 });
      }

      if (!['Read', 'Write'].includes(permission)) {
        return NextResponse.json({ error: "Permission must be 'Read' or 'Write'" }, { status: 400 });
      }

      if (!container) {
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      // Find the user record
      const query = `SELECT * FROM c WHERE c.tenant_id = @tenantId AND c.email = @email AND c.type = "tenant_user"`;
      const { resources } = await container.items
        .query({
          query,
          parameters: [
            { name: "@tenantId", value: tenantId },
            { name: "@email", value: email.toLowerCase() }
          ],
        })
        .fetchAll();

      if (resources.length === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const userRecord = resources[0];
      userRecord.permission = permission;
      userRecord.updated_at = new Date().toISOString();
      userRecord.updated_by = user.email;

      // Update the record
      const { resource } = await container.item(userRecord.id, tenantId).replace(userRecord);

      return NextResponse.json(resource);
    } catch (error) {
      console.error("PATCH /api/tenants/[tenantId]/users error:", error);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
  })(req);
}
