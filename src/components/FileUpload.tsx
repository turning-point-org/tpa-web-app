"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Modal from "@/components/Modal";

type FileUploadProps = {
  title: string;
  description?: string;
  allowedTypes?: string[];
  onUploadSuccess?: (title?: string) => void;
  onDeleteSuccess?: (documentInfo?: DocumentInfo) => void;
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
  summary?: string;
  summarization_prompt?: string;
  status?: string;
};

// Helper function to get file type description
const getFileTypeDescription = (mimeType: string): string => {
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/csv': 'CSV',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  };
  
  return typeMap[mimeType] || mimeType;
};

// Helper function to extract file extension from filename
const getFileExtensionFromFilename = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  // Map common extensions to readable format
  const extensionMap: Record<string, string> = {
    'pdf': 'PDF',
    'csv': 'CSV',
    'xls': 'Excel',
    'xlsx': 'Excel'
  };
  
  return extensionMap[extension] || extension.toUpperCase();
};

export default function FileUpload({
  title,
  description = "",
  allowedTypes = [
    "application/pdf", 
    "text/csv", 
    "application/vnd.ms-excel", 
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ],
  onUploadSuccess,
  onDeleteSuccess,
}: FileUploadProps) {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;
  
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [existingDocument, setExistingDocument] = useState<DocumentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  
  // New state for summarization prompt
  const [showSummarizationModal, setShowSummarizationModal] = useState(false);
  const [summarizationPrompt, setSummarizationPrompt] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [promptSaveSuccess, setPromptSaveSuccess] = useState(false);
  
  // State for summary modal
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summary, setSummary] = useState("");
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [summarySaveSuccess, setSummarySaveSuccess] = useState(false);
  
  const [documentDescription, setDocumentDescription] = useState(description);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Remove polling states
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const maxPollAttempts = 20; // Maximum number of polling attempts
  const pollInterval = 3000; // Poll every 3 seconds
  
  // Add a new function to fetch document data
  const fetchDocumentData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&document_type=${encodeURIComponent(title)}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch document information");
      }
      
      const data = await response.json();
      if (data && data.length > 0) {
        // There is an existing document
        const doc = data[0];
        
        // Ensure all fields exist to avoid rendering issues
        setExistingDocument({
          id: doc.id || "",
          document_type: doc.document_type || "",
          file_name: doc.file_name || "",
          file_url: doc.file_url || "",
          file_size: doc.file_size || 0,
          uploaded_at: doc.created_at || doc.updated_at || new Date().toISOString(),
          summary: doc.summary || "",
          summarization_prompt: doc.summarization_prompt || "",
          status: doc.status || "pending"
        });
        
        // Initialize the summary state
        setSummary(doc.summary || "");
        
        // Initialize the summarization prompt state
        setSummarizationPrompt(doc.summarization_prompt || getDefaultSummarizationPrompt(title));
        
        // Set document description if available
        if (doc.description) {
          setDocumentDescription(doc.description);
        }
        
        // Only set the uploaded file URL if the file has been uploaded
        if (doc.file_url && doc.status === "uploaded") {
          setUploadedFileUrl(doc.file_url);
        }
      } else {
        // No document yet, but we can still set a default summarization prompt
        setSummarizationPrompt(getDefaultSummarizationPrompt(title));
      }
    } catch (err) {
      console.error("Error fetching document:", err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch existing document on component mount
  useEffect(() => {
    fetchDocumentData();
  }, [tenantSlug, workspaceId, scanId, title]);
  
  // Get a default summarization prompt based on document type
  const getDefaultSummarizationPrompt = (documentType: string): string => {
    const defaultPrompts: Record<string, string> = {
      "HRIS Report": "Focus on extracting key information about employee roles, departments, reporting structures, and headcount metrics. Identify organizational patterns and employee distribution.",
      "Org. Structure": "Analyze the organizational hierarchy, reporting relationships, and departmental structures. Identify key leadership positions and span of control.",
      "Strategic Objectives": "Extract the company's mission, vision, strategic goals, key performance indicators, and priority initiatives. Focus on timeframes and success metrics.",
      "Cost Breakdown": "Summarize major expense categories, cost centers, budget allocations, and spending patterns. Highlight significant financial insights and trends.",
      "Technology Roadmaps": "Identify current technology systems, planned implementations, integration points, and timelines. Focus on strategic technology initiatives and dependencies.",
      "General Ledger": "Extract financial accounts, transaction categories, revenue streams, and expense patterns. Identify financial reporting structures and accounting practices.",
      "Data Capability": "Summarize data assets, data management practices, analytics capabilities, and data governance structures. Identify data flows and integration points."
    };
    
    return defaultPrompts[documentType] || 
      "Provide a comprehensive summary of this document, focusing on key information relevant to business processes, operations, and organizational structure.";
  };
  
  // Handle saving the summarization prompt
  const handleSavePrompt = async () => {
    if (!summarizationPrompt) return;
    
    setIsSavingPrompt(true);
    setError("");
    
    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents/summarization-prompt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            workspace_id: workspaceId,
            scan_id: scanId,
            document_type: title,
            document_id: existingDocument?.id,
            summarization_prompt: summarizationPrompt,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save summarization prompt");
      }
      
      // Update the document with the new prompt
      if (existingDocument) {
        setExistingDocument({
          ...existingDocument,
          summarization_prompt: summarizationPrompt,
        });
      }
      
      // Show success message
      setPromptSaveSuccess(true);
      setTimeout(() => setPromptSaveSuccess(false), 3000);
      
      // Close the modal
      setShowSummarizationModal(false);
    } catch (err: any) {
      setError(err.message || "An error occurred while saving the summarization prompt");
    } finally {
      setIsSavingPrompt(false);
    }
  };
  
  // Handle saving the summary
  const handleSaveSummary = async () => {
    setIsSavingSummary(true);
    setError("");
    
    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents/summary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            workspace_id: workspaceId,
            scan_id: scanId,
            document_type: title,
            document_id: existingDocument?.id,
            summary: summary,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save summary");
      }
      
      // Update the document with the new summary
      if (existingDocument) {
        setExistingDocument({
          ...existingDocument,
          summary: summary,
        });
      }
      
      // Show success message
      setSummarySaveSuccess(true);
      setTimeout(() => setSummarySaveSuccess(false), 3000);
      
      // Exit edit mode
      setIsEditingSummary(false);
    } catch (err: any) {
      setError(err.message || "An error occurred while saving the summary");
    } finally {
      setIsSavingSummary(false);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check if the file type is allowed
      if (!allowedTypes.includes(selectedFile.type)) {
        const allowedTypesText = allowedTypes.map(type => getFileTypeDescription(type)).join(", ");
        setError(`Invalid file type. Allowed types: ${allowedTypesText}`);
        return;
      }
      
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError("");
      setUploadComplete(false);
    }
  };
  
  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFile(null);
    setFileName("");
    setUploadProgress(0);
    setUploadComplete(false);
    setUploadedFileUrl(null);
    setError("");
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const formatDate = (dateString: string): string => {
    try {
      // First check if it's a valid date string
      if (!dateString) return "Unknown date";
      
      const date = new Date(dateString);
      
      // Check if the date is valid before formatting
      if (isNaN(date.getTime())) {
        return "Unknown date";
      }
      
      // Format with more cross-browser compatibility
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Unknown date";
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError("Please select a file to upload");
      return;
    }
    
    setIsUploading(true);
    setError("");
    setUploadProgress(0);
    setUploadedFileUrl(null);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", title);
      
      // If replacing an existing document, include its ID
      if (existingDocument) {
        formData.append("documentId", existingDocument.id);
      }
      
      // Mock progress updates (in a real implementation, you'd use XMLHttpRequest or fetch with a ReadableStream)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = Math.min(prev + 10, 90);
          return newProgress;
        });
      }, 300);
      
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents/upload?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`,
        {
          method: "POST",
          body: formData,
        }
      );
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload file");
      }
      
      const data = await response.json();
      setUploadProgress(100);
      setUploadComplete(true);
      
      console.log('Document upload response data:', {
        id: data.id,
        document_type: data.document_type,
        file_name: data.file_name,
        uploaded_at: data.uploaded_at
      });
      
      // Ensure document_type is the same as the component title if not provided
      const documentType = data.document_type || title;
      
      // Store the uploaded file information
      setExistingDocument({
        id: data.id,
        document_type: documentType,
        file_name: data.file_name,
        file_url: data.file_url,
        file_size: file.size,
        uploaded_at: data.uploaded_at,
      });
      
      // Store the uploaded file URL if available
      if (data.file_url) {
        setUploadedFileUrl(data.file_url);
      }
      
      resetFileInput();
      
      // Call onUploadSuccess if provided
      if (onUploadSuccess) {
        onUploadSuccess(title);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during upload");
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDeleteDocument = async () => {
    if (!existingDocument) return;
    
    setIsDeleting(true);
    setError("");
    
    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&document_id=${existingDocument.id}`,
        {
          method: "DELETE",
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete document");
      }
      
      // Preserve the existing summarization prompt and document_type for the event
      const currentSummarizationPrompt = existingDocument.summarization_prompt;
      const deletedDocumentInfo = { ...existingDocument };
      
      // Document was reset to placeholder state, not completely deleted
      // Update the existing document state to reflect this
      setExistingDocument({
        ...existingDocument,
        status: "placeholder",
        file_url: "",
        file_name: "",
        file_size: 0,
        // Keep the existing summarization prompt
        summarization_prompt: currentSummarizationPrompt
      });
      setUploadedFileUrl(null);
      setShowDeleteConfirmation(false);
      
      // Show success message
      setUploadComplete(true);
      setTimeout(() => setUploadComplete(false), 3000);
      
      // Call onDeleteSuccess if provided
      if (onDeleteSuccess) {
        onDeleteSuccess(deletedDocumentInfo);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting the document");
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Check if the file type is allowed
      if (!allowedTypes.includes(droppedFile.type)) {
        const allowedTypesText = allowedTypes.map(type => getFileTypeDescription(type)).join(", ");
        setError(`Invalid file type. Allowed types: ${allowedTypesText}`);
        return;
      }
      
      setFile(droppedFile);
      setFileName(droppedFile.name);
      setError("");
      setUploadComplete(false);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };
  
  // Helper function to determine whether to show a placeholder or the current document
  const isPlaceholder = existingDocument && (!existingDocument.file_url || existingDocument.status === "pending");
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{documentDescription}</p>
        </div>
        <div className="p-6 flex justify-center items-center h-16">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-[350px]">{documentDescription}</p>
        </div>
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => setShowSummarizationModal(true)}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-end"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit Summary Instructions
          </button>
          <button
            onClick={() => {
              fetchDocumentData(); // Refresh data when View Summary is clicked
              setShowSummaryModal(true);
            }}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-end"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <line x1="10" y1="9" x2="8" y2="9"></line>
            </svg>
            View Summary
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
            {error}
          </div>
        )}
        
        {uploadComplete && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-200">
            {existingDocument && existingDocument.status === "uploaded" 
              ? (
                <div className="flex justify-between items-center">
                  <span>Upload successful!</span>
                  <button
                    onClick={() => setShowSummaryModal(true)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <line x1="10" y1="9" x2="8" y2="9"></line>
                    </svg>
                    View Summary
                  </button>
                </div>
              ) 
              : "Document removed successfully!"}
          </div>
        )}
        
        {/* Summary Modal */}
        <Modal
          isOpen={showSummaryModal}
          onClose={() => {
            setShowSummaryModal(false);
            setIsEditingSummary(false);
            // Reset summary to original value if canceled during editing
            if (isEditingSummary && existingDocument) {
              setSummary(existingDocument.summary || "");
            }
          }}
          maxWidth="4xl"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Document Summary</h3>
            <div className="flex items-center space-x-3">
              {!isEditingSummary ? (
                <button
                  onClick={() => setIsEditingSummary(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Edit Summary
                </button>
              ) : null}
              <button
                onClick={() => {
                  setShowSummaryModal(false);
                  setIsEditingSummary(false);
                  // Reset summary to original value if canceled during editing
                  if (isEditingSummary && existingDocument) {
                    setSummary(existingDocument.summary || "");
                  }
                }}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          
          {summarySaveSuccess && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-200">
              Summary saved successfully!
            </div>
          )}
          
          {!isEditingSummary ? (
            <div className="prose prose-sm max-w-none">
              {summary ? (
                <div className="whitespace-pre-wrap bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[500px] overflow-y-auto">
                  {summary}
                </div>
              ) : (
                <div className="text-gray-500 italic">
                  No summary available yet. This document has not been processed or no summary was generated.
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <textarea
                rows={18}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Enter summary for this document..."
              />
            </div>
          )}
          
          {isEditingSummary && (
            <div className="flex justify-end space-x-2">
              <button 
                className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
                onClick={() => {
                  setIsEditingSummary(false);
                  // Reset to original value
                  if (existingDocument) {
                    setSummary(existingDocument.summary || "");
                  }
                }}
              >
                Cancel
              </button>
              <button 
                className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 flex items-center"
                onClick={handleSaveSummary}
                disabled={isSavingSummary}
              >
                {isSavingSummary ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Summary</span>
                )}
              </button>
            </div>
          )}
        </Modal>
        
        {/* Summarization Instructions Modal */}
        <Modal
          isOpen={showSummarizationModal}
          onClose={() => setShowSummarizationModal(false)}
          maxWidth="3xl"
        >
          <h3 className="text-lg font-bold mb-4">Edit Summarization Instructions</h3>
          <p className="text-sm text-gray-600 mb-4">
            Customize how this document should be summarized. These instructions guide the AI in creating a focused summary of the document's content.
          </p>
          
          {promptSaveSuccess && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-200">
              Summarization instructions saved successfully!
            </div>
          )}
          
          <div className="mb-4">
            <label htmlFor="summarization-prompt" className="block text-sm font-medium text-gray-700 mb-1">
              Summarization Instructions
            </label>
            <textarea
              id="summarization-prompt"
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={summarizationPrompt}
              onChange={(e) => setSummarizationPrompt(e.target.value)}
              placeholder="Enter instructions for summarizing this document..."
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <button 
              className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
              onClick={() => setShowSummarizationModal(false)}
            >
              Cancel
            </button>
            <button 
              className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 flex items-center"
              onClick={handleSavePrompt}
              disabled={isSavingPrompt}
            >
              {isSavingPrompt ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Instructions</span>
              )}
            </button>
          </div>
        </Modal>
        
        {/* Placeholder Document Display */}
        {isPlaceholder && !isUploading && !uploadComplete && (
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-gray-800 mb-2 text-sm">Document Placeholder</h4>
                <p className="text-sm text-gray-500 mb-1">
                  No file has been uploaded yet. Upload a file to complete this document.
                </p>
                <div className="flex text-xs text-gray-500 space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Current Document Display */}
        {existingDocument && !isPlaceholder && !isUploading && !uploadComplete && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-blue-800 mb-2 text-sm">Current Document</h4>
                <p className="text-sm font-medium text-gray-900 truncate mb-1">
                  {existingDocument.file_name}
                </p>
                <div className="flex text-xs text-gray-500 space-x-2">
                  <span>{existingDocument.file_type || 
                    (existingDocument.content_type ? getFileTypeDescription(existingDocument.content_type) : '') || 
                    getFileExtensionFromFilename(existingDocument.file_name)}</span>
                  <span>•</span>
                  {existingDocument.file_size && (
                    <span>{formatFileSize(existingDocument.file_size)}</span>
                  )}
                  <span>•</span>
                  <span>{formatDate(existingDocument.uploaded_at)}</span>
                  {existingDocument.status && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        {existingDocument.status === "uploaded" ? "Uploaded" : existingDocument.status}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <a 
                  href={existingDocument.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  View
                </a>
                {!showDeleteConfirmation ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleDeleteDocument}
                      disabled={isDeleting}
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting..." : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirmation(false)}
                      className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* File Upload Area */}
        {(!existingDocument || isPlaceholder || file) && (
          <form onSubmit={handleSubmit}>
            {!file && (
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="space-y-2">
                  <svg 
                    className="mx-auto h-12 w-12 text-gray-400" 
                    stroke="currentColor" 
                    fill="none" 
                    viewBox="0 0 48 48" 
                    aria-hidden="true"
                  >
                    <path 
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
                      strokeWidth={2} 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                  </svg>
                  <div className="text-sm text-gray-600">
                    <label 
                      htmlFor={`file-upload-${title}`} 
                      className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload a file</span>
                      <input 
                        id={`file-upload-${title}`} 
                        name="file-upload" 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept={allowedTypes.join(",")}
                        className="sr-only" 
                      />
                    </label>
                    <span className="pl-1">or drag and drop</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    PDF, CSV, Excel up to 10MB
                  </p>
                </div>
              </div>
            )}
            
            {file && (
              <div className="mt-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <svg 
                      className="h-8 w-8 text-gray-400" 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 truncate">{fileName}</p>
                      <p className="text-gray-500 text-xs">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetFileInput}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path 
                        fillRule="evenodd" 
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            {isUploading && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}
            
            {file && (
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : existingDocument ? "Replace" : "Upload"}
                </button>
              </div>
            )}
          </form>
        )}
        
        {/* Replace Button for Existing Document */}
        {existingDocument && !isPlaceholder && !file && !isUploading && (
          <div className="mt-4">
            <label
              htmlFor={`file-replace-${title}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
            >
              Replace Document
              <input
                id={`file-replace-${title}`}
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={allowedTypes.join(",")}
                className="sr-only"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
} 