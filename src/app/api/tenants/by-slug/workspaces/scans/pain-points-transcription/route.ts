import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { v4 as uuidv4 } from "uuid";

// GET: Retrieve a pain points transcription for a specific scan
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

    // Query for the pain points transcription document
    const query = `
      SELECT * FROM c 
      WHERE c.type = "pain_points_transcription" 
      AND c.scan_id = @scanId 
      AND c.workspace_id = @workspaceId 
      AND c.tenant_slug = @tenantSlug
    `;
    
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@scanId", value: scanId },
          { name: "@workspaceId", value: workspaceId },
          { name: "@tenantSlug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (resources.length === 0) {
      return NextResponse.json(
        { 
          transcription: null,
          speakers: {},
          message: "No transcription found"
        }
      );
    }

    return NextResponse.json({
      transcription: resources[0].transcription,
      speakers: resources[0].speakers || {},
      updated_at: resources[0].updated_at
    });
  } catch (error) {
    console.error("GET /api/tenants/by-slug/workspaces/scans/pain-points-transcription error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pain points transcription" },
      { status: 500 }
    );
  }
}

// POST: Save a transcription
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcription, speakers, tenantSlug, workspaceId, scanId } = body;
    
    if (!transcription || typeof transcription !== 'string') {
      console.error('Invalid request body:', body);
      return NextResponse.json(
        { error: 'Invalid request body. "transcription" field is required and must be a string.' },
        { status: 400 }
      );
    }
    
    // Validate required IDs for saving to Cosmos DB
    if (!tenantSlug || !workspaceId || !scanId) {
      console.error('Missing required IDs for saving to Cosmos DB:', { tenantSlug, workspaceId, scanId });
      return NextResponse.json(
        { error: 'Missing tenant slug, workspace ID, or scan ID.' },
        { status: 400 }
      );
    }
    
    await saveTranscriptionToCosmosDB(transcription, speakers, tenantSlug, workspaceId, scanId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving transcription:', error);
    return NextResponse.json(
      { error: 'Failed to save transcription', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Save the transcription to Cosmos DB
 * @param transcription The transcription text to save
 * @param speakers The speakers mapping object
 * @param tenantSlug The tenant slug
 * @param workspaceId The workspace ID
 * @param scanId The scan ID
 */
async function saveTranscriptionToCosmosDB(
  transcription: string,
  speakers: Record<string, string> = {},
  tenantSlug: string, 
  workspaceId: string, 
  scanId: string
): Promise<void> {
  try {
    console.log('Saving transcription to Cosmos DB...');
    
    // First, fetch the tenant record to get the tenant_id for partitioning
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
    
    // Check if a transcription already exists for this scan
    const transcriptionQuery = `SELECT * FROM c WHERE c.type = "pain_points_transcription" AND c.scan_id = @scanId AND c.workspace_id = @workspaceId AND c.tenant_slug = @tenantSlug`;
    const { resources: existingTranscriptions } = await container.items
      .query({
        query: transcriptionQuery,
        parameters: [
          { name: "@scanId", value: scanId },
          { name: "@workspaceId", value: workspaceId },
          { name: "@tenantSlug", value: tenantSlug }
        ],
      })
      .fetchAll();
    
    if (existingTranscriptions.length > 0) {
      // Update the existing transcription
      const existingTranscription = existingTranscriptions[0];
      existingTranscription.transcription = transcription;
      existingTranscription.speakers = speakers;
      existingTranscription.updated_at = new Date().toISOString();
      
      await container
        .item(existingTranscription.id, tenantId)
        .replace(existingTranscription);
        
      console.log(`Updated existing transcription with ID: ${existingTranscription.id}`);
    } else {
      // Create a new transcription document
      const transcriptionDocument = {
        id: uuidv4(),
        tenant_id: tenantId,
        tenant_slug: tenantSlug,
        workspace_id: workspaceId,
        scan_id: scanId,
        type: "pain_points_transcription",
        transcription: transcription,
        speakers: speakers,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await container.items.create(transcriptionDocument);
      console.log(`Created new transcription document with ID: ${transcriptionDocument.id}`);
    }
  } catch (error) {
    console.error('Error saving transcription to Cosmos DB:', error);
    throw error;
  }
}

// DELETE: Delete a transcription
export async function DELETE(req: NextRequest) {
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

    // First, fetch the tenant record to get the tenant_id for partitioning
    const tenantQuery = `SELECT * FROM c WHERE LOWER(c.slug) = @slug AND c.id = c.tenant_id`;
    const { resources: tenantResources } = await container.items
      .query({
        query: tenantQuery,
        parameters: [{ name: "@slug", value: tenantSlug.toLowerCase() }],
      })
      .fetchAll();
    
    if (tenantResources.length === 0) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }
    
    const tenantId = tenantResources[0].id;

    // Query for the transcription document
    const transcriptionQuery = `
      SELECT * FROM c 
      WHERE c.type = "pain_points_transcription" 
      AND c.scan_id = @scanId 
      AND c.workspace_id = @workspaceId 
      AND c.tenant_slug = @tenantSlug
    `;
    
    const { resources: transcriptions } = await container.items
      .query({
        query: transcriptionQuery,
        parameters: [
          { name: "@scanId", value: scanId },
          { name: "@workspaceId", value: workspaceId },
          { name: "@tenantSlug", value: tenantSlug },
        ],
      })
      .fetchAll();

    if (transcriptions.length === 0) {
      return NextResponse.json(
        { 
          success: true,
          message: "No transcription found to delete"
        }
      );
    }

    // Delete the transcription
    const transcription = transcriptions[0];
    await container.item(transcription.id, tenantId).delete();
    
    console.log(`Deleted transcription with ID: ${transcription.id}`);

    return NextResponse.json({
      success: true,
      message: "Transcription deleted successfully"
    });
  } catch (error) {
    console.error("DELETE /api/tenants/by-slug/workspaces/scans/pain-points-transcription error:", error);
    return NextResponse.json(
      { error: "Failed to delete transcription", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 