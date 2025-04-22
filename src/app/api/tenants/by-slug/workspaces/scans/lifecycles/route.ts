import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const skipPositionFix = searchParams.get("skip_position_fix") === "true";

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

    // Query to find lifecycles for this scan
    // First fetch them all without ordering to check if we need position migration
    const query = `
      SELECT * FROM c 
      WHERE c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "lifecycle"
    `;
    
    const { resources: lifecycles } = await container.items
      .query({
        query,
        parameters: [
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    // Check if any lifecycle is missing the position field
    const hasMissingPositions = lifecycles.some(lifecycle => typeof lifecycle.position !== 'number');
    
    // Only attempt to fix positions if we haven't been asked to skip it
    // This prevents recursive fixes
    if (hasMissingPositions && !skipPositionFix) {
      console.log("Lifecycles missing position field detected");
      
      // Sort by created_at for consistent ordering
      lifecycles.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      // Find the tenant ID for the partition key
      const tenantQuery = `
        SELECT * FROM c 
        WHERE LOWER(c.slug) = @tenant_slug 
        AND c.id = c.tenant_id
      `;
      
      const { resources: tenants } = await container.items
        .query({
          query: tenantQuery,
          parameters: [{ name: "@tenant_slug", value: tenantSlug.toLowerCase() }],
        })
        .fetchAll();

      if (tenants && tenants.length > 0) {
        const tenant_id = tenants[0].id;
        
        // Add position to lifecycles or fix any incorrectly ordered ones
        let updatesNeeded = false;
        
        for (let i = 0; i < lifecycles.length; i++) {
          const lifecycle = lifecycles[i];
          
          // Only update if position is missing or different from expected
          if (typeof lifecycle.position !== 'number' || lifecycle.position !== i) {
            updatesNeeded = true;
            lifecycle.position = i;
            lifecycle.updated_at = new Date().toISOString();
            
            try {
              await container.item(lifecycle.id, tenant_id).replace(lifecycle);
            } catch (err) {
              console.error(`Error updating position for lifecycle ${lifecycle.id}:`, err);
              // Continue with other updates even if one fails
            }
          }
        }
        
        if (updatesNeeded) {
          // If we fixed positions, redirect to same endpoint but with skip_position_fix=true
          // to avoid infinite migration loops
          const redirectUrl = `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&skip_position_fix=true`;
          
          return NextResponse.redirect(new URL(redirectUrl, req.url));
        }
      }
    }

    // Sort and return the lifecycles by position
    const sortedLifecycles = [...lifecycles].sort((a, b) => {
      // If position isn't a number, treat as highest value to put at end
      const posA = typeof a.position === 'number' ? a.position : Number.MAX_SAFE_INTEGER;
      const posB = typeof b.position === 'number' ? b.position : Number.MAX_SAFE_INTEGER;
      return posA - posB;
    });

    return NextResponse.json(sortedLifecycles);
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans/lifecycles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lifecycles" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const requestBody = await req.json();
    const { 
      tenant_slug, 
      workspace_id, 
      scan_id, 
      lifecycle_id,
      action
    } = requestBody;

    if (!tenant_slug || !workspace_id || !scan_id || !lifecycle_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // Find the tenant ID from the tenant slug for partition key
    const tenantQuery = `
      SELECT * FROM c 
      WHERE LOWER(c.slug) = @tenant_slug 
      AND c.id = c.tenant_id
    `;
    
    const { resources: tenants } = await container.items
      .query({
        query: tenantQuery,
        parameters: [{ name: "@tenant_slug", value: tenant_slug.toLowerCase() }],
      })
      .fetchAll();

    if (!tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const tenant_id = tenants[0].id;

    // Find the lifecycle item
    const lifecycleQuery = `
      SELECT * FROM c 
      WHERE c.id = @lifecycle_id 
      AND c.type = "lifecycle"
      AND c.scan_id = @scan_id
      AND c.workspace_id = @workspace_id
      AND c.tenant_slug = @tenant_slug
    `;
    
    const { resources: lifecycles } = await container.items
      .query({
        query: lifecycleQuery,
        parameters: [
          { name: "@lifecycle_id", value: lifecycle_id },
          { name: "@scan_id", value: scan_id },
          { name: "@workspace_id", value: workspace_id },
          { name: "@tenant_slug", value: tenant_slug },
        ],
      })
      .fetchAll();

    if (!lifecycles || lifecycles.length === 0) {
      return NextResponse.json(
        { error: "Lifecycle not found" },
        { status: 404 }
      );
    }

    const lifecycle = lifecycles[0];
    
    // Initialize processes structure if it doesn't exist
    if (!lifecycle.processes) {
      lifecycle.processes = { process_categories: [] };
    }
    if (!lifecycle.processes.process_categories) {
      lifecycle.processes.process_categories = [];
    }

    // Handle different actions
    switch (action) {
      case 'update_score': {
        const { category_index, group_index, score } = requestBody;
        
        if (category_index === undefined || group_index === undefined || score === undefined) {
          return NextResponse.json(
            { error: "Missing required fields for score update" },
            { status: 400 }
          );
        }

        // Validate score is a number
        const numericScore = Number(score);
        if (isNaN(numericScore)) {
          return NextResponse.json(
            { error: "Score must be a number" },
            { status: 400 }
          );
        }

        // Ensure category and group exist
        if (!lifecycle.processes.process_categories[category_index] ||
            !lifecycle.processes.process_categories[category_index].process_groups ||
            !lifecycle.processes.process_categories[category_index].process_groups[group_index]) {
          return NextResponse.json(
            { error: "Process category or group not found" },
            { status: 404 }
          );
        }

        // Update the score
        lifecycle.processes.process_categories[category_index].process_groups[group_index].score = numericScore;
        
        // Calculate the total score for the category
        const categoryGroups = lifecycle.processes.process_categories[category_index].process_groups;
        const categoryScore = categoryGroups.reduce((total: number, group: { score?: number }) => total + (group.score || 0), 0);
        lifecycle.processes.process_categories[category_index].score = categoryScore;
        
        // Update the lifecycle in the database
        lifecycle.updated_at = new Date().toISOString();
        await container.item(lifecycle.id, tenant_id).replace(lifecycle);

        return NextResponse.json({
          success: true,
          message: "Score updated successfully",
          category_score: categoryScore,
          group_score: numericScore
        });
      }

      case 'create_category': {
        const { category } = requestBody;
        
        if (!category || !category.name) {
          return NextResponse.json(
            { error: "Missing required fields for category creation" },
            { status: 400 }
          );
        }

        // Add the new category
        const newCategory = {
          name: category.name,
          description: category.description || "",
          score: 0,
          process_groups: category.process_groups || []
        };
        
        lifecycle.processes.process_categories.push(newCategory);
        
        // Update the lifecycle in the database
        lifecycle.updated_at = new Date().toISOString();
        await container.item(lifecycle.id, tenant_id).replace(lifecycle);

        return NextResponse.json({
          success: true,
          message: "Category created successfully",
          category: newCategory
        });
      }

      case 'update_category': {
        const { category_index, category } = requestBody;
        
        if (category_index === undefined || !category || !category.name) {
          return NextResponse.json(
            { error: "Missing required fields for category update" },
            { status: 400 }
          );
        }

        // Ensure category exists
        if (!lifecycle.processes.process_categories[category_index]) {
          return NextResponse.json(
            { error: "Process category not found" },
            { status: 404 }
          );
        }

        // Update the category
        lifecycle.processes.process_categories[category_index].name = category.name;
        lifecycle.processes.process_categories[category_index].description = category.description || "";
        
        // Update the lifecycle in the database
        lifecycle.updated_at = new Date().toISOString();
        await container.item(lifecycle.id, tenant_id).replace(lifecycle);

        return NextResponse.json({
          success: true,
          message: "Category updated successfully"
        });
      }

      case 'delete_category': {
        const { category_index } = requestBody;
        
        if (category_index === undefined) {
          return NextResponse.json(
            { error: "Missing required fields for category deletion" },
            { status: 400 }
          );
        }

        // Ensure category exists
        if (!lifecycle.processes.process_categories[category_index]) {
          return NextResponse.json(
            { error: "Process category not found" },
            { status: 404 }
          );
        }

        // Remove the category
        lifecycle.processes.process_categories.splice(category_index, 1);
        
        // Update the lifecycle in the database
        lifecycle.updated_at = new Date().toISOString();
        await container.item(lifecycle.id, tenant_id).replace(lifecycle);

        return NextResponse.json({
          success: true,
          message: "Category deleted successfully"
        });
      }

      case 'create_group': {
        const { category_index, group } = requestBody;
        
        if (category_index === undefined || !group || !group.name) {
          return NextResponse.json(
            { error: "Missing required fields for group creation" },
            { status: 400 }
          );
        }

        // Ensure category exists
        if (!lifecycle.processes.process_categories[category_index]) {
          return NextResponse.json(
            { error: "Process category not found" },
            { status: 404 }
          );
        }

        // Initialize process_groups if it doesn't exist
        if (!lifecycle.processes.process_categories[category_index].process_groups) {
          lifecycle.processes.process_categories[category_index].process_groups = [];
        }

        // Add the new group
        const newGroup = {
          name: group.name,
          description: group.description || "",
          score: 0,
          processes: group.processes || []
        };
        
        lifecycle.processes.process_categories[category_index].process_groups.push(newGroup);
        
        // Update the lifecycle in the database
        lifecycle.updated_at = new Date().toISOString();
        await container.item(lifecycle.id, tenant_id).replace(lifecycle);

        return NextResponse.json({
          success: true,
          message: "Process group created successfully",
          group: newGroup
        });
      }

      case 'update_group': {
        const { category_index, group_index, group } = requestBody;
        
        if (category_index === undefined || group_index === undefined || !group || !group.name) {
          return NextResponse.json(
            { error: "Missing required fields for group update" },
            { status: 400 }
          );
        }

        // Ensure category and group exist
        if (!lifecycle.processes.process_categories[category_index] ||
            !lifecycle.processes.process_categories[category_index].process_groups ||
            !lifecycle.processes.process_categories[category_index].process_groups[group_index]) {
          return NextResponse.json(
            { error: "Process category or group not found" },
            { status: 404 }
          );
        }

        // Update the group
        lifecycle.processes.process_categories[category_index].process_groups[group_index].name = group.name;
        lifecycle.processes.process_categories[category_index].process_groups[group_index].description = group.description || "";
        
        // Update the lifecycle in the database
        lifecycle.updated_at = new Date().toISOString();
        await container.item(lifecycle.id, tenant_id).replace(lifecycle);

        return NextResponse.json({
          success: true,
          message: "Process group updated successfully"
        });
      }

      case 'delete_group': {
        const { category_index, group_index } = requestBody;
        
        if (category_index === undefined || group_index === undefined) {
          return NextResponse.json(
            { error: "Missing required fields for group deletion" },
            { status: 400 }
          );
        }

        // Ensure category and group exist
        if (!lifecycle.processes.process_categories[category_index] ||
            !lifecycle.processes.process_categories[category_index].process_groups ||
            !lifecycle.processes.process_categories[category_index].process_groups[group_index]) {
          return NextResponse.json(
            { error: "Process category or group not found" },
            { status: 404 }
          );
        }

        // Remove the group
        lifecycle.processes.process_categories[category_index].process_groups.splice(group_index, 1);
        
        // Recalculate category score
        const categoryGroups = lifecycle.processes.process_categories[category_index].process_groups;
        const categoryScore = categoryGroups.reduce((total: number, group: { score?: number }) => total + (group.score || 0), 0);
        lifecycle.processes.process_categories[category_index].score = categoryScore;
        
        // Update the lifecycle in the database
        lifecycle.updated_at = new Date().toISOString();
        await container.item(lifecycle.id, tenant_id).replace(lifecycle);

        return NextResponse.json({
          success: true,
          message: "Process group deleted successfully"
        });
      }

      case 'reorder_group': {
        const { reorder } = requestBody;
        
        if (!reorder || 
            reorder.source_category_index === undefined || 
            reorder.source_group_index === undefined || 
            reorder.dest_category_index === undefined || 
            reorder.dest_group_index === undefined) {
          return NextResponse.json(
            { error: "Missing required fields for group reordering" },
            { status: 400 }
          );
        }

        // Ensure source and destination categories exist
        if (!lifecycle.processes.process_categories[reorder.source_category_index] || 
            !lifecycle.processes.process_categories[reorder.dest_category_index]) {
          return NextResponse.json(
            { error: "Source or destination category not found" },
            { status: 404 }
          );
        }

        // Ensure source group exists
        if (!lifecycle.processes.process_categories[reorder.source_category_index].process_groups ||
            !lifecycle.processes.process_categories[reorder.source_category_index].process_groups[reorder.source_group_index]) {
          return NextResponse.json(
            { error: "Source process group not found" },
            { status: 404 }
          );
        }

        // Initialize destination process_groups if it doesn't exist
        if (!lifecycle.processes.process_categories[reorder.dest_category_index].process_groups) {
          lifecycle.processes.process_categories[reorder.dest_category_index].process_groups = [];
        }

        // Move the group
        const sourceCategory = lifecycle.processes.process_categories[reorder.source_category_index];
        const destCategory = lifecycle.processes.process_categories[reorder.dest_category_index];
        
        // Remove from source
        const [movedGroup] = sourceCategory.process_groups.splice(reorder.source_group_index, 1);
        
        // Add to destination
        if (reorder.dest_group_index >= destCategory.process_groups.length) {
          destCategory.process_groups.push(movedGroup);
        } else {
          destCategory.process_groups.splice(reorder.dest_group_index, 0, movedGroup);
        }
        
        // Recalculate category scores
        const sourceGroups = sourceCategory.process_groups;
        const sourceScore = sourceGroups.reduce((total: number, group: { score?: number }) => total + (group.score || 0), 0);
        sourceCategory.score = sourceScore;
        
        const destGroups = destCategory.process_groups;
        const destScore = destGroups.reduce((total: number, group: { score?: number }) => total + (group.score || 0), 0);
        destCategory.score = destScore;
        
        // Update the lifecycle in the database
        lifecycle.updated_at = new Date().toISOString();
        await container.item(lifecycle.id, tenant_id).replace(lifecycle);

        return NextResponse.json({
          success: true,
          message: "Process group reordered successfully",
          source_category_score: sourceScore,
          dest_category_score: destScore
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("POST /api/tenants/by-slug/workspaces/scans/lifecycles error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const requestBody = await req.json();
    const { tenant_slug, workspace_id, scan_id, lifecycle_id, name, description } = requestBody;

    if (!tenant_slug || !workspace_id || !scan_id || !lifecycle_id || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // Find the tenant ID from the tenant slug for partition key
    const tenantQuery = `
      SELECT * FROM c 
      WHERE LOWER(c.slug) = @tenant_slug 
      AND c.id = c.tenant_id
    `;
    
    const { resources: tenants } = await container.items
      .query({
        query: tenantQuery,
        parameters: [{ name: "@tenant_slug", value: tenant_slug.toLowerCase() }],
      })
      .fetchAll();

    if (!tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const tenant_id = tenants[0].id;

    // Find the lifecycle to update
    const lifecycleQuery = `
      SELECT * FROM c 
      WHERE c.id = @lifecycle_id 
      AND c.type = "lifecycle"
      AND c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug
    `;
    
    const { resources: lifecycles } = await container.items
      .query({
        query: lifecycleQuery,
        parameters: [
          { name: "@lifecycle_id", value: lifecycle_id },
          { name: "@scan_id", value: scan_id },
          { name: "@workspace_id", value: workspace_id },
          { name: "@tenant_slug", value: tenant_slug },
        ],
      })
      .fetchAll();

    if (!lifecycles || lifecycles.length === 0) {
      return NextResponse.json(
        { error: "Lifecycle not found" },
        { status: 404 }
      );
    }

    const existingLifecycle = lifecycles[0];
    
    // Update the lifecycle
    const updatedLifecycle = {
      ...existingLifecycle,
      name,
      description: description || existingLifecycle.description,
      updated_at: new Date().toISOString()
    };
    
    await container.item(lifecycle_id, tenant_id).replace(updatedLifecycle);

    return NextResponse.json(updatedLifecycle);
  } catch (error: any) {
    console.error("PUT /api/tenants/by-slug/workspaces/scans/lifecycles error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update lifecycle" },
      { status: 500 }
    );
  }
}

// New endpoint to update positions
export async function PATCH(req: NextRequest) {
  try {
    const requestBody = await req.json();
    const { tenant_slug, workspace_id, scan_id, positions } = requestBody;

    if (!tenant_slug || !workspace_id || !scan_id || !positions || !Array.isArray(positions)) {
      return NextResponse.json(
        { error: "Missing required fields or positions is not an array" },
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

    // Find the tenant ID from the tenant slug for partition key
    const tenantQuery = `
      SELECT * FROM c 
      WHERE LOWER(c.slug) = @tenant_slug 
      AND c.id = c.tenant_id
    `;
    
    const { resources: tenants } = await container.items
      .query({
        query: tenantQuery,
        parameters: [{ name: "@tenant_slug", value: tenant_slug.toLowerCase() }],
      })
      .fetchAll();

    if (!tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const tenant_id = tenants[0].id;

    // Update position for each lifecycle
    const updatedLifecycles = [];
    for (const posItem of positions) {
      // Check if container is still available (defensive programming)
      if (!container) {
        throw new Error("Database connection not available");
      }
      
      const lifecycleQuery = `
        SELECT * FROM c 
        WHERE c.id = @lifecycle_id 
        AND c.type = "lifecycle"
        AND c.scan_id = @scan_id 
        AND c.workspace_id = @workspace_id 
        AND c.tenant_slug = @tenant_slug
      `;
      
      const { resources: lifecycles } = await container.items
        .query({
          query: lifecycleQuery,
          parameters: [
            { name: "@lifecycle_id", value: posItem.id },
            { name: "@scan_id", value: scan_id },
            { name: "@workspace_id", value: workspace_id },
            { name: "@tenant_slug", value: tenant_slug },
          ],
        })
        .fetchAll();

      if (lifecycles && lifecycles.length > 0) {
        const lifecycle = lifecycles[0];
        
        // Only update if position actually changed
        if (lifecycle.position !== posItem.position) {
          lifecycle.position = posItem.position;
          lifecycle.updated_at = new Date().toISOString();
          
          // Check if container is still available (defensive programming)
          if (!container) {
            throw new Error("Database connection not available");
          }
          
          const { resource: updatedLifecycle } = await container.item(lifecycle.id, tenant_id).replace(lifecycle);
          updatedLifecycles.push(updatedLifecycle);
        } else {
          updatedLifecycles.push(lifecycle);
        }
      }
    }

    // Return success with the IDs of updated items but not the full items
    // to avoid triggering more position normalization
    return NextResponse.json({
      success: true,
      updated: updatedLifecycles.map(lc => lc.id)
    });
  } catch (error: any) {
    console.error("PATCH /api/tenants/by-slug/workspaces/scans/lifecycles error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update lifecycle positions" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const lifecycleId = searchParams.get("lifecycle_id");

    if (!tenantSlug || !workspaceId || !scanId || !lifecycleId) {
      return NextResponse.json(
        { error: "Missing tenant slug, workspace id, scan id, or lifecycle id" },
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

    // Find the tenant ID from the tenant slug for partition key
    const tenantQuery = `
      SELECT * FROM c 
      WHERE LOWER(c.slug) = @tenant_slug 
      AND c.id = c.tenant_id
    `;
    
    const { resources: tenants } = await container.items
      .query({
        query: tenantQuery,
        parameters: [{ name: "@tenant_slug", value: tenantSlug.toLowerCase() }],
      })
      .fetchAll();

    if (!tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const tenant_id = tenants[0].id;

    // Get the lifecycle to determine its position
    const lifecycleQuery = `
      SELECT * FROM c 
      WHERE c.id = @lifecycle_id 
      AND c.type = "lifecycle"
      AND c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug
    `;
    
    const { resources: lifecycles } = await container.items
      .query({
        query: lifecycleQuery,
        parameters: [
          { name: "@lifecycle_id", value: lifecycleId },
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (lifecycles && lifecycles.length > 0) {
      const deletedPosition = lifecycles[0].position;
      
      // Delete the lifecycle
      await container.item(lifecycleId, tenant_id).delete();
      
      // Update positions of other lifecycles
      const updateQuery = `
        SELECT * FROM c 
        WHERE c.scan_id = @scan_id 
        AND c.workspace_id = @workspace_id 
        AND c.tenant_slug = @tenant_slug 
        AND c.type = "lifecycle"
        AND c.position > @deleted_position
      `;
      
      const { resources: lifeCyclesToUpdate } = await container.items
        .query({
          query: updateQuery,
          parameters: [
            { name: "@scan_id", value: scanId },
            { name: "@workspace_id", value: workspaceId },
            { name: "@tenant_slug", value: tenantSlug },
            { name: "@deleted_position", value: deletedPosition },
          ],
        })
        .fetchAll();

      // Update positions for the remaining lifecycles
      for (const lifecycle of lifeCyclesToUpdate) {
        lifecycle.position = lifecycle.position - 1;
        lifecycle.updated_at = new Date().toISOString();
        await container.item(lifecycle.id, tenant_id).replace(lifecycle);
      }
    } else {
      // Delete the lifecycle even if we couldn't find it (to be safe)
      await container.item(lifecycleId, tenant_id).delete();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/tenants/by-slug/workspaces/scans/lifecycles error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete lifecycle" },
      { status: 500 }
    );
  }
} 