'use client';
import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/components/Button';

// Define the type for the lifecycle object
type Lifecycle = {
  id: string;
  name: string;
};

// Define the type for the enriched transcription object
type EnrichedTranscription = {
  id: string;
  lifecycle_id: string;
  lifecycle_name: string;
  created_at: string;
  transcript_name?: string;
  journey_ref?: string;
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

interface TranscriptionListProps {
  lifecycles: Lifecycle[];
  transcriptions: EnrichedTranscription[];
  painPointSummaries: Record<string, PainPointSummary>;
}

export default function TranscriptionList({ lifecycles, transcriptions, painPointSummaries }: TranscriptionListProps) {
  const router = useRouter();
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;

  const handleViewClick = (
    lifecycleId: string, 
    transcriptionId: string,
    transcriptName?: string,
    journeyRef?: string
  ) => {
    const query = new URLSearchParams();
    query.set('transcription_id', transcriptionId);
    if (journeyRef) {
      query.set('journey', journeyRef);
    }
    if (transcriptName) {
      query.set('transcript_name', transcriptName);
    }
    
    router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/interview-copilot/${lifecycleId}?${query.toString()}`);
  };

  if (lifecycles.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600">No business lifecycles found for this scan.</p>
        <p className="text-sm text-gray-500 mt-2">You can create lifecycles and start interviews from the Business Lifecycles page.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
      <table className="min-w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Interview Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Journey Ref
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Interview Date
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {lifecycles.map((lifecycle) => {
            const lifecycleTranscriptions = transcriptions.filter(t => t.lifecycle_id === lifecycle.id);
            const painPoints = painPointSummaries[lifecycle.id]?.pain_points || [];
            const painPointCount = painPoints.length;

            return (
              <React.Fragment key={lifecycle.id}>
                {/* Lifecycle Header Row */}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-6 py-3 text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-md font-semibold text-gray-900">{lifecycle.name}</span>
                      {painPointCount > 0 && (
                        <span className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold" style={{ backgroundColor: '#0EA394' }}>
                          {painPointCount} Pain Points
                        </span>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Transcription Rows */}
                {lifecycleTranscriptions.length > 0 ? (
                  lifecycleTranscriptions.map(transcription => (
                    <tr key={transcription.id} className="hover:bg-gray-50 border-t border-gray-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-800">{transcription.transcript_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{transcription.journey_ref}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {new Date(transcription.created_at).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}
                          {' '}
                          {new Date(transcription.created_at).toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          onClick={() => handleViewClick(
                            transcription.lifecycle_id, 
                            transcription.id,
                            transcription.transcript_name,
                            transcription.journey_ref
                          )}
                          variant="primary"
                          className="text-sm"
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      No interviews recorded for this lifecycle.
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}