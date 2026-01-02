import { NextRequest, NextResponse } from "next/server";
import { container } from "@/lib/cosmos";
import { withTenantAuth } from "@/utils/tenant-auth";

// GET endpoint to fetch all transcriptions for a given scan
export const GET = withTenantAuth(async (req: NextRequest, _user?: unknown, _tenantId?: string) => {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");

    if (!tenantSlug || !workspaceId || !scanId) {
      return NextResponse.json(
        { error: "Missing required parameters: slug, workspace_id, scan_id" },
        { status: 400 }
      );
    }

    if (!container) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // 1. Fetch all lifecycles for the scan to create a name map
    const lifecycleQuery = `
      SELECT c.id, c.name 
      FROM c 
      WHERE c.type = "lifecycle" 
      AND c.tenant_slug = @tenantSlug
      AND c.workspace_id = @workspaceId
      AND c.scan_id = @scanId
    `;
    const { resources: lifecycles } = await container.items.query({
      query: lifecycleQuery,
      parameters: [
        { name: "@tenantSlug", value: tenantSlug },
        { name: "@workspaceId", value: workspaceId },
        { name: "@scanId", value: scanId },
      ]
    }).fetchAll();

    const lifecycleNameMap = new Map(lifecycles.map(lc => [lc.id, lc.name]));

    // 2. Fetch all transcriptions for the scan
    const transcriptionQuery = `
      SELECT c.id, c.lifecycle_id, c.created_at, c.transcript_name, c.journey_ref 
      FROM c 
      WHERE c.type = "pain_point_transcription" 
      AND c.tenant_slug = @tenantSlug
      AND c.workspace_id = @workspaceId
      AND c.scan_id = @scanId
      ORDER BY c.created_at DESC
    `;
    const { resources: transcriptions } = await container.items.query({
      query: transcriptionQuery,
      parameters: [
        { name: "@tenantSlug", value: tenantSlug },
        { name: "@workspaceId", value: workspaceId },
        { name: "@scanId", value: scanId },
      ]
    }).fetchAll();

    if (transcriptions.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // 3. Enrich transcriptions with lifecycle name
    const enrichedTranscriptions = transcriptions.map(t => {
      return {
        id: t.id,
        lifecycle_id: t.lifecycle_id,
        created_at: t.created_at,
        lifecycle_name: lifecycleNameMap.get(t.lifecycle_id) || "Unknown Lifecycle",
        transcript_name: t.transcript_name || "Unnamed Transcript",
        journey_ref: t.journey_ref || "N/A",
      };
    });

    return NextResponse.json(enrichedTranscriptions, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: unknown) {
    console.error("Error fetching transcriptions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred." },
      { status: 500 }
    );
  }
});
