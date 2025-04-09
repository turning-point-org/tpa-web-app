"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import Modal from "@/components/Modal";
import { useUser } from '@auth0/nextjs-auth0/client';
import { fetchWithAuth } from '../utils/api';

interface Tenant {
  name: string;
  slug: string;
  // Additional fields from the backend: description and region.
  description?: string;
  region?: string;
}

export default function TenantSwitcher() {
  const { user, isLoading } = useUser();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDescription, setNewTenantDescription] = useState("");
  const [newTenantRegion, setNewTenantRegion] = useState("Australia");

  const router = useRouter();
  const pathname = usePathname();

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleSelectTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsOpen(false);
    router.push(`/tenants/${tenant.slug}`);
  };

  const fetchTenants = async () => {
    try {
      const res = await fetchWithAuth("/api/tenants", user?.accessToken as string | undefined);
      if (!res.ok) {
        console.error("Failed to fetch tenants");
        return;
      }
      const data: Tenant[] = await res.json();
      setTenants(data);

      // Auto-select a tenant from the URL path
      // This handles both direct tenant paths (/tenants/slug) and nested paths (/tenants/slug/...)
      const tenantMatch = pathname?.match(/\/tenants\/([^\/]+)/);
      if (tenantMatch && tenantMatch[1]) {
        const pathSlug = tenantMatch[1];
        const matchedTenant = data.find((t) => t.slug === pathSlug);
        if (matchedTenant) {
          setSelectedTenant(matchedTenant);
        }
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

  const handleCreateTenant = async () => {
    const trimmedName = newTenantName.trim();
    if (!trimmedName) return;

    if (
      tenants.some(
        (t) => t.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      alert("A tenant with this name already exists.");
      return;
    }

    try {
      const res = await fetchWithAuth("/api/tenants", user?.accessToken as string | undefined, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          description: newTenantDescription.trim(),
          region: newTenantRegion,
        }),
      });

      if (res.status === 409) {
        alert("Tenant name already exists.");
        return;
      }

      if (!res.ok) throw new Error("Failed to create tenant");

      const newTenant: Tenant = await res.json();
      setTenants((prev) => [...prev, newTenant]);
      setSelectedTenant(newTenant);
      setNewTenantName("");
      setNewTenantDescription("");
      setNewTenantRegion("Australia");
      setIsCreating(false);
      router.push(`/tenants/${newTenant.slug}`);
    } catch (err) {
      console.error(err);
      alert("Error creating tenant.");
    }
  };

  useEffect(() => {
    fetchTenants();
    // Clear selected tenant when returning to root path
    if (pathname === "/") {
      setSelectedTenant(null);
    }
  }, [pathname]);

  return (
    <div className="mt-6">
      {/* Collapsed Header */}
      <div
        className="flex items-center justify-between p-4 border border-gray-300 rounded-lg bg-white cursor-pointer"
        onClick={toggleOpen}
      >
        <div className="flex items-center space-x-3">
          <Image
            src="/tenant-icon.png"
            alt="Tenant Icon"
            width={30}
            height={30}
            className="rounded"
          />
          <span className="text-gray-700 font-semibold">
            {selectedTenant ? selectedTenant.name : "Select a tenant"}
          </span>
        </div>
        <span className="text-gray-500">{isOpen ? "▲" : "▼"}</span>
      </div>

      {/* Expanded Content */}
      <div
        className={`
          overflow-hidden rounded-lg mt-2 
          ${isOpen ? "max-h-[400px] p-4 bg-white" : "max-h-0 p-0 bg-transparent"}
        `}
      >
        {isOpen && (
          <div className="flex flex-col h-full">
            <div className="flex-grow overflow-y-auto">
              <ul className="space-y-2">
                {tenants.map((tenant) => (
                  <li
                    key={tenant.slug}
                    className="text-gray-600 hover:bg-gray-100 p-2 rounded cursor-pointer"
                    onClick={() => handleSelectTenant(tenant)}
                  >
                    {tenant.name}
                  </li>
                ))}
              </ul>
            </div>
            <button
              className="mt-2 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 cursor-pointer"
              onClick={() => setIsCreating(true)}
            >
              Create New Tenant
            </button>
          </div>
        )}
      </div>

      {/* Modal for Creating Tenant */}
      <Modal
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false);
          setNewTenantName("");
          setNewTenantDescription("");
          setNewTenantRegion("Australia");
        }}
      >
        <h3 className="text-lg font-bold mb-4">Create Tenant</h3>
        <input
          type="text"
          placeholder="Enter tenant name"
          value={newTenantName}
          onChange={(e) => setNewTenantName(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
        />
        <textarea
          placeholder="Enter tenant description (optional)"
          value={newTenantDescription}
          onChange={(e) => setNewTenantDescription(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
          rows={3}
        ></textarea>
        <select
          value={newTenantRegion}
          onChange={(e) => setNewTenantRegion(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full mb-4"
        >
          <option value="Australia">Australia</option>
          <option value="United States">United States</option>
          <option value="Europe">Europe</option>
        </select>
        <div className="flex justify-end space-x-2">
          <button
            className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
            onClick={() => {
              setIsCreating(false);
              setNewTenantName("");
              setNewTenantDescription("");
              setNewTenantRegion("Australia");
            }}
          >
            Cancel
          </button>
          <button
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            onClick={handleCreateTenant}
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}
