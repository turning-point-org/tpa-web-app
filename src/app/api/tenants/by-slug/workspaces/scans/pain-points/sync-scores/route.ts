/**
 * DEPRECATED: This API endpoint is no longer used as of the refactoring that removed
 * score syncing between pain points and lifecycle data. The LifecycleViewer component 
 * now directly calculates scores from pain points data on the client side.
 * 
 * This file can be removed in a future update once all references to it are confirmed
 * to be eliminated from the codebase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/cosmos';

interface PainPoint {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  score?: number;
}

// POST endpoint to sync pain point scores with lifecycle process groups
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const lifecycleId = searchParams.get("lifecycle_id");

    if (!tenantSlug || !workspaceId || !scanId || !lifecycleId) {
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

    // First, fetch the pain points for this lifecycle
    const painPoints = await fetchPainPoints(tenantSlug, workspaceId, scanId, lifecycleId);
    
    if (!painPoints || !painPoints.length) {
      return NextResponse.json(
        { message: "No pain points found for this lifecycle, nothing to sync" },
        { status: 200 }
      );
    }
    
    // Then, update the lifecycle data with the scores
    const result = await updateLifecycleScores(tenantSlug, workspaceId, scanId, lifecycleId, painPoints);
    
    return NextResponse.json(
      { message: "Lifecycle scores synchronized successfully", affected_groups: result.updatedGroups },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error synchronizing pain point scores with lifecycle:', error);
    return NextResponse.json(
      { error: 'Failed to sync scores', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Fetch pain points for a specific lifecycle
 */
async function fetchPainPoints(
  tenantSlug: string,
  workspaceId: string,
  scanId: string,
  lifecycleId: string
): Promise<PainPoint[]> {
  // Check if container is initialized
  if (!container) {
    throw new Error('Database connection not available');
  }
  
  // Query for the summary record
  const query = `
    SELECT * FROM c 
    WHERE c.type = "pain_point_summary" 
    AND c.tenant_slug = @tenantSlug
    AND c.workspace_id = @workspaceId
    AND c.scan_id = @scanId
    AND c.lifecycle_id = @lifecycleId
  `;

  const { resources } = await container.items
    .query({
      query,
      parameters: [
        { name: "@tenantSlug", value: tenantSlug },
        { name: "@workspaceId", value: workspaceId },
        { name: "@scanId", value: scanId },
        { name: "@lifecycleId", value: lifecycleId }
      ]
    })
    .fetchAll();

  if (resources.length === 0) {
    return [];
  }

  // Return the pain points from the most recent summary if multiple exist
  const sortedResources = resources.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Handle both property naming conventions (pain_points and painPoints)
  return sortedResources[0].pain_points || sortedResources[0].painPoints || [];
}

/**
 * Update lifecycle process group scores based on pain points
 */
async function updateLifecycleScores(
  tenantSlug: string,
  workspaceId: string,
  scanId: string,
  lifecycleId: string,
  painPoints: PainPoint[]
): Promise<{ updatedGroups: string[] }> {
  // Check if container is initialized
  if (!container) {
    throw new Error('Database connection not available');
  }
  
  // First, fetch the lifecycle data
  const query = `
    SELECT * FROM c 
    WHERE c.type = "lifecycle" 
    AND c.tenant_slug = @tenantSlug
    AND c.workspace_id = @workspaceId
    AND c.scan_id = @scanId
    AND c.id = @lifecycleId
  `;

  const { resources } = await container.items
    .query({
      query,
      parameters: [
        { name: "@tenantSlug", value: tenantSlug },
        { name: "@workspaceId", value: workspaceId },
        { name: "@scanId", value: scanId },
        { name: "@lifecycleId", value: lifecycleId }
      ]
    })
    .fetchAll();

  if (resources.length === 0) {
    throw new Error('Lifecycle data not found');
  }

  const lifecycle = resources[0];
  
  if (!lifecycle.processes || !lifecycle.processes.process_categories) {
    throw new Error('Lifecycle data has invalid structure');
  }
  
  // Fetch tenant ID for partitioning
  const tenantQuery = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id`;
  const { resources: tenantResources } = await container.items
    .query({
      query: tenantQuery,
      parameters: [{ name: "@slug", value: tenantSlug.toLowerCase() }],
    })
    .fetchAll();

  if (tenantResources.length === 0) {
    throw new Error(`Tenant not found with slug: ${tenantSlug}`);
  }

  const tenantId = tenantResources[0].id;
  
  // Create a map to track total scores by process group
  const processGroupScores: { [key: string]: number } = {};
  
  // Calculate total scores for each process group based on pain points
  for (const painPoint of painPoints) {
    if (painPoint.assigned_process_group && painPoint.assigned_process_group !== 'Unassigned' && painPoint.score) {
      const groupName = painPoint.assigned_process_group;
      if (!processGroupScores[groupName]) {
        processGroupScores[groupName] = 0;
      }
      processGroupScores[groupName] += painPoint.score;
    }
  }
  
  console.log('Calculated process group scores from pain points:', processGroupScores);
  
  // Update the process group scores in the lifecycle data
  let updated = false;
  const updatedGroups: string[] = [];
  
  for (const category of lifecycle.processes.process_categories) {
    let categoryScore = 0;
    
    if (category.process_groups && Array.isArray(category.process_groups)) {
      for (const group of category.process_groups) {
        // If this group has assigned pain points, update its score
        if (processGroupScores[group.name] !== undefined) {
          // Only track as updated if the score is changing
          if (group.score !== processGroupScores[group.name]) {
            group.score = processGroupScores[group.name];
            updatedGroups.push(group.name);
            updated = true;
          }
        }
        
        // Add to category total score
        categoryScore += (group.score || 0);
      }
      
      // Update the category score (sum of all group scores)
      if (category.score !== categoryScore) {
        category.score = categoryScore;
        updated = true;
      }
    }
  }
  
  // Only update in the database if changes were made
  if (updated) {
    // Update the lifecycle document
    lifecycle.updated_at = new Date().toISOString();
    
    await container
      .item(lifecycle.id, tenantId)
      .replace(lifecycle);
    
    console.log(`Lifecycle scores updated for lifecycle ID: ${lifecycleId}`);
  } else {
    console.log('No score updates needed for lifecycle');
  }
  
  return { updatedGroups };
} 