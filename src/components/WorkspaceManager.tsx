"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { useUser } from '@auth0/nextjs-auth0/client';
import { fetchWithAuth } from '../utils/api';
import { PencilIcon } from '../assets/icons';
import Button from "./Button";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface Scan {
  id: string;
  name: string;
  description?: string;
  status: string;
}

interface WorkspaceManagerProps {
  tenantSlug: string;
}

export default function WorkspaceManager({ tenantSlug }: WorkspaceManagerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");

  // Edit state
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editedWorkspaceName, setEditedWorkspaceName] = useState("");
  const [editedWorkspaceDescription, setEditedWorkspaceDescription] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Delete confirmation state inside edit modal
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [childScans, setChildScans] = useState<Scan[]>([]);
  const [isLoadingScans, setIsLoadingScans] = useState(false);

  const { user } = useUser();

  useEffect(() => {
    fetchWorkspaces();
  }, [tenantSlug]);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetchWithAuth(`/api/tenants/by-slug/workspaces?slug=${tenantSlug}`, user?.accessToken as string | undefined);
      if (!res.ok) {
        console.error("Failed to fetch workspaces");
        return;
      }
      const data = await res.json();
      setWorkspaces(data);
    } catch (error) {
      console.error("Error fetching workspaces:", error);
    }
  };

  const handleCreateWorkspace = async () => {
    const trimmedName = newWorkspaceName.trim();
    if (!trimmedName) return;

    try {
      const res = await fetchWithAuth(`/api/tenants/by-slug/workspaces?slug=${tenantSlug}`, user?.accessToken as string | undefined, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          description: newWorkspaceDescription.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to create workspace");

      const newWorkspace = await res.json();
      setWorkspaces((prev) => [...prev, newWorkspace]);
      setNewWorkspaceName("");
      setNewWorkspaceDescription("");
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating workspace:", error);
      alert("Failed to create workspace");
    }
  };

  const openEditModal = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setEditedWorkspaceName(workspace.name);
    setEditedWorkspaceDescription(workspace.description || "");
    setShowDeleteConfirmation(false);
    setDeleteConfirmationText("");
    setChildScans([]);
    setIsEditModalOpen(true);
  };

  const handleEditWorkspace = async () => {
    if (!editingWorkspace || !editedWorkspaceName.trim()) return;
    const trimmedNewName = editedWorkspaceName.trim();
    // Check for duplicate names (exclude current workspace)
    const duplicate = workspaces.find(
      (w) =>
        w.id !== editingWorkspace.id &&
        w.name.toLowerCase() === trimmedNewName.toLowerCase()
    );
    if (duplicate) {
      alert("A workspace with this name already exists.");
      return;
    }
    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces?slug=${tenantSlug}&id=${editingWorkspace.id}`,
        user?.accessToken as string | undefined,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedNewName,
            description: editedWorkspaceDescription.trim(),
          }),
        }
      );
      if (res.ok) {
        setIsEditModalOpen(false);
        setEditingWorkspace(null);
        setEditedWorkspaceName("");
        setEditedWorkspaceDescription("");
        fetchWorkspaces();
      } else {
        console.error("Failed to update workspace");
      }
    } catch (err) {
      console.error("Error updating workspace:", err);
    }
  };

  const handleShowDeleteConfirmation = async () => {
    if (!editingWorkspace) return;
    
    setIsLoadingScans(true);
    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces/scans?slug=${tenantSlug}&workspace_id=${editingWorkspace.id}`,
        user?.accessToken as string | undefined
      );
      if (res.ok) {
        const data = await res.json();
        setChildScans(data);
      } else {
        console.error("Failed to fetch scans for workspace");
      }
    } catch (err) {
      console.error("Error fetching scans:", err);
    } finally {
      setIsLoadingScans(false);
      setShowDeleteConfirmation(true);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces?slug=${tenantSlug}&id=${workspaceId}`,
        user?.accessToken as string | undefined,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) throw new Error("Failed to delete workspace");

      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
      // Close the modal after successful deletion
      setIsEditModalOpen(false);
      setEditingWorkspace(null);
      setEditedWorkspaceName("");
      setEditedWorkspaceDescription("");
      setShowDeleteConfirmation(false);
      setDeleteConfirmationText("");
    } catch (error) {
      console.error("Error deleting workspace:", error);
      alert("Failed to delete workspace");
    }
  };

  const handleUpdateWorkspace = async (workspaceId: string) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;

    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces?slug=${tenantSlug}&id=${workspaceId}`,
        user?.accessToken as string | undefined,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: workspace.name,
            description: workspace.description,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to update workspace");
    } catch (error) {
      console.error("Error updating workspace:", error);
      alert("Failed to update workspace");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4 shadow">
        <h2 className="text-xl font-semibold text-gray-800">Workspaces</h2>
        <Button
          onClick={() => setIsCreating(true)}
        >
          Create Workspace
        </Button>
      </div>

      {/* Modal for Creating Workspace */}
      <Modal
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false);
          setNewWorkspaceName("");
          setNewWorkspaceDescription("");
        }}
      >
        <h3 className="text-lg font-bold mb-4">Create Workspace</h3>
        <input
          type="text"
          placeholder="Enter workspace name"
          value={newWorkspaceName}
          onChange={(e) => setNewWorkspaceName(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
        />
        <textarea
          placeholder="Enter workspace description (optional)"
          value={newWorkspaceDescription}
          onChange={(e) => setNewWorkspaceDescription(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
          rows={3}
        ></textarea>
        <div className="flex justify-end space-x-2">
          <Button
            variant="secondary"
            onClick={() => {
              setIsCreating(false);
              setNewWorkspaceName("");
              setNewWorkspaceDescription("");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateWorkspace}
          >
            Save
          </Button>
        </div>
      </Modal>

      {/* Modal for Editing Workspace */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingWorkspace(null);
          setEditedWorkspaceName("");
          setEditedWorkspaceDescription("");
          setShowDeleteConfirmation(false);
          setDeleteConfirmationText("");
        }}
      >
        <h3 className="text-lg font-bold mb-4">Edit Workspace</h3>
        {!showDeleteConfirmation ? (
          <>
            <input
              type="text"
              placeholder="Update workspace name"
              value={editedWorkspaceName}
              onChange={(e) => setEditedWorkspaceName(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
            />
            <textarea
              placeholder="Update workspace description"
              value={editedWorkspaceDescription}
              onChange={(e) => setEditedWorkspaceDescription(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
              rows={3}
            ></textarea>
            <div className="flex items-center justify-between mb-4">
              {/* Left Group: Delete button */}
              <Button
                variant="danger"
                onClick={handleShowDeleteConfirmation}
              >
                Delete Workspace
              </Button>
              {/* Right Group: Cancel and Save buttons */}
              <div className="space-x-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingWorkspace(null);
                    setEditedWorkspaceName("");
                    setEditedWorkspaceDescription("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEditWorkspace}
                >
                  Save
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Delete confirmation UI (edit UI hidden)
          <div>
            <div className="text-red-600 mb-4">
              <p className="font-bold text-lg mb-2">Warning: This action cannot be undone</p>
              <p className="mb-4">Deleting this workspace will permanently remove all associated data, including:</p>
              
              {isLoadingScans ? (
                <p className="italic text-gray-600">Loading scans...</p>
              ) : childScans.length > 0 ? (
                <div className="mb-4">
                  <p className="mb-2 font-semibold">The following scans will be deleted:</p>
                  <ul className="list-disc pl-5 mb-3">
                    {childScans.map(scan => (
                      <li key={scan.id} className="mb-1">
                        {scan.name} {scan.status && <span className="text-xs ml-1">({scan.status})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mb-3">This workspace has no scans.</p>
              )}
              
              <p className="mb-2">
                To confirm deletion, type the workspace name:{" "}
                <strong>{editingWorkspace?.name}</strong>
              </p>
            </div>
            <input
              type="text"
              placeholder="Type workspace name to confirm"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirmation(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (deleteConfirmationText === editingWorkspace?.name) {
                    handleDeleteWorkspace(editingWorkspace?.id || "");
                  } else {
                    alert("The workspace name you entered doesn't match. Please try again.");
                  }
                }}
                disabled={deleteConfirmationText !== editingWorkspace?.name}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((workspace) => (
          <div
            key={workspace.id}
            className="group relative p-4 border border-gray-200 rounded-lg bg-gray-50 shadow hover:bg-gray-100 h-[350px]"
          >
            {/* Edit button only visible on hover */}
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="primary"
                iconOnly
                className="p-2.5 rounded-full flex items-center justify-center shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(workspace);
                }}
                icon={<PencilIcon className="h-4 w-4" />}
                title="Edit workspace"
              />
            </div>
            <Link href={`/tenants/${tenantSlug}/workspace/${workspace.id}`}>
              <div className="h-full cursor-pointer">
                <h3 className="text-xl font-semibold text-gray-800">
                  {workspace.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Created: {new Date(workspace.created_at).toLocaleString()}
                </p>
                {workspace.description && (
                  <p className="mt-1 text-sm text-gray-500">
                    Description: {workspace.description}
                  </p>
                )}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
