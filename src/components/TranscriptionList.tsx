'use client';
import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/components/Button';

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
  transcriptions: EnrichedTranscription[];
  painPointSummaries: Record<string, PainPointSummary>;
}

export default function TranscriptionList({ transcriptions, painPointSummaries }: TranscriptionListProps) {
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

  if (transcriptions.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600">No interview transcriptions found for this scan.</p>
        <p className="text-sm text-gray-500 mt-2">You can start an interview from the Business Lifecycles page to generate a transcript.</p>
      </div>
    );
  }

  let lastLifecycleName: string | null = null;

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
          {transcriptions.map((transcription) => {
            const showHeader = transcription.lifecycle_name !== lastLifecycleName;
            if (showHeader) {
              lastLifecycleName = transcription.lifecycle_name;
            }
            const lifecycleId = transcription.lifecycle_id;
            const painPoints = painPointSummaries[lifecycleId]?.pain_points || [];
            const painPointCount = painPoints.length;

            return (
              <React.Fragment key={transcription.id}>
                {showHeader && (
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-6 py-3 text-left">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-900">{transcription.lifecycle_name}</span>
                        {painPointCount > 0 && (
                          <span className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold" style={{ backgroundColor: '#0EA394' }}>
                            {painPointCount} Pain Points
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                <tr className="hover:bg-gray-50 border-t border-gray-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-800">{transcription.transcript_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{transcription.journey_ref}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">{new Date(transcription.created_at).toLocaleString()}</div>
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
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}