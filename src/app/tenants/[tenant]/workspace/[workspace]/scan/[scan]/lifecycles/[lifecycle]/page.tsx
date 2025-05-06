"use client";

import { useParams, useRouter } from "next/navigation";
import LifecycleViewer from "@/components/LifecycleViewer";

export default function LifecycleProcessesPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;
  const lifecycleId = params.lifecycle as string;

  const handleBackClick = () => {
    router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/lifecycles`);
  };

  if (!tenantSlug || !workspaceId || !scanId || !lifecycleId) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-gray-500">Loading parameters...</div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <LifecycleViewer 
        tenantSlug={tenantSlug}
        workspaceId={workspaceId}
        scanId={scanId}
        lifecycleId={lifecycleId}
        onBackClick={handleBackClick}
        initialHeight="calc(100vh - 100px)"
      />
    </div>
  );
} 