"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/Button";

interface CostMetrics {
  processes: number;
  painPoints: number;
  points: number; // Renamed from scoring
  costToServe: number;
  industryBenchmark: number;
  delta: number;
}

interface Lifecycle {
  id: string;
  name: string;
  description?: string;
  position: number;
  costMetrics: CostMetrics;
}

interface ProcessCategory {
  name: string;
  description?: string;
  process_groups?: any[];
}

interface PainPoint {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  cost_to_serve?: number;
  [key: string]: any; // For strategic objective properties (so_*)
}

export default function LifecycleCostPage() {
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    async function fetchLifecycleData() {
      try {
        const tenantSlug = params.tenant as string;
        const workspaceId = params.workspace as string;
        const scanId = params.scan as string;

        if (!tenantSlug || !workspaceId || !scanId) {
          throw new Error("Missing required parameters");
        }

        // Fetch all lifecycles first
        const lifecyclesResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );

        if (!lifecyclesResponse.ok) {
          throw new Error("Failed to fetch lifecycles");
        }

        const lifecyclesData = await lifecyclesResponse.json();
        
        // For each lifecycle, fetch detailed data and pain points
        const enhancedLifecycles = await Promise.all(
          lifecyclesData.map(async (lifecycle: any) => {
            // Fetch detailed lifecycle data for process groups
            const lifecycleDetailResponse = await fetch(
              `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`
            );
            
            let processCount = 0;
            let processCategories: ProcessCategory[] = [];
            
            if (lifecycleDetailResponse.ok) {
              const data = await lifecycleDetailResponse.json();
              const lifecycleData = Array.isArray(data) ? data.find(lc => lc.id === lifecycle.id) : data;
              
              if (lifecycleData?.processes?.process_categories) {
                processCategories = lifecycleData.processes.process_categories;
                
                // Count process groups
                processCount = processCategories.reduce((count, category) => {
                  return count + (category.process_groups?.length || 0);
                }, 0);
              }
            }
            
            // Fetch pain points for this lifecycle
            const painPointsResponse = await fetch(
              `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`
            );
            
            let painPoints: PainPoint[] = [];
            let costToServe = 0;
            let totalPoints = 0;
            
            if (painPointsResponse.ok) {
              const painPointsData = await painPointsResponse.json();
              painPoints = painPointsData.pain_points || [];
              
              // Filter out pain points with "Unassigned" process group
              const assignedPainPoints = painPoints.filter(
                point => point.assigned_process_group && point.assigned_process_group !== "Unassigned"
              );
              
              // Calculate cost to serve
              costToServe = assignedPainPoints.reduce((sum, point) => {
                return sum + (point.cost_to_serve || 0);
              }, 0);
              
              // Calculate total points from strategic objectives
              totalPoints = assignedPainPoints.reduce((sum, point) => {
                let pointScore = 0;
                Object.entries(point).forEach(([key, value]) => {
                  if (key.startsWith('so_') && typeof value === 'number') {
                    pointScore += value;
                  }
                });
                return sum + pointScore;
              }, 0);
            }
            
            // Use hardcoded industry benchmark
            const industryBenchmark = 300000;
            
            // Calculate delta (difference between cost to serve and industry benchmark)
            const delta = industryBenchmark - costToServe;
            
            return {
              id: lifecycle.id,
              name: lifecycle.name,
              description: lifecycle.description,
              position: lifecycle.position || 0,
              costMetrics: {
                processes: processCount,
                painPoints: painPoints.filter(p => p.assigned_process_group && p.assigned_process_group !== "Unassigned").length,
                points: totalPoints,
                costToServe: costToServe,
                industryBenchmark: industryBenchmark,
                delta: delta
              }
            };
          })
        );
        
        setLifecycles(enhancedLifecycles);
      } catch (err) {
        console.error("Error fetching lifecycle data:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchLifecycleData();
  }, [params]);

  // Helper function to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  const navigateToScenarioPlanning = () => {
    const tenantSlug = params.tenant as string;
    const workspaceId = params.workspace as string;
    const scanId = params.scan as string;
    router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/scenario-planning`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Lifecycle Costs</h2>
      <p className="mb-6">Below are the estimated costs of the lifecycles compared to Industry benchmarks.</p>
      
      {loading ? (
        <div className="flex justify-center">
          <p className="text-gray-500">Loading lifecycles...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 p-4 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      ) : lifecycles.length === 0 ? (
        <div className="bg-gray-100 p-4 rounded-md">
          <p className="text-gray-700">No lifecycles found for this scan.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {lifecycles.map((lifecycle) => (
            <div 
              key={lifecycle.id} 
              className="rounded-lg overflow-hidden bg-white shadow-md"
            >
              <div className="p-6">
                <div className="w-full overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 px-2 text-left">Lifecycle</th>
                        <th className="py-3 px-2 text-center">Processes</th>
                        <th className="py-3 px-2 text-center">Pain Points</th>
                        <th className="py-3 px-2 text-center">Points</th>
                        <th className="py-3 px-2 text-center">Cost to Serve</th>
                        <th className="py-3 px-2 text-center">Industry Benchmark</th>
                        <th className="py-3 px-2 text-center">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-4 px-2 text-left font-medium">{lifecycle.name}</td>
                        <td className="py-4 px-2 text-center">{lifecycle.costMetrics.processes}</td>
                        <td className="py-4 px-2 text-center">{lifecycle.costMetrics.painPoints}</td>
                        <td className="py-4 px-2 text-center">{lifecycle.costMetrics.points}</td>
                        <td className="py-4 px-2 text-center text-gray-800">-{formatCurrency(lifecycle.costMetrics.costToServe)}</td>
                        <td className="py-4 px-2 text-center text-gray-800">-{formatCurrency(lifecycle.costMetrics.industryBenchmark)}</td>
                        <td className={`py-4 px-2 text-center font-medium ${lifecycle.costMetrics.delta > 0 ? 'text-green-600' : 'text-purple-600'}`}>
                          {lifecycle.costMetrics.delta > 0 ? '+' : ''}{formatCurrency(lifecycle.costMetrics.delta)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
          
          <div className="flex justify-end mt-8">
            <Button onClick={navigateToScenarioPlanning}>
              Continue to Scenario Planning
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 