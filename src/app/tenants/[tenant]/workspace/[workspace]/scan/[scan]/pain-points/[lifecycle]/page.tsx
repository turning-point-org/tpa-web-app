"use client";

import { useParams, useRouter } from "next/navigation";
import LifecycleViewer from "@/components/LifecycleViewer";
import Button from "@/components/Button"; // Import button if needed for fallbacks

export default function PainPointLifecycleInterviewPage() {
  const params = useParams();
  const router = useRouter();
  
  // Extract parameters, ensuring they are strings
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;
  const lifecycleId = params.lifecycle as string; // Get lifecycle ID from dynamic route segment

  // Handler for the back button within LifecycleViewer
  const handleBackToPainPoints = () => {
    router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/pain-points`);
  };

  // Basic check to ensure all required parameters are present
  if (!tenantSlug || !workspaceId || !scanId || !lifecycleId) {
    // Return a loading or error state if parameters are missing
    // This might happen during initial render or if URL is invalid
    return (
      <div className="flex flex-col justify-center items-center h-screen p-6">
        <div className="text-gray-500 mb-4">Loading interview details or invalid URL...</div>
        <Button onClick={() => router.back()} variant="secondary">
          Go Back
        </Button>
      </div>
    );
  }

  // Render the LifecycleViewer with the correct props
  // The OraInterviewPanel will be handled automatically by the context providers
  return (
    <div className="h-full"> 
      <LifecycleViewer 
        tenantSlug={tenantSlug}
        workspaceId={workspaceId}
        scanId={scanId}
        lifecycleId={lifecycleId}
        onBackClick={handleBackToPainPoints}
        initialHeight="calc(100vh - 100px)"
        isPainPointContext={true}
      />
    </div>
  );
} 