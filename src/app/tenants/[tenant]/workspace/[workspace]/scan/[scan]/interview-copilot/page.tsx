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
  processes?: {
    process_categories?: Array<{ // Make categories optional too
      name: string;
      description?: string;
      score?: number;
      // Add nested structure if needed later
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

export default function InterviewCopilotPage() {
  // Get URL parameters
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;

  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);
  const [painPointSummaries, setPainPointSummaries] = useState<Record<string, PainPointSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate total score for a lifecycle from pain points
  const calculateTotalScore = (lifecycleId: string): number => {
    const summary = painPointSummaries[lifecycleId];
    if (!summary || !summary.pain_points) return 0;
    
    return summary.pain_points.reduce((total, point) => total + (point.score || 0), 0);
  };

  // Calculate total cost for a lifecycle from pain points
  const calculateTotalCost = (lifecycleId: string): number => {
    const summary = painPointSummaries[lifecycleId];
    if (!summary || !summary.pain_points) return 0;
    
    return summary.pain_points.reduce((total, point) => total + (point.cost_to_serve || 0), 0);
  };

  // Fetch lifecycles on component mount
  useEffect(() => {
    async function loadLifecycles() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );

        if (response.ok) {
          const data: Lifecycle[] = await response.json();
          // Ensure status has a default if missing from DB
          const lifecyclesWithDefaults = data.map(lc => ({
            ...lc,
            interview_status: lc.interview_status || 'required'
          }));
          setLifecycles(lifecyclesWithDefaults);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to load lifecycles");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while loading lifecycles");
      } finally {
        setIsLoading(false);
      }
    }
    
    loadLifecycles();
  }, [tenantSlug, workspaceId, scanId]);

  // Fetch pain point summaries for all lifecycles
  useEffect(() => {
    async function loadPainPointSummaries() {
      if (!lifecycles.length) return;
      
      setIsLoadingSummaries(true);
      
      try {
        const summaries: Record<string, PainPointSummary> = {};
        
        // Create an array of promises for fetching all summaries
        const fetchPromises = lifecycles.map(async (lifecycle) => {
          try {
            const response = await fetch(
              `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}&t=${Date.now()}`
            );
            
            if (response.ok) {
              const data = await response.json();
              // Store the summary with lifecycle ID as key
              summaries[lifecycle.id] = {
                ...data,
                pain_points: data.pain_points || []
              };
            } else if (response.status !== 404) {
              // Only log errors for non-404 responses (404 just means no data yet)
              console.warn(`Failed to load pain point summary for lifecycle ${lifecycle.id}:`, response.status);
            }
          } catch (err) {
            console.error(`Error fetching pain point summary for lifecycle ${lifecycle.id}:`, err);
          }
        });
        
        // Wait for all fetch operations to complete
        await Promise.all(fetchPromises);
        
        // Update state with all summaries
        setPainPointSummaries(summaries);
      } catch (err) {
        console.error('Error loading pain point summaries:', err);
      } finally {
        setIsLoadingSummaries(false);
      }
    }
    
    loadPainPointSummaries();
  }, [lifecycles, tenantSlug, workspaceId, scanId]);

  // Handler for changing the interview status
  const handleStatusChange = useCallback(async (lifecycleId: string, newStatus: 'required' | 'complete') => {
    // Optimistically update UI
    setLifecycles(prev => 
      prev.map(lc => 
        lc.id === lifecycleId ? { ...lc, interview_status: newStatus } : lc
      )
    );

    try {
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
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
        setError(`Failed to update status for ${lifecycleId}: ${errorData.error || response.statusText}`);
        // Revert UI change on error
        setLifecycles(prev => 
          prev.map(lc => 
            lc.id === lifecycleId ? { ...lc, interview_status: newStatus === 'required' ? 'complete' : 'required' } : lc
          )
        );
      }
    } catch (err: any) {
      setError(`Error updating status: ${err.message}`);
      // Revert UI change on error
      setLifecycles(prev => 
        prev.map(lc => 
          lc.id === lifecycleId ? { ...lc, interview_status: newStatus === 'required' ? 'complete' : 'required' } : lc
        )
      );
    }
  }, [tenantSlug, workspaceId, scanId]);

  return (
    <div className="max-w-[1200px] mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Interview Copilot</h2>
      <p className="text-gray-600 mb-6">Conduct interviews based on business lifecycles to identify pain points and opportunities for improvement.</p>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.03a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
          </button>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : lifecycles.length === 0 ? (
        <div className="text-center py-10 px-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600">No business lifecycles found for this scan.</p>
          <p className="text-sm text-gray-500 mt-2">Please generate or add lifecycles first in the 'Business Lifecycles' section.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lifecycles.map((lifecycle) => {
            // Get total score and pain point count
            const score = calculateTotalScore(lifecycle.id);
            const painPointCount = painPointSummaries[lifecycle.id]?.pain_points?.length || 0;
            
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
                  <p className="text-gray-600 mb-4">{lifecycle.description}</p>
                  <div className="mb-4 flex flex-wrap gap-2">                    
                    {/* Display score from pain points */}
                    {score > 0 && (
                      <Tag className="bg-[#0EA394] text-white">
                        {score} pts
                      </Tag>
                    )}
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <label htmlFor={`status-${lifecycle.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        Interview Status
                      </label>
                      <select
                        id={`status-${lifecycle.id}`}
                        name="interview_status"
                        value={lifecycle.interview_status || 'required'} // Default to required if undefined
                        onChange={(e) => handleStatusChange(lifecycle.id, e.target.value as 'required' | 'complete')}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-[200px]"
                      >
                        <option value="required">Interview Required</option>
                        <option value="complete">Interview Complete</option>
                      </select>
                    </div>
                    <Button
                      onClick={() => router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/interview-copilot/${lifecycle.id}`)}
                      variant="primary"
                      className="text-sm self-end"
                    >
                      Start Interview
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 