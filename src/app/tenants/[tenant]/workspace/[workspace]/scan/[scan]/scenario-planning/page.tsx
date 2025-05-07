"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Button from '@/components/Button';
import Image from 'next/image';
import Modal from '@/components/Modal';

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
}

interface ProcessGroup {
  name: string;
  description?: string;
  score?: number;
  processes?: any[];
  strategicObjectives?: { name: string; score: number }[];
  costToServe?: number;
  painPoints?: PainPoint[]; // Add pain points property
}

// Define interface for pain points
interface PainPoint {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  cost_to_serve?: number;
  // Strategic objective properties are prefixed with so_
  [key: string]: any; // To allow strategic objective properties (so_*)
}

interface PainPointSummary {
  id: string;
  pain_points: PainPoint[];
  overallSummary: string;
}

// Modal Component for Process Category Details
const DetailsModal = ({ 
  isOpen, 
  onClose, 
  lifecycleName, 
  categoryName,
  processGroups = []
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  lifecycleName: string; 
  categoryName: string;
  processGroups?: ProcessGroup[];
}) => {
  if (!isOpen) return null;

  // Calculate total cost_to_serve for all process groups
  const totalCost = processGroups.reduce((total, group) => total + (group.costToServe || 0), 0);
  
  // Calculate total points for all process groups
  const totalPoints = processGroups.reduce((total, group) => total + (group.score || 0), 0);
  
  // State to track expanded process groups
  const [expandedGroups, setExpandedGroups] = useState<{[key: string]: boolean}>({});
  
  // State to track expanded pain points sections
  const [expandedPainPointSections, setExpandedPainPointSections] = useState<{[key: string]: boolean}>({});
  
  // State to track expanded individual pain points
  const [expandedPainPoints, setExpandedPainPoints] = useState<{[key: string]: boolean}>({});
  
  // Function to toggle a process group expansion
  const toggleProcessGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  
  // Function to toggle a pain points section expansion
  const togglePainPointsSection = (groupId: string) => {
    setExpandedPainPointSections(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  
  // Function to toggle a specific pain point
  const togglePainPoint = (painPointId: string) => {
    setExpandedPainPoints(prev => ({
      ...prev,
      [painPointId]: !prev[painPointId]
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl" title="">
      <div className="py-2 relative">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Custom header with lifecycle tag and category title */}
        <div className="mb-6">
          <div className="mb-1 text-left">
            <span 
              className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
              style={{ backgroundColor: '#6B7280' }}
            >
              {lifecycleName}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 text-left mb-1">
            {categoryName}
          </h2>
          <p className="text-sm text-gray-500 text-left">Journey</p>
        </div>
        
        {/* Header with metrics */}
        <div className="mb-6 text-left">
          <div className="flex space-x-2 mb-4">
            <span 
              className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
              style={{ backgroundColor: '#0EA394' }}
              title="Total points across all process groups"
            >
              {totalPoints} pts
            </span>
            
            <span 
              className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
              style={{ backgroundColor: '#7A2BF7' }}
              title="Total cost to serve"
            >
              ${formatCurrency(totalCost)}
            </span>
          </div>
          
          <h4 className="text-sm font-medium text-gray-500 mb-1 text-left">Description</h4>
          <p className="text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-200 text-sm text-left">
            {categoryName} process category in the {lifecycleName} lifecycle.
          </p>
        </div>
        
        {/* Process Groups Section with Accordion */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2 text-left">
            Processes ({processGroups.length})
          </h4>
          
          {processGroups.length === 0 ? (
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 text-left">
              <p className="text-gray-500">No processes found for this category.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {processGroups.map((group, index) => {
                const score = typeof group.score === 'number' ? group.score : 0;
                const strategicObjectives = group.strategicObjectives || [];
                // Create a unique ID for each group
                const groupId = `group-${index}`;
                const isExpanded = expandedGroups[groupId] || false;
                const isPainPointsSectionExpanded = expandedPainPointSections[groupId] || false;
                
                // Get pain points assigned to this group
                const assignedPainPoints = group.painPoints || [];
                const hasPainPoints = assignedPainPoints.length > 0;
                
                return (
                  <div 
                    key={index} 
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                  >
                    {/* Collapsible header */}
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleProcessGroup(groupId)}
                    >
                      <div className="flex items-center">
                        <span 
                          className={`mr-2 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        >
                          ▶
                        </span>
                        <h3 className="text-lg font-medium text-gray-800 text-left">{group.name}</h3>
                      </div>
                      
                      <div className="flex space-x-2">
                        <span 
                          className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                          style={{ backgroundColor: '#0EA394' }}
                          title="Process group score"
                        >
                          {score} pts
                        </span>
                        
                        <span 
                          className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                          style={{ backgroundColor: '#7A2BF7' }}
                          title="Cost to serve"
                        >
                          ${formatCurrency(group.costToServe || 0)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Collapsible content */}
                    {isExpanded && (
                      <div className="p-4 pt-0 border-t border-gray-100">
                        {/* Group Description */}
                        {group.description ? (
                          <div className="mb-3 pt-3">
                            <h4 className="text-xs font-medium text-gray-500 mb-1 text-left">Description</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-100 text-left">
                              {group.description}
                            </p>
                          </div>
                        ) : null}
                        
                        {/* Strategic Objectives section */}
                        {strategicObjectives && strategicObjectives.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-xs font-medium text-gray-500 mb-1 text-left">Strategic Objectives Impact</h4>
                            <div className="bg-gray-50 p-2 rounded-md border border-gray-100">
                              <div className="flex flex-wrap gap-2">
                                {strategicObjectives.map((obj, idx) => (
                                  <div 
                                    key={idx} 
                                    className="flex items-center bg-white rounded px-2 py-1 border border-gray-200"
                                  >
                                    <span className="text-xs text-gray-700 text-left">{obj.name}</span>
                                    <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-[#0EA394] text-white text-xs rounded-full">
                                      {obj.score}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Pain Points Section */}
                        <div className="mt-4">
                          <div 
                            className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePainPointsSection(groupId);
                            }}
                          >
                            <span 
                              className={`mr-2 transform transition-transform duration-200 ${isPainPointsSectionExpanded ? 'rotate-90' : ''}`}
                            >
                              ▶
                            </span>
                            <h4 className="text-xs font-medium text-gray-500 text-left flex items-center">
                              Assigned Pain Points 
                              {assignedPainPoints.length > 0 && (
                                <span className="ml-2 bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                                  {assignedPainPoints.length}
                                </span>
                              )}
                            </h4>
                          </div>
                          
                          {/* Pain Points Content */}
                          {isPainPointsSectionExpanded && (
                            <div className="mt-2">
                              {!hasPainPoints ? (
                                <p className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-md border border-gray-200">
                                  No pain points assigned to this process.
                                </p>
                              ) : (
                                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 space-y-3">
                                  {assignedPainPoints.map((painPoint, ppIdx) => {
                                    const painPointId = `pain-point-${index}-${ppIdx}`;
                                    const isPainPointExpanded = expandedPainPoints[painPointId] || false;
                                    
                                    // Calculate the total strategic objective score
                                    const totalScore = Object.entries(painPoint)
                                      .filter(([key, value]) => key.startsWith('so_') && typeof value === 'number')
                                      .reduce((total, [_, value]) => total + (value as number), 0);
                                    
                                    return (
                                      <div 
                                        key={ppIdx} 
                                        className="bg-white rounded-md border border-gray-200 overflow-hidden"
                                      >
                                        {/* Pain Point Header */}
                                        <div 
                                          className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            togglePainPoint(painPointId);
                                          }}
                                        >
                                          <div className="flex items-center">
                                            <span 
                                              className={`mr-2 transform transition-transform duration-200 ${isPainPointExpanded ? 'rotate-90' : ''}`}
                                            >
                                              ▶
                                            </span>
                                            <h5 className="font-medium text-gray-800 text-sm">{painPoint.name}</h5>
                                          </div>
                                          
                                          <div className="flex items-center space-x-2">
                                            {/* Show total strategic objectives points */}
                                            <span className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold bg-[#0EA394]">
                                              {totalScore} pts
                                            </span>
                                            
                                            {painPoint.cost_to_serve !== undefined && (
                                              <span className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold bg-[#7A2BF7]">
                                                ${formatCurrency(painPoint.cost_to_serve)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Pain Point Details */}
                                        {isPainPointExpanded && (
                                          <div className="p-3 pt-0 border-t border-gray-100">
                                            <p className="text-sm text-gray-600 mb-3 pt-3 text-left">{painPoint.description}</p>
                                            
                                            {/* Strategic Objectives for this Pain Point */}
                                            <div className="mt-2">
                                              <h6 className="text-xs font-medium text-gray-500 mb-1 text-left">Strategic Objective Applicability:</h6>
                                              <div className="flex flex-wrap gap-1">
                                                {Object.entries(painPoint)
                                                  .filter(([key, value]) => key.startsWith('so_') && typeof value === 'number' && value > 0)
                                                  .map(([key, value], idx) => {
                                                    // Format the objective name
                                                    const objName = key.replace('so_', '')
                                                      .split('_')
                                                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                                      .join(' ');
                                                      
                                                    // Determine label based on score
                                                    let label = 'Low';
                                                    if (value === 2) label = 'Med';
                                                    else if (value >= 3) label = 'High';
                                                      
                                                    return (
                                                      <div 
                                                        key={idx}
                                                        className="flex items-center bg-gray-100 rounded px-2 py-1 border border-gray-200"
                                                      >
                                                        <span className="text-xs text-gray-700 text-left">{objName}</span>
                                                        <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-[#0EA394] text-white text-xs rounded-full">
                                                          {label} ({value})
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Process count (if there are processes) */}
                        {group.processes && group.processes.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
                            Contains {group.processes.length} {group.processes.length === 1 ? 'process' : 'processes'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// Module components
const Introduction = ({ scanName = "Introduction" }: { scanName?: string }) => (
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

// ProjectOverview is now a functional component that accepts companyName as a prop
const ProjectOverview = ({ companyName = "the company" }: { companyName?: string }) => {
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
};

const LifecyclesScanned = () => {
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
        
        // Fetch all lifecycles
        const lifecyclesResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}`
        );
        
        if (!lifecyclesResponse.ok) {
          throw new Error('Failed to fetch lifecycles');
        }
        
        const lifecycles = await lifecyclesResponse.json();
        
        // For each lifecycle, fetch detailed data and pain points
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
          
          // Fetch pain points for this lifecycle to calculate cost to serve
          const painPointsResponse = await fetch(
            `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`
          );
          
          let costToServe = 0;
          
          if (painPointsResponse.ok) {
            const painPointsData = await painPointsResponse.json();
            const painPoints = painPointsData.pain_points || [];
            
            // Sum cost_to_serve for pain points that don't have assigned_process_group = "Unassigned"
            costToServe = painPoints.reduce((total: number, point: any) => {
              if (point.assigned_process_group !== "Unassigned") {
                return total + (point.cost_to_serve || 0);
              }
              return total;
            }, 0);
          } else if (painPointsResponse.status !== 404) {
            console.error(`Failed to fetch pain points for lifecycle ${lifecycle.id}`);
          }
          
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
};

const OpportunityExplorer = () => {
  const params = useParams();
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);
  const [selectedLifecycle, setSelectedLifecycle] = useState<string>("all");
  const [selectedLifecycleData, setSelectedLifecycleData] = useState<Lifecycle | null>(null);
  const [allLifecyclesData, setAllLifecyclesData] = useState<Lifecycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ 
    lifecycleName: '', 
    categoryName: '',
    processGroups: [] as ProcessGroup[]
  });
  
  // Add state for pain points data
  const [painPointsData, setPainPointsData] = useState<Record<string, PainPointSummary>>({});
  const [isLoadingPainPoints, setIsLoadingPainPoints] = useState(false);

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
          // Fetch detailed data for all lifecycles
          const detailedDataPromises = lifecycles.map(lifecycle => 
            fetch(`/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}&lifecycle_id=${lifecycle.id}`)
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to fetch lifecycle data for ${lifecycle.id}`);
                }
                return response.json();
              })
              .then(data => Array.isArray(data) ? data.find(lc => lc.id === lifecycle.id) : data)
          );
          
          const detailedData = await Promise.all(detailedDataPromises);
          const filteredData = detailedData.filter(Boolean);
          setAllLifecyclesData(filteredData);
          
          // Also fetch pain points data for all lifecycles
          const painPointsPromises = filteredData.map(async (lifecycle: any) => 
            fetchPainPointsForLifecycle(lifecycle.id)
              .then(painPointsData => [lifecycle.id, painPointsData])
          );
          
          const painPointsResults = await Promise.all(painPointsPromises);
          const painPointsMap = Object.fromEntries(painPointsResults);
          setPainPointsData(painPointsMap);
          
          setSelectedLifecycleData(null);
        } else {
          // Find the lifecycle in the already loaded data first
          const existingLifecycle = lifecycles.find(lc => lc.id === selectedLifecycle);
          
          // If we have all the data we need, use it directly
          if (existingLifecycle && existingLifecycle.processes && existingLifecycle.processes.process_categories) {
            setSelectedLifecycleData(existingLifecycle);
            
            // Still need to fetch pain points data for this lifecycle
            const painPointsSummary = await fetchPainPointsForLifecycle(selectedLifecycle);
            setPainPointsData({ [selectedLifecycle]: painPointsSummary });
            
            setIsLoading(false);
            return;
          }
          
          // Otherwise fetch the specific lifecycle data
          const response = await fetch(`/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenant}&workspace_id=${workspace}&scan_id=${scanId}&lifecycle_id=${selectedLifecycle}`);
          
          if (!response.ok) {
            throw new Error('Failed to fetch lifecycle data');
          }
          
          const data = await response.json();
          // The API might return an array, so we need to find the specific lifecycle
          const lifecycleData = Array.isArray(data) ? data.find(lc => lc.id === selectedLifecycle) : data;
          setSelectedLifecycleData(lifecycleData);
          
          // Fetch pain points for this lifecycle
          const painPointsSummary = await fetchPainPointsForLifecycle(selectedLifecycle);
          setPainPointsData({ [selectedLifecycle]: painPointsSummary });
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
  }, [selectedLifecycle, lifecycles, params]);

  const handleLifecycleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLifecycle(e.target.value);
  };

  // Calculate score for a process group based on strategic objectives
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
  
  // Calculate cost to serve for a process group based on pain points
  const calculateProcessGroupCost = (lifecycleId: string, groupName: string): number => {
    if (!painPointsData[lifecycleId] || !painPointsData[lifecycleId].pain_points) return 0;
    
    // Calculate total cost from pain points assigned to this process group
    return painPointsData[lifecycleId].pain_points
      .filter(point => point.assigned_process_group === groupName)
      .reduce((total, point) => total + (point.cost_to_serve || 0), 0);
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

  // Calculate total points for a process category based on strategic objectives
  const calculateCategoryTotalPoints = (lifecycleId: string, category: ProcessCategory) => {
    if (!category.process_groups) return 0;
    
    return category.process_groups.reduce((total, group) => {
      return total + calculateProcessGroupScore(lifecycleId, group.name);
    }, 0);
  };

  // Calculate total cost to serve for a process category based on pain points
  const calculateCategoryTotalCost = (lifecycleId: string, category: ProcessCategory) => {
    if (!category.process_groups) return 0;
    
    return category.process_groups.reduce((total, group) => {
      return total + calculateProcessGroupCost(lifecycleId, group.name);
    }, 0);
  };

  // Calculate total cost to serve for an entire lifecycle
  const calculateLifecycleTotalCost = (lifecycleId: string) => {
    const lifecycle = allLifecyclesData.find(lc => lc.id === lifecycleId);
    if (!lifecycle || !lifecycle.processes || !lifecycle.processes.process_categories) return 0;
    
    return lifecycle.processes.process_categories.reduce((total, category) => {
      return total + calculateCategoryTotalCost(lifecycleId, category);
    }, 0);
  };

  // Handle opening the modal with category details
  const handleCategoryClick = (lifecycleName: string, lifecycleId: string, category: ProcessCategory) => {
    // Update process groups with calculated scores based on strategic objectives
    const updatedProcessGroups = category.process_groups ? 
      category.process_groups.map(group => {
        // Calculate score
        const score = calculateProcessGroupScore(lifecycleId, group.name);
        
        // Calculate cost to serve
        const costToServe = calculateProcessGroupCost(lifecycleId, group.name);
        
        // Get strategic objectives breakdown
        const strategicObjectives = getStrategicObjectivesForGroup(lifecycleId, group.name);
        
        // Get pain points assigned to this group
        const painPoints = getPainPointsForGroup(lifecycleId, group.name);
        
        return {
          ...group,
          score,
          costToServe,
          strategicObjectives,
          painPoints
        };
      }) : [];
      
    setModalContent({
      lifecycleName,
      categoryName: category.name,
      processGroups: updatedProcessGroups
    });
    setModalOpen(true);
  };

  const renderAllLifecycles = () => {
    if (!allLifecyclesData.length) {
      return <p className="text-gray-500">No lifecycle data available.</p>;
    }

    return (
      <div className="flex justify-between gap-4 w-full overflow-hidden px-3 py-2">
        {allLifecyclesData.map((lifecycle, index) => {
          // Calculate total cost to serve for this lifecycle
          const totalCostToServe = lifecycle.processes?.process_categories?.reduce(
            (total, category) => total + (category.cost_to_serve || 0), 
            0
          ) || 0;

          // Get all process categories for this lifecycle
          const categories = lifecycle.processes?.process_categories || [];
          
          return (
            <div 
              key={lifecycle.id} 
              className="flex-1 min-w-0 flex flex-col h-[450px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-[#5319A5] hover:scale-[1.01] transition-all duration-200 transform cursor-pointer group"
              style={{ minWidth: '0' }}
              onClick={() => setSelectedLifecycle(lifecycle.id)}
              title={`Click to view ${lifecycle.name} details`}
            >
              <div className="flex flex-col h-full">
                {/* Lifecycle header */}
                <div className="bg-white p-3 border-b border-gray-200 group-hover:bg-[#f9f5ff] transition-colors duration-200">
                  <div className="flex items-center justify-center">
                    <span className="bg-[#7A2BF7] text-white font-bold px-3 py-1 rounded-md text-xs group-hover:bg-[#5319A5] transition-colors duration-200">
                      ${formatCurrency(calculateLifecycleTotalCost(lifecycle.id))}
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
                            ${isTopCard ? 'rounded-t-md' : ''}`}
                          style={{ 
                            height: `${height}px`,
                            backgroundColor 
                          }}
                          title={`${category.name}: ${category.description || 'No description'}`}
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
                    {categories.length} Process Categories
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
        {selectedLifecycleData.processes.process_categories.map((category, index) => (
          <div 
            key={index} 
            className="flex-1 min-w-0 flex flex-col h-[450px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-[#5319A5] hover:scale-[1.01] transition-all duration-200 transform cursor-pointer group"
            style={{ minWidth: '0' }}
            onClick={() => handleCategoryClick(selectedLifecycleData.name, lifecycleId, category)}
            title={`Click to view details for ${category.name}`}
          >
            <div className="flex flex-col h-full">
              {/* Cost to serve header */}
              <div className="bg-white p-3 border-b border-gray-200 group-hover:bg-[#f9f5ff] transition-colors duration-200">
                <div className="flex items-center justify-center">
                  <span className="bg-[#7A2BF7] text-white font-bold px-3 py-1 rounded-md text-xs group-hover:bg-[#5319A5] transition-colors duration-200">
                    ${formatCurrency(calculateCategoryTotalCost(lifecycleId, category))}
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
                          ${isTopCard ? 'rounded-t-md' : ''}`}
                        style={{ 
                          height: `${height}px`,
                          backgroundColor 
                        }}
                        title={`${group.name}: ${group.description}`}
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
        ))}
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
      
      {/* Modal for displaying category details */}
      <DetailsModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        lifecycleName={modalContent.lifecycleName} 
        categoryName={modalContent.categoryName}
        processGroups={modalContent.processGroups}
      />
    </div>
  );
};

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

  // Modules array is now constructed with company name from state
  const getModules = (companyName: string, scanName: string) => [
    { component: <Introduction scanName={scanName} />, name: "Introduction" },
    { component: <ProjectOverview companyName={companyName} />, name: "Project Overview" },
    { component: <LifecyclesScanned />, name: "Lifecycles Scanned" },
    { component: <OpportunityExplorer />, name: "Opportunity Explorer" },
  ];

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

  // Get company name from company info, or use a default
  const companyName = companyInfo?.name || "the company";
  
  // Get modules array with current company name and scan name
  const modules = getModules(companyName, scanData.name || "Introduction");

  return (
    <div className={`px-8 ${currentModule === 0 ? 'min-h-screen flex flex-col justify-center -mt-20' : ''}`}>
      {/* Header with scan name - hidden on introduction page */}
      {currentModule !== 0 && (
        <div className="mb-8 bg-white p-4 rounded-lg shadow-sm inline-block">
          <p className="text-sm font-medium text-gray-500">SCENARIO PLANNER</p>
          <h1 className="text-xl font-bold">{isLoading ? 'Loading...' : scanData.name}</h1>
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
    </div>
  );
} 