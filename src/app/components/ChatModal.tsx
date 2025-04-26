'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUser } from "@auth0/nextjs-auth0/client";
import Image from "next/image";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { REQUIRED_DOCUMENT_TYPES, DOCUMENT_DESCRIPTIONS } from '@/lib/document-config';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type DocumentResult = {
  document_id: string;
  document_type: string;
  file_name: string;
  text: string;
  score: number;
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

type ChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  scanId: string;
  tenantSlug: string;
  workspaceId: string;
};

export default function ChatModal({ isOpen, onClose, scanId, tenantSlug, workspaceId }: ChatModalProps) {
  const { user, isLoading: userLoading } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Data Room Assistant. I can help you understand the documents uploaded for this scan. What would you like to know?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentInfo[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);

  // Function to clear chat history
  const clearChatHistory = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat history has been cleared. How else can I help you today?'
      }
    ]);
    // Refresh document status to update welcome message
    if (documentsLoaded) {
      fetchDocuments().then(() => {
        // After refreshing documents, reload the welcome message
        setTimeout(() => {
          setMessages([
            {
              role: 'assistant',
              content: generateWelcomeMessage()
            }
          ]);
        }, 100);
      });
    }
  };

  // Generate welcome message based on document status
  const generateWelcomeMessage = () => {
    // Get uploaded document types
    const uploadedTypes = uploadedDocuments.map(doc => doc.document_type);
    
    // Get missing document types
    const missingTypes = REQUIRED_DOCUMENT_TYPES.filter(
      type => !uploadedTypes.some(uploadedType => uploadedType === type.toString())
    );
    
    let message = "### Welcome to the Turning Point Advisory Data Room Assistant!\n\n";
    
    if (uploadedDocuments.length === 0) {
      message += "I notice you haven't uploaded any documents yet for this scan. ";
      message += "To proceed with the Scan workflow, you'll need to upload the following required documents:\n\n";
      
      REQUIRED_DOCUMENT_TYPES.forEach(type => {
        message += `- **${type}:** ${getDocumentDescription(type)}\n`;
      });
      
      message += "\nPlease upload these documents to proceed with your analysis. How can I assist you today?";
    } else {
      message += `I see you've uploaded ${uploadedDocuments.length} of ${REQUIRED_DOCUMENT_TYPES.length} required documents.\n\n`;
      
      // Add uploaded documents with assessment
      message += "### Uploaded Documents\n\n";
      uploadedDocuments.forEach(doc => {
        const docTypeAssessment = getDocumentAssessment(doc.document_type, doc.file_name);
        message += `- **${doc.document_type}:** "${doc.file_name}" - *${docTypeAssessment}*\n`;
      });
      
      // Add missing documents
      if (missingTypes.length > 0) {
        message += "\n### Missing Documents (needed to proceed with scan)\n\n";
        missingTypes.forEach(type => {
          message += `- **${type}:** ${getDocumentDescription(type)}\n`;
        });
        
        message += "\nUploading these documents will greatly enhance the analysis process.";
      } else {
        message += "\n**Great job!** You've uploaded all required documents for the Scan workflow.";
      }
      
      message += "\n\nHow can I help you analyse these documents today?";
      
      // Add note about document relevance checking
      message += "\n\n*Note: As you ask questions about specific documents, I'll assess whether the document content matches what would be expected for that document type and let you know if there appears to be a mismatch.*";
    }
    
    return message;
  };

  // Helper function to get document descriptions
  const getDocumentDescription = (docType: string): string => {
    return DOCUMENT_DESCRIPTIONS[docType as keyof typeof DOCUMENT_DESCRIPTIONS] || "Important document for business analysis";
  };

  // Helper function to assess document relevance based on filename
  const getDocumentAssessment = (docType: string, fileName: string): string => {
    // Simple relevance check based on filename and document type
    const filenameLower = fileName.toLowerCase();
    const docTypeLower = docType.toLowerCase();
    
    // These are simple heuristics to determine if filenames match expected content
    // In a production environment, this could be enhanced with actual content analysis
    if (docType === "HRIS Reports" && 
        (filenameLower.includes("hr") || 
         filenameLower.includes("employee") || 
         filenameLower.includes("personnel") ||
         filenameLower.includes("workforce"))) {
      return "Appears to be a relevant HR document";
    }
    
    if (docType === "Business Strategy Documents" && 
        (filenameLower.includes("strateg") || 
         filenameLower.includes("objective") || 
         filenameLower.includes("plan") ||
         filenameLower.includes("goal"))) {
      return "Appears to be a relevant strategic document";
    }
    
    if (docType === "Financial Documents" && 
        (filenameLower.includes("cost") || 
         filenameLower.includes("expense") || 
         filenameLower.includes("budget") ||
         filenameLower.includes("gl") ||
         filenameLower.includes("financial") ||
         filenameLower.includes("ledger"))) {
      return "Appears to be a relevant financial document";
    }
    
    if (docType === "Technology Roadmaps" && 
        (filenameLower.includes("tech") || 
         filenameLower.includes("roadmap") || 
         filenameLower.includes("it") ||
         filenameLower.includes("digital"))) {
      return "Appears to be a relevant technology document";
    }
    
    if (docType === "Pain Points" && 
        (filenameLower.includes("pain") || 
         filenameLower.includes("challenge") || 
         filenameLower.includes("issue") ||
         filenameLower.includes("problem") ||
         filenameLower.includes("obstacle"))) {
      return "Appears to be a relevant document about organizational challenges";
    }
    
    // If no specific matches, give a more general assessment
    if (filenameLower.includes(docTypeLower.replace(/\s+/g, "").replace(".", ""))) {
      return "Filename suggests relevant content for this category";
    }
    
    return "Uploaded successfully, but filename doesn't clearly indicate content relevance";
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Fetch documents when modal opens and update welcome message
  useEffect(() => {
    if (isOpen) {
      const fetchAllData = async () => {
        // Fetch documents if not already loaded
        if (!documentsLoaded) {
          await fetchDocuments();
        }
        
        // Also fetch company data if not already loaded
        if (!companyData) {
          await fetchCompanyData();
        }
        
        // Update welcome message
        if (messages.length === 1 && messages[0].role === 'assistant') {
          setMessages([
            {
              role: 'assistant',
              content: generateWelcomeMessage()
            }
          ]);
        }
      };
      
      fetchAllData();
    }
  }, [isOpen, documentsLoaded, uploadedDocuments, companyData]);

  // Reset input when modal closes
  useEffect(() => {
    if (!isOpen) {
      setInput('');
    }
  }, [isOpen]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/documents?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      
      const documents: DocumentInfo[] = await response.json();
      setUploadedDocuments(documents);
      setDocumentsLoaded(true);
      
      return documents;
    } catch (error) {
      console.error("Error fetching documents:", error);
      return [];
    }
  };

  // Add function to fetch company data
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

  // Update the getDocumentStatusContext function to include company info
  const getDocumentStatusContext = () => {
    // Get uploaded document types
    const uploadedTypes = uploadedDocuments.map(doc => doc.document_type);
    
    // Get missing document types
    const missingTypes = REQUIRED_DOCUMENT_TYPES.filter(
      type => !uploadedTypes.some(uploadedType => uploadedType === type.toString())
    );
    
    let context = "";
    
    // Add company information if available
    if (companyData) {
      context += "Company Information:\n";
      context += `Name: ${companyData.name || 'Not provided'}\n`;
      context += `Website: ${companyData.website || 'Not provided'}\n`;
      context += `Country: ${companyData.country || 'Not provided'}\n`;
      context += `Industry: ${companyData.industry || 'Not provided'}\n`;
      context += `Description: ${companyData.description || 'Not provided'}\n\n`;
    }
    
    context += "Document Status Information:\n";
    
    if (uploadedDocuments.length === 0) {
      context += "No documents have been uploaded yet. All required documents are missing.\n";
    } else {
      context += `${uploadedDocuments.length} of ${REQUIRED_DOCUMENT_TYPES.length} required documents have been uploaded.\n\n`;
      
      // Add uploaded documents
      context += "Uploaded Documents:\n";
      uploadedDocuments.forEach(doc => {
        const date = new Date(doc.uploaded_at).toLocaleDateString();
        context += `- ${doc.document_type}: "${doc.file_name}" (uploaded on ${date})\n`;
      });
      
      // Add missing documents
      if (missingTypes.length > 0) {
        context += "\nMissing Documents:\n";
        missingTypes.forEach(type => {
          context += `- ${type}\n`;
        });
      }
    }
    
    return context;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Add user message
    const userMessage = { role: 'user' as const, content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Refresh document status before sending
    if (!documentsLoaded) {
      await fetchDocuments();
    }

    try {
      // Format conversation history for the API
      // Exclude the initial welcome message and the current user message (which we just added)
      const historyToSend = messages.length > 1 
        ? messages.slice(1).map(msg => ({ 
            role: msg.role, 
            content: msg.content 
          }))
        : [];
      
      // Send the query to the chat API
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/chat?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            query: userMessage.content,
            conversationHistory: historyToSend,
            documentStatus: getDocumentStatusContext(),
            formatInstructions: "Use markdown formatting for your response. Format lists with dashes (-) and use ** for bold text and * for italic. Use ### for section headings. For example: \n\n### Document Types\n\n- **Strategic Objectives:** Description here\n- **Cost Breakdown:** Description here"
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Chat API error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch chat response');
      }

      const data = await response.json();
      
      // Use the AI-generated message if available, otherwise fall back to the old behavior
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        const results = data.results || [];
        
        let assistantResponse = '';
        
        if (results.length === 0) {
          assistantResponse = "I don't have any relevant information about that in the documents you've uploaded. Please try asking something else or upload more documents.";
        } else {
          // Create a response based on the search results
          assistantResponse = `Based on the documents you've uploaded, here's what I found:\n\n`;
          
          // Add information from each document
          results.forEach((result: DocumentResult, index: number) => {
            assistantResponse += `From document "${result.file_name}" (${result.document_type}):\n`;
            assistantResponse += `${result.text.substring(0, 500)}${result.text.length > 500 ? '...' : ''}\n\n`;
          });
        }
        
        // Add assistant message
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Data Room Assistant</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={clearChatHistory}
              className="text-gray-500 hover:text-gray-700 flex items-center text-sm"
              title="Clear chat history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-1">
                <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
              </svg>
              Clear Chat
            </button>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((message, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Profile Picture with name/email */}
              <div className="flex items-center gap-2 mb-1">
                {message.role === 'assistant' ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500">Assistant</span>
                  </>
                ) : (
                  <>
                    {user ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 text-right">{user.email || "You"}</span>
                        <div className="w-6 h-6 rounded-full overflow-hidden">
                          <Image
                            src={user.picture || "/user-icon.png"}
                            alt="User"
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 text-right">You</span>
                        <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Message Content */}
              <div 
                className={cn(
                  "rounded-lg p-4 shadow-sm",
                  message.role === 'user' 
                    ? "bg-blue-500 text-white max-w-[65%]" 
                    : "bg-gray-100 text-gray-800 max-w-[65%]"
                )}
              >
                {message.role === 'assistant' ? (
                  <div className="markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Define custom renderers for markdown elements if needed
                        a: ({ node, ...props }) => (
                          <a target="_blank" rel="noopener noreferrer" {...props} />
                        ),
                        // Add more custom renderers as needed
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <form onSubmit={handleSendMessage} className="border-t p-4">
          <div className="flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="flex-1 border rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className={`bg-blue-600 text-white px-4 py-2 rounded-r-lg ${
                isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <div className="h-5 w-5 border-t-2 border-r-2 border-white rounded-full animate-spin" />
              ) : (
                'Send'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 