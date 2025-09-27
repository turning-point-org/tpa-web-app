"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { ChatMessage, DocumentInfo } from "@/types";
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { OraIcon } from "@/assets/icons";
import { REQUIRED_DOCUMENT_TYPES, DOCUMENT_DESCRIPTIONS } from "@/lib/document-config";

interface OraPanelProps {
  scanId: string;
  tenantSlug: string;
  workspaceId: string;
}

// Define a Lifecycle type
type Lifecycle = {
  id: string;
  name: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
};

// Helper function to get document descriptions
const getDocumentDescription = (docType: string): string => {
  return DOCUMENT_DESCRIPTIONS[docType as keyof typeof DOCUMENT_DESCRIPTIONS] || "Important document for business analysis";
};

export default function OraPanel({ scanId, tenantSlug, workspaceId }: OraPanelProps) {
  const { user, isLoading: userLoading } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m Ora, your AI assistant. I\'m loading information about this scan to better assist you...'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentInfo[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [documentUpdateTracker, setDocumentUpdateTracker] = useState<{
    lastUpdated: Date | null,
    lastAction: 'added' | 'removed' | null,
    document: DocumentInfo | null
  }>({
    lastUpdated: null,
    lastAction: null,
    document: null
  });
  const [lifecyclesStatus, setLifecyclesStatus] = useState<'none' | 'generating' | 'complete'>('none');
  const [lifecycleCheckTime, setLifecycleCheckTime] = useState<Date | null>(null);
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);

  // Track the IDs of documents we've already reported changes for to prevent duplicate messages
  const [reportedDocumentIds, setReportedDocumentIds] = useState<Set<string>>(new Set());
  const [lastReportTime, setLastReportTime] = useState<number>(0);

  // Set CSS variables for panel expansion state
  useEffect(() => {
    if (isExpanded) {
      document.documentElement.style.setProperty('--ora-panel-expanded', 'true');
    } else {
      document.documentElement.style.setProperty('--ora-panel-expanded', 'false');
    }
  }, [isExpanded]);

  // Add custom scrollbar styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .ora-messages-container::-webkit-scrollbar {
        width: 6px;
      }
      .ora-messages-container::-webkit-scrollbar-track {
        background: #1f2937;
      }
      .ora-messages-container::-webkit-scrollbar-thumb {
        background-color: #4b5563;
        border-radius: 20px;
      }
      .ora-messages-container::-webkit-scrollbar-thumb:hover {
        background-color: #6b7280;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
      );
      
      // Check for authentication errors first
      const { handleFetchResponse } = await import('../utils/api');
      try {
        await handleFetchResponse(response);
      } catch (authError) {
        // Auth error handler will redirect, so we can return early
        return [];
      }
      
      if (!response.ok) {
        // Try to get detailed error information from the response
        let errorMessage = `Error fetching documents: ${response.status} ${response.statusText}`;
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorDetails = errorData.error;
            if (errorData.details) {
              errorDetails += `: ${errorData.details}`;
            }
          }
        } catch (parseError) {
          // If we can't parse the response as JSON, just use the status text
          console.error('Could not parse error response:', parseError);
        }
        
        console.error(errorMessage, errorDetails ? ` - ${errorDetails}` : '');
        
        // Add a message to the user about the connection issue
        if (documentsLoaded === false) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `⚠️ I encountered an issue connecting to the document storage. ${errorDetails || 'This might be due to missing configuration or network issues.'}. You can still chat with me, but I won't be able to reference your documents until this is resolved.`
          }]);
        }
        setDocumentsLoaded(true); // Prevent repeated error messages
        return [];
      }
      
      const documents: DocumentInfo[] = await response.json();
      
      // Log document data to troubleshoot issues
      console.log(`Fetched ${documents.length} documents for scan:`, 
        documents.map(doc => ({
          id: doc.id,
          document_type: doc.document_type,
          file_name: doc.file_name,
          status: doc.status
        }))
      );
      
      // Fix any documents with missing document_type
      const processedDocuments = documents.map(doc => {
        // If document_type is missing or undefined, try to infer it from other data
        if (!doc.document_type) {
          // Check if this document type matches any of the required types
          const requiredType = REQUIRED_DOCUMENT_TYPES.find(type => 
            doc.title === type || 
            doc.file_name?.includes(type.toString())
          );
          
          return { ...doc, document_type: requiredType || 'Unknown Document' };
        }
        return doc;
      });
      
      // Simply update state - no messages here
      // Messages should come from the event system only
      setUploadedDocuments(processedDocuments);
      return processedDocuments;
    } catch (error) {
      console.error("Error fetching documents:", error);
      // Add a message to the user about the connection issue if this is the first load
      if (documentsLoaded === false) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `⚠️ I encountered an issue connecting to the document storage. ${error instanceof Error ? error.message : 'Check your database configuration or network connection.'}. You can still chat with me, but I won't be able to reference your documents until this is resolved.`
        }]);
      }
      setDocumentsLoaded(true); // Prevent repeated error messages
      return [];
    }
  };
  
  // Helper function to get file extension from filename
  const getFileExtensionFromFilename = (filename: string | undefined): string => {
    if (!filename) return 'Unknown';
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    // Map common extensions to readable format
    const extensionMap: Record<string, string> = {
      'pdf': 'PDF',
      'csv': 'CSV',
      'xls': 'Excel',
      'xlsx': 'Excel',
      'doc': 'Word',
      'docx': 'Word',
      'txt': 'Text'
    };
    
    return extensionMap[extension] || extension.toUpperCase();
  };
  
  // Helper function to check if a document is a placeholder
  const isPlaceholderDocument = (doc: DocumentInfo): boolean => {
    // A document is a placeholder if its status is explicitly "placeholder"
    return doc.status === 'placeholder';
  };
  
  // Helper function to format file size
  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes || bytes === 0) return "Unknown size";
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // Fix the document type comparison in getMissingDocumentsMessage
  const getMissingDocumentsMessage = (documents: DocumentInfo[]): string => {
    // Filter out placeholder documents when checking for missing types
    const uploadedTypes = documents
      .filter(doc => !isPlaceholderDocument(doc))
      .map(doc => doc.document_type);
    
    const missingTypes = REQUIRED_DOCUMENT_TYPES.filter(
      type => !uploadedTypes.some(uploadedType => uploadedType === type.toString())
    );
    
    if (missingTypes.length > 0) {
      return ` You still need ${missingTypes.length} more document${missingTypes.length === 1 ? '' : 's'}: ${missingTypes.join(', ')}.`;
    }
    
    if (uploadedTypes.length === REQUIRED_DOCUMENT_TYPES.length) {
      return ` Great! You've uploaded all required documents. You can generate business lifecycles using the "Generate Lifecycles" button on the Data Sources page.`;
    }
    
    return '';
  };

  /**
   * Passively checks the current lifecycle status.
   * This function ONLY checks the status and NEVER triggers lifecycle generation.
   * It simply updates UI state based on what it observes.
   */
  const checkLifecyclesStatus = async () => {
    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
      );
      
      if (!response.ok) {
        return;
      }
      
      const fetchedLifecycles = await response.json();
      const hasLifecycles = fetchedLifecycles && fetchedLifecycles.length > 0;
      
      // Store the actual lifecycle data
      setLifecycles(fetchedLifecycles || []);
      
      // Just update the state without sending messages - messages should only come from user actions
      if (lifecyclesStatus !== 'complete' && hasLifecycles) {
        setLifecyclesStatus('complete');
        setLifecycleCheckTime(new Date());
      } 
      else if (lifecyclesStatus === 'complete' && !hasLifecycles) {
        setLifecyclesStatus('generating');
      }
      else if (lifecyclesStatus === 'none') {
        setLifecyclesStatus(hasLifecycles ? 'complete' : 'none');
      }
    } catch (error) {
      console.error("Error checking lifecycles status:", error);
    }
  };

  /**
   * Sets up passive monitoring of document and lifecycle status.
   * Only monitors for changes - NEVER triggers lifecycle generation.
   * Also listens for custom ora-document-change events.
   */
  useEffect(() => {
    // Initial fetch - just check status, don't generate
    fetchDocuments();
    checkLifecyclesStatus();
    
    // Listen for document change events from the FileUpload components
    const handleDocumentChange = (event: any) => {
      const { action, document, scanId: eventScanId } = event.detail;
      
      console.log('Document change event:', action, document);
      
      // Only process events for the current scan
      if (eventScanId !== scanId) return;
      
      // Update based on the action
      if (action === 'added' && document) {
        // Enhanced debug logging
        console.log('Document change details:', {
          id: document.id,
          document_type: document.document_type,
          title: document.title || 'N/A',
          file_name: document.file_name || 'N/A',
          file_size: document.file_size,
          file_type: document.file_type
        });
        
        const fileType = document.file_type || getFileExtensionFromFilename(document.file_name) || 'Unknown';
        const fileSize = document.file_size ? formatFileSize(document.file_size) : 'Unknown size';
        const fileName = document.file_name || 'Unnamed file';
        
        // Get document type - use a more reliable method
        const documentType = document.document_type || document.title || 'Document';
        
        // Check if this is a new document or an update to a placeholder
        const isPlaceholderUpdate = document.status && document.status !== 'placeholder' && 
                                   uploadedDocuments.some(doc => 
                                     doc.id === document.id && 
                                     isPlaceholderDocument(doc));
        
        if (isPlaceholderUpdate) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `📄 I see you've uploaded a file for the **${documentType}** document: "${fileName}" (${fileType}, ${fileSize}).`
          }]);
        } else {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `📄 I see you've added a new **${documentType}** document: "${fileName}" (${fileType}, ${fileSize}).`
          }]);
        }
        
        // Refresh documents list without triggering additional messages
        fetchDocuments();
        
        // Check if this was the last required document
        setTimeout(() => {
          // We need to get the latest document list
          fetch(`/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`)
            .then(response => response.json())
            .then(documents => {
              // Filter out placeholder documents when checking completion
              const completedDocs = documents.filter((doc: DocumentInfo) => !isPlaceholderDocument(doc));
              const uploadedTypes = completedDocs.map((doc: DocumentInfo) => doc.document_type);
              
              if (uploadedTypes.length === REQUIRED_DOCUMENT_TYPES.length && 
                  REQUIRED_DOCUMENT_TYPES.every(type => uploadedTypes.includes(type.toString()))) {
                setMessages(prev => [...prev, { 
                  role: 'assistant', 
                  content: `🎉 **Congratulations!** You've uploaded all required documents. You can now generate business lifecycles by clicking the "Generate Lifecycles" button on the Data Sources page.`
                }]);
              }
            })
            .catch(err => console.error("Error checking document completion:", err));
        }, 2000);
      }
      else if (action === 'status_changed' && document) {
        // Handle document status changes
        const newStatus = document.status;
        
        if (newStatus === 'processed') {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `✅ The **${document.document_type}** document has been successfully processed and is ready for analysis.`
          }]);
        } else if (newStatus === 'failed') {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `❌ There was an issue processing the **${document.document_type}** document. You may need to re-upload it.`
          }]);
        }
        
        fetchDocuments();
      }
      else if (action === 'removed' && document) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `🗑️ I see you've removed the **${document.document_type}** document.`
        }]);
        
        fetchDocuments();
      }
      else if (action === 'removed') {
        // Handle case where document info isn't available
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `🗑️ I see you've removed a document.`
        }]);
        
        fetchDocuments();
      }
    };
    
    // Add a listener for lifecycle generation events
    const handleLifecycleChange = (event: any) => {
      const { action, count, scanId: eventScanId } = event.detail;
      
      console.log('Lifecycle change event:', action, count);
      
      // Only process events for the current scan
      if (eventScanId !== scanId) return;
      
      // Handle lifecycle generation completion
      if (action === 'generated' && count !== undefined) {
        // Check if we've already shown a notification recently
        const notificationKey = `ora-lifecycle-notif-${scanId}`;
        const lastNotificationTime = localStorage.getItem(notificationKey);
        const currentTime = Date.now();
        
        // Skip if we've shown a notification in the last 5 seconds
        if (lastNotificationTime && (currentTime - parseInt(lastNotificationTime)) < 5000) {
          console.log("Skipping duplicate lifecycle notification");
          return;
        }
        
        // Save timestamp of this notification
        localStorage.setItem(notificationKey, currentTime.toString());
        
        // Fetch the actual lifecycle data
        fetch(`/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`)
          .then(response => {
            if (response.ok) return response.json();
            throw new Error("Failed to fetch lifecycle data");
          })
          .then(fetchedLifecycles => {
            // Update the lifecycles state with the actual data
            setLifecycles(fetchedLifecycles || []);
            
            const lifecycleText = count === 1 ? 'lifecycle' : 'lifecycles';
            
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `🚀 **${count} business ${lifecycleText} have been generated!**
              
You're now on the Lifecycles page where you can:
- View all generated business lifecycles based on the APQC Process Classification Framework
- Edit lifecycle names and descriptions to better align with your company's specific context
- Add new custom lifecycles
- Change the order of lifecycles
- Delete any lifecycles that aren't relevant to your organization
              
These lifecycles represent the core operational processes of the organization, adapted from industry standard frameworks to match your company's unique operating model based on your uploaded documents.`
            }]);
            
            // Update local lifecycle status
            setLifecyclesStatus('complete');
            setLifecycleCheckTime(new Date());
            
            // Also refresh documents in case any were updated
            fetchDocuments();
          })
          .catch(error => {
            console.error("Error fetching lifecycle data after generation:", error);
            // Even if there's an error, still update the status
            setLifecyclesStatus('complete');
            setLifecycleCheckTime(new Date());
          });
      }
    };
    
    // Add a separate listener for document status change events
    window.addEventListener('ora-document-status-change', (event: any) => {
      // Convert status change events to the standard format
      const detail = event.detail;
      if (detail && detail.document && detail.scanId) {
        // Create a compatible event object
        const compatEvent = {
          detail: {
            action: 'status_changed',
            document: detail.document,
            scanId: detail.scanId
          }
        };
        
        // Process with our main document change handler
        handleDocumentChange(compatEvent);
      }
    });
    
    // Only check lifecycle status periodically, not documents
    const intervalId = setInterval(() => {
      checkLifecyclesStatus();
    }, 30000);
    
    // Add event listeners
    window.addEventListener('ora-document-change', handleDocumentChange);
    window.addEventListener('ora-lifecycle-change', handleLifecycleChange);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('ora-document-change', handleDocumentChange);
      window.removeEventListener('ora-document-status-change', handleDocumentChange);
      window.removeEventListener('ora-lifecycle-change', handleLifecycleChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId, tenantSlug, workspaceId]);

  const fetchCompanyData = async () => {
    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/company-details?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
      );
      
      if (response.status === 404) {
        console.log("No company information found");
        return null;
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch company information");
      }
      
      const data = await response.json();
      setCompanyData(data);
      return data;
    } catch (error) {
      console.error("Error fetching company data:", error);
      return null;
    }
  };

  // Fetch documents and company data when component mounts
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // First fetch the documents
        let documents: DocumentInfo[] = [];
        try {
          documents = await fetchDocuments() || [];
        } catch (docError) {
          console.error("Error fetching documents:", docError);
          // Already handled in fetchDocuments
        }
        
        let companyInfo = null;
        try {
          companyInfo = await fetchCompanyData();
        } catch (companyError) {
          console.error("Error fetching company data:", companyError);
        }
        
        // Mark all initial documents as already reported to prevent messages on first load
        if (documents && documents.length > 0) {
          const initialDocIds = documents.map(doc => doc.id);
          setReportedDocumentIds(new Set(initialDocIds));
          setLastReportTime(Date.now());
        }
        
        // Check lifecycle status
        let hasLifecycles = false;
        try {
          const lifecyclesResponse = await fetch(
            `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
          );
          
          if (lifecyclesResponse.ok) {
            const fetchedLifecycles = await lifecyclesResponse.json();
            hasLifecycles = fetchedLifecycles && fetchedLifecycles.length > 0;
            setLifecyclesStatus(hasLifecycles ? 'complete' : 'none');
            if (hasLifecycles) {
              setLifecycleCheckTime(new Date());
              setLifecycles(fetchedLifecycles);
            }
          }
        } catch (lifecycleError) {
          console.error("Error checking lifecycle status:", lifecycleError);
        }
        
        setDocumentsLoaded(true);
        
        // Update welcome message after documents are loaded
        if (messages.length === 1 && messages[0].role === 'assistant') {
          const actualDocuments = documents ? documents.filter(doc => !isPlaceholderDocument(doc)) : [];
          const hasDocuments = actualDocuments.length > 0;
          let welcomeMessage = "### Welcome to Ora!\n\n";
          
          // Add company context if available
          if (companyInfo && companyInfo.name) {
            welcomeMessage += `I'm here to help with your analysis of ${companyInfo.name}`;
            if (companyInfo.industry) {
              welcomeMessage += `, a company in the ${companyInfo.industry} industry`;
            }
            welcomeMessage += ".\n\n";
          } else {
            welcomeMessage += "I'm here to help with your business analysis.\n\n";
          }
          
          const placeholderCount = documents ? documents.filter(doc => isPlaceholderDocument(doc)).length : 0;
          
          if (hasDocuments) {
            welcomeMessage += `I see you've uploaded ${actualDocuments.length} of ${REQUIRED_DOCUMENT_TYPES.length} required documents:\n\n`;
            
            // List uploaded documents with details
            actualDocuments.forEach(doc => {
              const fileType = doc.file_type || getFileExtensionFromFilename(doc.file_name) || 'Unknown';
              const fileSize = doc.file_size ? formatFileSize(doc.file_size) : 'Unknown size';
              const fileName = doc.file_name || 'Unnamed file';
              welcomeMessage += `- **${doc.document_type}**: "${fileName}" (${fileType}, ${fileSize})\n`;
            });
            
            welcomeMessage += "\n";
          } else if (placeholderCount > 0) {
            welcomeMessage += `Your scan has been initialized with ${placeholderCount} document placeholders. To proceed, you'll need to upload the actual files for each required document type:\n\n`;
            
            // If we have placeholders, show them with their status
            if (documents) {
              documents.forEach(doc => {
                const status = doc.status === 'placeholder' ? '📄 Needs upload' : 
                              doc.status === 'uploaded' ? '⏳ Processing' : 
                              doc.status === 'processed' ? '✅ Ready' : 
                              doc.status === 'failed' ? '❌ Failed' : 'Unknown status';
                welcomeMessage += `- **${doc.document_type}:** ${status} - ${getDocumentDescription(doc.document_type)}\n`;
              });
            } else {
              // Fallback if no documents object
              REQUIRED_DOCUMENT_TYPES.forEach(type => {
                welcomeMessage += `- **${type}:** ${getDocumentDescription(type)}\n`;
              });
            }
            
            welcomeMessage += "\n";
          } else {
            welcomeMessage += "I notice you haven't uploaded any documents yet for this scan, or there might be an issue connecting to document storage. ";
            welcomeMessage += "To proceed with the Scan workflow, you'll need to upload the following required documents:\n\n";
            
            REQUIRED_DOCUMENT_TYPES.forEach(type => {
              welcomeMessage += `- **${type}:** ${getDocumentDescription(type)}\n`;
            });
            welcomeMessage += "\n";
          }
          
          // Show missing documents if any
          if (hasDocuments) {
            const uploadedTypes = actualDocuments.map(doc => doc.document_type);
            const missingTypes = REQUIRED_DOCUMENT_TYPES.filter(
              type => !uploadedTypes.some(uploadedType => uploadedType === type.toString())
            );
            
            if (missingTypes.length > 0) {
              welcomeMessage += "You still need to upload:\n\n";
              missingTypes.forEach(type => {
                welcomeMessage += `- **${type}:** ${getDocumentDescription(type)}\n`;
              });
              welcomeMessage += "\n";
            } else {
              welcomeMessage += "Great! You've uploaded all required documents.\n\n";
            }
            
            // Add lifecycle status
            if (hasLifecycles) {
              welcomeMessage += "✅ **Business lifecycles have been generated** and are ready for review! These are based on the APQC Process Classification Framework but tailored to your company's specific context.\n\n";
            } else if (actualDocuments.length === REQUIRED_DOCUMENT_TYPES.length) {
              welcomeMessage += "🔍 **All documents uploaded!** You can generate business lifecycles following the APQC Process Classification Framework by clicking the 'Generate Lifecycles' button on the Data Sources page.\n\n";
            }
          }
          
          welcomeMessage += "What would you like to know?";
          
          setMessages([
            {
              role: 'assistant',
              content: welcomeMessage
            }
          ]);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setDocumentsLoaded(true);
        
        // Provide a fallback welcome message
        if (messages.length === 1 && messages[0].role === 'assistant') {
          setMessages([
            {
              role: 'assistant',
              content: "### Welcome to Ora!\n\nI'm here to help with your business analysis. There seems to be an issue connecting to the data services. You can still chat with me, but some features might be limited until the connection issues are resolved.\n\nWhat would you like to know?"
            }
          ]);
        }
      }
    };
    
    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Fetch fresh lifecycle data to ensure we have the most current information
      try {
        const lifecyclesResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
        );
        
        if (lifecyclesResponse.ok) {
          const freshLifecycles = await lifecyclesResponse.json();
          const hasLifecycles = freshLifecycles && freshLifecycles.length > 0;
          
          if (hasLifecycles) {
            setLifecycles(freshLifecycles);
            setLifecyclesStatus('complete');
            setLifecycleCheckTime(new Date());
          } else if (lifecyclesStatus === 'complete') {
            // Previously had lifecycles but now they're gone
            setLifecyclesStatus('generating');
          }
        }
      } catch (lifecyclesError) {
        console.error("Error fetching fresh lifecycle data:", lifecyclesError);
        // Continue with existing lifecycle data
      }
      
      // Create document status context
      const actualDocuments = uploadedDocuments.filter(doc => !isPlaceholderDocument(doc));
      const placeholderDocuments = uploadedDocuments.filter(doc => isPlaceholderDocument(doc));
      
      const uploadedTypes = actualDocuments.map(doc => doc.document_type);
      const missingTypes = REQUIRED_DOCUMENT_TYPES.filter(
        type => !uploadedTypes.some(uploadedType => uploadedType === type.toString())
      );
      
      let documentStatus = "### Document Status\n\n";
      
      if (actualDocuments.length === 0 && placeholderDocuments.length === 0) {
        documentStatus += "No documents have been uploaded yet.\n\n";
      } else if (actualDocuments.length === 0 && placeholderDocuments.length > 0) {
        documentStatus += `${placeholderDocuments.length} document placeholders exist, but no actual documents have been uploaded yet.\n\n`;
        
        documentStatus += "Required documents:\n\n";
        placeholderDocuments.forEach(doc => {
          const status = doc.status === 'placeholder' ? '📄 Needs upload' : 
                        doc.status === 'uploaded' ? '⏳ Processing' : 
                        doc.status === 'processed' ? '✅ Ready' : 
                        doc.status === 'failed' ? '❌ Failed' : 'Unknown status';
          documentStatus += `- **${doc.document_type}:** ${status} - ${getDocumentDescription(doc.document_type)}\n`;
        });
      } else {
        documentStatus += `Uploaded ${actualDocuments.length} of ${REQUIRED_DOCUMENT_TYPES.length} required documents:\n\n`;
        
        // List uploaded documents with status indicators
        uploadedDocuments.forEach(doc => {
          const status = doc.status === 'placeholder' ? '📄 Needs upload' : 
                        doc.status === 'uploaded' ? '⏳ Processing' : 
                        doc.status === 'processed' ? '✅ Ready' : 
                        doc.status === 'failed' ? '❌ Failed' : '✅ Ready'; // Default to ready if status not provided
          const fileName = doc.file_name || 'Unnamed file';
          documentStatus += `- **${doc.document_type}:** ${status} ${fileName ? `"${fileName}"` : ''}\n`;
        });
        
        // List missing documents
        if (missingTypes.length > 0) {
          documentStatus += "\nMissing documents:\n\n";
          missingTypes.forEach(type => {
            documentStatus += `- **${type}:** ${getDocumentDescription(type)}\n`;
          });
        }
      }
      
      // Add company information if available
      if (companyData) {
        documentStatus += "\n### Company Information\n\n";
        if (companyData.name) documentStatus += `- **Company Name:** ${companyData.name}\n`;
        if (companyData.website) documentStatus += `- **Website:** ${companyData.website}\n`;
        if (companyData.country) documentStatus += `- **Country:** ${companyData.country}\n`;
        if (companyData.industry) documentStatus += `- **Industry:** ${companyData.industry}\n`;
        if (companyData.description) documentStatus += `- **Description:** ${companyData.description}\n`;
      }

      // Add lifecycle status information with detailed data
      if (lifecyclesStatus === 'complete' && lifecycles.length > 0) {
        documentStatus += "\n### Business Lifecycles\n\n";
        documentStatus += `${lifecycles.length} business lifecycles have been generated based on the APQC Process Classification Framework and are available for review.\n\n`;
        
        // Include actual lifecycle details
        lifecycles.forEach((lifecycle, index) => {
          documentStatus += `- **${lifecycle.name}**: ${lifecycle.description}\n`;
        });
        
        if (lifecycleCheckTime) {
          documentStatus += `\nLast checked: ${lifecycleCheckTime.toLocaleString()}\n`;
        }
      } else if (lifecyclesStatus === 'generating') {
        documentStatus += "\n### Lifecycle Status\n\n";
        documentStatus += "Business lifecycles are currently being regenerated using the APQC Process Classification Framework and your company's specific context.\n";
      } else if (actualDocuments.length === REQUIRED_DOCUMENT_TYPES.length) {
        documentStatus += "\n### Lifecycle Status\n\n";
        documentStatus += "All required documents have been uploaded. You can generate business lifecycles based on the APQC Process Classification Framework using the 'Generate Lifecycles' button on the Data Sources page.\n";
      }

      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/chat?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: userMessage,
            conversationHistory: messages,
            documentStatus: documentStatus,
            companyInfo: companyData || null,
            formatInstructions: "Use extremely compact markdown formatting with minimal spacing. Use dashes (-) for lists. Avoid line breaks between paragraphs, list items, and headers. Use ### for section headings, ** for bold, and * for italic. Keep line breaks to absolute minimum."
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I encountered an error: ${errorData.error}. Please try again or contact support if the issue persists.`
        }]);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        const results = data.results || [];
        
        let assistantResponse = '';
        
        if (results.length === 0) {
          assistantResponse = "I don't have any relevant information about that in the documents you've uploaded. Please try asking something else or upload more documents.";
        } else {
          assistantResponse = `Based on the documents you've uploaded, here's what I found:\n\n`;
          
          results.forEach((result: any, index: number) => {
            assistantResponse += `From document "${result.file_name}" (${result.document_type}):\n`;
            assistantResponse += `${result.text.substring(0, 500)}${result.text.length > 500 ? '...' : ''}\n\n`;
          });
        }
        
        setMessages(prev => [...prev, { role: 'assistant', content: assistantResponse }]);
      }
    } catch (error) {
      console.error('Error searching documents:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error searching through your documents. This could be because you haven\'t uploaded any documents yet, or there\'s an issue with the document processing. Please try uploading some documents first.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to bottom of messages when new messages are added
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      const scrollOptions = {
        top: messagesEndRef.current.offsetTop,
        behavior: 'smooth' as ScrollBehavior
      };
      messagesContainerRef.current.scrollTo(scrollOptions);
    }
  }, [messages]);

  // Function to clear chat history
  const clearChatHistory = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat history has been cleared. How else can I help you today?'
      }
    ]);
  };

  // Add custom compact markdown styles
  const compactMarkdownStyles = {
    h1: 'text-xl font-bold mt-1 mb-0.5',
    h2: 'text-lg font-bold mt-1 mb-0.5',
    h3: 'text-base font-bold mt-1 mb-0.5',
    p: 'mt-0.5 mb-0.5',
    ul: 'list-disc pl-3 mt-0 mb-0',
    ol: 'list-decimal pl-3 mt-0 mb-0',
    li: 'mt-0 mb-0 leading-tight',
    strong: 'font-bold',
    em: 'italic',
  };

  return (
    <div className={`fixed top-0 right-0 bottom-0 z-10 bg-gray-900 shadow-lg transition-all duration-300 ease-in-out ${isExpanded ? `w-[650px]` : 'w-16'}`}>
      {/* Ora Logo - Always visible when collapsed */}
      {!isExpanded && (
        <>
          <div className="flex items-center justify-center h-12 mt-2">
            <OraIcon className="w-10 h-10" />
          </div>
          
          {/* Expand button at bottom when panel is closed */}
          <button
            onClick={() => setIsExpanded(true)}
            className="absolute left-1/2 bottom-4 -translate-x-1/2 bg-gray-700 p-2 rounded-lg hover:bg-gray-600 transition-colors z-20 text-gray-300 border border-gray-600 flex-shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </>
      )}

      {isExpanded && (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800 flex items-center">
            <OraIcon className="w-10 h-10 mr-3" />
            <h2 className="text-lg font-semibold text-gray-100">Ora</h2>
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-900 ora-messages-container">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-2 ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-gray-100'
                      : 'bg-gray-800 text-gray-200'
                  }`}
                >
                  {message.role === 'user' ? (
                    <div className="prose prose-sm max-w-none prose-invert">
                      {message.content.split('\n').map((line: string, i: number) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="markdown-content text-gray-200">
                      <ReactMarkdown
                        components={{
                          h1: ({node, ...props}) => <h1 className={compactMarkdownStyles.h1} {...props} />,
                          h2: ({node, ...props}) => <h2 className={compactMarkdownStyles.h2} {...props} />,
                          h3: ({node, ...props}) => <h3 className={compactMarkdownStyles.h3} {...props} />,
                          p: ({node, children, ...props}) => {
                            // Use a more type-safe approach
                            const parentNode = (node as any)?.parent;
                            const isInListItem = parentNode?.type === 'listItem';
                            return isInListItem 
                              ? <span className="inline" {...props}>{children}</span>
                              : <p className={compactMarkdownStyles.p} {...props}>{children}</p>;
                          },
                          ul: ({node, ...props}) => <ul className={compactMarkdownStyles.ul} {...props} />,
                          ol: ({node, ...props}) => <ol className={compactMarkdownStyles.ol} {...props} />,
                          li: ({node, ...props}) => <li className={compactMarkdownStyles.li} {...props} />,
                          strong: ({node, ...props}) => <strong className={compactMarkdownStyles.strong} {...props} />,
                          em: ({node, ...props}) => <em className={compactMarkdownStyles.em} {...props} />,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input with collapse button on the left side when expanded */}
          <div className="p-4 border-t border-gray-700 bg-gray-800 shadow-inner flex-shrink-0">
            <div className="flex gap-2">
              {/* Collapse button next to input when panel is open */}
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-gray-300 border border-gray-600 flex-shrink-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              <form onSubmit={handleSendMessage} className="flex gap-2 flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-4 py-2 bg-indigo-600 text-gray-100 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    'Send'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}