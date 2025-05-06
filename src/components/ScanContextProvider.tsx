"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useParams, usePathname } from 'next/navigation';
import OraPanelContextProvider from './OraPanelContextProvider';

// Define the context type
interface ScanContextType {
  tenantSlug: string | null;
  workspaceId: string | null;
  scanId: string | null;
  isInScan: boolean;
}

// Create the context with default values
const ScanContext = createContext<ScanContextType>({
  tenantSlug: null,
  workspaceId: null,
  scanId: null,
  isInScan: false
});

// Export a hook for easy context consumption
export const useScanContext = () => useContext(ScanContext);

interface ScanContextProviderProps {
  children: ReactNode;
}

export function ScanContextProvider({ children }: ScanContextProviderProps) {
  const params = useParams();
  const pathname = usePathname();
  
  const [contextValue, setContextValue] = useState<ScanContextType>({
    tenantSlug: null,
    workspaceId: null,
    scanId: null,
    isInScan: false
  });

  // Update the context value when URL parameters change
  useEffect(() => {
    // Extract scan-related parameters from the URL
    const tenantSlug = params?.tenant as string || null;
    const workspaceId = params?.workspace as string || null;
    const scanId = params?.scan as string || null;
    
    // Check if we're inside a scan based on the URL path
    const isInScan = Boolean(tenantSlug && workspaceId && scanId && 
      pathname?.includes(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}`));
    
    setContextValue({
      tenantSlug,
      workspaceId,
      scanId,
      isInScan
    });
    
  }, [params, pathname]);

  return (
    <ScanContext.Provider value={contextValue}>
      {children}
      
      {/* Conditionally render the OraPanelContextProvider if we're in a scan */}
      {contextValue.isInScan && contextValue.tenantSlug && contextValue.workspaceId && contextValue.scanId && (
        <OraPanelContextProvider
          tenantSlug={contextValue.tenantSlug}
          workspaceId={contextValue.workspaceId}
          scanId={contextValue.scanId}
        />
      )}
    </ScanContext.Provider>
  );
} 