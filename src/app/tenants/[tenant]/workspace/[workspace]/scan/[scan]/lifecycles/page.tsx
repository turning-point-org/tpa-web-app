"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Modal from "@/components/Modal";

type Lifecycle = {
  id: string;
  name: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
  processes?: any;
};

export default function LifecyclesPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;
  
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string }>({ name: "", description: "" });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newLifecycle, setNewLifecycle] = useState<{ name: string; description: string }>({ name: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [generatingProcesses, setGeneratingProcesses] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState<string | null>(null);

  useEffect(() => {
    loadLifecycles();
  }, [tenantSlug, workspaceId, scanId]);

  async function loadLifecycles() {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
      );
      
      if (response.ok) {
        let data = await response.json();
        console.log("Loaded lifecycles:", data); // Debug log to verify position field
        
        // If any lifecycle is missing a position field, add it based on array index
        // But do this client-side only without recursively triggering updates
        const hasMissingPositions = data.some((lifecycle: Lifecycle) => typeof lifecycle.position !== 'number');
        
        if (hasMissingPositions) {
          console.log("Fixing missing position values");
          // Sort by created_at date if position is missing
          data.sort((a: Lifecycle, b: Lifecycle) => {
            if (typeof a.position === 'number' && typeof b.position === 'number') {
              return a.position - b.position;
            }
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          
          // Assign positions based on array index
          data = data.map((lifecycle: Lifecycle, index: number) => ({
            ...lifecycle,
            position: index
          }));
          
          // Save the updated positions to the backend without waiting for response
          // and without recursively loading lifecycles again
          try {
            const positions = data.map((lc: Lifecycle) => ({
              id: lc.id,
              position: lc.position
            }));
            
            // Use a fire-and-forget approach instead of awaiting
            fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                tenant_slug: tenantSlug,
                workspace_id: workspaceId,
                scan_id: scanId,
                positions
              }),
            }).catch(error => {
              console.error("Error fixing positions:", error);
            });
          } catch (err) {
            console.error("Error fixing positions:", err);
            // Continue with local positions even if server update fails
          }
        }
        
        setLifecycles(data);
        
        // Check URL params to see if we were just redirected from lifecycle generation
        const urlParams = new URLSearchParams(window.location.search);
        const fromGeneration = urlParams.get('from') === 'generation';
        
        // Create a unique notification ID based on the scan and timestamp
        const notificationKey = `lifecycle-notification-${scanId}`;
        
        // Get the last notification time (if any)
        const lastNotificationTime = sessionStorage.getItem(notificationKey);
        const currentTime = Date.now();
        
        // Determine if we should send a notification:
        // 1. If we have lifecycles
        // 2. AND (we came from generation OR no recent notification exists)
        // 3. AND not within last 10 seconds (to prevent duplicates)
        const hasRecentNotification = lastNotificationTime && 
          (currentTime - parseInt(lastNotificationTime)) < 10000; // 10 seconds
        
        if (data.length > 0 && (fromGeneration || !lastNotificationTime) && !hasRecentNotification) {
          console.log("Dispatching lifecycle notification event");
          
          // Update the timestamp
          sessionStorage.setItem(notificationKey, currentTime.toString());
          
          // Clear the 'from' parameter from the URL without page reload
          if (fromGeneration && window.history.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('from');
            window.history.replaceState({}, '', url);
          }
          
          // Dispatch the event with count information
          const customEvent = new CustomEvent('ora-lifecycle-change', { 
            detail: { 
              action: 'generated',
              count: data.length,
              scanId: scanId
            } 
          });
          
          // Small delay to ensure OraPanel is ready to receive the event
          setTimeout(() => {
            window.dispatchEvent(customEvent);
          }, 500);
        } else {
          console.log("Skipping lifecycle notification:", {
            hasLifecycles: data.length > 0,
            fromGeneration,
            hasRecentNotification,
            lastNotificationTime
          });
        }
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

  const handleEditClick = useCallback((lifecycle: Lifecycle) => {
    setIsEditing(lifecycle.id);
    setEditForm({
      name: lifecycle.name,
      description: lifecycle.description
    });
  }, []);

  const handleEditCancel = useCallback(() => {
    setIsEditing(null);
    setEditForm({ name: "", description: "" });
  }, []);

  const handleEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleDeleteClick = useCallback((lifecycleId: string) => {
    setDeleteConfirm(lifecycleId);
    setIsEditing(null);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const handleEditSubmit = async (e: React.FormEvent, lifecycleId: string) => {
    e.preventDefault();
    if (!editForm.name.trim()) return;
    
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          lifecycle_id: lifecycleId,
          name: editForm.name,
          description: editForm.description
        }),
      });

      if (response.ok) {
        const updatedLifecycle = await response.json();
        setLifecycles(prevLifecycles => 
          prevLifecycles.map(lc => lc.id === lifecycleId ? updatedLifecycle : lc)
        );
        setIsEditing(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update lifecycle");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating the lifecycle");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async (lifecycleId: string) => {
    try {
      setIsSubmitting(true);
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        setLifecycles(prevLifecycles => 
          prevLifecycles.filter(lc => lc.id !== lifecycleId)
        );
        setDeleteConfirm(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete lifecycle");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting the lifecycle");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewClick = () => {
    setIsAddingNew(true);
    setNewLifecycle({ name: "", description: "" });
  };

  const handleAddNewCancel = () => {
    setIsAddingNew(false);
    setNewLifecycle({ name: "", description: "" });
  };

  const handleNewLifecycleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewLifecycle(prev => ({ ...prev, [name]: value }));
  };

  const handleAddNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLifecycle.name.trim()) return;
    
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
          name: newLifecycle.name,
          description: newLifecycle.description
        }),
      });

      if (response.ok) {
        const createdLifecycle = await response.json();
        setLifecycles(prevLifecycles => [...prevLifecycles, createdLifecycle]);
        setIsAddingNew(false);
        setNewLifecycle({ name: "", description: "" });
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create lifecycle");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while creating a new lifecycle");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveUp = useCallback(async (lifecycle: Lifecycle, index: number) => {
    if (index <= 0) return; // Already at the top
    
    const updatedLifecycles = [...lifecycles];
    
    // Swap positions with the lifecycle above
    const temp = { ...updatedLifecycles[index - 1] };
    updatedLifecycles[index - 1] = { ...lifecycle, position: index - 1 };
    updatedLifecycles[index] = { ...temp, position: index };
    
    // Sort by position to ensure correct order
    updatedLifecycles.sort((a, b) => a.position - b.position);
    
    // Update state optimistically
    setLifecycles(updatedLifecycles);
    
    // Update positions in the backend
    try {
      const positions = updatedLifecycles.map(lc => ({
        id: lc.id,
        position: lc.position
      }));
      
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          positions
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update lifecycle positions");
        // No need to reload, we've already updated the UI optimistically
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating lifecycle positions");
    }
  }, [lifecycles, tenantSlug, workspaceId, scanId]);

  const handleMoveDown = useCallback(async (lifecycle: Lifecycle, index: number) => {
    if (index >= lifecycles.length - 1) return; // Already at the bottom
    
    const updatedLifecycles = [...lifecycles];
    
    // Swap positions with the lifecycle below
    const temp = { ...updatedLifecycles[index + 1] };
    updatedLifecycles[index + 1] = { ...lifecycle, position: index + 1 };
    updatedLifecycles[index] = { ...temp, position: index };
    
    // Sort by position to ensure correct order
    updatedLifecycles.sort((a, b) => a.position - b.position);
    
    // Update state optimistically
    setLifecycles(updatedLifecycles);
    
    // Update positions in the backend
    try {
      const positions = updatedLifecycles.map(lc => ({
        id: lc.id,
        position: lc.position
      }));
      
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/lifecycles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          positions
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update lifecycle positions");
        // No need to reload, we've already updated the UI optimistically
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating lifecycle positions");
    }
  }, [lifecycles, tenantSlug, workspaceId, scanId]);

  const handleGenerateProcesses = async (lifecycle: Lifecycle) => {
    try {
      setGeneratingProcesses(lifecycle.id);
      setShowRegenerateModal(null);
      
      const response = await fetch("/api/tenants/by-slug/workspaces/scans/lifecycles/generate-processes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          workspace_id: workspaceId,
          scan_id: scanId,
          lifecycle_id: lifecycle.id,
          lifecycle_name: lifecycle.name,
          lifecycle_description: lifecycle.description,
        }),
      });

      if (response.ok) {
        // Dispatch notification event
        const customEvent = new CustomEvent('ora-notification', {
          detail: {
            type: 'success',
            message: `Processes for ${lifecycle.name} have been generated successfully.`
          }
        });
        window.dispatchEvent(customEvent);
        
        // Reload lifecycles to get updated data
        await loadLifecycles();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to generate processes");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while generating processes");
    } finally {
      setGeneratingProcesses(null);
    }
  };

  // Card view component for non-edit mode
  const CardView = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {lifecycles.map((lifecycle) => (
          <div key={lifecycle.id} className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">{lifecycle.name}</h3>
              <p className="mt-1 text-xs text-gray-600">{lifecycle.description}</p>
            </div>
            <div className="m-4 p-4 bg-white border border-gray-200 rounded-md relative h-[300px] overflow-auto">
              <button 
                className={`absolute top-2 right-2 p-2 rounded z-10 ${
                  lifecycle.processes ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={lifecycle.processes ? "Expand" : "Generate processes first"}
                onClick={() => lifecycle.processes && router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/lifecycles/${lifecycle.id}`)}
                disabled={!lifecycle.processes}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              </button>

              {/* Process visualization */}
              {lifecycle.processes?.process_categories && (
                <div className="flex flex-row overflow-x-auto space-x-2 pb-10">
                  {lifecycle.processes.process_categories.map((category: any, catIndex: number) => (
                    <div 
                      key={catIndex} 
                      className="flex-shrink-0 w-32 border border-gray-300 rounded bg-gray-50"
                    >
                      <div className="p-1 bg-gray-600 text-white text-center">
                        <p className="text-xs font-medium truncate" title={category.name}>
                          {category.name}
                        </p>
                      </div>
                      <div className="p-1">
                        {category.process_groups?.map((group: any, groupIndex: number) => (
                          <div 
                            key={groupIndex} 
                            className="mb-1 p-1 bg-gray-100 border border-gray-200 rounded text-xs"
                            title={group.description}
                          >
                            {group.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Show message if no processes */}
              {!lifecycle.processes?.process_categories && !generatingProcesses && (
                <div className="flex items-center justify-center h-full pb-10">
                  <p className="text-gray-400 text-sm">No processes generated</p>
                </div>
              )}

              <button
                className={`absolute bottom-2 right-2 px-3 py-1 ${
                  lifecycle.processes ? 'bg-gray-500' : 'bg-blue-600'
                } text-white text-sm rounded hover:${
                  lifecycle.processes ? 'bg-gray-600' : 'bg-blue-700'
                } transition`}
                onClick={() => {
                  if (lifecycle.processes) {
                    setShowRegenerateModal(lifecycle.id);
                  } else {
                    handleGenerateProcesses(lifecycle);
                  }
                }}
                disabled={generatingProcesses !== null}
              >
                {generatingProcesses === lifecycle.id ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  lifecycle.processes ? "Regenerate Processes" : "Generate Processes"
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Business Lifecycles</h2>
        <div className="flex items-center space-x-4">
          {/* Toggle Switch */}
          <div className="flex items-center">
            <span className={`mr-2 text-sm ${!editMode ? 'font-medium text-blue-600' : 'text-gray-500'}`}>View</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={editMode} 
                onChange={() => setEditMode(!editMode)} 
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className={`ml-2 text-sm ${editMode ? 'font-medium text-blue-600' : 'text-gray-500'}`}>Edit</span>
          </div>
        </div>
      </div>
      <p className="text-gray-600 mb-6">
        Business lifecycles represent the core operational processes of the organization.
        {lifecycles.length > 1 && editMode && !isEditing && !deleteConfirm && !isAddingNew && (
          <span className="ml-1 text-blue-600">
            Use the up and down arrows to reorder lifecycles.
          </span>
        )}
      </p>
      
      {error && (
        <div className="p-4 mb-6 bg-red-100 text-red-800 rounded-lg">
          {error}
          <button 
            className="ml-2 text-red-600 font-semibold"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : lifecycles.length === 0 && !isAddingNew ? (
        <div className="p-6 text-center bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 mb-4">No lifecycles have been created yet.</p>
          <button
            onClick={handleAddNewClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Create Your First Lifecycle
          </button>
        </div>
      ) : (
        <>
          {editMode ? (
            <div className="space-y-6">
              <div className="space-y-6">
                {lifecycles.map((lifecycle, index) => (
                  <div 
                    key={lifecycle.id} 
                    className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm"
                  >
                    {isEditing === lifecycle.id ? (
                      <form onSubmit={(e) => handleEditSubmit(e, lifecycle.id)}>
                        <div className="mb-4">
                          <label htmlFor={`name-${lifecycle.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                            Name
                          </label>
                          <input
                            id={`name-${lifecycle.id}`}
                            name="name"
                            type="text"
                            value={editForm.name}
                            onChange={handleEditChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            required
                          />
                        </div>
                        <div className="mb-4">
                          <label htmlFor={`description-${lifecycle.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            id={`description-${lifecycle.id}`}
                            name="description"
                            value={editForm.description}
                            onChange={handleEditChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-between space-x-3">
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(lifecycle.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                            disabled={isSubmitting}
                          >
                            Delete
                          </button>
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              onClick={handleEditCancel}
                              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                              disabled={isSubmitting}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : deleteConfirm === lifecycle.id ? (
                      <div>
                        <p className="mb-4 text-red-600 font-medium">Are you sure you want to delete this lifecycle?</p>
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={handleDeleteCancel}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                            disabled={isSubmitting}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteConfirm(lifecycle.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">{lifecycle.name}</h3>
                            <p className="text-gray-600">{lifecycle.description}</p>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            {/* Up and Down arrow buttons */}
                            <div className="flex flex-col space-y-1 mr-2">
                              <button
                                onClick={() => handleMoveUp(lifecycle, index)}
                                className={`p-1 rounded hover:bg-gray-100 transition ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500'}`}
                                disabled={index === 0 || isEditing !== null || deleteConfirm !== null || isSubmitting}
                                title="Move up"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleMoveDown(lifecycle, index)}
                                className={`p-1 rounded hover:bg-gray-100 transition ${index === lifecycles.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500'}`}
                                disabled={index === lifecycles.length - 1 || isEditing !== null || deleteConfirm !== null || isSubmitting}
                                title="Move down"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            
                            {/* Edit button only */}
                            <button
                              onClick={() => handleEditClick(lifecycle)}
                              className="text-blue-600 hover:text-blue-800 transition"
                              disabled={isEditing !== null || deleteConfirm !== null || isSubmitting}
                              title="Edit"
                            >
                              <span className="sr-only">Edit</span>
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              {isAddingNew && (
                <div className="p-6 bg-white rounded-lg border border-blue-300 shadow-sm">
                  <form onSubmit={handleAddNewSubmit}>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Add New Lifecycle</h3>
                    <div className="mb-4">
                      <label htmlFor="new-name" className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        id="new-name"
                        name="name"
                        type="text"
                        value={newLifecycle.name}
                        onChange={handleNewLifecycleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="new-description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        id="new-description"
                        name="description"
                        value={newLifecycle.description}
                        onChange={handleNewLifecycleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={handleAddNewCancel}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
              
              {/* Add New Lifecycle button at the bottom */}
              {editMode && !isAddingNew && (
                <div className="flex justify-end mt-6">
                  <button
                    onClick={handleAddNewClick}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                    disabled={isAddingNew || isSubmitting}
                  >
                    Add New Lifecycle
                  </button>
                </div>
              )}
            </div>
          ) : (
            <CardView />
          )}
        </>
      )}
      
      <Modal 
        isOpen={showRegenerateModal !== null} 
        onClose={() => setShowRegenerateModal(null)}
      >
        <h3 className="text-lg font-bold mb-4">Confirm Regeneration</h3>
        <div className="mb-6">
          <p className="text-red-600 font-semibold mb-2">Warning</p>
          <p className="text-gray-600">
            This lifecycle already has generated processes. Regenerating will replace all existing process data.
          </p>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowRegenerateModal(null)}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const lifecycle = lifecycles.find(lc => lc.id === showRegenerateModal);
              if (lifecycle) {
                handleGenerateProcesses(lifecycle);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Regenerate
          </button>
        </div>
      </Modal>
    </div>
  );
} 