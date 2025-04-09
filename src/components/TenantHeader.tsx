"use client";

import React, { useState, useEffect } from "react";
import { useUser } from '@auth0/nextjs-auth0/client';
import { fetchWithAuth } from '../utils/api';
import Modal from "./Modal";
import { PencilIcon } from '../assets/icons';

interface Tenant {
  name: string;
  slug: string;
  description?: string;
  region?: string;
}

interface TenantHeaderProps {
  tenant: Tenant;
}

export default function TenantHeader({ tenant }: TenantHeaderProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updatedDescription, setUpdatedDescription] = useState(tenant.description || "");
  const [localTenant, setLocalTenant] = useState(tenant);
  const { user } = useUser();

  // Updates the tenant description via a PATCH request.
  const updateTenantDescription = async () => {
    try {
      const res = await fetchWithAuth("/api/tenants/by-slug", user?.accessToken as string | undefined, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: tenant.slug,
          description: updatedDescription,
        }),
      });
      if (!res.ok) {
        console.error("Failed to update tenant description");
        return;
      }
      const updatedTenant = await res.json();
      setLocalTenant(updatedTenant);
    } catch (error) {
      console.error("Error updating tenant description:", error);
    }
  };

  const fetchTenant = async () => {
    try {
      const res = await fetchWithAuth(`/api/tenants/by-slug?slug=${tenant.slug}`, user?.accessToken as string | undefined);
      if (!res.ok) {
        console.error("Failed to fetch tenant");
        return;
      }
      const data = await res.json();
      setLocalTenant(data);
    } catch (error) {
      console.error("Error fetching tenant:", error);
    }
  };

  return (
    <div className="relative mb-6">
      <div className="flex items-center">
        <h1 className="text-3xl font-bold text-gray-800 group inline-flex items-center">
          {localTenant.name}
          {/* Edit button with pencil icon */}
          <button
            className="invisible group-hover:visible ml-3 bg-blue-500 text-white p-2 rounded-full flex items-center justify-center shadow-sm hover:bg-blue-600"
            onClick={() => setIsEditModalOpen(true)}
            aria-label="Edit tenant"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        </h1>
      </div>
      {localTenant.region && (
        <p className="mt-1 text-sm text-gray-500">Data Region: {localTenant.region}</p>
      )}
      {localTenant.description && (
        <p className="mt-1 text-sm text-gray-500"> Description: {localTenant.description}</p>
      )}

      {/* Modal for editing tenant description */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setUpdatedDescription(localTenant.description || "");
        }}
      >
        <h3 className="text-lg font-bold mb-4">Edit Tenant</h3>
        <label className="block mb-2">
          <span className="text-gray-700">Tenant Title</span>
          <input
            type="text"
            value={localTenant.name}
            readOnly
            className="mt-1 block w-full rounded border border-gray-300 bg-gray-100 px-3 py-2"
          />
        </label>
        <label className="block mb-2">
          <span className="text-gray-700">Data Region</span>
          <input
            type="text"
            value={localTenant.region || ""}
            readOnly
            className="mt-1 block w-full rounded border border-gray-300 bg-gray-100 px-3 py-2"
          />
        </label>
        <label className="block mb-4">
          <span className="text-gray-700">Description</span>
          <textarea
            value={updatedDescription}
            onChange={(e) => setUpdatedDescription(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            rows={3}
            placeholder="Enter tenant description"
          ></textarea>
        </label>
        <div className="flex justify-end space-x-2">
          <button
            className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
            onClick={() => {
              setIsEditModalOpen(false);
              setUpdatedDescription(localTenant.description || "");
            }}
          >
            Cancel
          </button>
          <button
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            onClick={async () => {
              await updateTenantDescription();
              setIsEditModalOpen(false);
            }}
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}
