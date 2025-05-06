"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Modal from "@/components/Modal"; // Assuming @ points to src
import Button from "@/components/Button"; // Import the Button component
import { Expand } from "lucide-react"; // Import Expand icon from lucide-react

type TransformFunctions = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
};

interface PainPoint {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  score?: number;
  cost_to_serve?: number;
}

interface PainPointSummary {
  id: string;
  pain_points: PainPoint[];
  overallSummary: string;
}

interface Lifecycle {
  id: string;
  name: string;
  description: string;
  position: number;
  processes?: {
    process_categories: Array<{
      name: string;
      description?: string;
      score?: number;
      process_groups: Array<{
        name: string;
        description: string;
        score?: number;
        processes?: Array<{
          name: string;
          description: string;
          score?: number;
        }>;
      }>;
    }>;
  };
  created_at: string;
  updated_at: string;
}

interface LifecycleViewerProps {
  tenantSlug: string;
  workspaceId: string;
  scanId: string;
  lifecycleId: string;
  onBackClick?: () => void; // Optional back handler prop
  initialHeight?: string; // Optional prop to control height
  isPainPointContext?: boolean; // Flag indicating if viewing in pain points context
}

export default function LifecycleViewer({ 
  tenantSlug, 
  workspaceId, 
  scanId, 
  lifecycleId, 
  onBackClick,
  initialHeight = 'calc(100vh - 305px)', // Default height
  isPainPointContext = false // Default to false
}: LifecycleViewerProps) {
  // Removed params = useParams()
  // Removed router = useRouter()
  
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize toggles based on context
  const [toggles, setToggles] = useState({
    processDetails: true,
    scores: true,
    costs: true, // Set to true by default to show cost tags
    editMode: !isPainPointContext // Set to false by default in pain point context
  });
  
  // Category and group editing state
  const [editingCategory, setEditingCategory] = useState<{
    index: number;
    name: string;
    description: string;
  } | null>(null);
  
  const [editingGroup, setEditingGroup] = useState<{
    categoryIndex: number;
    groupIndex: number;
    name: string;
    description: string;
  } | null>(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
    type: 'category' | 'group';
    categoryIndex: number;
    groupIndex?: number;
  } | null>(null);
  
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  
  const [showNewGroupModal, setShowNewGroupModal] = useState<{
    categoryIndex: number;
  } | null>(null);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  
  // Lifecycle info modal state
  const [showLifecycleInfo, setShowLifecycleInfo] = useState(false);
  
  // Canvas and container refs for measuring
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Add new state for pain point summary data
  const [painPointSummary, setPainPointSummary] = useState<PainPointSummary | null>(null);
  const [isLoadingPainPoints, setIsLoadingPainPoints] = useState(false);
  const [painPointsError, setPainPointsError] = useState("");
  
  // Use useCallback to memoize the loadLifecycleData function
  const loadLifecycleData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(""); // Reset error on new load attempt
      
      // Use props in API call
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log("Loaded lifecycle data:", data);
        
        // If the API returns an array, find the specific lifecycle by ID
        if (Array.isArray(data)) {
          console.log("API returned an array, filtering for specific lifecycle");
          const specificLifecycle = data.find(lc => lc.id === lifecycleId);
          
          if (specificLifecycle) {
            setLifecycle(specificLifecycle);
          } else {
            setError(`Lifecycle with ID ${lifecycleId} not found in the data`);
            setLifecycle(null); // Ensure lifecycle is null if not found
          }
        } else if (data && typeof data === 'object') {
          // If the API returns a single object, use it directly
          setLifecycle(data);
        } else {
           setError("Unexpected data format received from API");
           setLifecycle(null);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || `Failed to load lifecycle data (Status: ${response.status})`);
        setLifecycle(null); // Ensure lifecycle is null on error
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while loading lifecycle data");
      setLifecycle(null); // Ensure lifecycle is null on catch
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug, workspaceId, scanId, lifecycleId]); // Add dependencies for useCallback
  
  // Add function to load pain point summary data
  const loadPainPointSummary = useCallback(async () => {
    try {
      setIsLoadingPainPoints(true);
      setPainPointsError(""); // Reset error on new load attempt
      
      // Call API to get pain point summary
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log("Loaded pain point summary data:", data);
        
        // Handle both possible property names (pain_points and painPoints)
        const painPoints = data.pain_points || data.painPoints || [];
        
        // Create standard structured data
        setPainPointSummary({
          id: data.id || "",
          pain_points: painPoints,
          overallSummary: data.overallSummary || ""
        });
      } else {
        // If 404, it's fine - just no pain points yet
        if (response.status !== 404) {
          const errorData = await response.json();
          setPainPointsError(errorData.error || `Failed to load pain point data (Status: ${response.status})`);
        } else {
          // No pain points found - set empty array
          setPainPointSummary({
            id: "",
            pain_points: [],
            overallSummary: ""
          });
        }
      }
    } catch (err: any) {
      setPainPointsError(err.message || "An error occurred while loading pain point data");
    } finally {
      setIsLoadingPainPoints(false);
    }
  }, [tenantSlug, workspaceId, scanId, lifecycleId]);
  
  useEffect(() => {
    loadLifecycleData();
  }, [loadLifecycleData]); // Use loadLifecycleData in the dependency array
  
  // Add effect to load pain point summary when component mounts
  useEffect(() => {
    loadPainPointSummary();
  }, [loadPainPointSummary]);
  
  // Add event listener for lifecycle data updates from OraInterviewPanel
  useEffect(() => {
    // Handler for lifecycle data update events
    const handleLifecycleDataUpdated = (event: CustomEvent<{lifecycleId: string, timestamp: number}>) => {
      // Only reload if it's for this lifecycle
      if (event.detail.lifecycleId === lifecycleId) {
        console.log(`Received lifecycle-data-updated event for lifecycle ${lifecycleId}, reloading data`);
        loadLifecycleData();
        // Also reload pain point summary
        loadPainPointSummary();
      }
    };
    
    // Add event listener with type assertion
    window.addEventListener('lifecycle-data-updated', handleLifecycleDataUpdated as EventListener);
    
    // Clean up event listener when component unmounts
    return () => {
      window.removeEventListener('lifecycle-data-updated', handleLifecycleDataUpdated as EventListener);
    };
  }, [lifecycleId, loadLifecycleData, loadPainPointSummary]); // Include loadPainPointSummary in dependencies
  
  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Calculate background color based on score
  const getScoreColor = (score: number = 0) => {
    // Constrain score between 0 and 100 for the gradient calculation
    const constrainedScore = Math.min(Math.max(score, 0), 100);
    
    // Warm orange: rgb(255, 140, 0) at 0
    // Cherry pastel red: rgb(255, 105, 120) at 100
    const r = Math.round(255);
    const g = Math.round(140 - (35 * constrainedScore / 100));
    const b = Math.round(0 + (120 * constrainedScore / 100));
    
    return `rgb(${r}, ${g}, ${b})`;
  };
  
  const handleToggle = (name: keyof typeof toggles) => {
    setToggles(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Category editing handlers
  const handleCategoryClick = (index: number) => {
    if (!lifecycle?.processes?.process_categories || !lifecycle.processes.process_categories[index]) return;
    
    const category = lifecycle.processes.process_categories[index];
    setEditingCategory({
      index,
      name: category.name,
      description: category.description || ''
    });
  };
  
  const handleCategoryUpdate = async () => {
    if (!editingCategory || !lifecycle) return;
    
    try {
      setIsSubmitting(true);
      
      // API call to update the category - use props
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          lifecycle_id: lifecycleId,
          action: 'update_category',
          category_index: editingCategory.index,
          category: {
            name: editingCategory.name,
            description: editingCategory.description
          }
        }),
      });
        
      if (response.ok) {
         // Create a deep copy for state update
        const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
        if (updatedLifecycle.processes?.process_categories?.[editingCategory.index]) {
           updatedLifecycle.processes.process_categories[editingCategory.index].name = editingCategory.name;
           updatedLifecycle.processes.process_categories[editingCategory.index].description = editingCategory.description;
           setLifecycle(updatedLifecycle);
           setEditingCategory(null);
        } else {
            console.error("Category index out of bounds during category update");
            setError("Failed to update category locally due to index mismatch.");
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update category");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating the category");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Process group editing handlers
  const handleGroupClick = (categoryIndex: number, groupIndex: number) => {
    if (!lifecycle?.processes?.process_categories?.[categoryIndex]?.process_groups?.[groupIndex]) return;
    
    const group = lifecycle.processes.process_categories[categoryIndex].process_groups[groupIndex];
    setEditingGroup({
      categoryIndex,
      groupIndex,
      name: group.name,
      description: group.description
    });
  };
  
  const handleGroupUpdate = async () => {
    if (!editingGroup || !lifecycle) return;
    
    try {
      setIsSubmitting(true);
      
      // API call to update the group - use props
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          lifecycle_id: lifecycleId,
          action: 'update_group',
          category_index: editingGroup.categoryIndex,
          group_index: editingGroup.groupIndex,
          group: {
            name: editingGroup.name,
            description: editingGroup.description
          }
        }),
      });
        
      if (response.ok) {
         // Create a deep copy for state update
        const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
        if (updatedLifecycle.processes?.process_categories?.[editingGroup.categoryIndex]?.process_groups?.[editingGroup.groupIndex]) {
            const category = updatedLifecycle.processes.process_categories[editingGroup.categoryIndex];
            category.process_groups[editingGroup.groupIndex].name = editingGroup.name;
            category.process_groups[editingGroup.groupIndex].description = editingGroup.description;
            setLifecycle(updatedLifecycle);
            setEditingGroup(null);
        } else {
             console.error("Category/Group index out of bounds during group update");
             setError("Failed to update group locally due to index mismatch.");
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update process group");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating the process group");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Delete handlers
  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm || !lifecycle) return;
    
    try {
      setIsSubmitting(true);
      
      if (showDeleteConfirm.type === 'category') {
        // API call to delete the category - use props
        const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            workspace_id: workspaceId,
            scan_id: scanId,
            lifecycle_id: lifecycleId,
            action: 'delete_category',
            category_index: showDeleteConfirm.categoryIndex
          }),
        });
        
        if (response.ok) {
          // Create a deep copy and remove the category
          const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
          if (updatedLifecycle.processes?.process_categories) {
            updatedLifecycle.processes.process_categories.splice(showDeleteConfirm.categoryIndex, 1);
            setLifecycle(updatedLifecycle);
          }
          setShowDeleteConfirm(null);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to delete category");
        }
      } else if (showDeleteConfirm.type === 'group' && showDeleteConfirm.groupIndex !== undefined) {
        // API call to delete the group - use props
        const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            workspace_id: workspaceId,
            scan_id: scanId,
            lifecycle_id: lifecycleId,
            action: 'delete_group',
            category_index: showDeleteConfirm.categoryIndex,
            group_index: showDeleteConfirm.groupIndex
          }),
        });
        
        if (response.ok) {
          // Create a deep copy and remove the group
          const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
          if (updatedLifecycle.processes?.process_categories?.[showDeleteConfirm.categoryIndex]?.process_groups) {
            const category = updatedLifecycle.processes.process_categories[showDeleteConfirm.categoryIndex];
            category.process_groups.splice(showDeleteConfirm.groupIndex, 1);
             // Optional: Recalculate category score after deleting a group
             // category.score = category.process_groups.reduce((sum, group) => sum + (group.score || 0), 0);
            setLifecycle(updatedLifecycle);
          }
          setShowDeleteConfirm(null);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to delete process group");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during deletion");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Create new category handler
  const handleCreateCategory = async () => {
    if (!lifecycle) return;
    
    try {
      setIsSubmitting(true);
      
      // API call to create a new category - use props
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          lifecycle_id: lifecycleId,
          action: 'create_category',
          category: {
            name: newCategory.name,
            description: newCategory.description,
            process_groups: [] // Start with empty groups
          }
        }),
      });
      
      if (response.ok) {
        // Fetch the updated lifecycle data to get the new category structure and potential score updates
        // Alternatively, manually add the category locally, but fetching ensures consistency
        // For now, we will manually update locally. Consider fetching if IDs or complex backend logic is involved.
        
        const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
        
        if (!updatedLifecycle.processes) {
          updatedLifecycle.processes = { process_categories: [] };
        }
        if (!updatedLifecycle.processes.process_categories) {
          updatedLifecycle.processes.process_categories = [];
        }
        
        updatedLifecycle.processes.process_categories.push({
          name: newCategory.name,
          description: newCategory.description,
          score: 0, // Initialize score
          process_groups: []
        });
        
        setLifecycle(updatedLifecycle);
        setShowNewCategoryModal(false);
        setNewCategory({ name: '', description: '' });
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create category");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while creating the category");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Create new process group handler
  const handleCreateGroup = async () => {
    if (!lifecycle || !showNewGroupModal) return;
    
    try {
      setIsSubmitting(true);
      
      // API call to create a new process group - use props
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          lifecycle_id: lifecycleId,
          action: 'create_group',
          category_index: showNewGroupModal.categoryIndex,
          group: {
            name: newGroup.name,
            description: newGroup.description,
            processes: [] // Start with empty processes if applicable
          }
        }),
      });
      
      if (response.ok) {
         // Fetch updated data or update locally
        const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
        
        if (updatedLifecycle.processes?.process_categories?.[showNewGroupModal.categoryIndex]) {
          const category = updatedLifecycle.processes.process_categories[showNewGroupModal.categoryIndex];
          
          if (!category.process_groups) {
            category.process_groups = [];
          }
          
          category.process_groups.push({
            name: newGroup.name,
            description: newGroup.description,
            score: 0, // Initialize score
            processes: [] // Initialize processes if applicable
          });
          
          setLifecycle(updatedLifecycle);
          setShowNewGroupModal(null);
          setNewGroup({ name: '', description: '' });
        } else {
            console.error("Category index out of bounds during group creation");
            setError("Failed to add group locally due to index mismatch.");
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create process group");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while creating the process group");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Emit an event to swap the OraPanel with OraInterviewPanel when in pain point context
  useEffect(() => {
    if (isPainPointContext && lifecycle) {
      // Only trigger the panel swap once we have the lifecycle data
      const event = new CustomEvent('ora-context-change', {
        detail: {
          context: 'pain-point-interview',
          tenantSlug,
          workspaceId,
          scanId,
          lifecycleId,
          lifecycleName: lifecycle.name
        }
      });
      window.dispatchEvent(event);
    }
  }, [isPainPointContext, lifecycle, tenantSlug, workspaceId, scanId, lifecycleId]);
  
  // Add function to calculate score for a process group
  const calculateProcessGroupScore = (groupName: string): number => {
    if (!painPointSummary || !painPointSummary.pain_points) return 0;
    
    // Calculate total score from pain points assigned to this process group
    return painPointSummary.pain_points
      .filter(point => point.assigned_process_group === groupName)
      .reduce((total, point) => total + (point.score || 0), 0);
  };
  
  // Add function to calculate total score for a process category
  const calculateCategoryScore = (category: any): number => {
    if (!category.process_groups) return 0;
    
    // Calculate sum of scores from all groups in this category
    return category.process_groups.reduce((total: number, group: any) => {
      const groupScore = calculateProcessGroupScore(group.name);
      return total + groupScore;
    }, 0);
  };
  
  // Add function to calculate cost for a process group
  const calculateProcessGroupCost = (groupName: string): number => {
    if (!painPointSummary || !painPointSummary.pain_points) return 0;
    
    // Calculate total cost from pain points assigned to this process group
    return painPointSummary.pain_points
      .filter(point => point.assigned_process_group === groupName)
      .reduce((total, point) => total + (point.cost_to_serve || 100000), 0);
  };
  
  // Add function to calculate total cost for a process category
  const calculateCategoryCost = (category: any): number => {
    if (!category.process_groups) return 0;
    
    // Calculate sum of costs from all groups in this category
    return category.process_groups.reduce((total: number, group: any) => {
      const groupCost = calculateProcessGroupCost(group.name);
      return total + groupCost;
    }, 0);
  };
  
  // Helper function to format cost as currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center pt-0" style={{ height: initialHeight }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="pt-0 px-6 pb-6" style={{ height: initialHeight }}>
        <div className="p-4 mb-6 bg-red-100 text-red-800 rounded-lg">
          {error}
          <button 
            className="ml-2 text-red-600 font-semibold"
            onClick={() => setError("")} // Allow dismissing error within component
          >
            Dismiss
          </button>
        </div>
        {/* Optionally show a retry button */}
        <button
          onClick={loadLifecycleData}
          className="px-4 py-2 mr-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition"
        >
          Retry Load
        </button>
        {/* Conditionally render back button if handler is provided */}
        {onBackClick && (
           <button
             onClick={onBackClick}
             className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
           >
             Back
           </button>
        )}
      </div>
    );
  }
  
  if (!lifecycle) {
    return (
       <div className="pt-0 px-6 pb-6 flex flex-col items-center justify-center" style={{ height: initialHeight }}>
        <div className="p-4 mb-6 bg-yellow-100 text-yellow-800 rounded-lg text-center">
          Lifecycle data not found or failed to load. <br/>
          Please ensure the correct IDs are provided or try again.
        </div>
         {/* Optionally show a retry button */}
        <button
          onClick={loadLifecycleData}
          className="px-4 py-2 mr-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition"
        >
          Retry Load
        </button>
         {/* Conditionally render back button if handler is provided */}
         {onBackClick && (
           <button
             onClick={onBackClick}
             className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
           >
             Back
           </button>
         )}
      </div>
    );
  }
  
  // Check if processes data is properly structured
  const hasValidProcesses = 
    lifecycle.processes && 
    lifecycle.processes.process_categories && 
    Array.isArray(lifecycle.processes.process_categories); // Allow empty array
    // Removed check for length > 0 to allow rendering empty state correctly
  
  return (
    // Removed outer p-6, let the consumer handle padding
    <div ref={containerRef} className="mt-0 pt-0">      
      <div className="bg-white rounded-lg border border-gray-200 p-0 overflow-hidden relative" style={{ height: initialHeight }}> {/* Use initialHeight prop */}
        {/* Header Section */}
        <div className="flex justify-between items-center p-4 mb-0 rounded-t-lg bg-white shadow-sm border-b border-gray-200"> {/* Adjusted padding/margin */}
          <div className="flex items-center">
             {/* Conditionally render back button if handler is provided */}
            {onBackClick && (
                <button
                onClick={onBackClick}
                className="p-2 mr-4 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                >
                <svg className="w-5 h-5 text-indigo-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                </button>
            )}
            <div>
              <div className="text-gray-500 text-sm">
                {isPainPointContext ? "PAIN POINT INTERVIEW - LIFECYCLE" : "LIFECYCLE"}
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-indigo-800">{lifecycle?.name}</div> {/* Responsive text size */}
            </div>
          </div>
          {/* Menu Toggle Button */}
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {/* Menu Dropdown */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                {/* Lifecycle Info Section */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-800">Lifecycle Info</h3>
                    <button 
                      className="rounded-full p-1 text-indigo-600 hover:bg-indigo-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLifecycleInfo(true);
                        setShowMenu(false);
                      }}
                      title="View Lifecycle Details"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                 {/* Toggles Section */}
                <div className="p-4 space-y-4">
                  {/* Process Details Toggle */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Process Details</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={toggles.processDetails}
                        onChange={() => handleToggle('processDetails')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                   {/* Scores Toggle */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Scores</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={toggles.scores}
                        onChange={() => handleToggle('scores')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  {/* Costs Toggle */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Costs</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={toggles.costs}
                        onChange={() => handleToggle('costs')}
                        className="sr-only peer"
                      />
                       <div className={`w-11 h-6 ${toggles.costs ? 'bg-blue-600' : 'bg-gray-200'} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                    </label>
                  </div>
                  
                   {/* Edit Mode Toggle */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Edit Mode</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={toggles.editMode}
                        onChange={() => handleToggle('editMode')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Canvas Area */}
        {hasValidProcesses ? (
          // Only render TransformWrapper if there are categories (even if empty)
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={3}
            wheel={{ step: 0.1 }}
            centerOnInit={true}
            limitToBounds={false}
            // doubleClick={{ disabled: true }} // Disable double click zoom if needed
          >
            {(utils: TransformFunctions) => ( // Destructure utils directly
              <>
                {/* Zoom Controls */}
                <div className="absolute bottom-4 right-4 z-10 flex space-x-2 bg-white p-2 rounded-md shadow-md border border-gray-100">
                  <button 
                    onClick={() => utils.zoomIn()} 
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600"
                    title="Zoom In"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  </button>
                  <button 
                    onClick={() => utils.zoomOut()} 
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600"
                    title="Zoom Out"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>
                  </button>
                  <button 
                    onClick={() => utils.resetTransform()} 
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600"
                    title="Reset View"
                  >
                     <Expand className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Add Category Button (Bottom Left) */}
                <div className="absolute bottom-4 left-4 z-10">
                  {toggles.editMode && (
                    <Button
                      onClick={() => {
                        setNewCategory({ name: '', description: '' });
                        setShowNewCategoryModal(true);
                      }}
                      variant="primary"
                      icon={<svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>}
                      title="Add New Process Category"
                      className="shadow-md" // Keep shadow class if needed
                    >
                      Add Category
                    </Button>
                  )}
                </div>
                
                {/* Process Categories Canvas */}
                <TransformComponent wrapperStyle={{ width: '100%', height: 'calc(100% - 68px)' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}> {/* Updated to ensure center alignment */}
                 <div className={`flex space-x-8 p-8 ${lifecycle?.processes?.process_categories?.length === 0 ? 'w-full items-center justify-center' : ''}`}> {/* Removed min-w-max to allow centering */}
                    {lifecycle?.processes?.process_categories.length === 0 && toggles.editMode ? (
                      <div className="text-center text-gray-500">
                        <p>No process categories yet.</p>
                        <p>Click "Add Category" to get started.</p>
                      </div>
                     ) : lifecycle?.processes?.process_categories?.length === 0 && !toggles.editMode ? (
                        <div className="text-center text-gray-500">
                          <p>No process categories defined for this lifecycle.</p>
                        </div>
                     ) : (
                         lifecycle?.processes?.process_categories.map((category, catIndex) => (
                         <div 
                             key={`cat-${lifecycleId}-${catIndex}`} // More specific key
                             className="flex-shrink-0 w-64 border border-gray-300 rounded-lg bg-gray-50 shadow-sm relative flex flex-col" // Use flex-col
                             style={{ minHeight: '200px' }} // Ensure minimum height
                         >
                             {/* Category Header */}
                             <div 
                                 className={`p-3 bg-gray-700 text-white relative rounded-t-lg ${toggles.editMode ? 'cursor-pointer hover:bg-gray-800' : 'cursor-pointer hover:bg-gray-600'} transition-colors`}
                                 onClick={() => handleCategoryClick(catIndex)}
                                 title={toggles.editMode ? "Click to edit category" : "Click to view category details"}
                             >
                             <h3 className="font-semibold truncate">{category.name}</h3> {/* Add truncate */}
                             {toggles.processDetails && category.description && ( // Only show if description exists
                                 <p className="text-xs mt-1 text-gray-200 line-clamp-2">{category.description}</p> // Add line-clamp
                             )}
                             {toggles.scores && (
                                 <div className="mt-2 flex space-x-2">
                                     <span 
                                         className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                                         style={{ backgroundColor: '#0EA394' }}
                                         title={`Category Score: ${calculateCategoryScore(category)} (Sum of group scores from pain points)`}
                                     >
                                         {calculateCategoryScore(category)} pts
                                     </span>
                                     
                                     {toggles.costs && (
                                         <span 
                                             className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                                             style={{ backgroundColor: '#7A2BF7' }}
                                             title={`Category Cost: ${formatCurrency(calculateCategoryCost(category))} (Sum of costs from pain points)`}
                                         >
                                             {formatCurrency(calculateCategoryCost(category))}
                                         </span>
                                     )}
                                 </div>
                             )}
                             </div>
                             
                             {/* Process Groups Container */}
                             <div 
                                className="p-3 space-y-3 overflow-y-auto flex-grow" // Allow vertical scroll, take remaining space
                             >
                             {category.process_groups?.map((group, groupIndex) => (
                                 <div 
                                     key={`group-${lifecycleId}-${catIndex}-${groupIndex}`} // More specific key
                                     className={`p-3 bg-white border-2 ${toggles.editMode ? 'border-transparent hover:border-indigo-500 cursor-pointer' : 'border-transparent hover:border-gray-300 cursor-pointer'} rounded-lg shadow-sm relative transition-colors duration-200`}
                                     onClick={(e) => {
                                         e.stopPropagation(); // Prevent category click
                                         handleGroupClick(catIndex, groupIndex);
                                     }}
                                     title={toggles.editMode ? "Click to edit group" : "Click to view group details"}
                                 >
                                     <h4 className="font-medium text-gray-800 mb-1 truncate">{group.name}</h4> {/* Add truncate */}
                                     {toggles.processDetails && group.description && ( // Only show if description exists
                                        <p className="text-sm text-gray-600 mb-2 line-clamp-3">{group.description}</p> // Add line-clamp
                                     )}
                                     
                                     {toggles.scores && (
                                         <div className="mt-1 mb-2 flex space-x-2">
                                             <span 
                                                 className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                                                 style={{ backgroundColor: '#0EA394' }}
                                                 title={`Score: ${calculateProcessGroupScore(group.name)} (Calculated from pain points)`}
                                             >
                                                 {calculateProcessGroupScore(group.name)} pts
                                             </span>
                                             
                                             {toggles.costs && (
                                                 <span 
                                                     className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                                                     style={{ backgroundColor: '#7A2BF7' }}
                                                     title={`Cost: ${formatCurrency(calculateProcessGroupCost(group.name))} (Calculated from pain points)`}
                                                 >
                                                     {formatCurrency(calculateProcessGroupCost(group.name))}
                                                 </span>
                                             )}
                                         </div>
                                     )}
                                     
                                     {/* Processes (Example - Adapt if needed) */}
                                     {group.processes && group.processes.length > 0 && toggles.processDetails && (
                                         <div className="mt-2 space-y-1 border-t pt-2 border-gray-100">
                                             {group.processes?.map((process, processIndex) => (
                                                 <div 
                                                     key={`proc-${lifecycleId}-${catIndex}-${groupIndex}-${processIndex}`} 
                                                     className="p-1.5 bg-blue-50 border border-blue-100 rounded text-xs relative"
                                                     title={process.description} // Tooltip for process description
                                                 >
                                                     <div className="font-medium text-blue-800 truncate">{process.name}</div>
                                                     {toggles.scores && process.score !== undefined && (
                                                         <div className="mt-1">
                                                             <span 
                                                                 className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                                                                 style={{ backgroundColor: '#0EA394' }}
                                                                 title={`Process Score: ${process.score}`}
                                                             >
                                                                 {process.score} pts
                                                             </span>
                                                         </div>
                                                     )}
                                                 </div>
                                             ))}
                                         </div>
                                     )}
                                 </div>
                             ))}
                             
                             {/* Add Process Group Button */}
                             {toggles.editMode && (
                                 <button
                                 onClick={(e) => {
                                      e.stopPropagation(); // Prevent category click
                                      setNewGroup({ name: '', description: '' });
                                      setShowNewGroupModal({ categoryIndex: catIndex });
                                 }}
                                 className="w-full p-2 mt-auto bg-gray-100 text-gray-600 rounded border border-dashed border-gray-300 hover:bg-gray-200 transition flex items-center justify-center text-sm"
                                 title="Add New Process Group to this Category"
                                 >
                                 <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                 Add Group
                                 </button>
                             )}
                             </div>
                         </div>
                         ))
                     )}
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        ) : (
           // Fallback if lifecycle.processes or lifecycle.processes.process_categories is missing/invalid
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p className="text-gray-500 mb-4">No process data available or data is in an unexpected format.</p>
            {/* Provide context based on whether processes object exists */}
            {!lifecycle?.processes && (
                <p className="text-sm text-gray-400">The 'processes' field seems to be missing in the lifecycle data.</p>
            )}
            {lifecycle?.processes && !Array.isArray(lifecycle.processes.process_categories) && (
                <p className="text-sm text-gray-400">The 'process_categories' field is not an array as expected.</p>
            )}
             {/* Removed the "Generate Processes" button as it likely belongs on a different page */}
          </div>
        )}
      </div> {/* End Canvas Area Container */}

      {/* Modals Section */}
      
      {/* Category Editing Modal */}
      <Modal
        isOpen={editingCategory !== null}
        onClose={() => setEditingCategory(null)}
        title={toggles.editMode ? "Edit Process Category" : "Process Category Details"}
      >
        {editingCategory && (
          <div>
            {toggles.editMode ? (
              // Edit Mode ON - Show editable fields
              <>
                <div className="mb-4">
                  <label htmlFor="categoryName" className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="categoryName"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Enter category name"
                    required
                  />
                  {toggles.scores && lifecycle?.processes?.process_categories?.[editingCategory.index] && (
                    <div className="mt-2 flex space-x-2">
                      <span 
                        className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                        style={{ backgroundColor: '#0EA394' }}
                        title={`Category Score: ${calculateCategoryScore(lifecycle.processes.process_categories[editingCategory.index])} (Sum of group scores from pain points)`}
                      >
                        {calculateCategoryScore(lifecycle.processes.process_categories[editingCategory.index])} pts
                      </span>
                      
                      {toggles.costs && (
                          <span 
                              className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                              style={{ backgroundColor: '#7A2BF7' }}
                              title={`Category Cost: ${formatCurrency(calculateCategoryCost(lifecycle.processes.process_categories[editingCategory.index]))} (Sum of costs from pain points)`}
                          >
                              {formatCurrency(calculateCategoryCost(lifecycle.processes.process_categories[editingCategory.index]))}
                          </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mb-6">
                  <label htmlFor="categoryDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="categoryDescription"
                    value={editingCategory.description}
                    onChange={(e) => setEditingCategory({...editingCategory, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Enter category description (optional)"
                  />
                </div>
                
                <div className="flex justify-between pt-4 border-t border-gray-200">
                  {/* Delete Button */}
                  <Button
                    onClick={() => {
                      setShowDeleteConfirm({
                        type: 'category',
                        categoryIndex: editingCategory.index
                      });
                      setEditingCategory(null); // Close edit modal when opening confirm modal
                    }}
                    variant="danger" // Use danger variant for Delete
                    className="text-sm font-medium flex items-center disabled:opacity-50"
                    disabled={isSubmitting}
                    icon={<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>}
                    title="Delete this category and all groups within it"
                  >
                    Delete
                  </Button>
                  
                  {/* Cancel/Save Buttons */}
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => setEditingCategory(null)}
                      variant="secondary"
                      className="text-sm font-medium"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCategoryUpdate}
                      variant="primary"
                      className="text-sm font-medium disabled:opacity-50"
                      disabled={isSubmitting || !editingCategory.name.trim()} // Disable if name is empty
                    >
                      {isSubmitting ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Saving...
                        </div>
                      ) : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              // Edit Mode OFF - Show read-only view
              <>
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-gray-800">{editingCategory.name || ''}</h3>
                  {toggles.scores && lifecycle?.processes?.process_categories?.[editingCategory.index] && (
                    <div className="mt-1 flex space-x-2">
                      <span 
                        className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                        style={{ backgroundColor: '#0EA394' }}
                        title={`Category Score: ${calculateCategoryScore(lifecycle.processes.process_categories[editingCategory.index])} (Sum of group scores from pain points)`}
                      >
                        {calculateCategoryScore(lifecycle.processes.process_categories[editingCategory.index])} pts
                      </span>
                      
                      {toggles.costs && (
                          <span 
                              className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                              style={{ backgroundColor: '#7A2BF7' }}
                              title={`Category Cost: ${formatCurrency(calculateCategoryCost(lifecycle.processes.process_categories[editingCategory.index]))} (Sum of costs from pain points)`}
                          >
                              {formatCurrency(calculateCategoryCost(lifecycle.processes.process_categories[editingCategory.index]))}
                          </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Description</h4>
                  {editingCategory.description ? (
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-200 text-sm">
                      {editingCategory.description}
                    </p>
                  ) : (
                    <p className="text-gray-400 italic bg-gray-50 p-3 rounded-md border border-gray-200 text-sm">
                      No description provided.
                    </p>
                  )}
                </div>
                
                {editingCategory && lifecycle?.processes?.process_categories?.[editingCategory.index]?.process_groups && 
                 lifecycle?.processes?.process_categories?.[editingCategory.index]?.process_groups.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      Process Groups ({lifecycle?.processes?.process_categories?.[editingCategory.index]?.process_groups?.length || 0})
                    </h4>
                    <ul className="space-y-2 bg-gray-50 p-2 rounded-md border border-gray-200">
                      {lifecycle?.processes?.process_categories?.[editingCategory.index]?.process_groups?.map((group, idx) => (
                        <li key={`group-detail-${idx}`} className="text-sm text-gray-700 p-2 bg-white rounded border border-gray-100">
                          <div className="font-medium">{group.name}</div>
                          {toggles.scores && group.score !== undefined && (
                            <span 
                              className="inline-block px-2 py-0.5 mt-1 rounded-md text-xs text-white font-semibold"
                              style={{ backgroundColor: '#0EA394' }}
                            >
                              {group.score} pts
                            </span>
                          )}
                          {/* Cost display is handled in the main process group view */}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => setEditingCategory(null)}
                    variant="secondary"
                    className="text-sm font-medium"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      
      {/* Process Group Editing Modal */}
      <Modal
        isOpen={editingGroup !== null}
        onClose={() => setEditingGroup(null)}
        title={toggles.editMode ? "Edit Process Group" : "Process Group Details"}
      >
        {editingGroup && (
          <div>
            {toggles.editMode ? (
              // Edit Mode ON - Show editable fields
              <>
                <div className="mb-4">
                  <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="groupName"
                    value={editingGroup.name}
                    onChange={(e) => setEditingGroup({...editingGroup, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Enter group name"
                    required
                  />
                  {toggles.scores && lifecycle?.processes?.process_categories?.[editingGroup.categoryIndex]?.process_groups?.[editingGroup.groupIndex] && (
                    <div className="mt-2 flex space-x-2">
                      <span 
                        className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                        style={{ backgroundColor: '#0EA394' }}
                        title={`Score: ${calculateProcessGroupScore(lifecycle.processes.process_categories[editingGroup.categoryIndex].process_groups[editingGroup.groupIndex].name)} (Calculated from pain points)`}
                      >
                        {calculateProcessGroupScore(lifecycle.processes.process_categories[editingGroup.categoryIndex].process_groups[editingGroup.groupIndex].name)} pts
                      </span>
                      
                      {toggles.costs && (
                          <span 
                              className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                              style={{ backgroundColor: '#7A2BF7' }}
                              title={`Cost: ${formatCurrency(calculateProcessGroupCost(lifecycle.processes.process_categories[editingGroup.categoryIndex].process_groups[editingGroup.groupIndex].name))} (Calculated from pain points)`}
                          >
                              {formatCurrency(calculateProcessGroupCost(lifecycle.processes.process_categories[editingGroup.categoryIndex].process_groups[editingGroup.groupIndex].name))}
                          </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mb-6">
                  <label htmlFor="groupDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="groupDescription"
                    value={editingGroup.description}
                    onChange={(e) => setEditingGroup({...editingGroup, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Enter group description (optional)"
                  />
                </div>
                
                <div className="flex justify-between pt-4 border-t border-gray-200">
                  {/* Delete Button */}
                  <Button
                    onClick={() => {
                      setShowDeleteConfirm({
                        type: 'group',
                        categoryIndex: editingGroup.categoryIndex,
                        groupIndex: editingGroup.groupIndex
                      });
                      setEditingGroup(null); // Close edit modal
                    }}
                    variant="danger"
                    className="text-sm font-medium flex items-center disabled:opacity-50"
                    disabled={isSubmitting}
                    icon={<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>}
                    title="Delete this process group"
                  >
                    Delete
                  </Button>
                  
                  {/* Cancel/Save Buttons */}
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => setEditingGroup(null)}
                      variant="secondary"
                      className="text-sm font-medium"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleGroupUpdate}
                      variant="primary"
                      className="text-sm font-medium disabled:opacity-50"
                      disabled={isSubmitting || !editingGroup.name.trim()} // Disable if name is empty
                    >
                      {isSubmitting ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Saving...
                        </div>
                      ) : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              // Edit Mode OFF - Show read-only view
              <>
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-gray-800">{editingGroup.name || ''}</h3>
                  {toggles.scores && lifecycle?.processes?.process_categories?.[editingGroup.categoryIndex]?.process_groups?.[editingGroup.groupIndex] && (
                    <div className="mt-1 flex space-x-2">
                      <span 
                        className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                        style={{ backgroundColor: '#0EA394' }}
                        title={`Score: ${calculateProcessGroupScore(lifecycle?.processes?.process_categories?.[editingGroup.categoryIndex]?.process_groups?.[editingGroup.groupIndex]?.name)} (Calculated from pain points)`}
                      >
                        {calculateProcessGroupScore(lifecycle?.processes?.process_categories?.[editingGroup.categoryIndex]?.process_groups?.[editingGroup.groupIndex]?.name)} pts
                      </span>
                      
                      {toggles.costs && (
                          <span 
                              className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                              style={{ backgroundColor: '#7A2BF7' }}
                              title={`Cost: ${formatCurrency(calculateProcessGroupCost(lifecycle?.processes?.process_categories?.[editingGroup.categoryIndex]?.process_groups?.[editingGroup.groupIndex]?.name))} (Calculated from pain points)`}
                          >
                              {formatCurrency(calculateProcessGroupCost(lifecycle?.processes?.process_categories?.[editingGroup.categoryIndex]?.process_groups?.[editingGroup.groupIndex]?.name))}
                          </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Description</h4>
                  {editingGroup.description ? (
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-200 text-sm">
                      {editingGroup.description}
                    </p>
                  ) : (
                    <p className="text-gray-400 italic bg-gray-50 p-3 rounded-md border border-gray-200 text-sm">
                      No description provided.
                    </p>
                  )}
                </div>
                
                {(() => {
                  const processesArray = lifecycle?.processes?.process_categories?.[editingGroup?.categoryIndex ?? -1]?.
                    process_groups?.[editingGroup?.groupIndex ?? -1]?.processes;
                  
                  if (!editingGroup || !processesArray || processesArray.length === 0) {
                    return null;
                  }
                  
                  return (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">
                        Processes ({processesArray.length})
                      </h4>
                      <ul className="space-y-2 bg-gray-50 p-2 rounded-md border border-gray-200">
                        {processesArray.map((process, idx) => (
                          <li key={`process-detail-${idx}`} className="text-sm text-gray-700 p-2 bg-white rounded border border-gray-100">
                            <div className="font-medium">{process.name}</div>
                            {toggles.scores && process.score !== undefined && (
                              <span 
                                className="inline-block px-2 py-0.5 mt-1 rounded-md text-xs text-white font-semibold"
                                style={{ backgroundColor: '#0EA394' }}
                              >
                                {process.score} pts
                              </span>
                            )}
                            {/* Cost is calculated at the process group level */}
                            {process.description && <p className="text-xs text-gray-500 mt-1">{process.description}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => setEditingGroup(null)}
                    variant="secondary"
                    className="text-sm font-medium"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title="Confirm Deletion" // Add title prop
      >
        <div className="p-1">
          <div className="flex items-start mb-4"> {/* Use items-start */}
            <div className="flex-shrink-0 bg-red-100 p-2 rounded-full mr-3 mt-1"> {/* Add margin-top */}
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
             <div>
                 {/* <h3 className="text-lg font-medium text-gray-900">Confirm Delete</h3> */}
                 <p className="text-sm text-gray-600 mt-1">
                 {showDeleteConfirm?.type === 'category' ? (
                     <>Are you sure you want to delete the category <span className="font-semibold">"{lifecycle?.processes?.process_categories?.[showDeleteConfirm.categoryIndex]?.name}"</span>? This action cannot be undone and will permanently remove all associated process groups.</>
                 ) : (
                      <>Are you sure you want to delete the process group <span className="font-semibold">"{lifecycle?.processes?.process_categories?.[showDeleteConfirm?.categoryIndex ?? -1]?.process_groups?.[showDeleteConfirm?.groupIndex ?? -1]?.name}"</span>? This action cannot be undone.</>
                 )}
                 </p>
             </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
            <Button
              onClick={() => setShowDeleteConfirm(null)}
              variant="secondary"
              className="text-sm font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
               variant="danger" 
               className="text-sm font-medium disabled:opacity-50 flex items-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                   <div className="flex items-center">
                       <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                           Deleting...
                   </div>
               ) : (
                   <>
                     <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                     Confirm Delete
                   </>
               )}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* New Category Modal */}
      <Modal
        isOpen={showNewCategoryModal}
        onClose={() => setShowNewCategoryModal(false)}
        title="Create New Process Category"
      >
        {/* <h3 className="text-lg font-bold mb-4">Create New Process Category</h3> */}
        <div>
          <div className="mb-4">
            <label htmlFor="newCategoryName" className="block text-sm font-medium text-gray-700 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="newCategoryName"
              value={newCategory.name}
              onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g., Planning, Development, Testing"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="newCategoryDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="newCategoryDescription"
              value={newCategory.description}
              onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Enter a short description (optional)"
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              onClick={() => setShowNewCategoryModal(false)}
               variant="secondary"
               className="text-sm font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              variant="primary"
              className="text-sm font-medium disabled:opacity-50"
              disabled={isSubmitting || !newCategory.name.trim()}
            >
               {isSubmitting ? (
                   <div className="flex items-center">
                       <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                       Creating...
                   </div>
               ) : 'Create Category'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* New Process Group Modal */}
      <Modal
        isOpen={showNewGroupModal !== null}
        onClose={() => setShowNewGroupModal(null)}
        title="Create New Process Group"
      >
       {/* <h3 className="text-lg font-bold mb-4">Create New Process Group</h3> */}
        <div>
           {showNewGroupModal && lifecycle?.processes?.process_categories?.[showNewGroupModal.categoryIndex] && (
                <p className="text-sm text-gray-500 mb-4">
                    Adding group to category: <span className="font-medium">{lifecycle.processes.process_categories[showNewGroupModal.categoryIndex].name}</span>
                </p>
            )}
          <div className="mb-4">
            <label htmlFor="newGroupName" className="block text-sm font-medium text-gray-700 mb-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="newGroupName"
              value={newGroup.name}
              onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g., Requirements Gathering, UI Design"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="newGroupDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="newGroupDescription"
              value={newGroup.description}
              onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Enter a short description (optional)"
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              onClick={() => setShowNewGroupModal(null)}
               variant="secondary"
               className="text-sm font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              variant="primary"
              className="text-sm font-medium disabled:opacity-50"
              disabled={isSubmitting || !newGroup.name.trim()}
            >
              {isSubmitting ? (
                   <div className="flex items-center">
                       <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                       Creating...
                   </div>
               ) : 'Create Group'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Lifecycle Info Modal */}
      <Modal
        isOpen={showLifecycleInfo}
        onClose={() => setShowLifecycleInfo(false)}
         title={lifecycle?.name || "Lifecycle Info"} // Dynamic title
      >
        <div className="p-1">
           {/* No need for redundant header if title prop is used */}
          {/* <div className="flex items-center mb-4"> ... </div> */}
          
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-500 mb-1 uppercase tracking-wider">Description</h4>
            <div className="text-gray-700 p-3 bg-gray-50 rounded-md border border-gray-200 text-sm max-h-60 overflow-y-auto">
              {lifecycle?.description ? (
                <p>{lifecycle.description}</p> 
              ) : (
                <p className="text-gray-400 italic">No description provided.</p>
              )}
            </div>
          </div>

           <div className="mb-4">
               <h4 className="text-sm font-medium text-gray-500 mb-1 uppercase tracking-wider">Details</h4>
                <dl className="text-sm grid grid-cols-3 gap-x-4 gap-y-1 bg-gray-50 p-3 rounded-md border border-gray-200">
                   <dt className="font-medium text-gray-500 col-span-1">ID</dt>
                   <dd className="text-gray-700 col-span-2 truncate">{lifecycle?.id}</dd>
                   <dt className="font-medium text-gray-500 col-span-1">Created</dt>
                   <dd className="text-gray-700 col-span-2">{lifecycle?.created_at ? new Date(lifecycle.created_at).toLocaleString() : 'N/A'}</dd>
                   <dt className="font-medium text-gray-500 col-span-1">Updated</dt>
                   <dd className="text-gray-700 col-span-2">{lifecycle?.updated_at ? new Date(lifecycle.updated_at).toLocaleString() : 'N/A'}</dd>
               </dl>
           </div>
          
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              onClick={() => setShowLifecycleInfo(false)}
              variant="primary" // Or secondary, depending on desired look
              className="text-sm font-medium"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

    </div> // End main container
  );
} 