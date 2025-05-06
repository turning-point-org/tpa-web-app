"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import UserProfile from "@/components/UserProfile";
import TenantSwitcher from "@/components/TenantSwitcher";
import WorkflowNav from "@/app/tenants/[tenant]/workspace/[workspace]/scan/[scan]/components/WorkflowNav";
import { useUser } from "@auth0/nextjs-auth0/client";
import { AuthenticationError } from "@/utils/api";

interface SidebarProps {
  onCollapsedChange?: (collapsed: boolean) => void;
}

export default function Sidebar({ onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const isScanPage = pathname?.includes("/scan/");
  const [scanData, setScanData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    async function fetchScanData() {
      if (!isScanPage || !user) {
        setIsLoading(false);
        return;
      }

      try {
        // Extract tenant, workspace, and scan IDs from the pathname
        const pathParts = pathname.split("/");
        const tenantIndex = pathParts.findIndex(part => part === "tenants") + 1;
        
        if (tenantIndex < 1 || pathParts.length < tenantIndex + 5) {
          setIsLoading(false);
          return;
        }
        
        const tenant = pathParts[tenantIndex];
        const workspace = pathParts[tenantIndex + 2];
        const scan = pathParts[tenantIndex + 4];
        
        const res = await fetch(
          `/api/tenants/by-slug/workspaces/scans?slug=${tenant}&workspace_id=${workspace}&id=${scan}`,
          { cache: "no-store" }
        );
        
        if (!res.ok) {
          throw new Error("Failed to fetch scan data");
        }
        
        const data = await res.json();
        setScanData(data);
      } catch (error) {
        // Handle authentication errors gracefully
        if (error instanceof AuthenticationError) {
          console.log("Authentication required for scan data fetch - this is expected when not logged in");
        } else {
          console.error("Error fetching scan data:", error);
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchScanData();
  }, [pathname, isScanPage, user]);

  const toggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    // Notify parent component if callback exists
    if (onCollapsedChange) {
      onCollapsedChange(newCollapsedState);
    }
  };

  return (
    <aside className={`fixed top-0 left-0 ${isCollapsed ? 'w-20' : 'w-80'} h-screen flex flex-col bg-[var(--color-secondary)] border-r border-[var(--color-border)] ${isCollapsed ? 'p-2' : 'p-6'} shadow-sm z-[10] transition-all duration-300`}>
      <div className="flex-1 scrollable overflow-y-auto">
        {!isCollapsed && (
          <Link href="/" className="block mb-10">
            <Image
              src="/turning-point-logo.svg"
              alt="TurningPoint Logo"
              width={150}
              height={40}
              priority
            />
          </Link>
        )}
        <nav>
          {!isCollapsed && <TenantSwitcher />}
        </nav>
        {isScanPage && !isLoading && (
          <div className={`${isCollapsed ? 'mt-4' : 'mt-8'}`}>
            <WorkflowNav isSidebar scanData={scanData} isCollapsed={isCollapsed} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <UserProfile isCollapsed={isCollapsed} />
      </div>
      
      <button
        onClick={toggleCollapse}
        className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 shadow-sm absolute top-1/2 -right-3 transform -translate-y-1/2 z-20"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="#291841"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </aside>
  );
} 