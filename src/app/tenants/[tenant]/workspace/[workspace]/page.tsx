import { notFound } from "next/navigation";
import ScanManager from "@/components/ScanManager";

interface WorkspacePageProps {
  params: {
    tenant: string;
    workspace: string;
  };
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { tenant, workspace } = await Promise.resolve(params);

  const res = await fetch(
    `${process.env.BASE_URL}/api/tenants/by-slug/workspaces?slug=${tenant}&id=${workspace}`,
    { cache: "no-store" }
  );
  if (!res.ok) return notFound();

  const workspaceData = await res.json();

  return (
    <div className="mx-auto pr-5 pl-5" style={{ 
      backgroundImage: "url('/assets/tpa-background.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      minHeight: "100vh"
    }}>
      <div className="max-w-[1200px] mx-auto pt-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-700">
            {workspaceData.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Description: {workspaceData.description || "No description available."}
          </p>
        </div>
        <ScanManager tenantSlug={tenant} workspaceId={workspace} />
      </div>
    </div>
  );
}
