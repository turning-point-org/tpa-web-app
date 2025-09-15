import { notFound } from "next/navigation";
import WorkspaceManager from "@/components/WorkspaceManager";
import TenantHeader from "@/components/TenantHeader";
import TenantPageClient from "./TenantPageClient";

interface TenantPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function TenantPage({ params }: TenantPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.tenant;

  const res = await fetch(`${process.env.BASE_URL}/api/tenants/by-slug?slug=${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return notFound();

  const tenant = await res.json();

  return (
    <div className="mx-auto pr-5 pl-5" style={{ 
      backgroundImage: "url('/assets/tpa-background.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      minHeight: "100vh"
    }}>
      <div className="max-w-[1200px] mx-auto pt-16">
        <TenantHeader tenant={tenant} />
        <TenantPageClient tenant={tenant} />
        <WorkspaceManager tenantSlug={tenant.slug} />
      </div>
    </div>
  );
}
