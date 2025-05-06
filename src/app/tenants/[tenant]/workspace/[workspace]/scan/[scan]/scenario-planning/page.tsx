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

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="6xl" title={categoryName}>
      <div className="py-2">
        <div className="mb-4">
          <span className="bg-[#5319A5] text-white text-xs px-2 py-1 rounded">
            {lifecycleName}
          </span>
        </div>
        
        <div className="space-y-4">
          {processGroups.length === 0 ? (
            <div className="bg-gray-50 p-4 rounded border border-gray-200 text-center">
              <p className="text-gray-500">No process groups found for this category.</p>
            </div>
          ) : (
            processGroups.map((group, index) => {
              const score = typeof group.score === 'number' ? group.score : 0;
              
              // Calculate color based on score (gradient from #12C8B5 to #007D70)
              const colorRatio = Math.min(1, score / 20);
              const startColor = { r: 18, g: 200, b: 181 }; // #12C8B5
              const endColor = { r: 0, g: 125, b: 112 };   // #007D70
              const r = Math.round(startColor.r + colorRatio * (endColor.r - startColor.r));
              const g = Math.round(startColor.g + colorRatio * (endColor.g - startColor.g));
              const b = Math.round(startColor.b + colorRatio * (endColor.b - startColor.b));
              const backgroundColor = `rgb(${r}, ${g}, ${b})`;
              
              return (
                <div 
                  key={index} 
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  <div className="p-4 flex items-center">
                    <div className="flex-grow">
                      <h3 className="text-lg font-medium">{group.name}</h3>
                      {group.description && (
                        <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                      )}
                    </div>
                    <div 
                      className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ backgroundColor }}
                    >
                      <span className="text-white font-bold">{score}pts</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Process count:</span>
                      <span className="font-medium">{group.processes?.length || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <div className="flex justify-end mt-6">
          <Button variant="secondary" onClick={onClose}>Close</Button>
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
const ProjectOverview = ({ companyName = "the company" }: { companyName?: string }) => (
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
          <p className="text-4xl font-semibold text-[#5319A5] mt-2">4</p>
        </div>
        
        <div className="text-center relative">
          <div className="absolute left-0 top-0 h-full w-px bg-gray-200"></div>
          <div className="absolute right-0 top-0 h-full w-px bg-gray-200"></div>
          <h3 className="text-lg font-medium text-gray-600">Total Processes</h3>
          <p className="text-4xl font-semibold text-[#5319A5] mt-2">124</p>
        </div>
        
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-600">Total Pain Points</h3>
          <p className="text-4xl font-semibold text-[#5319A5] mt-2">378</p>
        </div>
      </div>
    </div>
  </div>
);

const LifecyclesScanned = () => (
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
        {/* Customer Lifecycle Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center">
          <div className="w-1/4 text-left">
            <div className="text-gray-600 text-sm">Lifecycle</div>
            <div className="text-2xl font-semibold">Customer</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-1/6 text-center">
            <div className="text-gray-600 text-sm">Journeys</div>
            <div className="text-2xl font-semibold text-[#5319A5]">7</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-1/6 text-center">
            <div className="text-gray-600 text-sm">Processes</div>
            <div className="text-2xl font-semibold text-[#5319A5]">28</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-5/12 text-right">
            <div className="text-gray-600 text-sm">Cost to Serve</div>
            <div className="text-2xl font-semibold text-[#5319A5]">-$2,450,000</div>
          </div>
        </div>

        {/* Assets Lifecycle Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center">
          <div className="w-1/4 text-left">
            <div className="text-gray-600 text-sm">Lifecycle</div>
            <div className="text-2xl font-semibold">Assets</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-1/6 text-center">
            <div className="text-gray-600 text-sm">Journeys</div>
            <div className="text-2xl font-semibold text-[#5319A5]">6</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-1/6 text-center">
            <div className="text-gray-600 text-sm">Processes</div>
            <div className="text-2xl font-semibold text-[#5319A5]">23</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-5/12 text-right">
            <div className="text-gray-600 text-sm">Cost to Serve</div>
            <div className="text-2xl font-semibold text-[#5319A5]">-$1,950,000</div>
          </div>
        </div>

        {/* Vendor Lifecycle Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center">
          <div className="w-1/4 text-left">
            <div className="text-gray-600 text-sm">Lifecycle</div>
            <div className="text-2xl font-semibold">Vendor</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-1/6 text-center">
            <div className="text-gray-600 text-sm">Journeys</div>
            <div className="text-2xl font-semibold text-[#5319A5]">8</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-1/6 text-center">
            <div className="text-gray-600 text-sm">Processes</div>
            <div className="text-2xl font-semibold text-[#5319A5]">34</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-5/12 text-right">
            <div className="text-gray-600 text-sm">Cost to Serve</div>
            <div className="text-2xl font-semibold text-[#5319A5]">-$940,000</div>
          </div>
        </div>

        {/* Materials Lifecycle Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center">
          <div className="w-1/4 text-left">
            <div className="text-gray-600 text-sm">Lifecycle</div>
            <div className="text-2xl font-semibold">Materials</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-1/6 text-center">
            <div className="text-gray-600 text-sm">Journeys</div>
            <div className="text-2xl font-semibold text-[#5319A5]">5</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-1/6 text-center">
            <div className="text-gray-600 text-sm">Processes</div>
            <div className="text-2xl font-semibold text-[#5319A5]">20</div>
          </div>
          <div className="h-full w-px bg-gray-200"></div>
          <div className="w-5/12 text-right">
            <div className="text-gray-600 text-sm">Cost to Serve</div>
            <div className="text-2xl font-semibold text-[#5319A5]">-$940,000</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

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
          setAllLifecyclesData(detailedData.filter(Boolean));
          setSelectedLifecycleData(null);
        } else {
          // Find the lifecycle in the already loaded data first
          const existingLifecycle = lifecycles.find(lc => lc.id === selectedLifecycle);
          
          // If we have all the data we need, use it directly
          if (existingLifecycle && existingLifecycle.processes && existingLifecycle.processes.process_categories) {
            setSelectedLifecycleData(existingLifecycle);
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

  // Calculate total points for a process category
  const calculateCategoryTotalPoints = (category: ProcessCategory) => {
    if (!category.process_groups) return 0;
    
    return category.process_groups.reduce((total, group) => {
      return total + (group.score || 0);
    }, 0);
  };

  // Handle opening the modal with category details
  const handleCategoryClick = (lifecycleName: string, category: ProcessCategory) => {
    setModalContent({
      lifecycleName,
      categoryName: category.name,
      processGroups: category.process_groups || []
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
                      ${formatCurrency(totalCostToServe)}
                    </span>
                  </div>
                </div>
                
                {/* Main content area with stacked bars */}
                <div className="flex-grow flex flex-col justify-end px-4">
                  {categories
                    .sort((a, b) => calculateCategoryTotalPoints(a) - calculateCategoryTotalPoints(b))
                    .map((category, idx) => {
                      const totalPoints = calculateCategoryTotalPoints(category);
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
                            handleCategoryClick(lifecycle.name, category);
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

    const categoryCount = selectedLifecycleData.processes.process_categories.length;

    return (
      <div className="flex justify-between gap-4 w-full overflow-hidden px-3 py-2">
        {selectedLifecycleData.processes.process_categories.map((category, index) => (
          <div 
            key={index} 
            className="flex-1 min-w-0 flex flex-col h-[450px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-[#5319A5] hover:scale-[1.01] transition-all duration-200 transform cursor-pointer group"
            style={{ minWidth: '0' }}
            onClick={() => handleCategoryClick(selectedLifecycleData.name, category)}
            title={`Click to view details for ${category.name}`}
          >
            <div className="flex flex-col h-full">
              {/* Cost to serve header */}
              <div className="bg-white p-3 border-b border-gray-200 group-hover:bg-[#f9f5ff] transition-colors duration-200">
                <div className="flex items-center justify-center">
                  <span className="bg-[#7A2BF7] text-white font-bold px-3 py-1 rounded-md text-xs group-hover:bg-[#5319A5] transition-colors duration-200">
                    ${formatCurrency(category.cost_to_serve || 100000)}
                  </span>
                </div>
              </div>
              
              {/* Main content area with stacked bars */}
              <div className="flex-grow flex flex-col justify-end px-4">
                {category.process_groups && [...category.process_groups]
                  .sort((a, b) => (a.score || 0) - (b.score || 0)) // Sort by score ascending so highest is at the bottom
                  .map((group, idx, array) => {
                    const score = typeof group.score === 'number' ? group.score : 0;
                    // Smaller height calculation (min 20px for 0 score)
                    const height = score === 0 ? 20 : Math.max(20, Math.min(100, score * 10));
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
                {typeof category.score === 'number' && (
                  <p className="text-xs text-gray-500 text-center mt-1">{category.score}pts</p>
                )}
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
        {isLoading ? (
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