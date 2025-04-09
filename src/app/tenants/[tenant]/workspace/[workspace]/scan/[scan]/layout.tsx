import { notFound } from "next/navigation";
import WorkflowNav from "./components/WorkflowNav";
import { WorkflowNavButtons } from "./components/WorkflowNav";

interface ScanLayoutProps {
  children: React.ReactNode;
  params: {
    tenant: string;
    workspace: string;
    scan: string;
  };
}

export default async function ScanLayout({ children, params }: ScanLayoutProps) {
  const { tenant, workspace, scan } = await Promise.resolve(params);

  const res = await fetch(
    `${process.env.BASE_URL}/api/tenants/by-slug/workspaces/scans?slug=${tenant}&workspace_id=${workspace}&id=${scan}`,
    { cache: "no-store" }
  );
  if (!res.ok) return notFound();

  const scanData = await res.json();

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-700">
            {scanData.name}
          </h1>
          <span
            className={`px-2 py-1 rounded ${
              scanData.status === "done"
                ? "bg-green-100 text-green-800"
                : scanData.status === "active"
                ? "bg-blue-100 text-blue-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {scanData.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Created: {new Date(scanData.created_at).toLocaleString()}
        </p>
      </div>
      
      <WorkflowNav />
      
      <div className="bg-gray-100 p-6 rounded-lg shadow-sm">
        {children}
        <WorkflowNavButtons />
      </div>
    </div>
  );
} 