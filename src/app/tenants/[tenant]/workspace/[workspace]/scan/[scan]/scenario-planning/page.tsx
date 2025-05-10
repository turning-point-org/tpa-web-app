"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Button from '@/components/Button';
import Image from 'next/image';
import Modal from '@/components/Modal';
import DetailsModal from '@/app/components/DetailsModal';
import { FileText, Star } from 'lucide-react';

// Define interfaces for our data
interface CompanyInfo {
  name: string;
  website?: string;
  industry?: string;
  description?: string;
  [key: string]: any; // For other potential fields
}

interface ScanData {
  name: string;
  [key: string]: any; // For other potential fields
}

interface Lifecycle {
  id: string;
  name: string;
  description?: string;
  position?: number;
  processes?: {
    process_categories: ProcessCategory[];
  };
  [key: string]: any; // For other potential fields
}

interface ProcessCategory {
  name: string;
  description?: string;
  score?: number;
  process_groups?: ProcessGroup[];
  cost_to_serve?: number;
  industry_benchmark?: number;
}

// Reusing the ProcessGroup and PainPoint types from DetailsModal
import type { ProcessGroup, PainPoint } from '@/app/components/DetailsModal';

interface PainPointSummary {
  id: string;
  pain_points: PainPoint[];
  overallSummary: string;
}

// Module components
function Introduction({ scanName = "Introduction" }: { scanName?: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <div className="bg-white p-3 rounded-full w-12 h-12 flex items-center justify-center shadow-sm mr-3">
          <Image src="/assets/icons/file.svg" width={25} height={25} alt="File icon" />
        </div>
        <h2 className="text-2xl font-semibold text-[#5319A5]">{scanName}</h2>
      </div>
      <p className="text-gray-600 mb-4 py-3 max-w-2xl mx-auto">A focused diagnostic to uncover key process pain points, highlight opportunities, and lay the groundwork for meaningful process improvements.</p>
      {/* <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <p className="text-gray-800">Introduction content will be placed here.</p>
      </div> */}
    </div>
  );
}

// ProjectOverview is now a functional component that accepts companyName as a prop
function ProjectOverview({ companyName = "the company" }: { companyName?: string }) {
  const params = useParams();
  const [lifecyclesCount, setLifecyclesCount] = useState(0);
  const [processesCount, setProcessesCount] = useState(0);
  const [painPointsCount, setPainPointsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        setIsLoading(true);
        const tenant = params.tenant as string;
        const workspace = params.workspace as string;
        const scanId = params.scan as string;
        
        // Fetch lifecycles
        const lifecyclesResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}`
        );
        
        if (!lifecyclesResponse.ok) {
          throw new Error('Failed to fetch lifecycles');
        }
        
        const lifecyclesData = await lifecyclesResponse.json();
        setLifecyclesCount(lifecyclesData.length);
        
        // Fetch detailed data for each lifecycle to count processes
        let totalProcesses = 0;
        const painPointsPromises = [];
        
        for (const lifecycle of lifecyclesData) {
          // Fetch lifecycle details to count process groups
          const lifecycleDetailResponse = await fetch(
            `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`
          );
          
          if (lifecycleDetailResponse.ok) {
            const data = await lifecycleDetailResponse.json();
            const lifecycleData = Array.isArray(data) ? data.find(lc => lc.id === lifecycle.id) : data;
            
            // Count process groups
            if (lifecycleData?.processes?.process_categories) {
              for (const category of lifecycleData.processes.process_categories) {
                if (category.process_groups) {
                  totalProcesses += category.process_groups.length;
                }
              }
            }
          }
          
          // Add promise to fetch pain points for this lifecycle
          painPointsPromises.push(
            fetch(`/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`)
              .then(response => {
                // Handle both 200 and 404 (no pain points yet)
                if (response.ok) return response.json();
                if (response.status === 404) return { pain_points: [] };
                throw new Error(`Failed to fetch pain points for ${lifecycle.id}`);
              })
              .catch(() => ({ pain_points: [] })) // Return empty array if fetch fails
          );
        }
        
        setProcessesCount(totalProcesses);
        
        // Calculate total pain points
        const painPointsResults = await Promise.all(painPointsPromises);
        const totalPainPoints = painPointsResults.reduce((sum, result) => {
          return sum + (result.pain_points?.length || 0);
        }, 0);
        
        setPainPointsCount(totalPainPoints);
      } catch (error) {
        console.error('Error fetching overview data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverviewData();
  }, [params]);

  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <div className="bg-white p-3 rounded-full w-12 h-12 flex items-center justify-center shadow-sm mr-3">
          <Image src="/assets/icons/file.svg" width={25} height={25} alt="File icon" />
        </div>
        <h2 className="text-2xl font-semibold text-[#5319A5]">Project Overview</h2>
      </div>
      <p className="text-gray-600 mb-4 py-3 max-w-2xl mx-auto">
        By collecting detailed information and data from {companyName}, we identified several key lifecycles and their associated processes. 
        We then conducted in-depth interviews for each lifecycle to uncover pain points, providing valuable insights into potential 
        growth opportunities for the company.
      </p>
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-600">Lifecycles</h3>
            {isLoading ? (
              <p className="text-4xl font-semibold text-[#5319A5] mt-2">-</p>
            ) : (
              <p className="text-4xl font-semibold text-[#5319A5] mt-2">{lifecyclesCount}</p>
            )}
          </div>
          
          <div className="text-center relative">
            <div className="absolute left-0 top-0 h-full w-px bg-gray-200"></div>
            <div className="absolute right-0 top-0 h-full w-px bg-gray-200"></div>
            <h3 className="text-lg font-medium text-gray-600">Total Processes</h3>
            {isLoading ? (
              <p className="text-4xl font-semibold text-[#5319A5] mt-2">-</p>
            ) : (
              <p className="text-4xl font-semibold text-[#5319A5] mt-2">{processesCount}</p>
            )}
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-600">Total Pain Points</h3>
            {isLoading ? (
              <p className="text-4xl font-semibold text-[#5319A5] mt-2">-</p>
            ) : (
              <p className="text-4xl font-semibold text-[#5319A5] mt-2">{painPointsCount}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LifecyclesScanned() {
  const params = useParams();
  const [lifecyclesData, setLifecyclesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLifecyclesData = async () => {
      try {
        setIsLoading(true);
        const tenant = params.tenant as string;
        const workspace = params.workspace as string;
        const scanId = params.scan as string;
        
        // Fetch all lifecycles with cost data from the lifecycle-costs endpoint
        const lifecyclesResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycle-costs?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}`
        );
        
        if (!lifecyclesResponse.ok) {
          throw new Error('Failed to fetch lifecycles');
        }
        
        const lifecycles = await lifecyclesResponse.json();
        
        // For each lifecycle, fetch additional details
        const enhancedLifecyclesPromises = lifecycles.map(async (lifecycle: any) => {
          // Fetch detailed lifecycle data
          const lifecycleDetailResponse = await fetch(
            `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`
          );
          
          let processCategories = [];
          let totalProcessGroups = 0;
          
          if (lifecycleDetailResponse.ok) {
            const data = await lifecycleDetailResponse.json();
            const lifecycleData = Array.isArray(data) ? data.find((lc: any) => lc.id === lifecycle.id) : data;
            
            // Get process categories and count process groups
            if (lifecycleData?.processes?.process_categories) {
              processCategories = lifecycleData.processes.process_categories;
              
              // Count total process groups across all categories
              totalProcessGroups = processCategories.reduce((total: number, category: any) => {
                return total + (category.process_groups?.length || 0);
              }, 0);
            }
          }
          
          // Use cost_to_serve directly from the lifecycle costMetrics
          const costToServe = lifecycle.costMetrics?.costToServe || 0;
          
          return {
            ...lifecycle,
            journeyCount: processCategories.length,
            processCount: totalProcessGroups,
            costToServe: costToServe
          };
        });
        
        const enhancedLifecycles = await Promise.all(enhancedLifecyclesPromises);
        setLifecyclesData(enhancedLifecycles);
      } catch (error) {
        console.error('Error fetching lifecycles data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLifecyclesData();
  }, [params]);

  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <div className="bg-white p-3 rounded-full w-12 h-12 flex items-center justify-center shadow-sm mr-3">
          <Image src="/assets/icons/file.svg" width={25} height={25} alt="File icon" />
        </div>
        <h2 className="text-2xl font-semibold text-[#5319A5]">Lifecycles Scanned</h2>
      </div>
      <p className="text-gray-600 mb-4 py-3 max-w-2xl mx-auto">We identified key business processes aligned to five major lifecycles that define how the company operates day to day. By mapping these lifecycles end-to-end we gained a clear view of where time and effort are spent, where friction occurs, and where the most valuable improvements can be made.</p>
      <div className="">
        <div className="flex flex-col space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading lifecycle data...</p>
            </div>
          ) : lifecyclesData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No lifecycle data available.</p>
            </div>
          ) : (
            lifecyclesData.map((lifecycle, index) => (
              <div key={lifecycle.id} className="bg-white rounded-lg shadow-sm p-4 flex items-center">
                <div className="w-1/4 text-left">
                  <div className="text-gray-600 text-sm">Lifecycle</div>
                  <div className="text-2xl font-semibold">{lifecycle.name}</div>
                </div>
                <div className="h-full w-px bg-gray-200"></div>
                <div className="w-1/6 text-center">
                  <div className="text-gray-600 text-sm">Journeys</div>
                  <div className="text-2xl font-semibold text-[#5319A5]">{lifecycle.journeyCount}</div>
                </div>
                <div className="h-full w-px bg-gray-200"></div>
                <div className="w-1/6 text-center">
                  <div className="text-gray-600 text-sm">Processes</div>
                  <div className="text-2xl font-semibold text-[#5319A5]">{lifecycle.processCount}</div>
                </div>
                <div className="h-full w-px bg-gray-200"></div>
                <div className="w-5/12 text-right">
                  <div className="text-gray-600 text-sm">Cost to Serve</div>
                  <div className="text-2xl font-semibold text-[#5319A5]">-${formatCurrency(lifecycle.costToServe)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Add this function at the top level of the file, outside of other components
function ModalWrapper({
  isOpen,
  onClose,
  lifecycleName,
  categoryName,
  processGroups,
  categoryCostToServe,
  initialExpandedGroupId
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  lifecycleName: string; 
  categoryName: string;
  processGroups: ProcessGroup[];
  categoryCostToServe: number;
  initialExpandedGroupId: string | null;
}) {
  return (
    <DetailsModal 
      isOpen={isOpen} 
      onClose={onClose}
      lifecycleName={lifecycleName} 
      categoryName={categoryName}
      processGroups={processGroups}
      categoryCostToServe={categoryCostToServe}
      initialExpandedGroupId={initialExpandedGroupId}
    />
  );
}

function OpportunityExplorer({ 
  setAllLifecyclesData,
  setPainPointsData
}: { 
  setAllLifecyclesData: React.Dispatch<React.SetStateAction<Lifecycle[]>>;
  setPainPointsData: React.Dispatch<React.SetStateAction<Record<string, PainPointSummary>>>;
}) {
  const params = useParams();
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);
  const [selectedLifecycle, setSelectedLifecycle] = useState<string>("all");
  const [selectedLifecycleData, setSelectedLifecycleData] = useState<Lifecycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ 
    lifecycleName: '', 
    categoryName: '',
    processGroups: [] as ProcessGroup[],
    categoryCostToServe: 0
  });
  
  // Add state for expanded process group in modal
  const [initialExpandedGroupId, setInitialExpandedGroupId] = useState<string | null>(null);
  
  // Add state for pain points data - using local variables instead to prevent duplicates
  const [localPainPointsData, setLocalPainPointsData] = useState<Record<string, PainPointSummary>>({});
  const [isLoadingPainPoints, setIsLoadingPainPoints] = useState(false);
  const [localAllLifecyclesData, setLocalAllLifecyclesData] = useState<Lifecycle[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchLifecycles = async () => {
      try {
        const tenant = params.tenant as string;
        const workspace = params.workspace as string;
        const scanId = params.scan as string;
        
        const response = await fetch(`/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch lifecycles');
        }
        
        const data = await response.json();
        setLifecycles(data);
      } catch (error) {
        console.error('Error fetching lifecycles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLifecycles();
  }, [params]);

  // Add function to fetch pain points for a lifecycle
  const fetchPainPointsForLifecycle = async (lifecycleId: string) => {
    try {
      setIsLoadingPainPoints(true);
      const tenant = params.tenant as string;
      const workspace = params.workspace as string;
      const scanId = params.scan as string;
      
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}&lifecycle_id=${lifecycleId}`
      );
      
      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to fetch pain points data for lifecycle ${lifecycleId}`);
      }
      
      // If 404, it's fine - just no pain points yet
      if (response.status === 404) {
        return {
          id: "",
          pain_points: [],
          overallSummary: ""
        };
      }
      
      const data = await response.json();
      
      // Handle both possible property names (pain_points and painPoints)
      const painPoints = data.pain_points || data.painPoints || [];
      
      return {
        id: data.id || "",
        pain_points: painPoints,
        overallSummary: data.overallSummary || ""
      };
    } catch (error) {
      console.error(`Error fetching pain points for lifecycle ${lifecycleId}:`, error);
      return {
        id: "",
        pain_points: [],
        overallSummary: ""
      };
    } finally {
      setIsLoadingPainPoints(false);
    }
  };

  // Fetch detailed data for all lifecycles or a specific lifecycle
  useEffect(() => {
    const fetchLifecyclesData = async () => {
      try {
        setIsLoading(true);
        const tenant = params.tenant as string;
        const workspace = params.workspace as string;
        const scanId = params.scan as string;
        
        if (selectedLifecycle === "all") {
          // Fetch detailed data for all lifecycles with cost information
          const lifecyclesResponse = await fetch(
            `/api/tenants/by-slug/workspaces/scans/lifecycle-costs?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}`
          );
          
          if (!lifecyclesResponse.ok) {
            throw new Error('Failed to fetch lifecycles');
          }
          
          const lifecyclesData = await lifecyclesResponse.json();
          
          // Now fetch detailed processes for these lifecycles
          const detailedDataPromises = lifecyclesData.map((lifecycle: Lifecycle) => 
            fetch(`/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`)
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to fetch lifecycle data for ${lifecycle.id}`);
                }
                return response.json();
              })
              .then(data => {
                const lifecycleDetails = Array.isArray(data) ? data.find(lc => lc.id === lifecycle.id) : data;
                // Merge the processes data with the lifecycle cost data
                return {
                  ...lifecycle,
                  processes: lifecycleDetails?.processes
                };
              })
          );
          
          const detailedData = await Promise.all(detailedDataPromises);
          const filteredData = detailedData.filter(Boolean);
          setLocalAllLifecyclesData(filteredData);
          // Update parent state
          setAllLifecyclesData(filteredData);
          
          // Also fetch pain points data for all lifecycles
          const painPointsPromises = filteredData.map(async (lifecycle: any) => 
            fetchPainPointsForLifecycle(lifecycle.id)
              .then(painPointsData => [lifecycle.id, painPointsData])
          );
          
          const painPointsResults = await Promise.all(painPointsPromises);
          const painPointsMap = Object.fromEntries(painPointsResults);
          setLocalPainPointsData(painPointsMap);
          // Update parent state
          setPainPointsData(painPointsMap);
          
          setSelectedLifecycleData(null);
        } else {
          // Fetch cost data for the selected lifecycle
          const costResponse = await fetch(
            `/api/tenants/by-slug/workspaces/scans/lifecycle-costs?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}`
          );
          
          if (!costResponse.ok) {
            throw new Error('Failed to fetch lifecycle costs');
          }
          
          const costData = await costResponse.json();
          const lifecycleCostData = costData.find((lc: any) => lc.id === selectedLifecycle);
          
          // Fetch the detailed lifecycle data
          const response = await fetch(
            `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}&lifecycle_id=${selectedLifecycle}`
          );
          
          if (!response.ok) {
            throw new Error('Failed to fetch lifecycle data');
          }
          
          const data = await response.json();
          // The API might return an array, so we need to find the specific lifecycle
          const lifecycleDetails = Array.isArray(data) ? data.find(lc => lc.id === selectedLifecycle) : data;
          
          // Merge the cost data with the detailed data
          const mergedData = {
            ...lifecycleDetails,
            costMetrics: lifecycleCostData?.costMetrics || {
              costToServe: 0,
              industryBenchmark: 0,
              delta: 0
            }
          };
          
          setSelectedLifecycleData(mergedData);
          
          // Fetch pain points for this lifecycle
          const painPointsSummary = await fetchPainPointsForLifecycle(selectedLifecycle);
          setLocalPainPointsData({ [selectedLifecycle]: painPointsSummary });
        }
      } catch (error) {
        console.error('Error fetching lifecycle data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we have lifecycles to work with
    if (lifecycles.length > 0) {
      fetchLifecyclesData();
    }
  }, [selectedLifecycle, lifecycles, params, setAllLifecyclesData, setPainPointsData]);

  const handleLifecycleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLifecycle(e.target.value);
  };

  // Calculate score for a process group based on strategic objectives
  const calculateProcessGroupScore = (lifecycleId: string, groupName: string): number => {
    if (!localPainPointsData[lifecycleId] || !localPainPointsData[lifecycleId].pain_points) return 0;
    
    // Calculate total score from pain points assigned to this process group
    return localPainPointsData[lifecycleId].pain_points
      .filter(point => point.assigned_process_group === groupName)
      .reduce((total, point) => {
        // Calculate sum of all strategic objective scores (properties starting with "so_")
        let pointScore = 0;
        Object.entries(point).forEach(([key, value]) => {
          if (key.startsWith('so_') && typeof value === 'number') {
            pointScore += value;
          }
        });
        return total + pointScore;
      }, 0);
  };
  
  // Get strategic objectives for a process group
  const getStrategicObjectivesForGroup = (lifecycleId: string, groupName: string): { name: string, score: number }[] => {
    if (!localPainPointsData[lifecycleId] || !localPainPointsData[lifecycleId].pain_points) return [];
    
    // Get pain points assigned to this group
    const groupPainPoints = localPainPointsData[lifecycleId].pain_points
      .filter(point => point.assigned_process_group === groupName);
      
    // Create a map to track totals for each strategic objective
    const soTotals = new Map<string, number>();
    
    // Process each pain point to extract and sum strategic objectives
    groupPainPoints.forEach(point => {
      Object.entries(point).forEach(([key, value]) => {
        if (key.startsWith('so_') && typeof value === 'number' && value > 0) {
          // Format the objective name: convert so_objective_name to Objective Name
          const objName = key.replace('so_', '')
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          // Add to the running total
          soTotals.set(objName, (soTotals.get(objName) || 0) + value);
        }
      });
    });
    
    // Convert map to array of objects for easier rendering
    return Array.from(soTotals.entries()).map(([name, score]) => ({
      name,
      score
    })).sort((a, b) => b.score - a.score); // Sort by highest total first
  };
  
  // Get pain points assigned to a process group
  const getPainPointsForGroup = (lifecycleId: string, groupName: string): PainPoint[] => {
    if (!localPainPointsData[lifecycleId] || !localPainPointsData[lifecycleId].pain_points) return [];
    
    // Get pain points assigned to this group
    return localPainPointsData[lifecycleId].pain_points
      .filter(point => point.assigned_process_group === groupName);
  };

  // Calculate total points for a process category based on strategic objectives
  const calculateCategoryTotalPoints = (lifecycleId: string, category: ProcessCategory) => {
    if (!category.process_groups) return 0;
    
    return category.process_groups.reduce((total, group) => {
      return total + calculateProcessGroupScore(lifecycleId, group.name);
    }, 0);
  };

  // Calculate cost to serve for a process category based on pain points
  const calculateCategoryTotalCost = (lifecycleId: string, category: ProcessCategory) => {
    // If there's a lifecycle with cost data, we can proportionally allocate cost to categories
    const lifecycle = localAllLifecyclesData.find(lc => lc.id === lifecycleId);
    if (!lifecycle) return 0;
    
    const lifecycleCost = lifecycle.costMetrics?.costToServe || lifecycle.cost_to_serve || 0;
    
    // If no lifecycle cost or no process groups in this category, return 0
    if (lifecycleCost === 0 || !category.process_groups || category.process_groups.length === 0) return 0;
    
    // For simplicity, distribute cost evenly across categories
    const totalCategories = lifecycle.processes?.process_categories?.length || 1;
    return lifecycleCost / totalCategories;
  };

  // Calculate industry benchmark for a process category
  const calculateCategoryIndustryBenchmark = (lifecycleId: string, category: ProcessCategory) => {
    // Get the lifecycle to use its global industry benchmark
    const lifecycle = localAllLifecyclesData.find(lc => lc.id === lifecycleId);
    if (!lifecycle) return 0;
    
    const lifecycleBenchmark = lifecycle.costMetrics?.industryBenchmark || lifecycle.industry_benchmark || 0;
    
    // If no lifecycle benchmark or no process groups in this category, return 0
    if (lifecycleBenchmark === 0 || !category.process_groups || category.process_groups.length === 0) return 0;
    
    // For simplicity, distribute benchmark evenly across categories
    const totalCategories = lifecycle.processes?.process_categories?.length || 1;
    return lifecycleBenchmark / totalCategories;
  };

  // Calculate total industry benchmark for an entire lifecycle
  const calculateLifecycleIndustryBenchmark = (lifecycleId: string) => {
    const lifecycle = localAllLifecyclesData.find(lc => lc.id === lifecycleId);
    if (!lifecycle) return 0;
    
    // Use lifecycle-level industry_benchmark directly
    return lifecycle.costMetrics?.industryBenchmark || lifecycle.industry_benchmark || 0;
  };

  // Calculate total cost to serve for an entire lifecycle
  const calculateLifecycleTotalCost = (lifecycleId: string) => {
    const lifecycle = localAllLifecyclesData.find(lc => lc.id === lifecycleId);
    if (!lifecycle) return 0;
    
    // Use lifecycle-level cost_to_serve directly
    return lifecycle.costMetrics?.costToServe || lifecycle.cost_to_serve || 0;
  };

  // Calculate total points for an entire lifecycle
  const calculateLifecycleTotalPoints = (lifecycleId: string) => {
    const lifecycle = localAllLifecyclesData.find(lc => lc.id === lifecycleId);
    if (!lifecycle || !lifecycle.processes || !lifecycle.processes.process_categories) return 0;
    
    // Sum up points from all process categories
    return lifecycle.processes.process_categories.reduce((total, category) => {
      return total + calculateCategoryTotalPoints(lifecycleId, category);
    }, 0);
  };

  // Handle opening the modal with category details
  const handleCategoryClick = (lifecycleName: string, lifecycleId: string, category: ProcessCategory) => {
    // Reset the initially expanded group ID
    setInitialExpandedGroupId(null);
    
    // Update process groups with calculated scores based on strategic objectives
    const updatedProcessGroups = category.process_groups ? 
      category.process_groups.map(group => {
        // Calculate score
        const score = calculateProcessGroupScore(lifecycleId, group.name);
        
        // Get strategic objectives breakdown
        const strategicObjectives = getStrategicObjectivesForGroup(lifecycleId, group.name);
        
        // Get pain points assigned to this group
        const painPoints = getPainPointsForGroup(lifecycleId, group.name);
        
        return {
          ...group,
          score,
          strategicObjectives,
          painPoints
        };
      }) : [];
      
    setModalContent({
      lifecycleName,
      categoryName: category.name,
      processGroups: updatedProcessGroups,
      categoryCostToServe: 0 // Set to 0 as we no longer display this
    });
    setModalOpen(true);
  };

  // New function to handle process group click
  const handleProcessGroupClick = (e: React.MouseEvent, lifecycleName: string, lifecycleId: string, category: ProcessCategory, groupName: string) => {
    e.stopPropagation(); // Prevent category click event

    // Update process groups with calculated scores based on strategic objectives
    const updatedProcessGroups = category.process_groups ? 
      category.process_groups.map(group => {
        // Calculate score
        const score = calculateProcessGroupScore(lifecycleId, group.name);
        
        // Get strategic objectives breakdown
        const strategicObjectives = getStrategicObjectivesForGroup(lifecycleId, group.name);
        
        // Get pain points assigned to this group
        const painPoints = getPainPointsForGroup(lifecycleId, group.name);
        
        return {
          ...group,
          score,
          strategicObjectives,
          painPoints
        };
      }) : [];
      
    setModalContent({
      lifecycleName,
      categoryName: category.name,
      processGroups: updatedProcessGroups,
      categoryCostToServe: 0
    });

    // Find the index of the clicked process group to create a unique ID
    const groupIndex = (category.process_groups || []).findIndex(group => group.name === groupName);
    if (groupIndex !== -1) {
      setInitialExpandedGroupId(`group-${groupIndex}`);
    }
    
    setModalOpen(true);
  };

  // Toggle process selection
  const toggleProcessSelection = (processId: string) => {
    setSelectedProcesses(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(processId)) {
        newSelected.delete(processId);
      } else {
        newSelected.add(processId);
      }
      return newSelected;
    });
  };

  const renderAllLifecycles = () => {
    if (!localAllLifecyclesData.length) {
      return <p className="text-gray-500">No lifecycle data available.</p>;
    }

    return (
      <div className="flex justify-between gap-4 w-full overflow-hidden px-3 py-2">
        {localAllLifecyclesData.map((lifecycle, index) => {
          // Get all process categories for this lifecycle
          const categories = lifecycle.processes?.process_categories || [];
          // Calculate total points for this lifecycle
          const totalPoints = calculateLifecycleTotalPoints(lifecycle.id);
          // Get lifecycle level cost to serve
          const costToServe = lifecycle.costMetrics?.costToServe || 0;
          
          return (
            <div 
              key={lifecycle.id} 
              className="flex-1 min-w-0 flex flex-col h-[550px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-[#5319A5] hover:scale-[1.01] transition-all duration-200 transform cursor-pointer group"
              style={{ minWidth: '0' }}
              onClick={() => setSelectedLifecycle(lifecycle.id)}
              title={`Click to view ${lifecycle.name} details`}
            >
              <div className="flex flex-col h-full">
                {/* Lifecycle header - showing points and cost */}
                <div className="bg-white p-3 border-b border-gray-200 group-hover:bg-[#f9f5ff] transition-colors duration-200">
                  <div className="flex items-center justify-center space-x-2">
                    <span 
                      className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-bold"
                      style={{ backgroundColor: '#0EA394' }}
                      title="Total points"
                    >
                      {totalPoints} pts
                    </span>
                    <span 
                      className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-bold"
                      style={{ backgroundColor: '#7A2BF7' }}
                      title="Total cost to serve"
                    >
                      ${formatCurrency(costToServe)}
                    </span>
                  </div>
                </div>
                
                {/* Main content area with stacked bars */}
                <div className="flex-grow flex flex-col justify-end px-4">
                  {categories
                    .sort((a, b) => calculateCategoryTotalPoints(lifecycle.id, a) - calculateCategoryTotalPoints(lifecycle.id, b))
                    .map((category, idx) => {
                      const totalPoints = calculateCategoryTotalPoints(lifecycle.id, category);
                      // Height calculation (min 20px for 0 score)
                      const height = totalPoints === 0 ? 20 : Math.max(20, Math.min(100, totalPoints * 3));
                      const isTopCard = idx === 0;
                      
                      // Calculate color based on total points
                      const colorRatio = Math.min(1, totalPoints / 50);
                      const startColor = { r: 18, g: 200, b: 181 };
                      const endColor = { r: 0, g: 125, b: 112 };
                      const r = Math.round(startColor.r + colorRatio * (endColor.r - startColor.r));
                      const g = Math.round(startColor.g + colorRatio * (endColor.g - startColor.g));
                      const b = Math.round(startColor.b + colorRatio * (endColor.b - startColor.b));
                      const backgroundColor = `rgb(${r}, ${g}, ${b})`;
                      
                      return (
                        <div 
                          key={idx} 
                          className={`relative w-full border-t border-white flex items-center justify-center 
                            ${isTopCard ? 'rounded-t-md' : ''} hover:bg-opacity-80 hover:brightness-110 transition-all`}
                          style={{ 
                            height: `${height}px`,
                            backgroundColor 
                          }}
                          title={`${category.name}`}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent lifecycle from being selected
                            handleCategoryClick(lifecycle.name, lifecycle.id, category);
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <p className="text-white font-bold text-sm">
                              {totalPoints}pts
                            </p>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
                
                {/* Lifecycle footer */}
                <div className="bg-gray-50 p-3 border-t border-gray-200 mt-auto w-full h-[90px] flex flex-col justify-center group-hover:bg-[#f9f5ff] transition-colors duration-200">
                  <h3 className="text-base font-medium text-center line-clamp-2 overflow-hidden group-hover:text-[#5319A5] transition-colors duration-200">
                    {lifecycle.name}
                  </h3>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {categories.length} Journeys
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderProcessCategories = () => {
    if (!selectedLifecycleData || !selectedLifecycleData.processes || !selectedLifecycleData.processes.process_categories) {
      return <p className="text-gray-500">No categories available for this lifecycle.</p>;
    }

    const lifecycleId = selectedLifecycleData.id;
    const categoryCount = selectedLifecycleData.processes.process_categories.length;

    return (
      <div className="flex justify-between gap-4 w-full overflow-hidden px-3 py-2">
        {selectedLifecycleData.processes.process_categories.map((category, index) => {
          // Calculate total points for this category
          const totalPoints = calculateCategoryTotalPoints(lifecycleId, category);
          
          return (
            <div 
              key={index} 
              className="flex-1 min-w-0 flex flex-col h-[550px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-[#5319A5] hover:scale-[1.01] transition-all duration-200 transform cursor-pointer group"
              style={{ minWidth: '0' }}
              onClick={() => handleCategoryClick(selectedLifecycleData.name, lifecycleId, category)}
              title={`Click to view details for ${category.name}`}
            >
              <div className="flex flex-col h-full">
                {/* Points header - removed cost to serve */}
                <div className="bg-white p-3 border-b border-gray-200 group-hover:bg-[#f9f5ff] transition-colors duration-200">
                  <div className="flex items-center justify-center">
                    <span 
                      className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-bold"
                      style={{ backgroundColor: '#0EA394' }}
                      title="Total points"
                    >
                      {totalPoints} pts
                    </span>
                  </div>
                </div>
                
                {/* Main content area with stacked bars */}
                <div className="flex-grow flex flex-col justify-end px-4">
                  {category.process_groups && [...category.process_groups]
                    .map(group => {
                      // Calculate score from strategic objectives
                      const calculatedScore = calculateProcessGroupScore(lifecycleId, group.name);
                      return { ...group, calculatedScore };
                    })
                    .sort((a, b) => a.calculatedScore - b.calculatedScore) // Sort by score ascending
                    .map((group, idx, array) => {
                      const score = group.calculatedScore;
                      // Smaller height calculation (min 20px for 0 score)
                      const height = score === 0 ? 20 : Math.max(20, Math.min(100, score * 5));
                      // Determine if this is the top card in the stack (visually at the top, with least points)
                      const isTopCard = idx === 0;
                      
                      // Calculate color based on score (gradient from #12C8B5 to #007D70)
                      // For 0 points: #12C8B5, for 20+ points: #007D70
                      const colorRatio = Math.min(1, score / 20); // Value between 0 and 1
                      
                      // Convert hex to RGB for interpolation
                      const startColor = { r: 18, g: 200, b: 181 }; // #12C8B5
                      const endColor = { r: 0, g: 125, b: 112 };   // #007D70
                      
                      // Interpolate between colors
                      const r = Math.round(startColor.r + colorRatio * (endColor.r - startColor.r));
                      const g = Math.round(startColor.g + colorRatio * (endColor.g - startColor.g));
                      const b = Math.round(startColor.b + colorRatio * (endColor.b - startColor.b));
                      
                      // Create RGB color string
                      const backgroundColor = `rgb(${r}, ${g}, ${b})`;
                      
                      return (
                        <div 
                          key={idx} 
                          className={`relative w-full border-t border-white flex items-center justify-center
                            ${isTopCard ? 'rounded-t-md' : ''} hover:bg-opacity-80 hover:brightness-110 transition-all`}
                          style={{ 
                            height: `${height}px`,
                            backgroundColor 
                          }}
                          title={`${group.name}`}
                          onClick={(e) => handleProcessGroupClick(e, selectedLifecycleData.name, lifecycleId, category, group.name)}
                        >
                          <p className="text-white font-bold text-sm">{score}pts</p>
                        </div>
                      );
                    })
                  }
                </div>
                
                {/* Category footer */}
                <div className="bg-gray-50 p-3 border-t border-gray-200 mt-auto w-full h-[90px] flex flex-col justify-center group-hover:bg-[#f9f5ff] transition-colors duration-200">
                  <h3 className="text-base font-medium text-center line-clamp-2 overflow-hidden group-hover:text-[#5319A5] transition-colors duration-200">
                    {category.name.length > 30 ? `${category.name.substring(0, 30)}...` : category.name}
                  </h3>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {calculateCategoryTotalPoints(lifecycleId, category)}pts
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <div className="bg-white p-3 rounded-full w-12 h-12 flex items-center justify-center shadow-sm mr-3">
          <Image src="/assets/icons/file.svg" width={25} height={25} alt="File icon" />
        </div>
        <h2 className="text-2xl font-semibold text-[#5319A5]">Opportunity Explorer</h2>
      </div>
      <div className="mb-6 max-w-[1200px] mx-auto">
        <div className="flex justify-center items-center">
          <label htmlFor="lifecycle-filter" className="text-sm font-medium text-[#5319A5] mr-3">
            Viewing by
          </label>
          <div className="w-48">
            <select
              id="lifecycle-filter"
              value={selectedLifecycle}
              onChange={handleLifecycleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white"
              disabled={isLoading}
            >
              <option value="all">All Lifecycles</option>
              {lifecycles.map((lifecycle) => (
                <option key={lifecycle.id} value={lifecycle.id}>
                  {lifecycle.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto overflow-x-auto">
        {isLoading || isLoadingPainPoints ? (
          <p className="text-gray-500">Loading opportunities...</p>
        ) : selectedLifecycle === "all" ? (
          renderAllLifecycles()
        ) : (
          renderProcessCategories()
        )}
      </div>
      
      {/* Use the ModalWrapper instead of direct DetailsModal */}
      <ModalWrapper 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        lifecycleName={modalContent.lifecycleName} 
        categoryName={modalContent.categoryName}
        processGroups={modalContent.processGroups}
        categoryCostToServe={modalContent.categoryCostToServe}
        initialExpandedGroupId={initialExpandedGroupId}
      />
    </div>
  );
}

// Format number as currency without cents
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(value);
};

export default function ScenarioPlanningPage() {
  const params = useParams();
  const [scanData, setScanData] = useState<ScanData>({ name: '' });
  const [scenarioData, setScenarioData] = useState<any>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [currentModule, setCurrentModule] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // Add state for the focus modal
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [focusType, setFocusType] = useState<'narrow' | 'wide'>('narrow');
  // Add state for selected processes
  const [selectedProcesses, setSelectedProcesses] = useState<Set<string>>(new Set());
  // Add state for selected processes modal
  const [selectedModalOpen, setSelectedModalOpen] = useState(false);
  
  // State for process data
  const [allLifecyclesData, setAllLifecyclesData] = useState<Lifecycle[]>([]);
  const [painPointsData, setPainPointsData] = useState<Record<string, PainPointSummary>>({});

  // Modules array is now constructed with company name from state
  const getModules = (companyName: string, scanName: string) => [
    { component: <Introduction scanName={scanName} />, name: "Introduction" },
    { component: <ProjectOverview companyName={companyName} />, name: "Project Overview" },
    { component: <LifecyclesScanned />, name: "Lifecycles Scanned" },
    { component: <OpportunityExplorer 
        setAllLifecyclesData={setAllLifecyclesData}
        setPainPointsData={setPainPointsData}
      />, name: "Opportunity Explorer" },
  ];

  // Functions for calculating scores - moved from OpportunityExplorer
  const calculateProcessGroupScore = (lifecycleId: string, groupName: string): number => {
    if (!painPointsData[lifecycleId] || !painPointsData[lifecycleId].pain_points) return 0;
    
    // Calculate total score from pain points assigned to this process group
    return painPointsData[lifecycleId].pain_points
      .filter(point => point.assigned_process_group === groupName)
      .reduce((total, point) => {
        // Calculate sum of all strategic objective scores (properties starting with "so_")
        let pointScore = 0;
        Object.entries(point).forEach(([key, value]) => {
          if (key.startsWith('so_') && typeof value === 'number') {
            pointScore += value;
          }
        });
        return total + pointScore;
      }, 0);
  };
  
  // Get strategic objectives for a process group
  const getStrategicObjectivesForGroup = (lifecycleId: string, groupName: string): { name: string, score: number }[] => {
    if (!painPointsData[lifecycleId] || !painPointsData[lifecycleId].pain_points) return [];
    
    // Get pain points assigned to this group
    const groupPainPoints = painPointsData[lifecycleId].pain_points
      .filter(point => point.assigned_process_group === groupName);
      
    // Create a map to track totals for each strategic objective
    const soTotals = new Map<string, number>();
    
    // Process each pain point to extract and sum strategic objectives
    groupPainPoints.forEach(point => {
      Object.entries(point).forEach(([key, value]) => {
        if (key.startsWith('so_') && typeof value === 'number' && value > 0) {
          // Format the objective name: convert so_objective_name to Objective Name
          const objName = key.replace('so_', '')
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          // Add to the running total
          soTotals.set(objName, (soTotals.get(objName) || 0) + value);
        }
      });
    });
    
    // Convert map to array of objects for easier rendering
    return Array.from(soTotals.entries()).map(([name, score]) => ({
      name,
      score
    })).sort((a, b) => b.score - a.score); // Sort by highest total first
  };
  
  // Get pain points assigned to a process group
  const getPainPointsForGroup = (lifecycleId: string, groupName: string): PainPoint[] => {
    if (!painPointsData[lifecycleId] || !painPointsData[lifecycleId].pain_points) return [];
    
    // Get pain points assigned to this group
    return painPointsData[lifecycleId].pain_points
      .filter(point => point.assigned_process_group === groupName);
  };

  useEffect(() => {
    const fetchScanData = async () => {
      try {
        const tenant = params.tenant as string;
        const workspace = params.workspace as string;
        const scanId = params.scan as string;
        
        const response = await fetch(`/api/tenants/by-slug/workspaces/scans/scenario-planning?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch scan data');
        }
        
        const data = await response.json();
        setScanData(data.scan);
        setScenarioData(data.scenarioPlanning);
        setCompanyInfo(data.companyInfo);
      } catch (error) {
        console.error('Error fetching scenario planning data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScanData();
  }, [params]);

  const handleNext = () => {
    if (currentModule < getModules(companyInfo?.name || "the company", scanData.name || "Introduction").length - 1) {
      setCurrentModule(currentModule + 1);
    }
  };

  const handlePrevious = () => {
    if (currentModule > 0) {
      setCurrentModule(currentModule - 1);
    }
  };

  // Add handlers for the focus buttons
  const handleNarrowFocusClick = () => {
    setFocusType('narrow');
    setFocusModalOpen(true);
  };

  const handleWideFocusClick = () => {
    setFocusType('wide');
    setFocusModalOpen(true);
  };
  
  // Toggle process selection
  const toggleProcessSelection = (processId: string) => {
    setSelectedProcesses(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(processId)) {
        newSelected.delete(processId);
      } else {
        newSelected.add(processId);
      }
      return newSelected;
    });
  };

  // Get company name from company info, or use a default
  const companyName = companyInfo?.name || "the company";
  
  // Get modules array with current company name and scan name
  const modules = getModules(companyName, scanData.name || "Introduction");

  // Handle opening the selected processes modal
  const handleSelectedProcessesClick = () => {
    setSelectedModalOpen(true);
  };

  return (
    <div className={`px-8 ${currentModule === 0 ? 'min-h-screen flex flex-col justify-center -mt-20' : ''}`}>
      {/* Header with scan name - hidden on introduction page */}
      {currentModule !== 0 && (
        <div className="mb-8 flex justify-between items-center">
          <div className="bg-white p-4 rounded-lg shadow-sm inline-block">
            <p className="text-sm font-medium text-gray-500">SCENARIO PLANNER</p>
            <h1 className="text-xl font-bold">{isLoading ? 'Loading...' : scanData.name}</h1>
          </div>
          
          {currentModule === 3 && (
            <div className="flex space-x-3 items-center">
              <Button variant="secondary" onClick={handleNarrowFocusClick}>Narrow Focus</Button>
              <Button variant="secondary" onClick={handleWideFocusClick}>Wide Focus</Button>
              <div className="ml-3 relative">
                <div 
                  className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50"
                  onClick={handleSelectedProcessesClick}
                >
                  <Star size={20} className="text-[#5319A5]" />
                  {selectedProcesses.size > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#5319A5] flex items-center justify-center text-white text-xs font-bold">
                      {selectedProcesses.size}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Module Content */}
      <div className="max-w-[1200px] mx-auto mb-8">
        {modules[currentModule].component}
      </div>
      
      {/* Navigation Buttons */}
      <div className={`flex justify-between max-w-[1200px] mx-auto ${currentModule === 0 ? 'mt-4' : 'mt-8 pt-4 border-t border-gray-200'}`}>
        {currentModule === 0 ? (
          // Centered "Start Scenario Planning" button for the Introduction page
          <div className="w-full flex justify-center">
            <Button
              onClick={handleNext}
            >
              Start Scenario Planning
            </Button>
          </div>
        ) : (
          // Regular navigation for other pages
          <>
            {currentModule > 0 ? (
              <Button 
                variant="secondary" 
                onClick={handlePrevious}
              >
                {modules[currentModule - 1].name}
              </Button>
            ) : (
              <div></div> // Empty placeholder for spacing
            )}
            
            {currentModule < modules.length - 1 && (
              <Button
                onClick={handleNext}
              >
                {modules[currentModule + 1].name}
              </Button>
            )}
          </>
        )}
      </div>

      {/* New Focus Modal - uses Modal component */}
      {focusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black opacity-50" 
            onClick={() => setFocusModalOpen(false)}
          ></div>
          <div className="relative z-10 bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] max-w-[1600px] max-h-[900px] flex flex-col">
            {/* Title and Close Button */}
            <div className="flex justify-between items-center p-6 pb-3 mb-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{focusType === 'narrow' ? 'Narrow Focus' : 'Wide Focus'}</h3>
              <button 
                onClick={() => setFocusModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Modal Content */}
            <div className="flex-grow overflow-auto p-6 pt-0">
              {focusType === 'narrow' ? (
                <div className="flex h-full">
                  {/* Left side - 30% width with centered title - now fixed while scrolling */}
                  <div className="w-[30%] pr-6 flex flex-col items-center justify-center sticky top-0 self-start h-full min-h-[500px]">
                    <div className="text-center max-w-[300px]">
                      <div className="mb-6 flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100">
                          <FileText size={24} className="text-[#5319A5]" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-medium mb-4 text-[#5319A5]">Key Processes For Improving</h3>
                        <p className="text-gray-600 mb-12">This selection identifies core processes to improve based their total opportunity score. Targeting a process this way allows you completely respond to all of the associated pain points.</p>
                      </div>
                      
                      <div className="pt-8 border-t border-gray-200">
                        <h4 className="font-medium text-gray-800 mb-2">What to do</h4>
                        <p className="text-sm text-gray-600">Review the list and select the processes that matter most to you or your team. These will guide where to focus your efforts next.</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right side - 70% width with process groups list - handles scrolling */}
                  <div className="w-[70%] overflow-y-auto max-h-[calc(900px-120px)]">
                    {/* Column Headers */}
                    <div className="grid grid-cols-12 gap-4 mb-4 px-4 text-sm font-medium text-gray-500">
                      <div className="col-span-6">Process</div>
                      <div className="col-span-2 text-center">Pain Points</div>
                      <div className="col-span-2 text-center">Score</div>
                      <div className="col-span-2 text-center">Select</div>
                    </div>
                    
                    <div className="space-y-4">
                      {allLifecyclesData.flatMap(lifecycle => {
                        if (!lifecycle.processes?.process_categories) return [];
                        
                        // Get all process groups from all categories
                        const groups: {
                          lifecycle: Lifecycle;
                          category: ProcessCategory;
                          group: ProcessGroup;
                          score: number;
                          painPointCount: number;
                          id: string;
                        }[] = [];
                        
                        lifecycle.processes.process_categories.forEach(category => {
                          if (!category.process_groups) return;
                          
                          category.process_groups.forEach(group => {
                            // Calculate score based on strategic objectives
                            let score = 0;
                            let painPointCount = 0;
                            
                            // If we have pain points data for this lifecycle, calculate score
                            if (painPointsData[lifecycle.id]?.pain_points) {
                              const points = painPointsData[lifecycle.id].pain_points
                                .filter(point => point.assigned_process_group === group.name);
                              
                              // Count pain points
                              painPointCount = points.length;
                                
                              // Calculate sum of all strategic objective scores
                              points.forEach(point => {
                                Object.entries(point).forEach(([key, value]) => {
                                  if (key.startsWith('so_') && typeof value === 'number') {
                                    score += value;
                                  }
                                });
                              });
                            }
                            
                            // Create a unique ID for this process group
                            const id = `${lifecycle.id}-${category.name}-${group.name}`;
                            
                            groups.push({
                              lifecycle,
                              category,
                              group,
                              score,
                              painPointCount,
                              id
                            });
                          });
                        });
                        
                        return groups;
                      })
                      // Sort by score (highest to lowest)
                      .sort((a, b) => b.score - a.score)
                      // Map to UI components
                      .map((item, index) => {
                        const isSelected = selectedProcesses.has(item.id);
                        
                        return (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="grid grid-cols-12 gap-4 items-center">
                              {/* Process */}
                              <div className="col-span-6">
                                <h4 className="text-md font-semibold">{item.group.name}</h4>
                                <div className="text-sm text-gray-500">
                                  <span className="font-medium text-[#5319A5]">{item.lifecycle.name}</span> &gt; {item.category.name}
                                </div>
                                {item.group.description && (
                                  <p className="text-sm text-gray-600 mt-2">{item.group.description}</p>
                                )}
                              </div>
                              
                              {/* Pain Points */}
                              <div className="col-span-2 text-center">
                                <span className="text-[#7A2BF7] text-lg font-bold">{item.painPointCount}</span>
                              </div>
                              
                              {/* Score */}
                              <div className="col-span-2 text-center">
                                <span className="text-[#0EA394] text-lg font-bold">{item.score}<span className="text-sm font-normal">pts</span></span>
                              </div>
                              
                              {/* Select */}
                              <div className="col-span-2 text-center">
                                <button 
                                  onClick={() => toggleProcessSelection(item.id)}
                                  className="inline-flex items-center justify-center focus:outline-none"
                                  aria-label={isSelected ? "Deselect process" : "Select process"}
                                >
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-[#5319A5]' : 'bg-white border border-gray-200'}`}>
                                    <Star 
                                      size={20} 
                                      className={`${isSelected ? 'text-white fill-white' : 'text-gray-400'}`} 
                                    />
                                  </div>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full">
                  {/* Left side - 30% width with centered title */}
                  <div className="w-[30%] pr-6 flex flex-col items-center justify-center sticky top-0 self-start h-full min-h-[500px]">
                    <div className="text-center max-w-[300px]">
                      <div className="mb-6 flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100">
                          <FileText size={24} className="text-[#5319A5]" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-medium mb-4 text-[#5319A5]">Key Pain Points By Process</h3>
                        <p className="text-gray-600 mb-12">This selection helps to identify processes to improve based on their top 2 pain points. Targeting processes this way allows you impact more areas of the company with shorter and sharper workloads.</p>
                      </div>
                      
                      <div className="pt-8 border-t border-gray-200">
                        <h4 className="font-medium text-gray-800 mb-2">What to do</h4>
                        <p className="text-sm text-gray-600">Review the list and select the processes that matter most to you or your team. These will guide where to focus your efforts next.</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right side - 70% width with process groups and pain points */}
                  <div className="w-[70%] overflow-y-auto max-h-[calc(900px-120px)]">
                    {/* Column Headers */}
                    <div className="grid grid-cols-12 gap-4 mb-4 px-4 text-sm font-medium text-gray-500">
                      <div className="col-span-6">Process</div>
                      <div className="col-span-2 text-center">Pain Points</div>
                      <div className="col-span-2 text-center">Score</div>
                      <div className="col-span-2 text-center">Select</div>
                    </div>
                    
                    <div className="space-y-6">
                      {allLifecyclesData.flatMap(lifecycle => {
                        if (!lifecycle.processes?.process_categories) return [];
                        
                        // Get all process groups from all categories
                        const groups: {
                          lifecycle: Lifecycle;
                          category: ProcessCategory;
                          group: ProcessGroup;
                          score: number;
                          painPointCount: number;
                          painPoints: PainPoint[];
                          id: string;
                        }[] = [];
                        
                        lifecycle.processes.process_categories.forEach(category => {
                          if (!category.process_groups) return;
                          
                          category.process_groups.forEach(group => {
                            // Calculate score based on strategic objectives
                            let score = 0;
                            let painPoints: PainPoint[] = [];
                            
                            // If we have pain points data for this lifecycle, calculate score
                            if (painPointsData[lifecycle.id]?.pain_points) {
                              painPoints = painPointsData[lifecycle.id].pain_points
                                .filter(point => point.assigned_process_group === group.name);
                              
                              // Calculate sum of all strategic objective scores
                              painPoints.forEach(point => {
                                Object.entries(point).forEach(([key, value]) => {
                                  if (key.startsWith('so_') && typeof value === 'number') {
                                    score += value;
                                  }
                                });
                              });
                            }
                            
                            // Create a unique ID for this process group
                            const id = `${lifecycle.id}-${category.name}-${group.name}`;
                            
                            groups.push({
                              lifecycle,
                              category,
                              group,
                              score,
                              painPointCount: painPoints.length,
                              painPoints,
                              id
                            });
                          });
                        });
                        
                        return groups;
                      })
                      // Sort by score (highest to lowest)
                      .sort((a, b) => b.score - a.score)
                      // Map to UI components
                      .map((item, index) => {
                        const isSelected = selectedProcesses.has(item.id);
                        
                        // Get top 2 pain points sorted by their total strategic objective scores
                        const topPainPoints = [...item.painPoints]
                          .map(point => {
                            // Calculate total score for this pain point
                            let pointScore = 0;
                            Object.entries(point).forEach(([key, value]) => {
                              if (key.startsWith('so_') && typeof value === 'number') {
                                pointScore += value;
                              }
                            });
                            return { ...point, totalScore: pointScore };
                          })
                          .sort((a, b) => b.totalScore - a.totalScore)
                          .slice(0, 2);
                        
                        return (
                          <div key={index} className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                            {/* Process Header */}
                            <div className="p-4 border-b border-gray-100">
                              <div className="grid grid-cols-12 gap-4 items-center">
                                {/* Process */}
                                <div className="col-span-6">
                                  <h4 className="text-md font-semibold">{item.group.name}</h4>
                                  <div className="text-sm text-gray-500">
                                    <span className="font-medium text-[#5319A5]">{item.lifecycle.name}</span> &gt; {item.category.name}
                                  </div>
                                  {item.group.description && (
                                    <p className="text-sm text-gray-600 mt-2">{item.group.description}</p>
                                  )}
                                </div>
                                
                                {/* Pain Points */}
                                <div className="col-span-2 text-center">
                                  <span className="text-[#7A2BF7] text-lg font-bold">{item.painPointCount}</span>
                                </div>
                                
                                {/* Score */}
                                <div className="col-span-2 text-center">
                                  <span className="text-[#0EA394] text-lg font-bold">{item.score}<span className="text-sm font-normal">pts</span></span>
                                </div>
                                
                                {/* Select */}
                                <div className="col-span-2 text-center">
                                  <button 
                                    onClick={() => toggleProcessSelection(item.id)}
                                    className="inline-flex items-center justify-center focus:outline-none"
                                    aria-label={isSelected ? "Deselect process" : "Select process"}
                                  >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-[#5319A5]' : 'bg-white border border-gray-200'}`}>
                                      <Star 
                                        size={20} 
                                        className={`${isSelected ? 'text-white fill-white' : 'text-gray-400'}`} 
                                      />
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Top Pain Points */}
                            {topPainPoints.length > 0 && (
                              <div className="bg-gray-50 p-4">
                                <div className="text-xs uppercase font-semibold text-gray-500 mb-2">Top Pain Points</div>
                                <div className="space-y-3">
                                  {topPainPoints.map((painPoint, idx) => (
                                    <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                                      <div className="flex items-start">
                                        <div className="min-w-[40px] h-6 rounded bg-[#7A2BF7] text-white flex items-center justify-center text-xs font-medium mr-3">
                                          {painPoint.totalScore}pts
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium mb-1">{painPoint.description}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Processes Modal */}
      {selectedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black opacity-50" 
            onClick={() => setSelectedModalOpen(false)}
          ></div>
          <div className="relative z-10 bg-white rounded-lg shadow-xl w-[90vw] max-w-[800px] max-h-[90vh] flex flex-col">
            {/* Title and Close Button */}
            <div className="flex justify-between items-center p-6 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Key Areas in Focus</h3>
              <button 
                onClick={() => setSelectedModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Modal Content */}
            <div className="flex-grow overflow-auto p-6">
              {selectedProcesses.size === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No processes selected yet.</p>
                  <p className="text-gray-500 mt-2">Select processes from the Narrow Focus or Wide Focus views.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allLifecyclesData.flatMap(lifecycle => {
                    if (!lifecycle.processes?.process_categories) return [];
                    
                    return lifecycle.processes.process_categories.flatMap(category => {
                      if (!category.process_groups) return [];
                      
                      return category.process_groups.map(group => {
                        // Create a unique ID for this process group
                        const id = `${lifecycle.id}-${category.name}-${group.name}`;
                        
                        // Only show selected processes
                        if (!selectedProcesses.has(id)) return null;
                        
                        // Calculate score and get pain points
                        const painPoints = painPointsData[lifecycle.id]?.pain_points.filter(
                          point => point.assigned_process_group === group.name
                        ) || [];
                        
                        let score = 0;
                        painPoints.forEach(point => {
                          Object.entries(point).forEach(([key, value]) => {
                            if (key.startsWith('so_') && typeof value === 'number') {
                              score += value;
                            }
                          });
                        });
                        
                        return (
                          <div key={id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="grid grid-cols-12 gap-4 items-center">
                              {/* Process */}
                              <div className="col-span-7">
                                <h4 className="text-md font-semibold">{group.name}</h4>
                                <div className="text-sm text-gray-500">
                                  <span className="font-medium text-[#5319A5]">{lifecycle.name}</span> &gt; {category.name}
                                </div>
                                {group.description && (
                                  <p className="text-sm text-gray-600 mt-2">{group.description}</p>
                                )}
                              </div>
                              
                              {/* Pain Points Count */}
                              <div className="col-span-2 text-center">
                                <div className="text-xs text-gray-500 mb-1">Pain Points</div>
                                <span className="text-[#7A2BF7] text-lg font-bold">{painPoints.length}</span>
                              </div>
                              
                              {/* Score */}
                              <div className="col-span-2 text-center">
                                <div className="text-xs text-gray-500 mb-1">Score</div>
                                <span className="text-[#0EA394] text-lg font-bold">{score}<span className="text-sm font-normal">pts</span></span>
                              </div>
                              
                              {/* Remove */}
                              <div className="col-span-1 text-center">
                                <button 
                                  onClick={() => toggleProcessSelection(id)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
                                  aria-label="Remove from selection"
                                >
                                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }).filter(Boolean);
                    });
                  })}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t border-gray-200 p-4 flex justify-between">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700">Total Opportunity Size:</span>
                <span className="ml-2 px-2 py-1 bg-[#0EA394] text-white text-sm font-bold rounded">
                  {/* Calculate total opportunity size by summing score values shown in the list */}
                  {allLifecyclesData.reduce((total, lifecycle) => {
                    if (!lifecycle.processes?.process_categories) return total;
                    
                    // Get scores for all selected processes in this lifecycle
                    const lifecycleTotal = lifecycle.processes.process_categories.reduce((catTotal, category) => {
                      if (!category.process_groups) return catTotal;
                      
                      // Get scores for selected process groups in this category
                      const categoryTotal = category.process_groups.reduce((groupTotal, group) => {
                        // Create ID to check if selected
                        const id = `${lifecycle.id}-${category.name}-${group.name}`;
                        if (!selectedProcesses.has(id)) return groupTotal;
                        
                        // Get pain points and calculate score
                        const painPoints = painPointsData[lifecycle.id]?.pain_points?.filter(
                          point => point.assigned_process_group === group.name
                        ) || [];
                        
                        let score = 0;
                        painPoints.forEach(point => {
                          Object.entries(point).forEach(([key, value]) => {
                            if (key.startsWith('so_') && typeof value === 'number') {
                              score += value;
                            }
                          });
                        });
                        
                        return groupTotal + score;
                      }, 0);
                      
                      return catTotal + categoryTotal;
                    }, 0);
                    
                    return total + lifecycleTotal;
                  }, 0)} pts
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 