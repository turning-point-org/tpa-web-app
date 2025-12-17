'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/Button';
import Tag from '@/components/Tag';

// Define the Lifecycle type including the new status field
type Lifecycle = {
  id: string;
  name: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
  interview_status?: 'required' | 'complete'; // Add optional status
  processes?: { // Add optional processes object
    process_categories?: Array<{
      name: string;
      description?: string;
      process_groups?: Array<{
        name: string;
        description?: string;
      }>;
    }>;
  };
};

// Define the PainPoint type
type PainPoint = {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  score?: number;
  cost_to_serve?: number;
};

// Define the PainPointSummary type
type PainPointSummary = {
  id: string;
  lifecycle_id: string;
  pain_points: PainPoint[];
  overallSummary: string;
};

interface LifecycleSelectorProps {
  initialLifecycles: Lifecycle[];
  initialPainPointSummaries: Record<string, PainPointSummary>;
}

export default function LifecycleSelector({ initialLifecycles, initialPainPointSummaries }: LifecycleSelectorProps) {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;

  const [lifecycles, setLifecycles] = useState<Lifecycle[]>(initialLifecycles);
  const [painPointSummaries] = useState<Record<string, PainPointSummary>>(initialPainPointSummaries);
  const [error, setError] = useState<string | null>(null);
  const [selectedJourneys, setSelectedJourneys] = useState<Record<string, string>>({});

  // Update state if initial props change
  useEffect(() => {
    setLifecycles(initialLifecycles);
  }, [initialLifecycles]);

  const calculatePainPointCount = (lifecycleId: string): number => {
    const summary = painPointSummaries[lifecycleId];
    return summary?.pain_points?.length || 0;
  };

  const handleStatusChange = useCallback(async (lifecycleId: string, newStatus: 'required' | 'complete') => {
    setLifecycles(prev => 
      prev.map(lc => 
        lc.id === lifecycleId ? { ...lc, interview_status: newStatus } : lc
      )
    );

    try {
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_interview_status',
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          lifecycle_id: lifecycleId,
          status: newStatus
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update status: ${response.statusText}`);
      }
    } catch (err: any) {
      setError(err.message);
      // Revert UI change on error
      setLifecycles(prev => 
        prev.map(lc => 
          lc.id === lifecycleId ? { ...lc, interview_status: newStatus === 'required' ? 'complete' : 'required' } : lc
        )
      );
    }
  }, [tenantSlug, workspaceId, scanId]);

  const handleJourneyChange = useCallback((lifecycleId: string, journey: string) => {
    setSelectedJourneys(prev => ({ ...prev, [lifecycleId]: journey }));
  }, []);

  if (lifecycles.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-gray-50 rounded-lg border border-gray-200 mb-8">
        <p className="text-gray-600">No business lifecycles found for this scan.</p>
        <p className="text-sm text-gray-500 mt-2">Please generate or add lifecycles first in the 'Business Lifecycles' section.</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {lifecycles.map((lifecycle) => {
          const painPointCount = calculatePainPointCount(lifecycle.id);
          const journeyOptions = lifecycle.processes?.process_categories?.map(
            (category) => ({
              name: category.name,
              value: category.name.replace(/ /g, '_'),
            })
          ) || [];
          
          return (
            <div key={lifecycle.id} className="border border-gray-200 rounded-lg shadow-sm bg-white p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">{lifecycle.name}</h3>
                  {painPointCount > 0 && (
                    <span 
                      className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                      style={{ backgroundColor: '#0EA394' }}
                    >
                      {painPointCount} Pain Points
                    </span>
                  )}
                </div>
                <p className="text-gray-600 mb-4 text-sm"></p> {/* removed - lifecycle.description */}
              </div>
              <div className="mt-auto">
                <div className="flex items-center justify-between gap-4">
                  {/* removed previous ui parts */}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
