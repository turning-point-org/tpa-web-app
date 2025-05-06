"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/Button";

interface CostMetrics {
  processes: number;
  painPoints: number;
  scoring: number;
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

export default function LifecycleCostPage() {
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    async function fetchLifecycleCosts() {
      try {
        const tenantSlug = params.tenant as string;
        const workspaceId = params.workspace as string;
        const scanId = params.scan as string;

        if (!tenantSlug || !workspaceId || !scanId) {
          throw new Error("Missing required parameters");
        }

        const response = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycle-costs?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch lifecycle costs");
        }

        const data = await response.json();
        setLifecycles(data);
      } catch (err) {
        console.error("Error fetching lifecycle costs:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchLifecycleCosts();
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
                        <th className="py-3 px-2 text-center">Scoring</th>
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
                        <td className="py-4 px-2 text-center">{lifecycle.costMetrics.scoring}</td>
                        <td className="py-4 px-2 text-center text-gray-800">-{formatCurrency(lifecycle.costMetrics.costToServe)}</td>
                        <td className="py-4 px-2 text-center text-gray-800">-{formatCurrency(lifecycle.costMetrics.industryBenchmark)}</td>
                        <td className={`py-4 px-2 text-center font-medium ${lifecycle.costMetrics.delta > 0 ? 'text-purple-600' : 'text-green-600'}`}>
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