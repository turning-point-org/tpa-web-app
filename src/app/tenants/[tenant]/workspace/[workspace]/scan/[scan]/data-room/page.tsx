"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import CompanyInfoForm from "@/components/CompanyInfoForm";
import FileUpload from "@/components/FileUpload";
import ChatModal from "@/components/ChatModal";

// List of document types required for the scan workflow
const REQUIRED_DOCUMENT_TYPES = [
  "HRIS Report",
  "Org. Structure",
  "Strategic Objectives",
  "Cost Breakdown",
  "Technology Roadmaps",
  "General Ledger",
  "Data Capability"
];

type CompanyData = {
  name: string;
  website: string;
  country: string;
  industry: string;
  description: string;
};

type DocumentInfo = {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
  file_type?: string;
  content_type?: string;
};

export default function DataRoomPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;
  
  const [companyData, setCompanyData] = useState<CompanyData | undefined>(undefined);
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Load company data
        const companyResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/data-room?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );
        
        if (companyResponse.status === 404) {
          setCompanyData(undefined);
        } else if (companyResponse.ok) {
          const data = await companyResponse.json();
          setCompanyData(data);
        }

        // Load documents
        const documentsResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );
        
        if (documentsResponse.ok) {
          const documents = await documentsResponse.json();
          setUploadedDocuments(documents);
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
    fetch(`/api/tenants/by-slug/workspaces/scans/data-room?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`)
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

  const handleDocumentUploadSuccess = () => {
    // Optional: Trigger a refresh of documents list if you implement that feature
    console.log("Document upload successful");
  };

  const openChat = () => setIsChatOpen(true);
  const closeChat = () => setIsChatOpen(false);

  return (
    <div className="space-y-6 bg-gray-100">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold mb-2">Data Room</h2>
        <button 
          onClick={openChat}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
        >
          Data Room Assistant
        </button>
      </div>
      <p className="text-gray-600 mb-6">
        Capture and manage company information for this scan.
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
        <>
          <CompanyInfoForm 
            initialData={companyData} 
            onSubmitSuccess={handleFormSuccess} 
          />
          
          <div className="my-8">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold mb-2">Documents</h2>
              <span className="text-gray-600 text-sm mb-2">
                ({uploadedDocuments.length} of {REQUIRED_DOCUMENT_TYPES.length} required)
              </span>
            </div>
            <p className="text-gray-600 mb-6">
              Upload and manage documents related to this company.
            </p>
          </div>
          
          <FileUpload 
            title="HRIS Report"
            description="Upload the company's Human Resource Information System report."
            onUploadSuccess={handleDocumentUploadSuccess}
          />
          
          <FileUpload 
            title="Org. Structure"
            description="Upload the company's organizational structure and hierarchy."
            onUploadSuccess={handleDocumentUploadSuccess}
          />
          
          <FileUpload 
            title="Strategic Objectives"
            description="Upload the company's strategic plans and initiatives."
            onUploadSuccess={handleDocumentUploadSuccess}
          />
          
          <FileUpload 
            title="Cost Breakdown"
            description="Upload the detailed cost breakdown with general ledger codes."
            onUploadSuccess={handleDocumentUploadSuccess}
          />
          
          <FileUpload 
            title="Technology Roadmaps"
            description="Upload the company's technology implementation plans and roadmaps."
            onUploadSuccess={handleDocumentUploadSuccess}
          />
          
          <FileUpload 
            title="General Ledger"
            description="Upload the company's general ledger reports and financial records."
            onUploadSuccess={handleDocumentUploadSuccess}
          />
          
          <FileUpload 
            title="Data Capability"
            description="Upload documentation about the company's data processing capabilities and infrastructure."
            onUploadSuccess={handleDocumentUploadSuccess}
          />

          {/* Chat Modal */}
          <ChatModal 
            isOpen={isChatOpen} 
            onClose={closeChat} 
            scanId={scanId}
            tenantSlug={tenantSlug}
            workspaceId={workspaceId}
          />
        </>
      )}
    </div>
  );
} 