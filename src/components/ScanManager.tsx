"use client";

import React, { useState, useEffect } from "react";
import Modal from "@/components/Modal";
import Link from "next/link";
import { useUser } from '@auth0/nextjs-auth0/client';
import { fetchWithAuth } from '../utils/api';
import { PencilIcon } from '../assets/icons';

interface Scan {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
}

interface ScanManagerProps {
  tenantSlug: string;
  workspaceId: string;
}

export default function ScanManager({ tenantSlug, workspaceId }: ScanManagerProps) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newScanName, setNewScanName] = useState("");
  const [newScanDescription, setNewScanDescription] = useState("");
  const [newScanStatus, setNewScanStatus] = useState("pending");

  // Edit state
  const [editingScan, setEditingScan] = useState<Scan | null>(null);
  const [editedScanName, setEditedScanName] = useState("");
  const [editedScanDescription, setEditedScanDescription] = useState("");
  const [editedScanStatus, setEditedScanStatus] = useState("pending");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Delete confirmation state inside edit modal
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const { user } = useUser();

  useEffect(() => {
    fetchScans();
  }, [tenantSlug, workspaceId]);

  const fetchScans = async () => {
    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces/scans?slug=${tenantSlug}&workspace_id=${workspaceId}`,
        user?.accessToken as string | undefined
      );
      if (!res.ok) {
        console.error("Failed to fetch scans");
        return;
      }
      const data = await res.json();
      setScans(data);
    } catch (error) {
      console.error("Error fetching scans:", error);
    }
  };

  const handleCreateScan = async () => {
    const trimmedName = newScanName.trim();
    if (!trimmedName) return;

    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces/scans?slug=${tenantSlug}&workspace_id=${workspaceId}`,
        user?.accessToken as string | undefined,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            description: newScanDescription.trim(),
            status: newScanStatus,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to create scan");

      const newScan = await res.json();
      setScans((prev) => [...prev, newScan]);
      setNewScanName("");
      setNewScanDescription("");
      setNewScanStatus("pending");
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating scan:", error);
      alert("Failed to create scan");
    }
  };

  const openEditModal = (scan: Scan) => {
    setEditingScan(scan);
    setEditedScanName(scan.name);
    setEditedScanDescription(scan.description || "");
    setEditedScanStatus(scan.status);
    setShowDeleteConfirmation(false);
    setDeleteConfirmationText("");
    setIsEditModalOpen(true);
  };

  const handleEditScan = async () => {
    if (!editingScan || !editedScanName.trim()) return;
    const trimmedNewName = editedScanName.trim();
    // Check for duplicate names (exclude current scan)
    const duplicate = scans.find(
      (s) =>
        s.id !== editingScan.id &&
        s.name.toLowerCase() === trimmedNewName.toLowerCase()
    );
    if (duplicate) {
      alert("A scan with this name already exists.");
      return;
    }
    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces/scans?slug=${tenantSlug}&workspace_id=${workspaceId}&id=${editingScan.id}`,
        user?.accessToken as string | undefined,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedNewName,
            description: editedScanDescription.trim(),
            status: editedScanStatus,
          }),
        }
      );
      if (res.ok) {
        setIsEditModalOpen(false);
        setEditingScan(null);
        setEditedScanName("");
        setEditedScanDescription("");
        setEditedScanStatus("pending");
        fetchScans();
      } else {
        console.error("Failed to update scan");
      }
    } catch (err) {
      console.error("Error updating scan:", err);
    }
  };

  const handleDeleteScan = async (scanId: string) => {
    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces/scans?slug=${tenantSlug}&workspace_id=${workspaceId}&id=${scanId}`,
        user?.accessToken as string | undefined,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) throw new Error("Failed to delete scan");

      setScans((prev) => prev.filter((s) => s.id !== scanId));
      
      // Close the modal and reset all edit state after successful deletion
      setIsEditModalOpen(false);
      setEditingScan(null);
      setEditedScanName("");
      setEditedScanDescription("");
      setEditedScanStatus("pending");
      setShowDeleteConfirmation(false);
      setDeleteConfirmationText("");
    } catch (error) {
      console.error("Error deleting scan:", error);
      alert("Failed to delete scan");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4 shadow">
        <h2 className="text-xl font-semibold text-gray-800">Scans</h2>
        <button
          className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          onClick={() => setIsCreating(true)}
        >
          Create Scan
        </button>
      </div>

      {/* Modal for Creating Scan */}
      <Modal
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false);
          setNewScanName("");
          setNewScanDescription("");
          setNewScanStatus("pending");
        }}
      >
        <h3 className="text-lg font-bold mb-4">Create Scan</h3>
        <input
          type="text"
          placeholder="Enter scan name"
          value={newScanName}
          onChange={(e) => setNewScanName(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
        />
        <select
          value={newScanStatus}
          onChange={(e) => setNewScanStatus(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
        >
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="done">Done</option>
        </select>
        <textarea
          placeholder="Enter scan description (optional)"
          value={newScanDescription}
          onChange={(e) => setNewScanDescription(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
          rows={3}
        ></textarea>
        <div className="flex justify-end space-x-2">
          <button
            className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
            onClick={() => {
              setIsCreating(false);
              setNewScanName("");
              setNewScanDescription("");
              setNewScanStatus("pending");
            }}
          >
            Cancel
          </button>
          <button
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            onClick={handleCreateScan}
          >
            Save
          </button>
        </div>
      </Modal>

      {/* Modal for Editing Scan */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingScan(null);
          setEditedScanName("");
          setEditedScanDescription("");
          setEditedScanStatus("pending");
          setShowDeleteConfirmation(false);
          setDeleteConfirmationText("");
        }}
      >
        <h3 className="text-lg font-bold mb-4">Edit Scan</h3>
        {!showDeleteConfirmation ? (
          <>
            <input
              type="text"
              placeholder="Update scan name"
              value={editedScanName}
              onChange={(e) => setEditedScanName(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
            />
            <select
              value={editedScanStatus}
              onChange={(e) => setEditedScanStatus(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="done">Done</option>
            </select>
            <textarea
              placeholder="Update scan description"
              value={editedScanDescription}
              onChange={(e) => setEditedScanDescription(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
              rows={3}
            ></textarea>
            <div className="flex items-center justify-between mb-4">
              {/* Left Group: Delete button */}
              <button
                className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
                onClick={() => setShowDeleteConfirmation(true)}
              >
                Delete Scan
              </button>
              {/* Right Group: Cancel and Save buttons */}
              <div className="space-x-2">
                <button
                  className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingScan(null);
                    setEditedScanName("");
                    setEditedScanDescription("");
                    setEditedScanStatus("pending");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                  onClick={handleEditScan}
                >
                  Save
                </button>
              </div>
            </div>
          </>
        ) : (
          // Delete confirmation UI (edit UI hidden)
          <div>
            <div className="text-red-600 mb-4">
              <p className="font-bold text-lg mb-2">Warning: This action cannot be undone</p>
              <p className="mb-4">Deleting this scan will permanently remove all associated data.</p>
              <p className="mb-2">
                To confirm deletion, type the scan name:{" "}
                <strong>{editingScan?.name}</strong>
              </p>
            </div>
            <input
              type="text"
              placeholder="Type scan name to confirm"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
                onClick={() => setShowDeleteConfirmation(false)}
              >
                Cancel
              </button>
              <button
                className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
                onClick={() => {
                  if (deleteConfirmationText === editingScan?.name) {
                    handleDeleteScan(editingScan?.id || "");
                  } else {
                    alert("The scan name you entered doesn't match. Please try again.");
                  }
                }}
                disabled={deleteConfirmationText !== editingScan?.name}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scans.map((scan) => (
          <div
            key={scan.id}
            className="group relative p-4 border border-gray-200 rounded-lg bg-gray-50 shadow hover:bg-gray-100 h-[350px]"
          >
            {/* Edit button only visible on hover */}
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="bg-blue-500 text-white p-2.5 rounded-full flex items-center justify-center shadow-md hover:bg-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(scan);
                }}
                aria-label="Edit scan"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            </div>
            {/* Status badge in top right corner - always visible */}
            <div className="absolute top-2 right-2">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  scan.status === "done"
                    ? "bg-green-100 text-green-800"
                    : scan.status === "active"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {scan.status}
              </span>
            </div>
            <Link href={`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scan.id}`}>
              <div className="h-full cursor-pointer">
                <h3 className="text-xl font-semibold text-gray-800">
                  {scan.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Created: {new Date(scan.created_at).toLocaleString()}
                </p>
                {scan.description && (
                  <p className="mt-1 text-sm text-gray-500">
                   Description: {scan.description}
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