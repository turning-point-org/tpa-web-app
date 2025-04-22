'use client';

import { notFound } from "next/navigation";
import { WorkflowNavButtons } from "./components/WorkflowNav";
import OraPanel from "@/components/OraPanel";
import { useEffect, useState } from "react";
import { use } from "react";

interface ScanLayoutProps {
  children: React.ReactNode;
  params: any; // Allow for Promise
}

interface UnwrappedParams {
  tenant: string;
  workspace: string;
  scan: string;
}

export default function ScanLayout({ children, params }: ScanLayoutProps) {
  // Unwrap params using React.use()
  const unwrappedParams = use(params) as UnwrappedParams;
  const tenant = unwrappedParams.tenant;
  const workspace = unwrappedParams.workspace;
  const scan = unwrappedParams.scan;
  
  const [scanData, setScanData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  
  // Watch for the CSS variable changes
  useEffect(() => {
    const checkPanelState = () => {
      const expandedValue = document.documentElement.style.getPropertyValue('--ora-panel-expanded');
      setIsPanelExpanded(expandedValue === 'true');
    };
    
    // Initialize
    checkPanelState();
    
    // Set up a small interval to check the CSS variable
    // This is more reliable than MutationObserver in this case
    const intervalId = setInterval(checkPanelState, 200);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Fetch scan data
  useEffect(() => {
    async function fetchScanData() {
      try {
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
  }, [tenant, workspace, scan]);
  
  if (isLoading) {
    return <div className="flex min-h-screen justify-center items-center">Loading...</div>;
  }
  
  if (!scanData) {
    return notFound();
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className={`flex-1 min-w-0 mt-5 transition-all duration-300 ${isPanelExpanded ? 'pr-[670px]' : 'pr-18'}`}>
        <div className="mx-auto">
          <div className="p-6">
            {children}
            {/* <WorkflowNavButtons /> */}
          </div>
        </div>
      </div>
      <OraPanel
        scanId={scan}
        tenantSlug={tenant}
        workspaceId={workspace}
      />
    </div>
  );
} 