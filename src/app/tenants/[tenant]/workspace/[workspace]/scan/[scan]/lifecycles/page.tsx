"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import GearIcon from "@/assets/icons/GearIcon";
import Button from '@/components/Button';

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
        const currentLifecycle = lifecycles.find(lc => lc.id === lifecycleId);
        const updatedLifecycleWithCurrentProcesses = {
          ...updatedLifecycle,
          processes: currentLifecycle?.processes
        };
        
        setLifecycles(prevLifecycles => 
          prevLifecycles.map(lc => lc.id === lifecycleId ? updatedLifecycleWithCurrentProcesses : lc)
        );
        
        // After saving, generate/regenerate processes
        if (currentLifecycle?.processes) {
          // If processes already exist, ask for confirmation
          setIsEditing(null);
          setShowRegenerateModal(lifecycleId);
        } else {
          // If no processes, generate them right away
          await handleGenerateProcesses({
            ...updatedLifecycleWithCurrentProcesses,
            name: editForm.name,
            description: editForm.description
          });
          setIsEditing(null);
        }
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
    
    // Enhanced validation
    if (!newLifecycle.name.trim()) {
      setError("Lifecycle name is required");
      return;
    }
    
    if (!newLifecycle.description.trim()) {
      setError("Lifecycle description is required");
      return;
    }
    
    try {
      setError(""); // Clear any previous errors
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
          name: newLifecycle.name.trim(),
          description: newLifecycle.description.trim()
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

  // LifecycleCard component that handles both view and edit modes
  const LifecycleCard = ({ lifecycle, index }: { lifecycle: Lifecycle, index: number }) => {
    const isEditingThis = isEditing === lifecycle.id;
    const isConfirmingDeleteThis = deleteConfirm === lifecycle.id;
    const isGeneratingThis = generatingProcesses === lifecycle.id;
    
    return (
      <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {!isEditingThis && (
          <div className="p-4 bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">{lifecycle.name}</h3>
            <Button 
              variant={lifecycle.processes ? 'primary' : 'secondary'}
              iconOnly
              title={lifecycle.processes ? "Expand" : "Generate processes first"}
              onClick={() => lifecycle.processes && router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/lifecycles/${lifecycle.id}`)}
              disabled={!lifecycle.processes}
              className="p-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </Button>
          </div>
        )}
        
        {isEditingThis ? (
          <div className="p-6 bg-white h-full flex flex-col">
            <form onSubmit={(e) => handleEditSubmit(e, lifecycle.id)} className="flex flex-col h-full">
              <div className="mb-4 flex-grow">
                <label htmlFor={`name-${lifecycle.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  id={`name-${lifecycle.id}`}
                  name="name"
                  type="text"
                  value={editForm.name}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                  autoFocus
                  key={`name-${lifecycle.id}`}
                />
              </div>
              <div className="mb-6 flex-grow">
                <label htmlFor={`description-${lifecycle.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id={`description-${lifecycle.id}`}
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md h-32"
                  rows={6}
                  key={`description-${lifecycle.id}`}
                />
              </div>
              <div className="flex justify-between mt-6">
                <div className="space-x-2">
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() => handleDeleteClick(lifecycle.id)}
                    disabled={isSubmitting}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={handleEditCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="space-x-2">
                  <Button
                    type="submit"
                    variant={lifecycle.processes ? 'secondary' : 'primary'}
                    disabled={isSubmitting || generatingProcesses !== null}
                  >
                    {isSubmitting ? 'Saving...' : 
                     isGeneratingThis ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      lifecycle.processes ? "Save & Regenerate Processes" : "Save & Generate Processes"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        ) : isConfirmingDeleteThis ? (
          <div className="m-4 p-4 bg-white border border-gray-200 rounded-md">
            <p className="mb-4 text-red-600 font-medium">Are you sure you want to delete this lifecycle?</p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={handleDeleteCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDeleteConfirm(lifecycle.id)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-white relative h-[350px] overflow-x-auto overflow-y-hidden">
            {/* Process visualization */}
            {lifecycle.processes?.process_categories && (
              <div className="flex flex-row overflow-x-auto space-x-2 pb-5">
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
            {!lifecycle.processes?.process_categories && !isGeneratingThis && (
              <div className="flex items-center justify-center h-full pb-10">
                <p className="text-gray-400 text-sm">No processes generated</p>
              </div>
            )}

            {/* Edit gear icon in bottom right */}
            <Button
              variant="secondary"
              iconOnly
              onClick={() => handleEditClick(lifecycle)}
              className="absolute bottom-2 right-2"
              icon={<GearIcon />}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Business Lifecycles</h2>
        {!isAddingNew && (
          <Button
            onClick={handleAddNewClick}
            disabled={isAddingNew || isSubmitting}
            icon={(
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          >
            New Lifecycle
          </Button>
        )}
      </div>
      <p className="text-gray-600 mb-6">
        Business lifecycles represent the core operational processes of the organization.
      </p>
      
      {error && (
        <div className="p-4 mb-6 bg-red-100 text-red-800 rounded-lg">
          {error}
          <Button 
            variant="danger-secondary"
            onClick={() => setError("")}
            className="ml-2"
          >
            Dismiss
          </Button>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : lifecycles.length === 0 && !isAddingNew ? (
        <div className="p-6 text-center bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 mb-4">No lifecycles have been created yet.</p>
          <Button
            onClick={handleAddNewClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Create Your First Lifecycle
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {lifecycles.map((lifecycle, index) => (
              <LifecycleCard key={lifecycle.id} lifecycle={lifecycle} index={index} />
            ))}
            
            {isAddingNew && (
              <div className="rounded-lg border border-blue-300 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800">New Lifecycle</h3>
                </div>
                <div className="m-4 p-4 bg-white border border-gray-200 rounded-md">
                  <form onSubmit={handleAddNewSubmit}>
                    <div className="mb-4">
                      <label htmlFor="new-name" className="block text-sm font-medium text-gray-700 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="new-name"
                        name="name"
                        type="text"
                        value={newLifecycle.name}
                        onChange={handleNewLifecycleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        required
                        placeholder="Enter lifecycle name"
                      />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="new-description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="new-description"
                        name="description"
                        value={newLifecycle.description}
                        onChange={handleNewLifecycleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        required
                        placeholder="Enter lifecycle description"
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={handleAddNewCancel}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Regenerate confirmation modal */}
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
          <Button
            variant="secondary"
            onClick={() => setShowRegenerateModal(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const lifecycle = lifecycles.find(lc => lc.id === showRegenerateModal);
              if (lifecycle) {
                handleGenerateProcesses(lifecycle);
              }
            }}
          >
            Regenerate
          </Button>
        </div>
      </Modal>
    </div>
  );
} 