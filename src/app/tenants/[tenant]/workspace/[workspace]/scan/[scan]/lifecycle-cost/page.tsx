"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/Button";
import Tag from "@/components/Tag";
import { ChevronDown, ChevronRight, Save, CheckCircle } from "lucide-react";

interface CostMetrics {
  processes: number;
  painPoints: number;
  points: number;
  costToServe: number;
  industryBenchmark: number;
  delta: number;
}

interface ProcessCategory {
  name: string;
  description?: string;
  process_groups?: any[];
  cost_to_serve?: number;
  industry_benchmark?: number;
}

interface Lifecycle {
  id: string;
  name: string;
  description?: string;
  position: number;
  costMetrics: CostMetrics;
  processCategories: ProcessCategory[];
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
  const [expandedLifecycle, setExpandedLifecycle] = useState<string | null>(null);
  const [editedCosts, setEditedCosts] = useState<Record<string, number>>({});
  const [editedBenchmarks, setEditedBenchmarks] = useState<Record<string, number>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState<Record<string, string>>({});
  const params = useParams();
  const router = useRouter();

  const toggleLifecycle = (lifecycleId: string) => {
    setExpandedLifecycle(expandedLifecycle === lifecycleId ? null : lifecycleId);
  };

  const handleCostChange = (lifecycleId: string, value: string) => {
    // Parse the input value, removing any non-numeric characters
    const numericValue = parseInt(value.replace(/\D/g, '')) || 0;
    
    // Update the edited costs state
    setEditedCosts(prev => ({
      ...prev,
      [lifecycleId]: numericValue
    }));
  };

  const handleBenchmarkChange = (lifecycleId: string, value: string) => {
    // Parse the input value, removing any non-numeric characters
    const numericValue = parseInt(value.replace(/\D/g, '')) || 0;
    
    // Update the edited benchmarks state
    setEditedBenchmarks(prev => ({
      ...prev,
      [lifecycleId]: numericValue
    }));
  };

  const handleSaveCost = async (lifecycleId: string) => {
    // Get the value to save
    const costToSave = editedCosts[lifecycleId];
    
    // If no edited value exists, do nothing
    if (costToSave === undefined) return;
    
    // Mark as saving
    setSavingStatus(prev => ({
      ...prev,
      [lifecycleId]: 'cost'
    }));

    try {
      const tenantSlug = params.tenant as string;
      const workspaceId = params.workspace as string;
      const scanId = params.scan as string;
      
      const response = await fetch(`/api/tenants/by-slug/workspaces/scans/lifecycle-costs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          lifecycle_id: lifecycleId,
          cost_to_serve: costToSave
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status} ${response.statusText}`);
      }

      // Update the local state with the new cost
      setLifecycles(prevLifecycles => {
        return prevLifecycles.map(lifecycle => {
          if (lifecycle.id === lifecycleId) {
            return {
              ...lifecycle,
              costMetrics: {
                ...lifecycle.costMetrics,
                costToServe: costToSave,
                delta: lifecycle.costMetrics.industryBenchmark - costToSave
              }
            };
          }
          return lifecycle;
        });
      });

      // Mark as saved successfully
      setSaveSuccess(prev => ({
        ...prev,
        [lifecycleId]: 'cost'
      }));

      // Clear the success indicator after 2 seconds
      setTimeout(() => {
        setSaveSuccess(prev => {
          const updatedSuccess = {...prev};
          if (updatedSuccess[lifecycleId] === 'cost') {
            delete updatedSuccess[lifecycleId];
          }
          return updatedSuccess;
        });
      }, 2000);

      // Clear the edited state since it's now been saved
      setEditedCosts(prev => {
        const updatedCosts = {...prev};
        delete updatedCosts[lifecycleId];
        return updatedCosts;
      });
      
    } catch (err) {
      console.error("Error saving cost to serve:", err);
      
      // Show error as an alert
      alert(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
    } finally {
      // Clear saving status
      setSavingStatus(prev => {
        const updatedStatus = {...prev};
        if (updatedStatus[lifecycleId] === 'cost') {
          delete updatedStatus[lifecycleId];
        }
        return updatedStatus;
      });
    }
  };

  const handleSaveBenchmark = async (lifecycleId: string) => {
    // Get the value to save
    const benchmarkToSave = editedBenchmarks[lifecycleId];
    
    // If no edited value exists, do nothing
    if (benchmarkToSave === undefined) return;
    
    // Mark as saving
    setSavingStatus(prev => ({
      ...prev,
      [lifecycleId]: 'benchmark'
    }));

    try {
      const tenantSlug = params.tenant as string;
      const workspaceId = params.workspace as string;
      const scanId = params.scan as string;
      
      const response = await fetch(`/api/tenants/by-slug/workspaces/scans/lifecycle-costs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          lifecycle_id: lifecycleId,
          industry_benchmark: benchmarkToSave
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status} ${response.statusText}`);
      }

      // Update the local state with the new benchmark
      setLifecycles(prevLifecycles => {
        return prevLifecycles.map(lifecycle => {
          if (lifecycle.id === lifecycleId) {
            return {
              ...lifecycle,
              costMetrics: {
                ...lifecycle.costMetrics,
                industryBenchmark: benchmarkToSave,
                delta: benchmarkToSave - lifecycle.costMetrics.costToServe
              }
            };
          }
          return lifecycle;
        });
      });

      // Mark as saved successfully
      setSaveSuccess(prev => ({
        ...prev,
        [lifecycleId]: 'benchmark'
      }));

      // Clear the success indicator after 2 seconds
      setTimeout(() => {
        setSaveSuccess(prev => {
          const updatedSuccess = {...prev};
          if (updatedSuccess[lifecycleId] === 'benchmark') {
            delete updatedSuccess[lifecycleId];
          }
          return updatedSuccess;
        });
      }, 2000);

      // Clear the edited state since it's now been saved
      setEditedBenchmarks(prev => {
        const updatedBenchmarks = {...prev};
        delete updatedBenchmarks[lifecycleId];
        return updatedBenchmarks;
      });
      
    } catch (err) {
      console.error("Error saving industry benchmark:", err);
      
      // Show error as an alert
      alert(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
    } finally {
      // Clear saving status
      setSavingStatus(prev => {
        const updatedStatus = {...prev};
        if (updatedStatus[lifecycleId] === 'benchmark') {
          delete updatedStatus[lifecycleId];
        }
        return updatedStatus;
      });
    }
  };

  useEffect(() => {
    async function fetchLifecycleData() {
      try {
        const tenantSlug = params.tenant as string;
        const workspaceId = params.workspace as string;
        const scanId = params.scan as string;

        if (!tenantSlug || !workspaceId || !scanId) {
          throw new Error("Missing required parameters");
        }

        // Fetch lifecycle costs from the API
        const lifecyclesResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycle-costs?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );

        if (!lifecyclesResponse.ok) {
          throw new Error("Failed to fetch lifecycles");
        }

        const lifecyclesData = await lifecyclesResponse.json();
        
        // Enhanced lifecycles with process categories
        const enhancedLifecycles = await Promise.all(
          lifecyclesData.map(async (lifecycle: any) => {
            // Fetch detailed lifecycle data for process categories
            const lifecycleDetailResponse = await fetch(
              `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`
            );
            
            let processCategories: ProcessCategory[] = [];
            
            if (lifecycleDetailResponse.ok) {
              const data = await lifecycleDetailResponse.json();
              const lifecycleData = Array.isArray(data) ? data.find(lc => lc.id === lifecycle.id) : data;
              
              if (lifecycleData?.processes?.process_categories) {
                processCategories = lifecycleData.processes.process_categories;
              }
            }
            
            // Use API's costMetrics, but ensure we have industry benchmark and delta calculated
            // consistently even if the API hasn't been updated yet
            const costMetrics = lifecycle.costMetrics || {
              processes: 0,
              painPoints: 0,
              points: 0,
              costToServe: 0,
              industryBenchmark: 0,
              delta: 0
            };
            
            return {
              id: lifecycle.id,
              name: lifecycle.name,
              description: lifecycle.description,
              position: lifecycle.position || 0,
              processCategories: processCategories,
              costMetrics: costMetrics
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
    if (value === 0) return '$0';
    
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

  // Helper to get current value for an input field
  const getCurrentValue = (lifecycleId: string, savedValue?: number, isIndustryBenchmark = false) => {
    // If it's industry benchmark field
    if (isIndustryBenchmark) {
      // If there's an edited value, use that
      if (editedBenchmarks[lifecycleId] !== undefined) {
        return editedBenchmarks[lifecycleId].toLocaleString();
      }
    } else {
      // If there's an edited value, use that
      if (editedCosts[lifecycleId] !== undefined) {
        return editedCosts[lifecycleId].toLocaleString();
      }
    }
    // Otherwise use the saved value or 0
    return savedValue ? savedValue.toLocaleString() : '0';
  };

  // Helper to check if a field is currently saving
  const isSaving = (lifecycleId: string, type: 'cost' | 'benchmark') => {
    return savingStatus[lifecycleId] === type;
  };

  // Helper to check if a field has been saved successfully
  const isSaveSuccess = (lifecycleId: string, type: 'cost' | 'benchmark') => {
    return saveSuccess[lifecycleId] === type;
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
                        <th className="py-3 px-2 text-center">Details</th>
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
                        <td className="py-4 px-2 text-center">
                          <button 
                            onClick={() => toggleLifecycle(lifecycle.id)}
                            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                            aria-label={expandedLifecycle === lifecycle.id ? "Collapse details" : "Expand details"}
                          >
                            {expandedLifecycle === lifecycle.id ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expandedLifecycle === lifecycle.id && (
                        <tr>
                          <td colSpan={8} className="py-4 px-6 bg-gray-50">
                            <div className="px-4 py-3">
                              <div className="space-y-6">
                                <div className="flex flex-wrap justify-between items-center">
                                  <div className="w-full md:w-1/3 mb-4 md:mb-0">
                                    <h3 className="font-medium text-lg">Lifecycle Cost Details</h3>
                                    <p className="text-gray-600 text-sm mt-1">Edit costs for the lifecycle</p>
                                  </div>
                                  <div className="w-full md:w-2/3 flex flex-col items-end space-y-4">
                                    <div className="flex items-center">
                                      <label htmlFor={`cost-${lifecycle.id}`} className="whitespace-nowrap text-right font-medium mr-2">
                                        Cost to Serve:
                                      </label>
                                      <div className="flex items-center">
                                        <div className="relative flex items-center">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2">$</span>
                                          <input
                                            id={`cost-${lifecycle.id}`}
                                            type="text"
                                            className="pl-6 pr-2 py-1 border rounded-md w-40 text-right"
                                            value={getCurrentValue(lifecycle.id, lifecycle.costMetrics.costToServe)}
                                            onChange={(e) => handleCostChange(lifecycle.id, e.target.value)}
                                            disabled={isSaving(lifecycle.id, 'cost')}
                                          />
                                          
                                          <button 
                                            className="ml-2 p-1 rounded-md hover:bg-blue-100 text-blue-600 disabled:text-gray-400 disabled:hover:bg-transparent"
                                            onClick={() => handleSaveCost(lifecycle.id)}
                                            disabled={isSaving(lifecycle.id, 'cost') || editedCosts[lifecycle.id] === undefined}
                                            aria-label="Save cost"
                                          >
                                            {isSaveSuccess(lifecycle.id, 'cost') ? (
                                              <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : (
                                              <Save className="w-5 h-5" />
                                            )}
                                          </button>
                                          
                                          {isSaving(lifecycle.id, 'cost') && (
                                            <span className="ml-2 text-sm text-gray-500">Saving...</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center">
                                      <label htmlFor={`benchmark-${lifecycle.id}`} className="whitespace-nowrap text-right font-medium mr-2">
                                        Industry Benchmark:
                                      </label>
                                      <div className="flex items-center">
                                        <div className="relative flex items-center">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2">$</span>
                                          <input
                                            id={`benchmark-${lifecycle.id}`}
                                            type="text"
                                            className="pl-6 pr-2 py-1 border rounded-md w-40 text-right"
                                            value={getCurrentValue(lifecycle.id, lifecycle.costMetrics.industryBenchmark, true)}
                                            onChange={(e) => handleBenchmarkChange(lifecycle.id, e.target.value)}
                                            disabled={isSaving(lifecycle.id, 'benchmark')}
                                          />
                                          
                                          <button 
                                            className="ml-2 p-1 rounded-md hover:bg-blue-100 text-blue-600 disabled:text-gray-400 disabled:hover:bg-transparent"
                                            onClick={() => handleSaveBenchmark(lifecycle.id)}
                                            disabled={isSaving(lifecycle.id, 'benchmark') || editedBenchmarks[lifecycle.id] === undefined}
                                            aria-label="Save benchmark"
                                          >
                                            {isSaveSuccess(lifecycle.id, 'benchmark') ? (
                                              <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : (
                                              <Save className="w-5 h-5" />
                                            )}
                                          </button>
                                          
                                          {isSaving(lifecycle.id, 'benchmark') && (
                                            <span className="ml-2 text-sm text-gray-500">Saving...</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
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