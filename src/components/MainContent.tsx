"use client";

import { usePathname } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";

interface MainContentProps {
  children: React.ReactNode;
  sidebarCollapsed?: boolean;
}

export default function MainContent({ children, sidebarCollapsed = false }: MainContentProps) {
  const pathname = usePathname();
  const isFullWidthView = pathname?.includes('/lifecycles/') || pathname?.includes('/pain-points/');
  
  return (
    <main className={`flex-grow ${sidebarCollapsed ? 'ml-20' : 'ml-80'} h-screen bg-gray-100 transition-all duration-300 overflow-x-hidden max-w-full`}>
      <div className={`w-full mx-auto h-full max-w-full ${isFullWidthView ? '' : 'scrollable'}`}>
        <Breadcrumbs />
        <div className={isFullWidthView ? 'h-[calc(100%-48px)]' : ''}>
          {children}
        </div>
      </div>
    </main>
  );
} 