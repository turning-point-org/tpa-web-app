"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSidebarCollapse = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
  };

  return (
    <>
      <Sidebar onCollapsedChange={handleSidebarCollapse} />
      <MainContent sidebarCollapsed={sidebarCollapsed}>{children}</MainContent>
    </>
  );
} 