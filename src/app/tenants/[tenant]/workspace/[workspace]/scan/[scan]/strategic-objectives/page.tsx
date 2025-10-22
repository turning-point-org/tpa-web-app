"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { Pencil, Trash, X, Check, Wand2, AlertCircle } from "lucide-react";

type StrategicObjective = {
  name: string;
  description: string;
  status: "to be approved" | "approved";
  scoring_criteria?: {
    low?: string;
    medium?: string;
    high?: string;
  };
};

export default function StrategicObjectivesPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;
  
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingObjective, setEditingObjective] = useState<StrategicObjective | null>(null);
  const [newObjective, setNewObjective] = useState<Partial<StrategicObjective>>({
    name: "",
    description: "",
    status: "to be approved",
    scoring_criteria: {
      low: "",
      medium: "",
      high: ""
    }
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [objectiveToDelete, setObjectiveToDelete] = useState<StrategicObjective | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [originalObjectiveName, setOriginalObjectiveName] = useState<string | null>(null);
  const [isGeneratingScoringCriteria, setIsGeneratingScoringCriteria] = useState(false);
  const [scoringCriteriaError, setScoringCriteriaError] = useState("");
  const [isGeneratingEditScoringCriteria, setIsGeneratingEditScoringCriteria] = useState(false);
  const [editScoringCriteriaError, setEditScoringCriteriaError] = useState("");

  const fetchObjectives = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/strategic-objectives?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          setObjectives([]);
        } else {
          throw new Error("Failed to fetch strategic objectives");
        }
      } else {
        const data = await response.json();
        setObjectives(data);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while loading data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchObjectives();
  }, [tenantSlug, workspaceId, scanId]);

  const handleSaveObjectives = async (objectives: StrategicObjective[]) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/strategic-objectives?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ strategic_objectives: objectives }),
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to save strategic objectives");
      }
      
      await fetchObjectives();
    } catch (err: any) {
      setError(err.message || "An error occurred while saving data");
      setIsLoading(false);
    }
  };

  // Check if a name is a duplicate
  const isDuplicateName = (name: string, currentName?: string): boolean => {
    if (!name.trim()) return false; // Empty names aren't duplicates, they're just invalid
    return objectives.some(obj => 
      obj.name.toLowerCase() === name.toLowerCase() && 
      obj.name !== currentName
    );
  };

  // Validate name as the user types in the new objective form
  useEffect(() => {
    if (newObjective.name && isDuplicateName(newObjective.name)) {
      setNameError("An objective with this name already exists");
    } else {
      setNameError(null);
    }
  }, [newObjective.name, objectives]);
  
  // Validate name as the user types in the edit form
  useEffect(() => {
    if (editingObjective?.name && isDuplicateName(editingObjective.name, editingObjective.name)) {
      setNameError("An objective with this name already exists");
    } else if (editingObjective) {
      setNameError(null);
    }
  }, [editingObjective?.name]);

  const handleAddObjective = async () => {
    if (!newObjective.name) {
      setError("Objective name is required");
      return;
    }

    // Check if an objective with this name already exists
    if (isDuplicateName(newObjective.name)) {
      setError("An objective with this name already exists");
      return;
    }
    
    const updatedObjectives = [
      ...objectives,
      {
        name: newObjective.name,
        description: newObjective.description || "",
        status: newObjective.status as "to be approved" | "approved" || "to be approved",
        scoring_criteria: newObjective.scoring_criteria || {
          low: "",
          medium: "",
          high: ""
        }
      }
    ];
    
    await handleSaveObjectives(updatedObjectives);
    setNewObjective({ 
      name: "", 
      description: "", 
      status: "to be approved",
      scoring_criteria: {
        low: "",
        medium: "",
        high: ""
      }
    });
    setIsAddingNew(false);
    setScoringCriteriaError("");
  };

  const handleUpdateObjective = async () => {
    if (!editingObjective || !editingObjective.name || !originalObjectiveName) return;
    
    // Check for duplicates
    if (isDuplicateName(editingObjective.name, originalObjectiveName)) {
      setError("An objective with this name already exists");
      return;
    }
    
    const updatedObjectives = objectives.map(obj => 
      obj.name === originalObjectiveName ? editingObjective : obj
    );
    
    await handleSaveObjectives(updatedObjectives);
    setEditingObjective(null);
    setOriginalObjectiveName(null);
    setShowEditModal(false);
  };

  const handleDeleteObjective = async () => {
    if (!objectiveToDelete) return;
    
    const updatedObjectives = objectives.filter(obj => obj.name !== objectiveToDelete.name);
    
    await handleSaveObjectives(updatedObjectives);
    setObjectiveToDelete(null);
    setShowDeleteModal(false);
  };

  const handleStatusChange = async (objective: StrategicObjective, status: "to be approved" | "approved") => {
    const updatedObjectives = objectives.map(obj => 
      obj.name === objective.name ? { ...obj, status } : obj
    );
    
    await handleSaveObjectives(updatedObjectives);
  };

  const confirmDelete = (objective: StrategicObjective) => {
    setObjectiveToDelete(objective);
    setShowDeleteModal(true);
  };

  const openEditModal = (objective: StrategicObjective) => {
    setEditingObjective(objective);
    setOriginalObjectiveName(objective.name);
    setShowEditModal(true);
  };

  const handleGenerateObjectives = async () => {
    try {
      setIsGenerating(true);
      setShowGenerateModal(false);
      
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/generate-objectives`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            workspace_id: workspaceId,
            scan_id: scanId
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate strategic objectives");
      }
      
      await fetchObjectives();
    } catch (err: any) {
      setError(err.message || "An error occurred while generating objectives");
    } finally {
      setIsGenerating(false);
    }
  };

  const confirmGenerate = () => {
    if (objectives.length > 0) {
      setShowGenerateModal(true);
    } else {
      handleGenerateObjectives();
    }
  };

  const handleGenerateScoringCriteria = async () => {
    if (!newObjective.name || !newObjective.description) {
      setScoringCriteriaError("Please provide both title and description before generating scoring criteria");
      return;
    }

    setIsGeneratingScoringCriteria(true);
    setScoringCriteriaError("");

    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/generate-scoring-criteria`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            workspace_id: workspaceId,
            scan_id: scanId,
            objective_name: newObjective.name,
            objective_description: newObjective.description
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate scoring criteria");
      }

      const data = await response.json();
      setNewObjective({
        ...newObjective,
        scoring_criteria: data.scoring_criteria
      });
    } catch (err: any) {
      setScoringCriteriaError(err.message || "An error occurred while generating scoring criteria");
    } finally {
      setIsGeneratingScoringCriteria(false);
    }
  };

  const handleGenerateEditScoringCriteria = async () => {
    if (!editingObjective?.name || !editingObjective?.description) {
      setEditScoringCriteriaError("Please provide both title and description before generating scoring criteria");
      return;
    }

    setIsGeneratingEditScoringCriteria(true);
    setEditScoringCriteriaError("");

    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/generate-scoring-criteria`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            workspace_id: workspaceId,
            scan_id: scanId,
            objective_name: editingObjective.name,
            objective_description: editingObjective.description
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate scoring criteria");
      }

      const data = await response.json();
      setEditingObjective({
        ...editingObjective,
        scoring_criteria: data.scoring_criteria
      });
    } catch (err: any) {
      setEditScoringCriteriaError(err.message || "An error occurred while generating scoring criteria");
    } finally {
      setIsGeneratingEditScoringCriteria(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Strategic Objectives</h2>
        <div className="flex space-x-2">
          <Button
            onClick={confirmGenerate}
            disabled={isLoading || isGenerating}
            icon={<Wand2 className="h-5 w-5" />}
            variant="secondary"
          >
            {isGenerating ? "Generating..." : "Generate Objectives"}
          </Button>
          <Button
            onClick={() => setIsAddingNew(true)}
            disabled={isLoading || isGenerating}
          >
            + Strategic Objective
          </Button>
        </div>
      </div>
      
      <p className="text-gray-600 mb-6">
        Define and manage strategic objectives for this scan.
      </p>
      
      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      {isGenerating && (
        <div className="p-4 bg-blue-100 text-blue-800 rounded-lg mb-4">
          Generating strategic objectives based on company information and business lifecycles...
        </div>
      )}
      
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {objectives.length ? (
            objectives.map(objective => (
              <div key={objective.name} className="border border-gray-200 rounded-lg shadow-sm bg-white p-6 flex flex-col">
                <h3 className="text-lg font-semibold mb-2">{objective.name}</h3>
                <p className="text-gray-600 mb-4 flex-grow">{objective.description}</p>
                <div className="flex justify-between items-center mt-auto">
                  <select
                    value={objective.status}
                    onChange={(e) => handleStatusChange(
                      objective, 
                      e.target.value as "to be approved" | "approved"
                    )}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="to be approved">To Be Approved</option>
                    <option value="approved">Approved</option>
                  </select>
                  <Button
                    onClick={() => openEditModal(objective)}
                    icon={<Pencil className="h-5 w-5" />}
                    iconOnly
                    title="Edit Objective"
                    variant="secondary"
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 p-6 bg-gray-50 rounded-lg text-center">
              <p className="text-gray-500">No strategic objectives defined yet.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Add New Objective Card */}
      {isAddingNew && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg shadow p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">Add New Strategic Objective</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title*
              </label>
              <input
                type="text"
                value={newObjective.name}
                onChange={(e) => setNewObjective({
                  ...newObjective,
                  name: e.target.value
                })}
                className={`w-full px-3 py-2 border ${nameError ? 'border-red-500' : 'border-gray-300'} rounded focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {nameError && (
                <div className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {nameError}
                </div>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newObjective.description}
                onChange={(e) => setNewObjective({
                  ...newObjective,
                  description: e.target.value
                })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={newObjective.status}
                onChange={(e) => setNewObjective({
                  ...newObjective,
                  status: e.target.value as "to be approved" | "approved"
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="to be approved">To Be Approved</option>
                <option value="approved">Approved</option>
              </select>
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Scoring Criteria
                </label>
                <Button
                  variant="secondary"
                  onClick={handleGenerateScoringCriteria}
                  disabled={isGeneratingScoringCriteria || !newObjective.name || !newObjective.description}
                  icon={<Wand2 className="h-4 w-4" />}
                >
                  {isGeneratingScoringCriteria ? "Generating..." : "Generate Scoring Criteria"}
                </Button>
              </div>
              
              {scoringCriteriaError && (
                <div className="mb-2 p-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                  {scoringCriteriaError}
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Low Impact (Score: 1)
                  </label>
                  <div className="relative">
                    <textarea
                      value={newObjective.scoring_criteria?.low || ""}
                      onChange={(e) => setNewObjective({
                        ...newObjective,
                        scoring_criteria: {
                          ...newObjective.scoring_criteria,
                          low: e.target.value
                        }
                      })}
                      rows={2}
                      placeholder="Define what constitutes low impact for this objective..."
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={isGeneratingScoringCriteria}
                    />
                    {isGeneratingScoringCriteria && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#5319A5] border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Medium Impact (Score: 2)
                  </label>
                  <div className="relative">
                    <textarea
                      value={newObjective.scoring_criteria?.medium || ""}
                      onChange={(e) => setNewObjective({
                        ...newObjective,
                        scoring_criteria: {
                          ...newObjective.scoring_criteria,
                          medium: e.target.value
                        }
                      })}
                      rows={2}
                      placeholder="Define what constitutes medium impact for this objective..."
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={isGeneratingScoringCriteria}
                    />
                    {isGeneratingScoringCriteria && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#5319A5] border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    High Impact (Score: 3)
                  </label>
                  <div className="relative">
                    <textarea
                      value={newObjective.scoring_criteria?.high || ""}
                      onChange={(e) => setNewObjective({
                        ...newObjective,
                        scoring_criteria: {
                          ...newObjective.scoring_criteria,
                          high: e.target.value
                        }
                      })}
                      rows={2}
                      placeholder="Define what constitutes high impact for this objective..."
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={isGeneratingScoringCriteria}
                    />
                    {isGeneratingScoringCriteria && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#5319A5] border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsAddingNew(false);
                  setNameError(null);
                  setScoringCriteriaError("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddObjective}
                disabled={!!nameError || !newObjective.name}
              >
                Add Objective
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      >
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Confirm Deletion
        </h3>
        <p className="text-gray-500 mb-4">
          Are you sure you want to delete this strategic objective? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            variant="secondary"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteObjective}
          >
            Delete
          </Button>
        </div>
      </Modal>
      
      {/* Generate Confirmation Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
      >
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Generate New Objectives
        </h3>
        <p className="text-gray-500 mb-4">
          This will replace all existing strategic objectives with AI-generated ones based on your company information and business lifecycles. This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            variant="secondary"
            onClick={() => setShowGenerateModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerateObjectives}
          >
            Generate
          </Button>
        </div>
      </Modal>
      
      {/* Edit Objective Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingObjective(null);
          setOriginalObjectiveName(null);
          setNameError(null);
          setEditScoringCriteriaError("");
        }}
        maxWidth="2xl"
      >
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Edit Strategic Objective
        </h3>
        
        {editingObjective && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={editingObjective.name}
                onChange={(e) => setEditingObjective({
                  ...editingObjective,
                  name: e.target.value
                })}
                className={`w-full px-3 py-2 border ${nameError ? 'border-red-500' : 'border-gray-300'} rounded focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {nameError && (
                <div className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {nameError}
                </div>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={editingObjective.description}
                onChange={(e) => setEditingObjective({
                  ...editingObjective,
                  description: e.target.value
                })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Scoring Criteria Section */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-gray-700">Scoring Criteria</h4>
                <Button
                  variant="secondary"
                  onClick={handleGenerateEditScoringCriteria}
                  disabled={isGeneratingEditScoringCriteria || !editingObjective.name || !editingObjective.description}
                  icon={<Wand2 className="h-4 w-4" />}
                >
                  {isGeneratingEditScoringCriteria ? "Generating..." : "Generate Scoring Criteria"}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Define custom scoring criteria for this strategic objective. These will be used when AI evaluates pain points.</p>
              
              {editScoringCriteriaError && (
                <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                  {editScoringCriteriaError}
                </div>
              )}
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Low Impact (Score: 1)
                  </label>
                  <div className="relative">
                    <textarea
                      value={editingObjective.scoring_criteria?.low || ""}
                      onChange={(e) => setEditingObjective({
                        ...editingObjective,
                        scoring_criteria: {
                          ...editingObjective.scoring_criteria,
                          low: e.target.value
                        }
                      })}
                      rows={2}
                      placeholder="Define what constitutes low impact for this objective..."
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      disabled={isGeneratingEditScoringCriteria}
                    />
                    {isGeneratingEditScoringCriteria && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#5319A5] border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Medium Impact (Score: 2)
                  </label>
                  <div className="relative">
                    <textarea
                      value={editingObjective.scoring_criteria?.medium || ""}
                      onChange={(e) => setEditingObjective({
                        ...editingObjective,
                        scoring_criteria: {
                          ...editingObjective.scoring_criteria,
                          medium: e.target.value
                        }
                      })}
                      rows={2}
                      placeholder="Define what constitutes medium impact for this objective..."
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      disabled={isGeneratingEditScoringCriteria}
                    />
                    {isGeneratingEditScoringCriteria && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#5319A5] border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    High Impact (Score: 3)
                  </label>
                  <div className="relative">
                    <textarea
                      value={editingObjective.scoring_criteria?.high || ""}
                      onChange={(e) => setEditingObjective({
                        ...editingObjective,
                        scoring_criteria: {
                          ...editingObjective.scoring_criteria,
                          high: e.target.value
                        }
                      })}
                      rows={2}
                      placeholder="Define what constitutes high impact for this objective..."
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      disabled={isGeneratingEditScoringCriteria}
                    />
                    {isGeneratingEditScoringCriteria && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#5319A5] border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <Button
                variant="danger"
                onClick={() => {
                  setShowEditModal(false);
                  confirmDelete(editingObjective);
                }}
                icon={<Trash className="h-5 w-5" />}
              >
                Delete
              </Button>
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingObjective(null);
                    setOriginalObjectiveName(null);
                    setEditScoringCriteriaError("");
                  }}
                  icon={<X className="h-5 w-5" />}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateObjective}
                  icon={<Check className="h-5 w-5" />}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </>
        )}
      </Modal>
      
      {nameError && !showEditModal && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {nameError}
        </div>
      )}
    </div>
  );
} 