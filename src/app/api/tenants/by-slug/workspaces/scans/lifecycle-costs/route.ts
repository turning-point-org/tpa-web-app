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
}

interface Lifecycle {
  id: string;
  name: string;
  processes?: {
    process_categories: ProcessCategory[];
  };
  position?: number;
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

    // Calculate real metrics based on actual lifecycle data
    const lifecyclesWithCosts = lifecycles.map((lifecycle: Lifecycle) => {
      // Count the total number of process groups inside all process categories
      let processes = 0;
      let scoring = 0;
      
      // Calculate totals from actual data if processes exists
      if (lifecycle.processes && Array.isArray(lifecycle.processes.process_categories)) {
        // Count total process groups
        lifecycle.processes.process_categories.forEach((category: ProcessCategory) => {
          if (category.process_groups && Array.isArray(category.process_groups)) {
            processes += category.process_groups.length;
          }
          
          // Sum up category scores as the scoring value
          scoring += category.score || 0;
        });
      }
      
      // Keep painPoints at 0 as requested
      const painPoints = 0;
      
      // Mock cost values - these would be calculated in a real implementation
      const costToServe = -1 * (Math.floor(Math.random() * 2500000) + 500000);
      const industryBenchmark = -1 * (Math.floor(Math.random() * 1500000) + 500000);
      const delta = industryBenchmark - costToServe;
      
      return {
        ...lifecycle,
        costMetrics: {
          processes,
          painPoints,
          scoring,
          costToServe,
          industryBenchmark,
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