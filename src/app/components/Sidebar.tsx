"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import UserProfile from "@/components/UserProfile";
import TenantSwitcher from "@/components/TenantSwitcher";
import WorkflowNav from "@/app/tenants/[tenant]/workspace/[workspace]/scan/[scan]/components/WorkflowNav";

export default function Sidebar() {
  const pathname = usePathname();
  const isScanPage = pathname?.includes("/scan/");

  return (
    <aside className="fixed top-0 left-0 w-80 h-screen flex flex-col bg-[var(--color-secondary)] border-r border-[var(--color-border)] p-6 shadow-sm z-[10]">
      <div>
        <Link href="/" className="block mb-10">
          <Image
            src="/novigi-logo.svg"
            alt="Novigi Logo"
            width={150}
            height={40}
            priority
          />
        </Link>
        <nav>
          <TenantSwitcher />
        </nav>
      </div>
      {isScanPage && (
        <div className="mt-8">
          {/* <h2 className="text-sm font-semibold text-gray-500 mb-4">Workflow Steps</h2> */}
          <WorkflowNav isSidebar />
        </div>
      )}
      <div className="mt-auto">
        <UserProfile />
      </div>
    </aside>
  );
} 