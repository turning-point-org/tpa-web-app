"use client";

import React, { useState, useEffect } from "react";
import { useUser } from '@auth0/nextjs-auth0/client';
import { fetchWithAuth } from '../utils/api';
import Link from "next/link";
import { usePathname } from "next/navigation";

// Helper: Converts a hyphenated string to title case.
function toTitleCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Workspace {
  id: string;
  name: string;
}

interface Scan {
  id: string;
  name: string;
}

interface Lifecycle {
  id: string;
  name: string;
}

// Define the workflow steps to match the ones in WorkflowNav
const WORKFLOW_STEPS = [
  { name: "Company Details", slug: "company-details" },
  { name: "Data Sources", slug: "data-sources" },
  { name: "Lifecycles", slug: "lifecycles" },
  { name: "Stakeholders", slug: "stakeholders" },
  { name: "Strategic Objectives", slug: "strategic-objectives" },
  { name: "Pain Points", slug: "pain-points" },
  { name: "Lifecycle Cost", slug: "lifecycle-cost" },
  { name: "Scenario Planning", slug: "scenario-planning" },
];

// Add a type for the active page state
type ActivePage = 'dashboard' | 'tenant' | 'workspace' | 'scan' | 'scanStep' | 'lifecycle' | 'painPointInterview';

export default function Breadcrumbs() {
  const pathname = usePathname();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [scanStep, setScanStep] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const { user } = useUser();

  const fetchTenant = async (slug: string): Promise<Tenant | null> => {
    try {
      const res = await fetchWithAuth(`/api/tenants/by-slug?slug=${slug}`, user?.accessToken as string | undefined);
      if (!res.ok) {
        console.error("Failed to fetch tenant");
        return null;
      }
      return await res.json();
    } catch (error) {
      console.error("Error fetching tenant:", error);
      return null;
    }
  };

  const fetchWorkspace = async (tenantSlug: string, workspaceId: string): Promise<Workspace | null> => {
    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces?slug=${tenantSlug}&id=${workspaceId}`,
        user?.accessToken as string | undefined
      );

      if (!res.ok) {
        console.error("Failed to fetch workspace");
        return null;
      }
      return await res.json();
    } catch (error) {
      console.error("Error fetching workspace:", error);
      return null;
    }
  };

  const fetchScan = async (tenantSlug: string, workspaceId: string, scanId: string): Promise<Scan | null> => {
    try {
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces/scans?slug=${tenantSlug}&workspace_id=${workspaceId}&id=${scanId}`,
        user?.accessToken as string | undefined
      );

      if (!res.ok) {
        console.error("Failed to fetch scan");
        return null;
      }
      return await res.json();
    } catch (error) {
      console.error("Error fetching scan:", error);
      return null;
    }
  };

  const fetchLifecycle = async (tenantSlug: string, workspaceId: string, scanId: string, lifecycleId: string): Promise<Lifecycle | null> => {
    try {
      // First try to get the specific lifecycle by ID
      const res = await fetchWithAuth(
        `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}`,
        user?.accessToken as string | undefined
      );

      if (!res.ok) {
        console.error("Failed to fetch lifecycle");
        return null;
      }

      const data = await res.json();
      
      // Handle both single object and array responses
      if (Array.isArray(data)) {
        const specificLifecycle = data.find(lc => lc.id === lifecycleId);
        return specificLifecycle ? { id: specificLifecycle.id, name: specificLifecycle.name } : null;
      } else if (data && data.id === lifecycleId) {
        return { id: data.id, name: data.name };
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching lifecycle:", error);
      return null;
    }
  };

  useEffect(() => {
    const updateBreadcrumbs = async () => {
      const pathParts = pathname.split('/').filter(Boolean);
      
      // Reset all states first
      setTenant(null);
      setWorkspace(null);
      setScan(null);
      setScanStep(null);
      setLifecycle(null);
      
      // Determine active page based on path length and pattern
      if (pathParts.length === 0 || (pathParts.length === 1 && pathParts[0] === '')) {
        setActivePage('dashboard');
      } else if (pathParts.length === 2 && pathParts[0] === 'tenants') {
        setActivePage('tenant');
      } else if (pathParts.length === 4 && pathParts[0] === 'tenants' && pathParts[2] === 'workspace') {
        setActivePage('workspace');
      } else if (pathParts.length === 6 && pathParts[0] === 'tenants' && pathParts[4] === 'scan') {
        setActivePage('scan');
      } else if (pathParts.length === 8 && pathParts[0] === 'tenants' && pathParts[6] === 'lifecycles') {
        // This is a specific lifecycle page (from /lifecycles/ path)
        setActivePage('lifecycle');
      } else if (pathParts.length === 8 && pathParts[0] === 'tenants' && pathParts[6] === 'pain-points') {
        // This is a specific pain point interview page
        setActivePage('painPointInterview');
      } else if (pathParts.length >= 7 && pathParts[0] === 'tenants' && pathParts[4] === 'scan') {
        setActivePage('scanStep');
      }
      
      if (pathParts.length >= 2 && pathParts[0] === 'tenants') {
        const tenantSlug = pathParts[1];
        const tenantData = await fetchTenant(tenantSlug);
        if (tenantData) {
          setTenant(tenantData);
        }

        if (pathParts.length >= 4 && pathParts[2] === 'workspace') {
          const workspaceId = pathParts[3];
          const workspaceData = await fetchWorkspace(tenantSlug, workspaceId);
          if (workspaceData) {
            setWorkspace(workspaceData);
          }

          if (pathParts.length >= 6 && pathParts[4] === 'scan') {
            const scanId = pathParts[5];
            const scanData = await fetchScan(tenantSlug, workspaceId, scanId);
            if (scanData) {
              setScan(scanData);
            }
            
            // Check if we're on a lifecycle detail page (from /lifecycles/ path)
            if (pathParts.length === 8 && pathParts[6] === 'lifecycles') {
              const lifecycleId = pathParts[7];
              const lifecycleData = await fetchLifecycle(tenantSlug, workspaceId, scanId, lifecycleId);
              if (lifecycleData) {
                setLifecycle(lifecycleData);
              }
              // Set scanStep to "Lifecycles" to show it in the breadcrumb
              setScanStep("Lifecycles");
            }
            // Check if we're on a pain point interview page (from /pain-points/ path)
            else if (pathParts.length === 8 && pathParts[6] === 'pain-points') {
              const lifecycleId = pathParts[7];
              const lifecycleData = await fetchLifecycle(tenantSlug, workspaceId, scanId, lifecycleId);
              if (lifecycleData) {
                setLifecycle(lifecycleData);
              }
              // Set scanStep to "Pain Points" to show it in the breadcrumb
              setScanStep("Pain Points");
            }
            // Check if there's a scan step in the URL (pathParts[6])
            else if (pathParts.length >= 7) {
              const step = pathParts[6];
              // Find the corresponding step name from our defined workflow steps
              const matchedStep = WORKFLOW_STEPS.find(ws => ws.slug === step);
              if (matchedStep) {
                setScanStep(matchedStep.name);
              } else {
                // If not a known step, just use the URL segment converted to title case
                setScanStep(toTitleCase(step));
              }
            }
          }
        }
      }
    };

    updateBreadcrumbs();
  }, [pathname, user?.accessToken]);

  return (
    <nav className="text-sm text-gray-600 pt-5 pb-5 border-b border-gray-200 pl-6">
      <ol className="list-reset flex items-center">
        <li>
          {activePage === 'dashboard' ? (
            <span className="text-gray-500">Dashboard</span>
          ) : (
            <Link href="/" className="text-blue-500 hover:text-blue-700">
              Dashboard
            </Link>
          )}
        </li>
        {tenant && (
          <>
            <li className="mx-2">/</li>
            <li>
              {activePage === 'tenant' ? (
                <span className="text-gray-500">{tenant.name}</span>
              ) : (
                <Link
                  href={`/tenants/${tenant.slug}`}
                  className="text-blue-500 hover:text-blue-700"
                >
                  {tenant.name}
                </Link>
              )}
            </li>
          </>
        )}
        {workspace && tenant && (
          <>
            <li className="mx-2">/</li>
            <li>
              {activePage === 'workspace' ? (
                <span className="text-gray-500">{workspace.name}</span>
              ) : (
                <Link
                  href={`/tenants/${tenant.slug}/workspace/${workspace.id}`}
                  className="text-blue-500 hover:text-blue-700"
                >
                  {workspace.name}
                </Link>
              )}
            </li>
          </>
        )}
        {scan && workspace && tenant && (
          <>
            <li className="mx-2">/</li>
            <li>
              {activePage === 'scan' ? (
                <span className="text-gray-500">{scan.name}</span>
              ) : (
                <Link
                  href={`/tenants/${tenant.slug}/workspace/${workspace.id}/scan/${scan.id}`}
                  className="text-blue-500 hover:text-blue-700"
                >
                  {scan.name}
                </Link>
              )}
            </li>
          </>
        )}
        {scanStep && scan && workspace && tenant && (
          <>
            <li className="mx-2">/</li>
            <li>
              {activePage === 'scanStep' || (activePage !== 'lifecycle' && activePage !== 'painPointInterview') ? (
                <span className="text-gray-500">
                  {scanStep}
                </span>
              ) : (
                <Link
                  href={`/tenants/${tenant.slug}/workspace/${workspace.id}/scan/${scan.id}/${scanStep.toLowerCase().replace(/ /g, '-')}`}
                  className="text-blue-500 hover:text-blue-700"
                >
                  {scanStep}
                </Link>
              )}
            </li>
          </>
        )}
        {lifecycle && (scanStep === "Lifecycles" || scanStep === "Pain Points") && (
          <>
            <li className="mx-2">/</li>
            <li>
              <span className="text-gray-500">
                {lifecycle.name}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
