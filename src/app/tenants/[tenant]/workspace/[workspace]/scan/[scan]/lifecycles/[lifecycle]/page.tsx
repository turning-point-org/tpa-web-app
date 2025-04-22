"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Modal from "@/components/Modal";

type TransformFunctions = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
};

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

export default function LifecycleProcessesPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;
  const lifecycleId = params.lifecycle as string;
  
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [toggles, setToggles] = useState({
    processDetails: true,
    scores: true,
    costs: false,
    editMode: true
  });

  // Score editing state
  const [editingScore, setEditingScore] = useState<{
    categoryIndex: number;
    groupIndex: number;
    score: number;
    name: string;
  } | null>(null);
  const [newScore, setNewScore] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  
  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{
    categoryIndex: number;
    groupIndex: number;
  } | null>(null);
  
  // Canvas and container refs for measuring
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    loadLifecycleData();
  }, [tenantSlug, workspaceId, scanId, lifecycleId]);
  
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
  
  async function loadLifecycleData() {
    try {
      setIsLoading(true);
      
      // Check if the API endpoint supports fetching a single lifecycle by ID
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
          }
        } else {
          // If the API returns a single object, use it directly
          // This is the ideal case if the API properly filters on the backend
          setLifecycle(data);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to load lifecycle data");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while loading lifecycle data");
    } finally {
      setIsLoading(false);
    }
  }
  
  const handleBackClick = () => {
    router.back();
  };
  
  const handleToggle = (name: keyof typeof toggles) => {
    setToggles(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleScoreClick = (categoryIndex: number, groupIndex: number, score: number, name: string) => {
    setEditingScore({
      categoryIndex,
      groupIndex,
      score,
      name
    });
    setNewScore(score || 0);
  };

  const handleScoreUpdate = async () => {
    if (!editingScore) return;

    try {
      setIsSubmitting(true);
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
          action: 'update_score',
          category_index: editingScore.categoryIndex,
          group_index: editingScore.groupIndex,
          score: newScore
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update the local state with the new scores
        if (lifecycle && lifecycle.processes) {
          const updatedLifecycle = { ...lifecycle };
          // Need to ensure processes exists on updatedLifecycle
          if (updatedLifecycle.processes && updatedLifecycle.processes.process_categories) {
            const category = updatedLifecycle.processes.process_categories[editingScore.categoryIndex];
            
            // Update the process group score
            category.process_groups[editingScore.groupIndex].score = newScore;
            
            // Update the category score with the value from the API
            category.score = result.category_score;
            
            setLifecycle(updatedLifecycle);
          }
        }

        // Reset state
        setEditingScore(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update score");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating the score");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Category editing handlers
  const handleCategoryClick = (index: number) => {
    if (!lifecycle?.processes?.process_categories) return;
    
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
      
      // Create a deep copy of the lifecycle
      const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
      
      if (updatedLifecycle.processes && updatedLifecycle.processes.process_categories) {
        updatedLifecycle.processes.process_categories[editingCategory.index].name = editingCategory.name;
        updatedLifecycle.processes.process_categories[editingCategory.index].description = editingCategory.description;
        
        // API call to update the category
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
          setLifecycle(updatedLifecycle);
          setEditingCategory(null);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to update category");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating the category");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Process group editing handlers
  const handleGroupClick = (categoryIndex: number, groupIndex: number) => {
    if (!lifecycle?.processes?.process_categories) return;
    
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
      
      // Create a deep copy of the lifecycle
      const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
      
      if (updatedLifecycle.processes && updatedLifecycle.processes.process_categories) {
        const category = updatedLifecycle.processes.process_categories[editingGroup.categoryIndex];
        category.process_groups[editingGroup.groupIndex].name = editingGroup.name;
        category.process_groups[editingGroup.groupIndex].description = editingGroup.description;
        
        // API call to update the group
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
          setLifecycle(updatedLifecycle);
          setEditingGroup(null);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to update process group");
        }
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
        // API call to delete the category
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
          if (updatedLifecycle.processes && updatedLifecycle.processes.process_categories) {
            updatedLifecycle.processes.process_categories.splice(showDeleteConfirm.categoryIndex, 1);
            setLifecycle(updatedLifecycle);
          }
          
          setShowDeleteConfirm(null);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to delete category");
        }
      } else if (showDeleteConfirm.type === 'group' && showDeleteConfirm.groupIndex !== undefined) {
        // API call to delete the group
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
          if (updatedLifecycle.processes && updatedLifecycle.processes.process_categories) {
            const category = updatedLifecycle.processes.process_categories[showDeleteConfirm.categoryIndex];
            category.process_groups.splice(showDeleteConfirm.groupIndex, 1);
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
      
      // API call to create a new category
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
            process_groups: []
          }
        }),
      });
      
      if (response.ok) {
        // Create a deep copy and add the new category
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
          score: 0,
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
      
      // API call to create a new process group
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
            processes: []
          }
        }),
      });
      
      if (response.ok) {
        // Create a deep copy and add the new process group
        const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
        
        if (updatedLifecycle.processes && updatedLifecycle.processes.process_categories) {
          const category = updatedLifecycle.processes.process_categories[showNewGroupModal.categoryIndex];
          
          if (!category.process_groups) {
            category.process_groups = [];
          }
          
          category.process_groups.push({
            name: newGroup.name,
            description: newGroup.description,
            score: 0,
            processes: []
          });
          
          setLifecycle(updatedLifecycle);
          setShowNewGroupModal(null);
          setNewGroup({ name: '', description: '' });
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
  
  // Handlers for drag and drop
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    categoryIndex: number,
    groupIndex: number
  ) => {
    e.stopPropagation();
    setDraggedItem({ categoryIndex, groupIndex });
    
    // Set the drag data
    e.dataTransfer.setData(
      'text/plain', 
      JSON.stringify({ categoryIndex, groupIndex })
    );
    
    // Add a custom class to the element being dragged
    if (e.currentTarget) {
      e.currentTarget.classList.add('opacity-50');
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Prevent default to allow drop
    e.preventDefault();
    
    // Add a visual cue
    if (e.currentTarget) {
      e.currentTarget.classList.add('bg-blue-50');
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Remove visual cue
    if (e.currentTarget) {
      e.currentTarget.classList.remove('bg-blue-50');
    }
  };
  
  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetCategoryIndex: number
  ) => {
    e.preventDefault();
    
    // Remove visual cue
    if (e.currentTarget) {
      e.currentTarget.classList.remove('bg-blue-50');
    }
    
    try {
      // Get the dragged item data
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const sourceCategoryIndex = data.categoryIndex;
      const sourceGroupIndex = data.groupIndex;
      
      // If dropped in the same category, do nothing
      if (sourceCategoryIndex === targetCategoryIndex) {
        return;
      }
      
      // Create a deep copy of the lifecycle
      const updatedLifecycle = JSON.parse(JSON.stringify(lifecycle));
      
      if (updatedLifecycle?.processes?.process_categories) {
        const sourceCategory = updatedLifecycle.processes.process_categories[sourceCategoryIndex];
        const targetCategory = updatedLifecycle.processes.process_categories[targetCategoryIndex];
        
        // Get the group to move
        const [movedGroup] = sourceCategory.process_groups.splice(sourceGroupIndex, 1);
        
        // Add to the target category
        targetCategory.process_groups.push(movedGroup);
        
        // Update the lifecycle state
        setLifecycle(updatedLifecycle);
        
        // API call to update the process group order
        await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            workspace_id: workspaceId,
            scan_id: scanId,
            lifecycle_id: lifecycleId,
            action: 'reorder_group',
            reorder: {
              source_category_index: sourceCategoryIndex,
              source_group_index: sourceGroupIndex,
              dest_category_index: targetCategoryIndex,
              dest_group_index: targetCategory.process_groups.length - 1
            }
          }),
        });
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while reordering process groups");
      // Reload the data to ensure consistency
      loadLifecycleData();
    }
    
    setDraggedItem(null);
  };
  
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    // Reset the appearance of the dragged item
    if (e.currentTarget) {
      e.currentTarget.classList.remove('opacity-50');
    }
    setDraggedItem(null);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 mb-6 bg-red-100 text-red-800 rounded-lg">
          {error}
          <button 
            className="ml-2 text-red-600 font-semibold"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
        <button
          onClick={handleBackClick}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
        >
          Back to Lifecycles
        </button>
      </div>
    );
  }
  
  if (!lifecycle) {
    return (
      <div className="p-6">
        <div className="p-4 mb-6 bg-yellow-100 text-yellow-800 rounded-lg">
          Lifecycle data not found. Please ensure the correct lifecycle ID is in the URL.
        </div>
        <button
          onClick={handleBackClick}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
        >
          Back to Lifecycles
        </button>
      </div>
    );
  }
  
  // Check if processes data is properly structured
  const hasValidProcesses = 
    lifecycle.processes && 
    lifecycle.processes.process_categories && 
    Array.isArray(lifecycle.processes.process_categories) &&
    lifecycle.processes.process_categories.length > 0;
  
  return (
    <div className="p-6" ref={containerRef}>      
      <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden relative" style={{ height: 'calc(100vh - 305px)' }}>
        <div className="flex justify-between items-center p-4 mb-4 rounded-lg bg-white shadow-sm">
          <div className="flex items-center">
            <button
              onClick={handleBackClick}
              className="p-2 mr-4 rounded-full bg-gray-100 hover:bg-gray-200 transition"
            >
              <svg className="w-5 h-5 text-indigo-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="text-gray-500 text-sm">LIFECYCLE</div>
              <div className="text-4xl font-bold text-indigo-800">{lifecycle?.name}</div>
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
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
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="p-4 space-y-4">
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
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Costs</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={toggles.costs}
                        onChange={() => handleToggle('costs')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
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
        
        {hasValidProcesses ? (
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={3}
            wheel={{ step: 0.1 }}
            centerOnInit={true}
          >
            {({ zoomIn, zoomOut, resetTransform }: TransformFunctions) => (
              <>
                <div className="absolute bottom-4 right-4 z-10 flex space-x-2 bg-white p-2 rounded-md shadow-md">
                  <button 
                    onClick={() => zoomIn()} 
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md"
                    title="Zoom In"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => zoomOut()} 
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md"
                    title="Zoom Out"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => resetTransform()} 
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md"
                    title="Reset View"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                    </svg>
                  </button>
                </div>
                
                <div className="absolute bottom-4 left-4 z-10">
                  {toggles.editMode && (
                    <button
                      onClick={() => {
                        setNewCategory({ name: '', description: '' });
                        setShowNewCategoryModal(true);
                      }}
                      className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                      title="Add Category"
                    >
                      <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Category
                    </button>
                  )}
                </div>
                
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                  <div className="flex space-x-8 min-w-max p-8">
                    {lifecycle?.processes?.process_categories.map((category, catIndex) => (
                      <div 
                        key={catIndex} 
                        className="flex-shrink-0 w-64 border border-gray-300 rounded-lg bg-gray-50 relative"
                      >
                        <div 
                          className="p-3 bg-gray-700 text-white relative rounded-t-lg cursor-pointer"
                          onClick={() => toggles.editMode && handleCategoryClick(catIndex)}
                        >
                          {toggles.scores && (
                            <div 
                              className="absolute -top-3 -right-3 w-8 h-8 p-4.5 rounded-full flex items-center justify-center text-base text-white font-bold shadow-lg border-2 border-white z-10 cursor-not-allowed" 
                              style={{ backgroundColor: getScoreColor(category.score) }}
                              title="Category score is the sum of all process group scores"
                            >
                              <span className="inline-block px-1">{category.score || 0}</span>
                            </div>
                          )}
                          <h3 className="font-semibold">{category.name}</h3>
                          {toggles.processDetails && (
                            <p className="text-xs mt-1 text-gray-200">{category.description}</p>
                          )}
                        </div>
                        
                        <div 
                          className="p-3 space-y-3 overflow-visible min-h-[100px]"
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, catIndex)}
                        >
                          {category.process_groups?.map((group, groupIndex) => (
                            <div 
                              key={`group-${catIndex}-${groupIndex}`} 
                              className="p-3 bg-white border-2 border-transparent hover:border-indigo-500 rounded-lg shadow-sm relative cursor-move transition-colors duration-200"
                              draggable={toggles.editMode}
                              onDragStart={(e) => handleDragStart(e, catIndex, groupIndex)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (toggles.editMode) {
                                  handleGroupClick(catIndex, groupIndex);
                                }
                              }}
                            >
                              {toggles.scores && (
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (toggles.editMode) {
                                      handleScoreClick(catIndex, groupIndex, group.score || 0, group.name);
                                    }
                                  }}
                                  className="absolute -top-2 -right-2 w-6 h-6 p-3.5 rounded-full flex items-center justify-center text-sm text-white font-bold shadow-lg border-2 border-white z-10 cursor-pointer transform transition-transform hover:scale-110" 
                                  style={{ backgroundColor: getScoreColor(group.score) }}
                                  title="Click to edit score"
                                >
                                  <span className="inline-block px-0.5">{group.score || 0}</span>
                                </div>
                              )}
                              <h4 className="font-medium text-gray-800 mb-2">{group.name}</h4>
                              {toggles.processDetails && (
                                <p className="text-sm text-gray-600 mb-3">{group.description}</p>
                              )}
                              
                              {group.processes?.map((process, processIndex) => (
                                <div 
                                  key={processIndex} 
                                  className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm relative"
                                >
                                  {toggles.scores && process.score !== undefined && (
                                    <div 
                                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-md border border-white z-10" 
                                      style={{ backgroundColor: getScoreColor(process.score) }}
                                    >
                                      <span className="inline-block px-0.5">{process.score}</span>
                                    </div>
                                  )}
                                  <div className="font-medium text-blue-800">{process.name}</div>
                                  {toggles.processDetails && (
                                    <div className="text-xs text-blue-600 mt-1">{process.description}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                          
                          {/* Add Process Group Button */}
                          {toggles.editMode && (
                            <button
                              onClick={() => {
                                setNewGroup({ name: '', description: '' });
                                setShowNewGroupModal({ categoryIndex: catIndex });
                              }}
                              className="w-full p-2 mt-2 bg-gray-100 text-gray-600 rounded border border-dashed border-gray-300 hover:bg-gray-200 transition flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Add Process Group
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500 mb-4">No processes data available</p>
            {lifecycle?.processes ? (
              <div className="text-center text-sm text-gray-400 max-w-lg">
                <p>Process data exists but may not be in the expected format.</p>
              </div>
            ) : (
              <button
                onClick={() => router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/lifecycles`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                Generate Processes
              </button>
            )}
          </div>
        )}
      </div>

      {/* Score Editing Modal */}
      <Modal
        isOpen={editingScore !== null}
        onClose={() => setEditingScore(null)}
      >
        <h3 className="text-lg font-bold mb-4">Edit Process Score</h3>
        {editingScore && (
          <div>
            <p className="mb-4 text-gray-600">
              Update the score for <span className="font-medium">{editingScore.name}</span>
            </p>
            
            <div className="mb-6">
              <div className="flex flex-col items-center gap-2">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white font-bold shadow-lg"
                  style={{ backgroundColor: getScoreColor(newScore) }}
                >
                  {newScore}
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newScore}
                  onChange={(e) => setNewScore(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between w-full">
                  <span className="text-orange-500 font-bold">0</span>
                  <span className="text-red-500 font-bold">100</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditingScore(null)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleScoreUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Score'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Category Editing Modal */}
      <Modal
        isOpen={editingCategory !== null}
        onClose={() => setEditingCategory(null)}
      >
        <h3 className="text-lg font-bold mb-4">Edit Process Category</h3>
        {editingCategory && (
          <div>
            <div className="mb-4">
              <label htmlFor="categoryName" className="block text-sm font-medium text-gray-700 mb-1">
                Category Name
              </label>
              <input
                type="text"
                id="categoryName"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter category name"
              />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter category description"
              />
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => {
                  setShowDeleteConfirm({
                    type: 'category',
                    categoryIndex: editingCategory.index
                  });
                  setEditingCategory(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                disabled={isSubmitting}
              >
                Delete Category
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCategoryUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Process Group Editing Modal */}
      <Modal
        isOpen={editingGroup !== null}
        onClose={() => setEditingGroup(null)}
      >
        <h3 className="text-lg font-bold mb-4">Edit Process Group</h3>
        {editingGroup && (
          <div>
            <div className="mb-4">
              <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
                Group Name
              </label>
              <input
                type="text"
                id="groupName"
                value={editingGroup.name}
                onChange={(e) => setEditingGroup({...editingGroup, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter group name"
              />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter group description"
              />
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => {
                  setShowDeleteConfirm({
                    type: 'group',
                    categoryIndex: editingGroup.categoryIndex,
                    groupIndex: editingGroup.groupIndex
                  });
                  setEditingGroup(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                disabled={isSubmitting}
              >
                Delete Group
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGroupUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
      >
        <div className="p-1">
          <div className="flex items-center mb-4">
            <div className="bg-red-100 p-2 rounded-full mr-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">Confirm Delete</h3>
          </div>
          
          <p className="mb-6 text-gray-600">
            {showDeleteConfirm?.type === 'category' ? (
              <>Are you sure you want to delete this category? This will also delete all process groups within it.</>
            ) : (
              <>Are you sure you want to delete this process group?</>
            )}
          </p>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
      
      {/* New Category Modal */}
      <Modal
        isOpen={showNewCategoryModal}
        onClose={() => setShowNewCategoryModal(false)}
      >
        <h3 className="text-lg font-bold mb-4">Create New Process Category</h3>
        <div>
          <div className="mb-4">
            <label htmlFor="newCategoryName" className="block text-sm font-medium text-gray-700 mb-1">
              Category Name
            </label>
            <input
              type="text"
              id="newCategoryName"
              value={newCategory.name}
              onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter category name"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter category description"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowNewCategoryModal(false)}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCategory}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              disabled={isSubmitting || !newCategory.name.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </div>
      </Modal>
      
      {/* New Process Group Modal */}
      <Modal
        isOpen={showNewGroupModal !== null}
        onClose={() => setShowNewGroupModal(null)}
      >
        <h3 className="text-lg font-bold mb-4">Create New Process Group</h3>
        <div>
          <div className="mb-4">
            <label htmlFor="newGroupName" className="block text-sm font-medium text-gray-700 mb-1">
              Group Name
            </label>
            <input
              type="text"
              id="newGroupName"
              value={newGroup.name}
              onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter group name"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter group description"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowNewGroupModal(null)}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              disabled={isSubmitting || !newGroup.name.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </Modal>
      
      {/* Lifecycle Info Modal */}
      <Modal
        isOpen={showLifecycleInfo}
        onClose={() => setShowLifecycleInfo(false)}
      >
        <div className="p-1">
          <div className="flex items-center mb-4">
            <div className="bg-indigo-100 p-2 rounded-full mr-3">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">{lifecycle?.name}</h3>
          </div>
          
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
            <p className="text-gray-600 p-3 bg-gray-50 rounded-md">
              {lifecycle?.description || "No description available."}
            </p>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={() => setShowLifecycleInfo(false)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 