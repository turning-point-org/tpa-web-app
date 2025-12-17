import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";

import { withTenantAuth } from "@/utils/tenant-auth";
// Function to get tenant_id from tenant_slug
async function getTenantIdFromSlug(tenantSlug: string): Promise<string> {
  // Check if container is initialized
  if (!container) {
    throw new Error("Database connection not available");
  }
  
  // Query for the tenant record using the provided slug
  const query = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id`;
  const { resources } = await container.items
    .query({
      query,
      parameters: [{ name: "@slug", value: tenantSlug.toLowerCase() }],
    })
    .fetchAll();

  if (resources.length === 0) {
    throw new Error("Tenant not found");
  }

  return resources[0].tenant_id;
}

// GET endpoint to fetch a transcription
export const GET = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const lifecycleId = searchParams.get("lifecycle_id");
    const fetchBy = searchParams.get("fetch_by");
    const transcriptionId = searchParams.get("transcription_id");

    if (!container) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Fetch by specific transcription ID if requested
    if (fetchBy === 'id' && transcriptionId) {
      if (!tenantSlug) {
        return NextResponse.json({ error: "Missing required parameter: slug" }, { status: 400 });
      }
      const query = `SELECT * FROM c WHERE c.id = @transcriptionId AND c.type = 'pain_point_transcription'`;
      const { resources } = await container.items.query({
        query,
        parameters: [{ name: "@transcriptionId", value: transcriptionId }]
      }).fetchAll();

      if (resources.length === 0) {
        return NextResponse.json({ message: "Transcription not found" }, { status: 404 });
      }
      
      return NextResponse.json(resources[0], {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Fallback to original logic: Fetch latest for a lifecycle
    if (!tenantSlug || !workspaceId || !scanId || !lifecycleId) {
      return NextResponse.json(
        { error: "Missing required parameters for lifecycle fetch: slug, workspace_id, scan_id, and lifecycle_id are required." },
        { status: 400 }
      );
    }

    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_point_transcription" 
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
      return NextResponse.json(
        { message: "No transcription found for this lifecycle" },
        { status: 404 }
      );
    }

    // Return the most recent transcription if multiple exist
    const sortedResources = resources.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return NextResponse.json(sortedResources[0], {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error("Error fetching transcription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch transcription" },
      { status: 500 }
    );
  }
});

// POST endpoint to create a transcription and trigger a summary update
export const POST = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
  try {
    const body = await req.json();
    const { 
      transcription, 
      tenantSlug, 
      workspaceId, 
      scanId, 
      lifecycleId,
      transcript_name, // New field
      journey_ref      // New field
    } = body;

    if (!transcription || !tenantSlug || !workspaceId || !scanId || !lifecycleId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!container) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // --- New Logic: Duplicate Check ---
    // Check if this exact transcription already exists for this lifecycle
    const duplicateQuery = `
      SELECT TOP 1 c.id FROM c 
      WHERE c.type = 'pain_point_transcription' 
      AND c.lifecycle_id = @lifecycleId 
      AND c.transcription = @transcription
    `;
    
    const { resources: existingTranscripts } = await container.items.query({
      query: duplicateQuery,
      parameters: [
        { name: "@lifecycleId", value: lifecycleId },
        { name: "@transcription", value: transcription }
      ]
    }).fetchAll();

    // If duplicate found, return success immediately without creating a new record
    if (existingTranscripts.length > 0) {
      console.log(`Skipping duplicate transcription for lifecycle: ${lifecycleId}`);
      return NextResponse.json({ 
        success: true, 
        message: "Transcription already exists. Skipped creation.",
        id: existingTranscripts[0].id // Return the ID of the existing record
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    // --- End Duplicate Check ---

    let tenant_id;
    try {
      tenant_id = await getTenantIdFromSlug(tenantSlug);
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to find tenant" },
        { status: 404 }
      );
    }

    const timestamp = new Date().toISOString();
    const newId = uuidv4();
    const newItem = {
      id: newId,
      tenant_id,
      type: "pain_point_transcription",
      tenant_slug: tenantSlug,
      workspace_id: workspaceId,
      scan_id: scanId,
      lifecycle_id: lifecycleId,
      transcription,
      transcript_name: transcript_name || `Interview - ${timestamp}`, // Add new field with fallback
      journey_ref: journey_ref || 'not_specific', // Add new field with fallback
      created_at: timestamp,
      updated_at: timestamp
    };

    // Always create a new transcription record
    await container.items.create(newItem);

    // --- New Logic: Trigger background summarization ---
    try {
      // 1. Fetch all transcriptions for the lifecycle
      const allTranscriptionsQuery = `SELECT * FROM c WHERE c.type = "pain_point_transcription" AND c.lifecycle_id = @lifecycleId ORDER BY c.created_at ASC`;
      const { resources: allTranscriptions } = await container.items.query({
          query: allTranscriptionsQuery,
          parameters: [{ name: "@lifecycleId", value: lifecycleId }]
      }).fetchAll();

      // 2. Concatenate the text
      const fullText = allTranscriptions.map(t => t.transcription).join('\n\n---\n\n');

      // 3. Trigger the summarization API
      const summarizeUrl = new URL('/api/summarize', req.url);

      // Fire-and-forget the summarization request
      fetch(summarizeUrl.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              text: fullText,
              tenantSlug,
              workspaceId,
              scanId,
              lifecycleId,
              saveToDatabase: true
          })
      }).catch(error => {
          // Log the error, but don't fail the main request as this is a background task
          console.error('Failed to trigger background summarization:', error);
      });

    } catch (summaryError) {
        // Log any errors during the summary trigger process but do not let it fail the main response
        console.error('Error during summary trigger process:', summaryError);
    }
    // --- End of New Logic ---

    return NextResponse.json({ 
      success: true, 
      message: "Transcription created successfully, summary update triggered.",
      id: newId
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: any) {
    console.error("Error saving transcription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save transcription" },
      { status: 500 }
    );
  }
});

// DELETE endpoint to remove a transcription by its ID
export const DELETE = withTenantAuth(async (req: NextRequest, user?: any, tenantId?: string) => {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const lifecycleId = searchParams.get("lifecycle_id");
    const transcriptionId = searchParams.get("transcription_id");

    if (!transcriptionId) {
      return NextResponse.json(
        { error: "Missing required parameter: transcription_id" },
        { status: 400 }
      );
    }

    if (!tenantSlug || !workspaceId || !scanId || !lifecycleId) {
      return NextResponse.json(
        { error: "Missing one or more required parameters: slug, workspace_id, scan_id, lifecycle_id" },
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

    // Get tenant_id from tenant_slug
    let tenant_id;
    try {
        tenant_id = await getTenantIdFromSlug(tenantSlug);
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to find tenant" },
        { status: 500 }
      );
    }

    // Query for the specific transcription record to delete
    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_point_transcription" 
      AND c.id = @transcriptionId
      AND c.lifecycle_id = @lifecycleId
    `;

    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@transcriptionId", value: transcriptionId },
          { name: "@lifecycleId", value: lifecycleId }
        ]
      })
      .fetchAll();

    if (resources.length === 0) {
      return NextResponse.json(
        { message: "Transcription not found to delete" },
        { status: 404 }
      );
    }

    const itemToDelete = resources[0];
    await container.item(itemToDelete.id, tenant_id).delete();

    // After deleting, re-summarize the remaining transcriptions
    try {
      const allTranscriptionsQuery = `SELECT * FROM c WHERE c.type = "pain_point_transcription" AND c.lifecycle_id = @lifecycleId ORDER BY c.created_at ASC`;
      const { resources: allTranscriptions } = await container.items.query({
        query: allTranscriptionsQuery,
        parameters: [{ name: "@lifecycleId", value: lifecycleId }]
      }).fetchAll();

      const fullText = allTranscriptions.map(t => t.transcription).join('\n\n---\n\n');
      const summarizeUrl = new URL('/api/summarize', req.url);

      fetch(summarizeUrl.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          tenantSlug,
          workspaceId,
          scanId,
          lifecycleId,
          saveToDatabase: true
        })
      }).catch(error => {
        console.error('Failed to trigger background summarization after delete:', error);
      });

    } catch (summaryError) {
      console.error('Error triggering summary update after delete:', summaryError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted 1 transcription record and triggered summary update.`
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error("Error deleting transcription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete transcription" },
      { status: 500 }
    );
  }
}); 