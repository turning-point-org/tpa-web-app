"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import UserProfile from "@/components/UserProfile";
import TenantSwitcher from "@/components/TenantSwitcher";
import WorkflowNav from "@/app/tenants/[tenant]/workspace/[workspace]/scan/[scan]/components/WorkflowNav";

export default function Sidebar() {
  const pathname = usePathname();
  const isScanPage = pathname?.includes("/scan/");
  const [scanData, setScanData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchScanData() {
      if (!isScanPage) {
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
        console.error("Error fetching scan data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchScanData();
  }, [pathname, isScanPage]);

  return (
    <aside className="fixed top-0 left-0 w-80 h-screen flex flex-col bg-[var(--color-secondary)] border-r border-[var(--color-border)] p-6 shadow-sm z-[10]">
      <div className="flex-1 scrollable overflow-y-auto">
        <Link href="/" className="block mb-10">
          <Image
            src="/turning-point-logo.svg"
            alt="TurningPoint Logo"
            width={150}
            height={40}
            priority
          />
        </Link>
        <nav>
          <TenantSwitcher />
        </nav>
        {isScanPage && !isLoading && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-4">Workflow Steps</h2>
            <WorkflowNav isSidebar scanData={scanData} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <UserProfile />
      </div>
    </aside>
  );
} 