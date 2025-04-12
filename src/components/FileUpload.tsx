"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";

type FileUploadProps = {
  title: string;
  description: string;
  allowedTypes?: string[];
  onUploadSuccess?: () => void;
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
  description,
  allowedTypes = [
    "application/pdf", 
    "text/csv", 
    "application/vnd.ms-excel", 
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ],
  onUploadSuccess,
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch existing document on component mount
  useEffect(() => {
    async function fetchExistingDocument() {
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
            file_name: doc.file_name || "Unknown file",
            file_url: doc.file_url || "",
            file_size: doc.file_size || 0,
            uploaded_at: doc.created_at || doc.updated_at || new Date().toISOString(),
          });
          
          setUploadedFileUrl(doc.file_url);
        }
      } catch (err) {
        console.error("Error fetching document:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchExistingDocument();
  }, [tenantSlug, workspaceId, scanId, title]);
  
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
      
      // Store the uploaded file information
      setExistingDocument({
        id: data.id,
        document_type: data.document_type,
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
      
      if (onUploadSuccess) {
        onUploadSuccess();
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
      
      // Clear the existing document
      setExistingDocument(null);
      setUploadedFileUrl(null);
      setShowDeleteConfirmation(false);
      
      // Show success message
      setUploadComplete(true);
      setTimeout(() => setUploadComplete(false), 3000);
      
      if (onUploadSuccess) {
        onUploadSuccess();
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
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <div className="p-6 flex justify-center items-center h-16">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
            {error}
          </div>
        )}
        
        {uploadComplete && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-200">
            {existingDocument ? "Upload successful!" : "Document deleted successfully!"}
          </div>
        )}
        
        {/* Current Document Display */}
        {existingDocument && !isUploading && !uploadComplete && (
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
        {(!existingDocument || file) && (
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
        {existingDocument && !file && !isUploading && (
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