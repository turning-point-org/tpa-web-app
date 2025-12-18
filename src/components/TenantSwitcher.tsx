"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import Modal from "@/components/Modal";
import { useUser } from '@auth0/nextjs-auth0/client';
import { fetchWithAuth, AuthenticationError, SessionExpiredError, handleFetchResponse, withAuthErrorHandling } from '../utils/api';
import Button from "@/components/Button";

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
  const [isSuperUser, setIsSuperUser] = useState(false);

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
      // Check if we have a user and token before making the API call
      if (!user) {
        console.log("User not authenticated yet, skipping tenant fetch");
        return;
      }
      
      // Check if user is a super user
      // Check if user is a super user
      const userEmail = user.email || '';
      const lowerCaseEmail = userEmail.toLowerCase();

      const isSuper = (
        lowerCaseEmail.endsWith('@turningpointadvisory.com.au') ||
        lowerCaseEmail.endsWith('@novigi.com.au')
      );
      setIsSuperUser(isSuper);
      console.log(`User ${userEmail} is${isSuper ? '' : ' not'} a super user`);
      
      // Ensure we have a token - add more detailed logging
      console.log("Auth status:", { 
        isAuthenticated: !!user, 
        user: user?.sub || user?.email || 'unknown',
        hasToken: !!user?.accessToken,
        tokenType: user?.accessToken ? typeof user.accessToken : 'undefined',
        isSuperUser: isSuper
      });
      
      // Try to get token from session if not directly available in user object
      let token = user?.accessToken as string | undefined;
      
      if (!token) {
        // Log the absence of token and attempt to get it from /api/auth/session
        console.log("No direct token available, attempting to get from session API");
        try {
          const sessionRes = await fetch('/api/auth/session', {
            credentials: 'include'
          });
          
          // Use our auth error handler for session requests
          await handleFetchResponse(sessionRes);
          
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData.accessToken) {
              console.log("Retrieved token from session API");
              token = sessionData.accessToken;
            } else {
              console.log("No token in session API response:", sessionData);
            }
          } else {
            console.log("Failed to get session data:", sessionRes.status);
          }
        } catch (e) {
          if (e instanceof SessionExpiredError || e instanceof AuthenticationError) {
            // Auth error handler will redirect, so we can return early
            return;
          }
          console.error("Error fetching session:", e);
        }
      }
      
      // Make the API call with the token (either from user or session)
      const res = await fetchWithAuth("/api/tenants", token);
      if (!res.ok) {
        console.error("Failed to fetch tenants", res.status, res.statusText);
        return;
      }
      
      const data: Tenant[] = await res.json();
      console.log("Fetched tenants:", data.length);
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
      } else if (data.length === 1 && !selectedTenant) {
        // Auto-select if user only has one tenant and no tenant is currently selected
        console.log("Auto-selecting single tenant:", data[0].name);
        setSelectedTenant(data[0]);
        router.push(`/tenants/${data[0].slug}`);
      }
    } catch (error) {
      // Check for authentication errors and handle them
      const { isAuthError, handleAuthError } = await import('../utils/api');
      if (isAuthError(error)) {
        handleAuthError(error);
        return;
      }
      
      console.error("Error fetching tenants:", error);
    }
  };

  const handleCreateTenant = async () => {
    try {
      const trimmedName = newTenantName.trim();
      if (!trimmedName) return;

      // Check if user is authorized to create tenants
      if (!isSuperUser) {
        alert("Only administrators can create new tenants.");
        return;
      }

      if (
        tenants.some(
          (t) => t.name.toLowerCase() === trimmedName.toLowerCase()
        )
      ) {
        alert("A tenant with this name already exists.");
        return;
      }
      // Try to get token from user object or session
      let token = user?.accessToken as string | undefined;
      
      if (!token) {
        // Try to get token from session API
        try {
          const sessionRes = await fetch('/api/auth/session', {
            credentials: 'include'
          });
          
          // Use our auth error handler for session requests
          await handleFetchResponse(sessionRes);
          
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData.accessToken) {
              token = sessionData.accessToken;
            }
          }
        } catch (e) {
          if (e instanceof SessionExpiredError || e instanceof AuthenticationError) {
            // Auth error handler will redirect, so we can return early
            return;
          }
          console.error("Error fetching session:", e);
        }
      }
      
      const res = await fetchWithAuth("/api/tenants", token, {
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

      if (res.status === 403) {
        alert("You are not authorized to create tenants. Only administrators can create new tenants.");
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
      // Check for authentication errors and handle them
      const { isAuthError, handleAuthError } = await import('../utils/api');
      if (isAuthError(err)) {
        handleAuthError(err);
        return;
      }
      
      console.error(err);
      alert("Error creating tenant.");
    }
  };

  useEffect(() => {
    // Only fetch tenants if the user is loaded and authenticated
    if (!isLoading && user) {
      fetchTenants();
    }
    
    // Clear selected tenant when returning to root path
    if (pathname === "/") {
      setSelectedTenant(null);
    }
  }, [pathname, user, isLoading]);

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
          overflow-hidden rounded-lg mt-2 border border-gray-200
          ${isOpen ? "max-h-[400px] bg-white" : "max-h-0 bg-transparent border-transparent"}
        `}
      >
        {isOpen && (
          <div className="flex flex-col h-[400px]">
            {/* Scrollable tenant list */}
            <div className="flex-1 overflow-y-auto p-4 pb-2">
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
            {/* Fixed create button at bottom - only show for super users */}
            {isSuperUser && (
              <div className="p-4 pt-2 border-t border-gray-100 bg-white">
                <Button
                  onClick={() => setIsCreating(true)}
                  className="w-full"
                >
                  Create New Tenant
                </Button>
              </div>
            )}
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
          <Button
            variant="secondary"
            onClick={() => {
              setIsCreating(false);
              setNewTenantName("");
              setNewTenantDescription("");
              setNewTenantRegion("Australia");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateTenant}
          >
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}
