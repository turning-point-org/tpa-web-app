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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [generatingProcesses, setGeneratingProcesses] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState<string | null>(null);
  
  // State for tracking process generation steps
  const [generationStep, setGenerationStep] = useState(0);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [generationSteps, setGenerationSteps] = useState([
    "Ora is analyzing business lifecycle components...",
    "Creating suggested process categories...",
    "Finalizing process groups and relationships..."
  ]);
  
  // State to track if we're generating for a new lifecycle (skip confirmation)
  const [isNewLifecycle, setIsNewLifecycle] = useState(false);
  
  // New state for modal-based editing
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    lifecycle: Lifecycle | null;
    name: string;
    description: string;
  }>({
    isOpen: false,
    lifecycle: null,
    name: "",
    description: ""
  });
  
  // New state for new lifecycle modal
  const [newLifecycleModal, setNewLifecycleModal] = useState({
    isOpen: false,
    name: "",
    description: ""
  });

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

  // New modal-based editing functions
  const openEditModal = (lifecycle: Lifecycle) => {
    setEditModal({
      isOpen: true,
      lifecycle,
      name: lifecycle.name,
      description: lifecycle.description
    });
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      lifecycle: null,
      name: "",
      description: ""
    });
  };

  const handleEditNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditModal(prev => ({
      ...prev,
      name: e.target.value
    }));
  };

  const handleEditDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditModal(prev => ({
      ...prev,
      description: e.target.value
    }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.lifecycle || !editModal.name.trim()) return;
    
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
          lifecycle_id: editModal.lifecycle.id,
          name: editModal.name,
          description: editModal.description
        }),
      });

      if (response.ok) {
        const updatedLifecycle = await response.json();
        const currentLifecycle = lifecycles.find(lc => lc.id === editModal.lifecycle?.id);
        const updatedLifecycleWithCurrentProcesses = {
          ...updatedLifecycle,
          processes: currentLifecycle?.processes
        };
        
        setLifecycles(prevLifecycles => 
          prevLifecycles.map(lc => lc.id === editModal.lifecycle?.id ? updatedLifecycleWithCurrentProcesses : lc)
        );
        
        // After saving, generate/regenerate processes
        if (currentLifecycle?.processes) {
          // If processes already exist, ask for confirmation
          closeEditModal();
          setShowRegenerateModal(editModal.lifecycle.id);
        } else {
          // Generate processes for new lifecycle
          closeEditModal();
          setShowRegenerateModal(editModal.lifecycle.id);
          setGeneratingProcesses(editModal.lifecycle.id);
          setGenerationStep(0);
          setGenerationComplete(false);
          
          // Animation with single interval
          const stepTimer = setInterval(() => {
            setGenerationStep(prev => {
              if (prev >= generationSteps.length - 1) {
                clearInterval(stepTimer);
                setGenerationComplete(true);
                return prev;
              }
              return prev + 1;
            });
          }, 2000);
          
          // Start API call and handle completion
          handleGenerateProcesses(editModal.lifecycle, false).then(() => {
            // Always close modal after API completes
            setTimeout(() => {
              setShowRegenerateModal(null);
              setGeneratingProcesses(null);
              setGenerationComplete(false);
              setGenerationStep(0);
            }, 1000);
          }).catch(() => {
            // On error, also close modal
            setShowRegenerateModal(null);
            setGeneratingProcesses(null);
            setGenerationComplete(false);
            setGenerationStep(0);
          });
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

  // New lifecycle modal functions
  const openNewLifecycleModal = () => {
    setNewLifecycleModal({
      isOpen: true,
      name: "",
      description: ""
    });
  };

  const closeNewLifecycleModal = () => {
    setNewLifecycleModal({
      isOpen: false,
      name: "",
      description: ""
    });
  };

  const handleNewLifecycleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewLifecycleModal(prev => ({
      ...prev,
      name: e.target.value
    }));
  };

  const handleNewLifecycleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewLifecycleModal(prev => ({
      ...prev,
      description: e.target.value
    }));
  };

  const handleNewLifecycleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced validation
    if (!newLifecycleModal.name.trim()) {
      setError("Lifecycle name is required");
      return;
    }
    
    if (!newLifecycleModal.description.trim()) {
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
          name: newLifecycleModal.name.trim(),
          description: newLifecycleModal.description.trim()
        }),
      });

      if (response.ok) {
        const createdLifecycle = await response.json();
        setLifecycles(prevLifecycles => [...prevLifecycles, createdLifecycle]);
        
        // Close the creation modal
        closeNewLifecycleModal();
        
        // Set flag to skip confirmation
        setIsNewLifecycle(true);
        
        // Start generation immediately
        setShowRegenerateModal(createdLifecycle.id);
        setGeneratingProcesses(createdLifecycle.id);
        setGenerationStep(0);
        setGenerationComplete(false);
        
        // Animation with single interval
        const stepTimer = setInterval(() => {
          setGenerationStep(prev => {
            if (prev >= generationSteps.length - 1) {
              clearInterval(stepTimer);
              setGenerationComplete(true);
              return prev;
            }
            return prev + 1;
          });
        }, 2000);
        
        // Start API call and handle completion
        try {
          const apiResult = await handleGenerateProcesses(createdLifecycle, false);
          
          // Always close modal and reset states after API completes
          setTimeout(() => {
            setShowRegenerateModal(null);
            setGeneratingProcesses(null);
            setIsNewLifecycle(false);
            setGenerationComplete(false);
            setGenerationStep(0);
          }, 1000); // Small delay to show completion
        } catch (error) {
          // On error, also close modal
          setShowRegenerateModal(null);
          setGeneratingProcesses(null);
          setIsNewLifecycle(false);
          setGenerationComplete(false);
          setGenerationStep(0);
        }
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

  const handleDeleteClick = useCallback((lifecycleId: string) => {
    setDeleteConfirm(lifecycleId);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

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
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating lifecycle positions");
    }
  }, [lifecycles, tenantSlug, workspaceId, scanId]);

  const handleGenerateProcesses = async (lifecycle: Lifecycle, autoClose: boolean = true) => {
    try {
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
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to generate processes");
        return false;
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while generating processes");
      return false;
    }
  };


  // LifecycleCard component that handles view mode only (edit is in modal)
  const LifecycleCard = ({ lifecycle, index }: { lifecycle: Lifecycle, index: number }) => {
    const isConfirmingDeleteThis = deleteConfirm === lifecycle.id;
    const isGeneratingThis = generatingProcesses === lifecycle.id;
    
    return (
      <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">{lifecycle.name}</h3>
          {lifecycle.processes ? (
            <Button 
              variant="primary"
              iconOnly
              title="Expand"
              onClick={() => router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/lifecycles/${lifecycle.id}`)}
              className="p-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </Button>
          ) : (
            <Button 
              variant="secondary"
              title="Generate processes"
              onClick={() => {
                // Open modal first, then start generation
                const lifecycleToGenerate = lifecycle;
                setShowRegenerateModal(lifecycleToGenerate.id);
                
                // Manual generation process with animation to ensure it works
                setGenerationStep(0);
                setGenerationComplete(false);
                setGeneratingProcesses(lifecycleToGenerate.id);
                
                // Start the step animation
                const stepInterval = setInterval(() => {
                  setGenerationStep(prevStep => {
                    if (prevStep >= generationSteps.length - 1) {
                      clearInterval(stepInterval);
                      setGenerationComplete(true);
                      
                      // Close modal if API call already completed
                      if (!generatingProcesses) {
                        setShowRegenerateModal(null);
                      }
                      return prevStep;
                    }
                    return prevStep + 1;
                  });
                }, 2000);
                
                // Make the actual API call
                handleGenerateProcesses(lifecycleToGenerate, false).then(() => {
                  // Always close modal after API completes
                  setTimeout(() => {
                    setShowRegenerateModal(null);
                    setGeneratingProcesses(null);
                    setGenerationComplete(false);
                    setGenerationStep(0);
                  }, 1000);
                }).catch(() => {
                  // On error, also close modal
                  setShowRegenerateModal(null);
                  setGeneratingProcesses(null);
                  setGenerationComplete(false);
                  setGenerationStep(0);
                });
              }}
              className="text-sm"
            >
              Generate
            </Button>
          )}
        </div>
        
        {isConfirmingDeleteThis ? (
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
          <div className="p-4 bg-white relative h-[350px] overflow-y-auto flex flex-col">
            {/* Process visualization */}
            {lifecycle.processes?.process_categories && (
              <div className="flex flex-row justify-between pb-5 flex-grow">
                {lifecycle.processes.process_categories.map((category: any, catIndex: number) => (
                  <div 
                    key={catIndex} 
                    className="flex-grow flex-shrink basis-0 border border-gray-300 rounded bg-gray-50 mx-1 min-w-0"
                  >
                    <div className="p-1 bg-[#31115E] text-white text-center rounded-t">
                      <p className="text-xs font-medium truncate" title={category.name}>
                        {category.name}
                      </p>
                    </div>
                    <div className="p-1 max-h-[200px] overflow-hidden relative">
                      {category.process_groups?.map((group: any, groupIndex: number) => (
                        <div 
                          key={groupIndex} 
                          className="mb-1 p-1 bg-gray-100 border border-gray-200 rounded text-xs truncate"
                          title={group.description || group.name}
                        >
                          {group.name}
                        </div>
                      ))}
                      {category.process_groups?.length > 6 && (
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Show message if no processes */}
            {!lifecycle.processes?.process_categories && !isGeneratingThis && (
              <div className="flex items-center justify-center flex-grow pb-10">
                <p className="text-gray-400 text-sm">No processes generated</p>
              </div>
            )}

            {/* Edit gear icon in footer */}
            <div className="w-full border-t border-gray-200 py-2 mt-auto flex justify-end">
              <Button
                variant="secondary"
                iconOnly
                onClick={() => openEditModal(lifecycle)}
                className="mr-2"
                icon={<GearIcon />}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Business Lifecycles</h2>
        <Button
          onClick={openNewLifecycleModal}
          disabled={isSubmitting}
          icon={(
            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
        >
          New Lifecycle
        </Button>
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
      ) : lifecycles.length === 0 ? (
        <div className="p-6 text-center bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 mb-4">No lifecycles have been created yet.</p>
          <Button
            onClick={openNewLifecycleModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Create Your First Lifecycle
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
            {lifecycles.map((lifecycle, index) => (
              <LifecycleCard key={lifecycle.id} lifecycle={lifecycle} index={index} />
            ))}
          </div>
        </>
      )}
      
      {/* Edit Lifecycle Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={closeEditModal}
        title={generatingProcesses === editModal.lifecycle?.id ? "Generating Processes" : "Edit Lifecycle"}
        maxWidth="4xl"
      >
        {editModal.lifecycle && generatingProcesses === editModal.lifecycle.id ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-6"></div>
            <h3 className="text-lg font-semibold text-center mb-2">
              {generationSteps[generationStep]}
            </h3>
            <div className="flex justify-center w-full mt-4">
              <div className="bg-gray-200 h-2 w-64 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-2 transition-all duration-500 ease-in-out" 
                  style={{ width: `${((generationStep + 1) / generationSteps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ) : editModal.lifecycle && (
          <form onSubmit={handleEditSubmit}>
            <div className="mb-4">
              <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="edit-name"
                value={editModal.name}
                onChange={handleEditNameChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
                placeholder="Enter lifecycle name"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="edit-description"
                value={editModal.description}
                onChange={handleEditDescriptionChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={6}
                required
                placeholder="Enter lifecycle description"
              />
            </div>
            <div className="flex justify-between">
              <Button
                variant="danger"
                type="button"
                onClick={() => {
                  closeEditModal();
                  handleDeleteClick(editModal.lifecycle!.id);
                }}
                disabled={isSubmitting}
              >
                Delete
              </Button>
              <div className="space-x-3">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeEditModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 
                   (editModal.lifecycle.processes ? 'Save & Regenerate Processes' : 'Save & Generate Processes')}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
      
      {/* New Lifecycle Modal */}
      <Modal
        isOpen={newLifecycleModal.isOpen}
        onClose={closeNewLifecycleModal}
        title="Create New Lifecycle"
        maxWidth="4xl"
      >
        <form onSubmit={handleNewLifecycleSubmit}>
          <div className="mb-4">
            <label htmlFor="new-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="new-name"
              value={newLifecycleModal.name}
              onChange={handleNewLifecycleNameChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
              placeholder="Enter lifecycle name"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="new-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="new-description"
              value={newLifecycleModal.description}
              onChange={handleNewLifecycleDescriptionChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows={6}
              required
              placeholder="Enter lifecycle description"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              type="button"
              onClick={closeNewLifecycleModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Lifecycle'}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Regenerate confirmation modal */}
      <Modal 
        isOpen={showRegenerateModal !== null} 
        onClose={() => generatingProcesses ? null : setShowRegenerateModal(null)} // Prevent closing during generation
        maxWidth="4xl"
        title={generatingProcesses && generatingProcesses === showRegenerateModal ? "Generating Processes" : "Confirm Regeneration"}
      >
        {(generatingProcesses && generatingProcesses === showRegenerateModal) || isNewLifecycle ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-6"></div>
            <h3 className="text-lg font-semibold text-center mb-2">
              {generationSteps[generationStep]}
            </h3>
            <div className="flex justify-center w-full mt-4">
              <div className="bg-gray-200 h-2 w-64 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-2 transition-all duration-500 ease-in-out" 
                  style={{ width: `${((generationStep + 1) / generationSteps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
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
                    // IMPORTANT: Set generating state FIRST to immediately show loading UI
                    setGeneratingProcesses(lifecycle.id);
                    
                    // Then start the animation process
                    setGenerationStep(0);
                    setGenerationComplete(false);
                    
                    // Force a re-render to ensure the UI updates immediately
                    setTimeout(() => {
                      // Start the step animation
                      const stepInterval = setInterval(() => {
                        setGenerationStep(prevStep => {
                          if (prevStep >= generationSteps.length - 1) {
                            clearInterval(stepInterval);
                            setGenerationComplete(true);
                            
                            // Close modal if API call already completed
                            if (!generatingProcesses) {
                              setShowRegenerateModal(null);
                              // Reset the new lifecycle flag
                              setIsNewLifecycle(false);
                            }
                            return prevStep;
                          }
                          return prevStep + 1;
                        });
                      }, 2000);
                      
                      // Make the actual API call
                      handleGenerateProcesses(lifecycle, false).then(() => {
                        // Always close modal after API completes
                        setTimeout(() => {
                          setShowRegenerateModal(null);
                          setGeneratingProcesses(null);
                          setIsNewLifecycle(false);
                          setGenerationComplete(false);
                          setGenerationStep(0);
                        }, 1000);
                      }).catch(() => {
                        // On error, also close modal
                        setShowRegenerateModal(null);
                        setGeneratingProcesses(null);
                        setIsNewLifecycle(false);
                        setGenerationComplete(false);
                        setGenerationStep(0);
                      });
                    }, 0);
                  }
                }}
              >
                Regenerate
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
} 