import { redirect } from 'next/navigation';

interface ScanOverviewPageProps {
  params: Promise<{
    tenant: string;
    workspace: string;
    scan: string;
  }>;
}

export default async function ScanOverviewPage({ params }: ScanOverviewPageProps) {
  const resolvedParams = await params;
  const { tenant, workspace, scan } = resolvedParams;
  
  // Redirect to the first workflow step ("company-details")
  redirect(`/tenants/${tenant}/workspace/${workspace}/scan/${scan}/company-details`);
} 