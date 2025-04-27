"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { Pencil, Trash2, Plus } from "lucide-react";

interface Stakeholder {
  id: string;
  name: string;
  role: string;
}

interface Lifecycle {
  id: string;
  name: string;
  stakeholders?: Stakeholder[];
}

export default function StakeholdersPage() {
  const params = useParams();
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [currentStakeholder, setCurrentStakeholder] = useState<Stakeholder | null>(null);
  const [currentLifecycleId, setCurrentLifecycleId] = useState<string>("");
  const [formData, setFormData] = useState({ name: "", role: "" });

  useEffect(() => {
    // Fetch lifecycles data when component mounts
    fetchLifecycles();
  }, []);

  const fetchLifecycles = async () => {
    try {
      const response = await fetch(`/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${params.tenant}&workspace_id=${params.workspace}&scan_id=${params.scan}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch lifecycles");
      }
      
      const data = await response.json();
      setLifecycles(data);
    } catch (error) {
      console.error("Error fetching lifecycles:", error);
      setErrorMessage("Failed to load lifecycles. Please try again.");
    }
  };

  const openAddModal = (lifecycleId: string) => {
    setModalMode("add");
    setFormData({ name: "", role: "" });
    setCurrentStakeholder(null);
    setCurrentLifecycleId(lifecycleId);
    setIsModalOpen(true);
  };

  const openEditModal = (lifecycleId: string, stakeholder: Stakeholder) => {
    setModalMode("edit");
    setFormData({ name: stakeholder.name, role: stakeholder.role });
    setCurrentStakeholder(stakeholder);
    setCurrentLifecycleId(lifecycleId);
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddStakeholder = async () => {
    if (!formData.name || !formData.role) {
      setErrorMessage("Name and role are required");
      return;
    }

    try {
      const response = await fetch("/api/tenants/by-slug/workspaces/scans/lifecycles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_slug: params.tenant,
          workspace_id: params.workspace,
          scan_id: params.scan,
          lifecycle_id: currentLifecycleId,
          action: "add_stakeholder",
          stakeholder: {
            name: formData.name,
            role: formData.role
          }
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add stakeholder");
      }

      // Refresh lifecycles data
      await fetchLifecycles();
      setIsModalOpen(false);
      setErrorMessage("");
    } catch (error) {
      console.error("Error adding stakeholder:", error);
      setErrorMessage("Failed to add stakeholder. Please try again.");
    }
  };

  const handleUpdateStakeholder = async () => {
    if (!currentStakeholder || !formData.name || !formData.role) {
      setErrorMessage("Name and role are required");
      return;
    }

    try {
      const response = await fetch("/api/tenants/by-slug/workspaces/scans/lifecycles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_slug: params.tenant,
          workspace_id: params.workspace,
          scan_id: params.scan,
          lifecycle_id: currentLifecycleId,
          action: "update_stakeholder",
          stakeholder_id: currentStakeholder.id,
          stakeholder: {
            name: formData.name,
            role: formData.role
          }
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update stakeholder");
      }

      // Refresh lifecycles data
      await fetchLifecycles();
      setIsModalOpen(false);
      setErrorMessage("");
    } catch (error) {
      console.error("Error updating stakeholder:", error);
      setErrorMessage("Failed to update stakeholder. Please try again.");
    }
  };

  const handleDeleteStakeholder = async (lifecycleId: string, stakeholderId: string) => {
    if (!confirm("Are you sure you want to delete this stakeholder?")) {
      return;
    }

    try {
      const response = await fetch("/api/tenants/by-slug/workspaces/scans/lifecycles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_slug: params.tenant,
          workspace_id: params.workspace,
          scan_id: params.scan,
          lifecycle_id: lifecycleId,
          action: "delete_stakeholder",
          stakeholder_id: stakeholderId
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete stakeholder");
      }

      // Refresh lifecycles data
      await fetchLifecycles();
    } catch (error) {
      console.error("Error deleting stakeholder:", error);
      setErrorMessage("Failed to delete stakeholder. Please try again.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    modalMode === "add" ? handleAddStakeholder() : handleUpdateStakeholder();
  };

  // Helper function to safely get stakeholders from a lifecycle
  const getStakeholders = (lifecycle: Lifecycle) => {
    return lifecycle.stakeholders || [];
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-semibold mb-6">Stakeholders Management</h1>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {errorMessage}
        </div>
      )}
      
      {lifecycles.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {lifecycles.map(lifecycle => (
            <div key={lifecycle.id} className="bg-white shadow rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-4 border-b">
                <h2 className="text-xl font-medium text-gray-800">{lifecycle.name}</h2>
              </div>
              
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-md font-medium text-gray-600">Stakeholders</h3>
                  <Button 
                    onClick={() => openAddModal(lifecycle.id)}
                    icon={<Plus size={16} />}
                    variant="primary"
                  >
                    Add
                  </Button>
                </div>
                
                {getStakeholders(lifecycle).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getStakeholders(lifecycle).map((stakeholder) => (
                          <tr key={stakeholder.id}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                              {stakeholder.name}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {stakeholder.role}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <Button 
                                  variant="secondary" 
                                  iconOnly
                                  icon={<Pencil size={16} />}
                                  onClick={() => openEditModal(lifecycle.id, stakeholder)}
                                  title="Edit"
                                />
                                <Button 
                                  variant="danger-secondary" 
                                  iconOnly
                                  icon={<Trash2 size={16} />}
                                  onClick={() => handleDeleteStakeholder(lifecycle.id, stakeholder.id)}
                                  title="Delete"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No stakeholders added yet.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-500">
          No lifecycles found for this scan.
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          {modalMode === "add" ? "Add New Stakeholder" : "Edit Stakeholder"}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <input
                type="text"
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button 
              variant="secondary" 
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {modalMode === "add" ? "Add Stakeholder" : "Update Stakeholder"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
} 