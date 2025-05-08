import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";

// Define interfaces for the lifecycle data structure
interface ProcessGroup {
  name: string;
  description: string;
  score: number;
}

interface ProcessCategory {
  name: string;
  description: string;
  score: number;
  process_groups: ProcessGroup[];
  cost_to_serve?: number;
  industry_benchmark?: number;
}

interface Lifecycle {
  id: string;
  name: string;
  processes?: {
    process_categories: ProcessCategory[];
  };
  position?: number;
}

interface PainPoint {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  [key: string]: any; // For strategic objective properties (so_*)
}

interface PainPointSummary {
  id: string;
  lifecycle_id: string;
  pain_points: PainPoint[];
}

export async function GET(req: NextRequest) {
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

    // Query to find lifecycles for this scan
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

    // Query to find all pain point summaries for this scan
    const painPointsQuery = `
      SELECT * FROM c 
      WHERE c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "pain_point_summary"
    `;
    
    const { resources: painPointSummaries } = await container.items
      .query({
        query: painPointsQuery,
        parameters: [
          { name: "@scan_id", value: scanId },
          { name: "@workspace_id", value: workspaceId },
          { name: "@tenant_slug", value: tenantSlug },
        ],
      })
      .fetchAll();

    // Map of lifecycle ID to pain point summary
    const painPointMap: Record<string, PainPointSummary> = painPointSummaries.reduce((map: Record<string, PainPointSummary>, summary: PainPointSummary) => {
      map[summary.lifecycle_id] = summary;
      return map;
    }, {});

    // Calculate real metrics based on actual lifecycle data
    const lifecyclesWithCosts = lifecycles.map((lifecycle: Lifecycle) => {
      // Count the total number of process groups inside all process categories
      let processes = 0;
      let costToServe = 0;
      let industryBenchmark = 0;
      let hasCostValues = false;
      let hasBenchmarkValues = false;
      
      // Calculate totals from actual data if processes exists
      if (lifecycle.processes && Array.isArray(lifecycle.processes.process_categories)) {
        // Count total process groups
        lifecycle.processes.process_categories.forEach((category: ProcessCategory) => {
          if (category.process_groups && Array.isArray(category.process_groups)) {
            processes += category.process_groups.length;
          }
          
          // Check if this category has a cost_to_serve value
          if (category.cost_to_serve) {
            hasCostValues = true;
            costToServe += Math.abs(category.cost_to_serve);
          }
          
          // Check if this category has an industry_benchmark value
          if (category.industry_benchmark) {
            hasBenchmarkValues = true;
            industryBenchmark += Math.abs(category.industry_benchmark);
          }
        });
      }
      
      // Get pain points and calculate strategic objective points
      let painPoints = 0;
      let points = 0;
      
      const painPointSummary = painPointMap[lifecycle.id];
      if (painPointSummary && Array.isArray(painPointSummary.pain_points)) {
        // Count pain points with assigned process groups (excluding "Unassigned")
        const assignedPainPoints = painPointSummary.pain_points.filter(
          (point: PainPoint) => point.assigned_process_group && point.assigned_process_group !== "Unassigned"
        );
        
        painPoints = assignedPainPoints.length;
        
        // Calculate total points from strategic objectives
        points = assignedPainPoints.reduce((sum: number, point: PainPoint) => {
          let pointScore = 0;
          Object.entries(point).forEach(([key, value]) => {
            if (key.startsWith('so_') && typeof value === 'number') {
              pointScore += value;
            }
          });
          return sum + pointScore;
        }, 0);
      }
      
      // Use actual cost_to_serve if values exist, otherwise use 0
      const actualCostToServe = hasCostValues ? costToServe : 0;
      
      // Use actual industry_benchmark as the sum of category benchmarks (no hardcoded fallback)
      const actualIndustryBenchmark = industryBenchmark;
      
      // Calculate delta (difference between industry benchmark and cost to serve)
      const delta = actualIndustryBenchmark - actualCostToServe;
      
      return {
        ...lifecycle,
        costMetrics: {
          processes,
          painPoints,
          points,
          costToServe: actualCostToServe,
          industryBenchmark: actualIndustryBenchmark,
          delta
        }
      };
    });

    // Sort by position if available
    const sortedLifecycles = [...lifecyclesWithCosts].sort((a, b) => {
      // If position isn't a number, treat as highest value to put at end
      const posA = typeof a.position === 'number' ? a.position : Number.MAX_SAFE_INTEGER;
      const posB = typeof b.position === 'number' ? b.position : Number.MAX_SAFE_INTEGER;
      return posA - posB;
    });

    return NextResponse.json(sortedLifecycles);
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans/lifecycle-costs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lifecycle costs" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { 
      tenant_slug, 
      workspace_id, 
      scan_id, 
      lifecycle_id, 
      category_index, 
      cost_to_serve,
      industry_benchmark
    } = body;

    // Validate required fields
    if (!tenant_slug || !workspace_id || !scan_id || !lifecycle_id || category_index === undefined || 
        (cost_to_serve === undefined && industry_benchmark === undefined)) {
      return NextResponse.json(
        { error: "Missing required parameters" },
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

    // Query to find the specific lifecycle
    const query = `
      SELECT * FROM c 
      WHERE c.id = @lifecycle_id
      AND c.scan_id = @scan_id 
      AND c.workspace_id = @workspace_id 
      AND c.tenant_slug = @tenant_slug 
      AND c.type = "lifecycle"
    `;
    
    const { resources: lifecycles } = await container.items
      .query({
        query,
        parameters: [
          { name: "@lifecycle_id", value: lifecycle_id },
          { name: "@scan_id", value: scan_id },
          { name: "@workspace_id", value: workspace_id },
          { name: "@tenant_slug", value: tenant_slug },
        ],
      })
      .fetchAll();

    if (lifecycles.length === 0) {
      return NextResponse.json(
        { error: "Lifecycle not found" },
        { status: 404 }
      );
    }

    // Get the lifecycle from resources
    const lifecycle = lifecycles[0];
    
    // Ensure the processes and process_categories exist
    if (!lifecycle.processes || !lifecycle.processes.process_categories || 
        !Array.isArray(lifecycle.processes.process_categories) || 
        category_index >= lifecycle.processes.process_categories.length) {
      return NextResponse.json(
        { error: "Process category not found" },
        { status: 404 }
      );
    }

    // Update the appropriate field in the process category
    if (cost_to_serve !== undefined) {
      // Store the cost_to_serve value as a positive integer
      const positiveCostValue = Math.abs(cost_to_serve);
      lifecycle.processes.process_categories[category_index].cost_to_serve = positiveCostValue;
    }
    
    if (industry_benchmark !== undefined) {
      // Store the industry_benchmark value as a positive integer
      const positiveBenchmarkValue = Math.abs(industry_benchmark);
      lifecycle.processes.process_categories[category_index].industry_benchmark = positiveBenchmarkValue;
    }
    
    try {
      // Update the lifecycle in the database using a more reliable approach
      // Instead of using .replace() which requires knowing the exact partition key,
      // use query-based update with an upsert operation
      const querySpec = {
        query: `
          SELECT * FROM c 
          WHERE c.id = @id
          AND c.scan_id = @scan_id 
          AND c.workspace_id = @workspace_id 
          AND c.tenant_slug = @tenant_slug 
          AND c.type = "lifecycle"
        `,
        parameters: [
          { name: "@id", value: lifecycle_id },
          { name: "@scan_id", value: scan_id },
          { name: "@workspace_id", value: workspace_id },
          { name: "@tenant_slug", value: tenant_slug },
        ]
      };
      
      // Use the upsert operation which will either update or create
      const { resource: updatedLifecycle } = await container.items.upsert(lifecycle);
        
      // Return the updated lifecycle
      return NextResponse.json(updatedLifecycle);
    } catch (error: any) {
      console.error("Error updating lifecycle:", error);
      
      // If document not found, return an appropriate error
      if (error.code === 404) {
        return NextResponse.json(
          { error: "Lifecycle document could not be updated. Document may have been deleted or partition key is incorrect." },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to update lifecycle costs" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("PUT /api/tenants/by-slug/workspaces/scans/lifecycle-costs error:", error);
    return NextResponse.json(
      { error: "Failed to update lifecycle costs" },
      { status: 500 }
    );
  }
} 