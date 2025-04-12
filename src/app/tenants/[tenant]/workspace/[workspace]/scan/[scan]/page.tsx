import { redirect } from 'next/navigation';

interface ScanOverviewPageProps {
  params: {
    tenant: string;
    workspace: string;
    scan: string;
  };
}

export default function ScanOverviewPage({ params }: ScanOverviewPageProps) {
  const { tenant, workspace, scan } = params;
  
  // Redirect to the first workflow step ("company-details")
  redirect(`/tenants/${tenant}/workspace/${workspace}/scan/${scan}/company-details`);
} 