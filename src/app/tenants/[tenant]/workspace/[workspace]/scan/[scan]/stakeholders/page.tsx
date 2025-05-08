"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { Pencil, Trash2, Plus, Search, CheckCircle, X, User, Check } from "lucide-react";

interface Stakeholder {
  id: string;
  name: string;
  role: string;
}

interface Employee {
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [isAddingMultiple, setIsAddingMultiple] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "multi-add">("add");
  const [currentStakeholder, setCurrentStakeholder] = useState<Stakeholder | null>(null);
  const [currentLifecycleId, setCurrentLifecycleId] = useState<string>("");
  const [formData, setFormData] = useState({ name: "", role: "" });
  const [showEmployeesList, setShowEmployeesList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Fetch lifecycles data when component mounts
    fetchLifecycles();
    // Fetch employees data
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setIsLoadingEmployees(true);
    try {
      // Fetch documents to find HRIS Reports
      const response = await fetch(`/api/tenants/by-slug/workspaces/scans/documents?slug=${params.tenant}&workspace_id=${params.workspace}&scan_id=${params.scan}&document_type=HRIS Reports`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch HRIS Reports");
      }
      
      const documents = await response.json();
      
      // Find HRIS document with employees data
      const hrisDoc = documents.find((doc: any) => doc.document_type === "HRIS Reports" && doc.employees);
      
      if (hrisDoc && hrisDoc.employees && hrisDoc.employees.length > 0) {
        setEmployees(hrisDoc.employees);
        console.log(`Loaded ${hrisDoc.employees.length} employees from HRIS Reports`);
      } else {
        console.log("No employees found in HRIS Reports");
        setEmployees([]);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setIsLoadingEmployees(false);
    }
  };

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
    setSearchQuery("");
    setIsAddingMultiple(false);
    // Don't automatically show the employee list
    setShowEmployeesList(false);
  };

  const openEditModal = (lifecycleId: string, stakeholder: Stakeholder) => {
    setModalMode("edit");
    setFormData({ name: stakeholder.name, role: stakeholder.role });
    setCurrentStakeholder(stakeholder);
    setCurrentLifecycleId(lifecycleId);
    setIsModalOpen(true);
    setSearchQuery("");
    setIsAddingMultiple(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper function to check if a stakeholder already exists in the lifecycle
  const stakeholderExists = (lifecycle: Lifecycle, name: string, role: string): boolean => {
    const stakeholders = getStakeholders(lifecycle);
    return stakeholders.some(
      s => s.name.toLowerCase() === name.toLowerCase() && s.role.toLowerCase() === role.toLowerCase()
    );
  };

  // Helper function to safely get stakeholders from a lifecycle
  const getStakeholders = (lifecycle: Lifecycle) => {
    return lifecycle.stakeholders || [];
  };

  // Helper function to get the current lifecycle by ID
  const getCurrentLifecycle = (): Lifecycle | undefined => {
    return lifecycles.find(lifecycle => lifecycle.id === currentLifecycleId);
  };

  // Function to select an employee from the list
  const selectEmployee = (employee: Employee) => {
    // Check if the employee is already a stakeholder in this lifecycle
    const currentLifecycle = getCurrentLifecycle();
    if (currentLifecycle && stakeholderExists(currentLifecycle, employee.name, employee.role)) {
      setErrorMessage(`${employee.name} (${employee.role}) is already a stakeholder in this lifecycle.`);
      return;
    }
    
    if (isAddingMultiple) {
      // Check if employee is already selected
      const isSelected = selectedEmployees.some(
        e => e.name === employee.name && e.role === employee.role
      );
      
      if (isSelected) {
        // Remove from selection
        setSelectedEmployees(selectedEmployees.filter(
          e => !(e.name === employee.name && e.role === employee.role)
        ));
      } else {
        // Add to selection
        setSelectedEmployees([...selectedEmployees, employee]);
      }
    } else {
      // Single selection mode
      setFormData({
        name: employee.name,
        role: employee.role
      });
      setShowEmployeesList(false);
    }
  };

  // Check if an employee is selected
  const isEmployeeSelected = (employee: Employee): boolean => {
    return selectedEmployees.some(
      e => e.name === employee.name && e.role === employee.role
    );
  };

  // Filter employees based on search query
  const filteredEmployees = employees.filter(employee => 
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    employee.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddStakeholder = async () => {
    if (!formData.name || !formData.role) {
      setErrorMessage("Name and role are required");
      return;
    }

    // Check if stakeholder already exists in the current lifecycle
    const currentLifecycle = getCurrentLifecycle();
    if (currentLifecycle && stakeholderExists(currentLifecycle, formData.name, formData.role)) {
      setErrorMessage(`A stakeholder with name "${formData.name}" and role "${formData.role}" already exists in this lifecycle.`);
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
    if (modalMode === "add") {
      if (selectedEmployees.length > 0) {
        // Adding multiple employees
        handleAddMultipleStakeholders();
      } else {
        // Adding a single stakeholder manually
        handleAddStakeholder();
      }
    } else if (modalMode === "edit") {
      handleUpdateStakeholder();
    }
  };

  // Add this new function to handle multiple stakeholder addition with duplicate checking
  const handleAddMultipleStakeholders = async () => {
    if (selectedEmployees.length === 0) {
      setErrorMessage("Please select at least one employee");
      return;
    }

    try {
      // Get current lifecycle for duplicate checking
      const currentLifecycle = getCurrentLifecycle();
      if (!currentLifecycle) {
        throw new Error("Lifecycle not found");
      }

      // Filter out stakeholders that already exist
      const newStakeholders = selectedEmployees.filter(
        employee => !stakeholderExists(currentLifecycle, employee.name, employee.role)
      );

      // Show warning if all selected employees are already stakeholders
      if (newStakeholders.length === 0) {
        setErrorMessage("All selected employees are already stakeholders in this lifecycle.");
        return;
      }

      // Process new stakeholders one by one
      const addPromises = newStakeholders.map(employee => 
        fetch("/api/tenants/by-slug/workspaces/scans/lifecycles", {
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
              name: employee.name,
              role: employee.role
            }
          }),
        })
      );
      
      // Wait for all requests to complete
      await Promise.all(addPromises);

      // Refresh lifecycles data
      await fetchLifecycles();
      setIsModalOpen(false);
      setErrorMessage("");
      setSelectedEmployees([]);

      // If some stakeholders were skipped, show a message
      if (newStakeholders.length < selectedEmployees.length) {
        const skippedCount = selectedEmployees.length - newStakeholders.length;
        setErrorMessage(`${newStakeholders.length} stakeholder(s) added. ${skippedCount} skipped because they already exist.`);
      }
    } catch (error) {
      console.error("Error adding stakeholders:", error);
      setErrorMessage("Failed to add stakeholders. Please try again.");
    }
  };

  // Function to determine if an employee is already a stakeholder in the current lifecycle
  const isEmployeeAlreadyStakeholder = (employee: Employee): boolean => {
    const currentLifecycle = getCurrentLifecycle();
    if (!currentLifecycle) return false;
    return stakeholderExists(currentLifecycle, employee.name, employee.role);
  };

  return (
    <div className="max-w-[1200px] mx-auto py-6">
      <h1 className="text-2xl font-semibold mb-6">Stakeholders</h1>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <button 
            className="absolute top-0 right-0 py-3 px-4"
            onClick={() => setErrorMessage("")}
          >
            <X size={16} />
          </button>
          {errorMessage}
        </div>
      )}
      
      {lifecycles.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                    Add Stakeholder
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
          {modalMode === "edit" ? "Edit Stakeholder" : "Add Stakeholders"}
        </h3>
        <form onSubmit={handleSubmit} className="relative">
          <div className="space-y-4">
            {/* Show employee selection UI if employees exist and we're not in edit mode */}
            {employees.length > 0 && modalMode === "add" && (
              <div>
                {!showEmployeesList ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowEmployeesList(true)}
                    className="w-full"
                  >
                    Select from HRIS Employees
                  </Button>
                ) : (
                  <div className="mb-2 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      {selectedEmployees.length > 0 
                        ? `${selectedEmployees.length} employee${selectedEmployees.length !== 1 ? 's' : ''} selected` 
                        : 'Select employee(s)'}
                    </span>
                    <div className="space-x-2">
                      {selectedEmployees.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedEmployees([])}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Clear all
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowEmployeesList(false)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        {selectedEmployees.length === 0 ? 'Manual entry' : 'Continue with selection'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Selected employees display */}
                {selectedEmployees.length > 0 && showEmployeesList && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2 mb-4 border p-2 rounded-md bg-gray-50">
                      {selectedEmployees.map((employee, index) => (
                        <div key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center text-sm">
                          <span className="mr-1">{employee.name}</span>
                          <button
                            type="button"
                            onClick={() => selectEmployee(employee)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Employees list */}
            {showEmployeesList && modalMode === "add" && (
              <div className="bg-white border border-gray-300 rounded-md shadow-sm mb-4">
                <div className="flex items-center p-2 border-b">
                  <Search size={16} className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-2 py-1 focus:outline-none text-sm"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowEmployeesList(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                </div>
                {isLoadingEmployees ? (
                  <div className="p-4 text-center text-gray-500">Loading employees...</div>
                ) : filteredEmployees.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    {filteredEmployees.map((employee, index) => {
                      const isAlreadyStakeholder = isEmployeeAlreadyStakeholder(employee);
                      
                      return (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 ${
                            isEmployeeSelected(employee) ? "bg-blue-50" : ""
                          } ${isAlreadyStakeholder ? "opacity-50" : ""}`}
                          onClick={() => !isAlreadyStakeholder && selectEmployee(employee)}
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {employee.name}
                              {isAlreadyStakeholder && (
                                <span className="ml-2 text-xs text-gray-500 italic">
                                  (Already added)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{employee.role}</div>
                          </div>
                          {!isAlreadyStakeholder && (
                            <button 
                              type="button" 
                              className={`${isEmployeeSelected(employee) ? "text-blue-600" : "text-gray-400 hover:text-blue-600"}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectEmployee(employee);
                              }}
                            >
                              {isEmployeeSelected(employee) ? (
                                <Check size={16} />
                              ) : (
                                <Plus size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">No matching employees found</div>
                )}
              </div>
            )}

            {/* Name and role inputs - only show if we're in edit mode or not showing employees list */}
            {(modalMode === "edit" || !showEmployeesList || selectedEmployees.length === 0) && (
              <>
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
                    required={selectedEmployees.length === 0}
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
                    required={selectedEmployees.length === 0}
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button 
              variant="secondary" 
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={modalMode === "add" && selectedEmployees.length === 0 && (!formData.name || !formData.role)}
            >
              {modalMode === "edit" ? "Update Stakeholder" : 
               selectedEmployees.length > 0 ? `Add ${selectedEmployees.length} Stakeholder${selectedEmployees.length !== 1 ? 's' : ''}` : 
               "Add Stakeholder"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
} 