import { headers } from 'next/headers';
import TranscriptionList from '@/components/TranscriptionList';
import LifecycleSelector from '@/components/LifecycleSelector';
import NewInterviewButton from '@/components/NewInterviewButton'; // Import the new component

// Define types
type EnrichedTranscription = {
  id: string;
  lifecycle_id: string;
  lifecycle_name: string;
  created_at: string;
  transcript_name?: string;
  journey_ref?: string;
};

type Lifecycle = {
  id: string;
  name: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
  interview_status?: 'required' | 'complete';
  processes?: { // Ensure processes is part of the type for the new modal
    process_categories?: Array<{
      name: string;
    }>;
  };
};

type PainPoint = {
  id: string;
  name: string;
  description: string;
};

type PainPointSummary = {
  id: string;
  lifecycle_id: string;
  pain_points: PainPoint[];
  overallSummary: string;
};

// Helper function to construct the absolute URL for server-side fetching
function getAbsoluteUrl(path: string) {
  const headersList = headers();
  const host = headersList.get('host') || '';
  const protocol = headersList.get('x-forwarded-proto') || 'http';
  return `${protocol}://${host}${path}`;
}

// Fetch all data in parallel
async function getPageData(tenantSlug: string, workspaceId: string, scanId: string) {
  const headersList = await headers();
  const cookie = headersList.get('cookie') || '';
  const commonHeaders = { 'Cookie': cookie, 'Cache-Control': 'no-store' };

  const transcriptionsUrl = getAbsoluteUrl(`/api/tenants/by-slug/workspaces/scans/transcriptions?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`);
  const lifecyclesUrl = getAbsoluteUrl(`/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`);

  try {
    const [transcriptionsResponse, lifecyclesResponse] = await Promise.all([
      fetch(transcriptionsUrl, { headers: commonHeaders }),
      fetch(lifecyclesUrl, { headers: commonHeaders })
    ]);

    if (!transcriptionsResponse.ok) throw new Error('Failed to fetch transcriptions');
    if (!lifecyclesResponse.ok) throw new Error('Failed to fetch lifecycles');

    const transcriptions: EnrichedTranscription[] = await transcriptionsResponse.json();
    const lifecycles: Lifecycle[] = await lifecyclesResponse.json();

    // Fetch pain point summaries for each lifecycle
    const painPointSummaries: Record<string, PainPointSummary> = {};
    const summaryPromises = lifecycles.map(async (lifecycle) => {
      const summaryUrl = getAbsoluteUrl(`/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`);
      const res = await fetch(summaryUrl, { headers: commonHeaders });
      if (res.ok) {
        painPointSummaries[lifecycle.id] = await res.json();
      }
    });

    await Promise.all(summaryPromises);

    return { transcriptions, lifecycles, painPointSummaries, error: null };

  } catch (error: unknown) {
    console.error("Error fetching page data on server:", error);
    return { 
      transcriptions: [], 
      lifecycles: [], 
      painPointSummaries: {}, 
      error: error instanceof Error ? error.message : "An unknown error occurred." 
    };
  }
}

export default async function InterviewCopilotPage({ params }: { params: { tenant: string, workspace: string, scan: string } }) {
  const { tenant, workspace, scan } = params;
  const { transcriptions, lifecycles, painPointSummaries, error } = await getPageData(tenant, workspace, scan);

  // Sort transcriptions: Primary by lifecycle name (asc), Secondary by date (desc)
  transcriptions.sort((a, b) => {
    // Primary sort: lifecycle_name
    const lifecycleComparison = a.lifecycle_name.localeCompare(b.lifecycle_name);
    if (lifecycleComparison !== 0) {
      return lifecycleComparison;
    }
    // Secondary sort: created_at (date)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Interview Copilot</h1>
        <p className="text-gray-600">Conduct interviews based on business lifecycles to identify pain points and opportunities for improvement.</p>
      </div>
      
      {error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      ) : (
        <>
          <div className="border-b border-gray-200 pb-5 mb-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Start an Interview</h2>
              <NewInterviewButton lifecycles={lifecycles} />
            </div>
            <p className="text-gray-600 mt-2">Select a business lifecycle to begin a new interview or review a previous one.</p>
          </div>

          <LifecycleSelector 
            initialLifecycles={lifecycles} 
            initialPainPointSummaries={painPointSummaries} 
          />
          
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">Interviews </h2>
            <p className="text-gray-600 mb-6">Review all interview transcriptions recorded for this scan. Select a transcription to view its details and associated pain points.</p>
            <TranscriptionList transcriptions={transcriptions} painPointSummaries={painPointSummaries} />
          </div>
        </>
      )}
    </div>
  );
}