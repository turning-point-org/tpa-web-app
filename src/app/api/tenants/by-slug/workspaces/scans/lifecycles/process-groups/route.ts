import { NextResponse } from 'next/server';
import { container } from '@/lib/cosmos';

/**
 * API endpoint to get all process groups from a lifecycle
 * 
 * @returns A JSON response with an array of process groups
 */
export async function GET(req: Request) {
  // Extract query parameters from the URL
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const workspaceId = url.searchParams.get('workspace_id');
  const scanId = url.searchParams.get('scan_id');
  const lifecycleId = url.searchParams.get('lifecycle_id');
  
  // Validate required parameters
  if (!slug || !workspaceId || !scanId || !lifecycleId) {
    return NextResponse.json(
      { error: 'Missing required parameters: slug, workspace_id, scan_id, or lifecycle_id' },
      { status: 400 }
    );
  }
  
  try {
    // Check if Cosmos DB container is initialized
    if (!container) {
      throw new Error('Cosmos DB container is not initialized');
    }
    
    // Query for the lifecycle record
    const query = `
      SELECT * FROM c 
      WHERE c.type = "lifecycle" 
      AND c.tenant_slug = @slug
      AND c.workspace_id = @workspaceId
      AND c.scan_id = @scanId
      AND c.id = @lifecycleId
    `;
    
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@slug", value: slug },
          { name: "@workspaceId", value: workspaceId },
          { name: "@scanId", value: scanId },
          { name: "@lifecycleId", value: lifecycleId }
        ]
      })
      .fetchAll();
    
    // If lifecycle not found
    if (resources.length === 0) {
      return NextResponse.json(
        { error: 'Lifecycle not found' },
        { status: 404 }
      );
    }
    
    const lifecycle = resources[0];
    
    // Extract all process groups from the lifecycle
    const processGroups: Array<{ name: string, description?: string }> = [];
    
    // Check if the lifecycle has process categories
    if (lifecycle.processes?.process_categories && 
        Array.isArray(lifecycle.processes.process_categories)) {
      
      // Loop through each category to collect process groups
      lifecycle.processes.process_categories.forEach((category: any) => {
        if (category.process_groups && Array.isArray(category.process_groups)) {
          category.process_groups.forEach((group: any) => {
            if (group && typeof group === 'object' && group.name) {
              // Check if this group is already in our array to avoid duplicates
              if (!processGroups.some(pg => pg.name === group.name)) {
                processGroups.push({
                  name: group.name,
                  description: group.description || ''
                });
              }
            }
          });
        }
      });
    }
    
    // Return the process groups
    return NextResponse.json({ 
      processGroups,
      count: processGroups.length 
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Error fetching process groups:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch process groups',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 