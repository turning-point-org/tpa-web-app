"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import CompanyInfoForm from "@/components/CompanyInfoForm";

type CompanyData = {
  name: string;
  website: string;
  country: string;
  industry: string;
  description: string;
};

export default function CompanyDetailsPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;
  
  const [companyData, setCompanyData] = useState<CompanyData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        // Load company data
        const companyResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/company-details?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );
        
        if (companyResponse.status === 404) {
          setCompanyData(undefined);
        } else if (companyResponse.ok) {
          const data = await companyResponse.json();
          setCompanyData(data);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while loading data");
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [tenantSlug, workspaceId, scanId]);

  const handleFormSuccess = () => {
    // Reload company data after successful update
    setIsLoading(true);
    fetch(`/api/tenants/by-slug/workspaces/scans/company-details?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`)
      .then(res => {
        if (res.status === 404) {
          setCompanyData(undefined);
          setIsLoading(false);
          return null;
        }
        if (!res.ok) {
          throw new Error("Failed to reload company information");
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setCompanyData(data);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  return (
    <div>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold mb-2">Company Details</h2>
      </div>
      <p className="text-gray-600 mb-6">
        Enter and manage company information for this scan.
      </p>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      ) : (
        <CompanyInfoForm 
          initialData={companyData} 
          onSubmitSuccess={handleFormSuccess} 
        />
      )}
    </div>
  );
} 