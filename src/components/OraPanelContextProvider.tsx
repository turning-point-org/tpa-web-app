"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import OraPanel from './OraPanel';
import OraInterviewPanel from './OraInterviewPanel';

interface OraPanelProviderProps {
  tenantSlug: string;
  workspaceId: string;
  scanId: string;
}

export default function OraPanelContextProvider({ 
  tenantSlug, 
  workspaceId, 
  scanId 
}: OraPanelProviderProps) {
  // Track the current panel context
  const [panelContext, setPanelContext] = useState<'default' | 'pain-point-interview'>('default');
  const [lifecycleId, setLifecycleId] = useState<string | null>(null);
  const [lifecycleName, setLifecycleName] = useState<string | null>(null);
  const pathname = usePathname();

  // Listen for context change events
  useEffect(() => {
    const handleContextChange = (event: CustomEvent) => {
      const { context, lifecycleId, lifecycleName } = event.detail;
      console.log('OraPanel context change event:', context, lifecycleId, lifecycleName);
      
      if (context === 'pain-point-interview' && lifecycleId) {
        setPanelContext('pain-point-interview');
        setLifecycleId(lifecycleId);
        setLifecycleName(lifecycleName || null);
      } else {
        setPanelContext('default');
        setLifecycleId(null);
        setLifecycleName(null);
      }
    };

    // Add the event listener
    window.addEventListener('ora-context-change', handleContextChange as EventListener);

    // Clean up the event listener
    return () => {
      window.removeEventListener('ora-context-change', handleContextChange as EventListener);
    };
  }, []);

  // Also check the URL path to detect pain points context
  useEffect(() => {
    // Check if we're in a pain point route
    if (pathname?.includes('/pain-points/')) {
      // Extract lifecycle ID from path if available
      const match = pathname.match(/\/pain-points\/([^\/]+)/);
      if (match && match[1]) {
        setLifecycleId(match[1]);
        setPanelContext('pain-point-interview');
        // Note: When detecting from URL, we won't have the lifecycle name
        // It will be fetched from the API in the OraInterviewPanel component
      }
    } else {
      // Reset to default panel for non pain-point routes
      setPanelContext('default');
      setLifecycleId(null);
      setLifecycleName(null);
    }
  }, [pathname]);

  // Render the appropriate panel based on context
  if (panelContext === 'pain-point-interview' && lifecycleId) {
    return (
      <OraInterviewPanel
        tenantSlug={tenantSlug}
        workspaceId={workspaceId}
        scanId={scanId}
        lifecycleId={lifecycleId}
        lifecycleName={lifecycleName} // Pass the lifecycle name to the panel
      />
    );
  }

  // Default OraPanel
  return (
    <OraPanel
      tenantSlug={tenantSlug}
      workspaceId={workspaceId}
      scanId={scanId}
    />
  );
} 