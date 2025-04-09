interface ScanOverviewPageProps {
  params: {
    tenant: string;
    workspace: string;
    scan: string;
  };
}

export default async function ScanOverviewPage({ params }: ScanOverviewPageProps) {
  const { tenant, workspace, scan } = await Promise.resolve(params);

  const res = await fetch(
    `${process.env.BASE_URL}/api/tenants/by-slug/workspaces/scans?slug=${tenant}&workspace_id=${workspace}&id=${scan}`,
    { cache: "no-store" }
  );
  
  const scanData = await res.json();
  
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Scan Overview</h2>
      
      <div className="mb-6 bg-gray-50 p-4 rounded-md border border-gray-200">
        <h3 className="text-md font-medium mb-2">Description</h3>
        <p className="text-gray-700">
          {scanData.description || "No description available."}
        </p>
      </div>
      
      <p>Welcome to the scan dashboard. Use the navigation above to explore different aspects of this scan.</p>
    </div>
  );
} 