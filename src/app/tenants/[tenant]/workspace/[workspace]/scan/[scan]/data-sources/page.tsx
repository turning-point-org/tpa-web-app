"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import FileUpload from "@/components/FileUpload";
import Modal from "@/components/Modal";

type DocumentInfo = {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
  file_type?: string;
  content_type?: string;
  status?: string;
  title?: string;
  description?: string;
};

export default function DataSourcesPage() {
  const router = useRouter();
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;
  
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentInfo[]>([]);
  const [requiredDocumentTypes, setRequiredDocumentTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isGeneratingLifecycles, setIsGeneratingLifecycles] = useState(false);
  const [lifecyclesExist, setLifecyclesExist] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Load documents
        const documentsResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );
        
        if (documentsResponse.ok) {
          const documents = await documentsResponse.json();
          setUploadedDocuments(documents);
          
          // Extract unique document types to determine required types
          const documentTypes = Array.from(new Set(
            documents.map((doc: DocumentInfo) => doc.document_type)
          )).filter(Boolean) as string[];
          
          setRequiredDocumentTypes(documentTypes);
        }

        // Check if lifecycles exist
        const lifecyclesResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );
        
        if (lifecyclesResponse.ok) {
          const lifecycles = await lifecyclesResponse.json();
          setLifecyclesExist(lifecycles && lifecycles.length > 0);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while loading data");
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [tenantSlug, workspaceId, scanId]);

  // Helper function to get document by type
  const getDocumentByType = (type: string): DocumentInfo | undefined => {
    return uploadedDocuments.find(doc => doc.document_type === type);
  };

  const handleDocumentUploadSuccess = async (documentTitle?: string) => {
    try {
      // Refresh the documents list
      const documentsResponse = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
      );
      
      if (documentsResponse.ok) {
        const documents = await documentsResponse.json();
        setUploadedDocuments(documents);
        
        // Refresh document types
        const documentTypes = Array.from(new Set(
          documents.map((doc: DocumentInfo) => doc.document_type)
        )).filter(Boolean) as string[];
        
        setRequiredDocumentTypes(documentTypes);
        
        // Find the newest document (for event)
        if (documents && documents.length > 0) {
          // Sort by created_at/uploaded_at descending
          const sortedDocs = [...documents].sort((a, b) => {
            const dateA = new Date(a.uploaded_at || a.created_at);
            const dateB = new Date(b.uploaded_at || b.created_at);
            return dateB.getTime() - dateA.getTime();
          });
          
          // Find the document that matches the title
          let documentToSend = sortedDocs[0];
          
          // If documentTitle is provided, try to find the matching document
          if (documentTitle) {
            const matchingDoc = documents.find((doc: DocumentInfo) => 
              doc.document_type === documentTitle || 
              doc.title === documentTitle
            );
            
            if (matchingDoc) {
              documentToSend = matchingDoc;
            } else {
              // If not found, enrich the newest document with the correct title
              documentToSend = {
                ...sortedDocs[0],
                document_type: documentTitle,
                title: documentTitle
              };
            }
          }
          
          // Log the document that will be sent in the event
          console.log('About to dispatch document change event with document:', {
            id: documentToSend?.id,
            document_type: documentToSend?.document_type,
            title: documentToSend?.title,
            file_name: documentToSend?.file_name
          });
          
          // Dispatch a custom event that Ora can listen for
          const customEvent = new CustomEvent('ora-document-change', { 
            detail: { 
              action: 'added',
              document: documentToSend,
              scanId: scanId
            } 
          });
          window.dispatchEvent(customEvent);
        }
      }
    } catch (err) {
      console.error("Error refreshing documents:", err);
    }
  };

  const handleDocumentDeleteSuccess = async (documentInfo?: DocumentInfo) => {
    try {
      // Refresh the documents list
      const documentsResponse = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
      );
      
      if (documentsResponse.ok) {
        const documents = await documentsResponse.json();
        setUploadedDocuments(documents);
        
        // Refresh document types
        const documentTypes = Array.from(new Set(
          documents.map((doc: DocumentInfo) => doc.document_type)
        )).filter(Boolean) as string[];
        
        setRequiredDocumentTypes(documentTypes);
        
        // Dispatch a custom event that Ora can listen for
        const customEvent = new CustomEvent('ora-document-change', { 
          detail: { 
            action: 'removed',
            // Include document information if available
            document: documentInfo || undefined,
            scanId: scanId
          } 
        });
        window.dispatchEvent(customEvent);
      }
    } catch (err) {
      console.error("Error refreshing documents:", err);
    }
  };

  const handleDocumentReplaceSuccess = async (documentTitle?: string) => {
    try {
      // Refresh the documents list
      const documentsResponse = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
      );
      
      if (documentsResponse.ok) {
        const documents = await documentsResponse.json();
        setUploadedDocuments(documents);
        
        // Find the newest document (for event)
        if (documents && documents.length > 0) {
          // Sort by created_at/uploaded_at descending
          const sortedDocs = [...documents].sort((a, b) => {
            const dateA = new Date(a.uploaded_at || a.created_at);
            const dateB = new Date(b.uploaded_at || b.created_at);
            return dateB.getTime() - dateA.getTime();
          });
          
          // Find the document that matches the title
          let documentToSend = sortedDocs[0];
          
          // If documentTitle is provided, try to find the matching document
          if (documentTitle) {
            const matchingDoc = documents.find((doc: DocumentInfo) => 
              doc.document_type === documentTitle || 
              doc.title === documentTitle
            );
            
            if (matchingDoc) {
              documentToSend = matchingDoc;
            } else {
              // If not found, enrich the newest document with the correct title
              documentToSend = {
                ...sortedDocs[0],
                document_type: documentTitle,
                title: documentTitle
              };
            }
          }
          
          // Log the document that will be sent in the event
          console.log('About to dispatch document replace event with document:', {
            id: documentToSend?.id,
            document_type: documentToSend?.document_type,
            title: documentToSend?.title,
            file_name: documentToSend?.file_name
          });
          
          // Dispatch a custom event that Ora can listen for
          const customEvent = new CustomEvent('ora-document-change', { 
            detail: { 
              action: 'replaced',
              document: documentToSend,
              scanId: scanId
            } 
          });
          window.dispatchEvent(customEvent);
        }
      }
    } catch (err) {
      console.error("Error refreshing documents:", err);
    }
  };

  const initiateGenerateLifecycles = () => {
    if (lifecyclesExist) {
      setShowConfirmModal(true);
    } else {
      handleGenerateLifecycles();
    }
  };

  const handleGenerateLifecycles = async () => {
    try {
      setIsGeneratingLifecycles(true);
      setShowConfirmModal(false);
      
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/generate-lifecycles`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            workspace_id: workspaceId,
            scan_id: scanId
          }),
        }
      );

      if (response.ok) {
        // Get the generated lifecycles data
        const data = await response.json();
        const lifecycles = data.lifecycles || [];
        
        // For the initial generation, we'll let the lifecycles page handle the notification
        // to avoid duplicate notifications. We'll just redirect with the 'from=generation' param.
        
        // Navigate to lifecycles page with the parameter
        router.push(`/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/lifecycles?from=generation`);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Failed to generate lifecycles");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while generating lifecycles");
    } finally {
      setIsGeneratingLifecycles(false);
    }
  };

  // Check if all required documents are uploaded
  const allDocumentsUploaded = requiredDocumentTypes.length > 0 && 
    requiredDocumentTypes.every(docType => 
      uploadedDocuments.some(doc => 
        doc.document_type === docType && doc.status !== "placeholder"
      )
    );
  
  // Count valid uploaded documents (not in pending status)
  const validUploadedDocumentsCount = uploadedDocuments.filter(doc => 
    doc.status !== "pending" && doc.status !== "placeholder" && doc.file_url
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <h2 className="text-2xl font-semibold mb-2">Data Sources</h2>
          <span className="text-gray-600 text-sm mb-1 ml-2">
            ({validUploadedDocumentsCount} of {requiredDocumentTypes.length} required)
          </span>
        </div>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          disabled={!allDocumentsUploaded || isGeneratingLifecycles || requiredDocumentTypes.length === 0}
          onClick={initiateGenerateLifecycles}
        >
          {isGeneratingLifecycles ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              <span>Generating</span>
            </>
          ) : (
            lifecyclesExist ? 'Regenerate Lifecycles' : 'Generate Lifecycles'
          )}
        </button>
      </div>
      <p className="text-gray-600 mb-6">
        Upload and manage documents related to this company.
      </p>
      
      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
      >
        <h3 className="text-lg font-bold mb-4">Confirm Regeneration</h3>
        <div className="mb-6">
          <p className="text-red-600 font-semibold mb-2">Warning</p>
          <p className="mb-4">
            This will replace all current lifecycles and any changes made to them.
          </p>
        </div>
        <div className="flex justify-end space-x-2">
          <button 
            className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
            onClick={() => setShowConfirmModal(false)}
          >
            Cancel
          </button>
          <button 
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            onClick={handleGenerateLifecycles}
          >
            Confirm
          </button>
        </div>
      </Modal>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      ) : requiredDocumentTypes.length === 0 ? (
        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg">
          No document types found. Please contact your administrator to configure document types for this scan.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">            
          {requiredDocumentTypes.map((docType) => {
            const document = getDocumentByType(docType);
            return (
              <FileUpload 
                key={docType}
                title={docType}
                description={document?.description || ""}
                onUploadSuccess={(title?: string) => handleDocumentUploadSuccess(title)}
                onDeleteSuccess={(documentInfo?: DocumentInfo) => handleDocumentDeleteSuccess(documentInfo)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
} 