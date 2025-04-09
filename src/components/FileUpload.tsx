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
  
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h3 className="text-xl font-medium mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        <div className="flex justify-center items-center h-16">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h3 className="text-xl font-medium mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
          {error}
        </div>
      )}
      
      {uploadComplete && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
          {existingDocument ? "Upload successful!" : "Document deleted successfully!"}
          {uploadedFileUrl && (
            <div className="mt-2">
              <a 
                href={uploadedFileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View uploaded document
              </a>
            </div>
          )}
        </div>
      )}
      
      {existingDocument && !isUploading && !uploadComplete && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <h4 className="font-medium text-blue-800 mb-2">Current Document</h4>
          <div className="mb-2">
            <span className="font-medium">File name:</span> {existingDocument.file_name}
          </div>
          <div className="mb-2">
            <span className="font-medium">Type:</span> {existingDocument.file_type || 
              (existingDocument.content_type ? getFileTypeDescription(existingDocument.content_type) : '') || 
              getFileExtensionFromFilename(existingDocument.file_name)}
          </div>
          {existingDocument.file_size && (
            <div className="mb-2">
              <span className="font-medium">Size:</span> {formatFileSize(existingDocument.file_size)}
            </div>
          )}
          <div className="mb-2">
            <span className="font-medium">Uploaded:</span> {formatDate(existingDocument.uploaded_at)}
          </div>
          <div className="mt-3 flex items-center">
            <a 
              href={existingDocument.file_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline mr-3"
            >
              View Document
            </a>
            {!showDeleteConfirmation ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirmation(true)}
                className="text-red-600 hover:text-red-800 hover:underline"
              >
                Delete Document
              </button>
            ) : (
              <div className="flex items-center">
                <span className="text-red-600 mr-2">Confirm delete?</span>
                <button
                  type="button"
                  onClick={handleDeleteDocument}
                  disabled={isDeleting}
                  className="bg-red-600 text-white px-2 py-1 rounded text-xs mr-2 hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmation(false)}
                  className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs hover:bg-gray-300"
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {existingDocument ? "Select a file to replace the current document" : "Select a file to upload"}
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Accepted file types: PDF, CSV, Excel
          </p>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={allowedTypes.join(",")}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            {file && (
              <button
                type="button"
                onClick={resetFileInput}
                className="text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            )}
          </div>
          {fileName && (
            <div className="mt-2 text-sm text-gray-600">
              Selected file: {fileName}
            </div>
          )}
        </div>
        
        {isUploading && (
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            ></div>
            <p className="text-xs text-gray-600 mt-1">
              Uploading: {uploadProgress}%
            </p>
          </div>
        )}
        
        <div className="mt-4">
          <button
            type="submit"
            disabled={isUploading || !file}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : existingDocument ? "Replace Document" : "Upload Document"}
          </button>
        </div>
      </form>
    </div>
  );
} 