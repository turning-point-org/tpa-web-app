"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { ChatMessage, DocumentInfo } from "@/types";
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { OraIcon } from "@/assets/icons";

interface OraPanelProps {
  scanId: string;
  tenantSlug: string;
  workspaceId: string;
}

const REQUIRED_DOCUMENT_TYPES = [
  "HRIS Report",
  "Org. Structure",
  "Strategic Objectives",
  "Cost Breakdown",
  "Technology Roadmaps",
  "General Ledger",
  "Data Capability"
];

export default function OraPanel({ scanId, tenantSlug, workspaceId }: OraPanelProps) {
  const { user, isLoading: userLoading } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m Ora, your AI assistant. I can help you understand the documents uploaded for this scan. What would you like to know?'
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

  // Function to get document status context
  const getDocumentStatusContext = () => {
    const uploadedTypes = uploadedDocuments.map(doc => doc.document_type);
    const missingTypes = REQUIRED_DOCUMENT_TYPES.filter(
      type => !uploadedTypes.some(uploadedType => uploadedType === type)
    );
    
    let context = "### Document Status\n\n";
    
    if (uploadedDocuments.length === 0) {
      context += "No documents have been uploaded yet.\n\n";
    } else {
      context += `Uploaded ${uploadedDocuments.length} of ${REQUIRED_DOCUMENT_TYPES.length} required documents:\n\n`;
      
      // List uploaded documents
      uploadedDocuments.forEach(doc => {
        context += `- **${doc.document_type}:** "${doc.file_name}"\n`;
      });
      
      // List missing documents
      if (missingTypes.length > 0) {
        context += "\nMissing documents:\n\n";
        missingTypes.forEach(type => {
          context += `- **${type}:** ${getDocumentDescription(type)}\n`;
        });
      }
    }
    
    // Add company information if available
    if (companyData) {
      context += "\n### Company Information\n\n";
      if (companyData.name) context += `- **Company Name:** ${companyData.name}\n`;
      if (companyData.industry) context += `- **Industry:** ${companyData.industry}\n`;
      if (companyData.size) context += `- **Company Size:** ${companyData.size}\n`;
    }
    
    return context;
  };

  // Function to clear chat history
  const clearChatHistory = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat history has been cleared. How else can I help you today?'
      }
    ]);
    if (documentsLoaded) {
      fetchDocuments().then(() => {
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
    const uploadedTypes = uploadedDocuments.map(doc => doc.document_type);
    const missingTypes = REQUIRED_DOCUMENT_TYPES.filter(
      type => !uploadedTypes.some(uploadedType => uploadedType === type)
    );
    
    let message = "### Welcome to Ora!\n\n";
    
    if (uploadedDocuments.length === 0) {
      message += "I notice you haven't uploaded any documents yet for this scan. ";
      message += "To proceed with the Scan workflow, you'll need to upload the following required documents:\n\n";
      
      REQUIRED_DOCUMENT_TYPES.forEach(type => {
        message += `- **${type}:** ${getDocumentDescription(type)}\n`;
      });
      
      message += "\nPlease upload these documents to proceed with your analysis. How can I assist you today?";
    } else {
      message += "I see you've uploaded some documents. Here's what I can help you with:\n\n";
      message += "- Answer questions about your uploaded documents\n";
      message += "- Explain what information is still needed\n";
      message += "- Help you understand the analysis process\n\n";
      
      if (missingTypes.length > 0) {
        message += "You still need to upload the following documents:\n\n";
        missingTypes.forEach(type => {
          message += `- **${type}:** ${getDocumentDescription(type)}\n`;
        });
      }
      
      message += "\nWhat would you like to know?";
    }
    
    return message;
  };

  // Helper function to get document descriptions
  const getDocumentDescription = (docType: string): string => {
    const descriptions: Record<string, string> = {
      "HRIS Report": "Contains employee data, roles, compensation, and HR metrics",
      "Org. Structure": "Outlines reporting relationships and organizational hierarchy",
      "Strategic Objectives": "Defines business goals, initiatives, and strategic direction",
      "Cost Breakdown": "Detailed breakdown of costs with general ledger codes",
      "Technology Roadmaps": "Plans for technology implementation and digital transformation",
      "General Ledger": "Complete financial transaction records and accounting data",
      "Data Capability": "Information about data systems, analytics, and processing capabilities"
    };
    
    return descriptions[docType] || "Important document for business analysis";
  };

  // Fetch documents and company data when component mounts
  useEffect(() => {
    const fetchAllData = async () => {
      await fetchDocuments();
      await fetchCompanyData();
      
      if (messages.length === 1 && messages[0].role === 'assistant') {
        setMessages([
          {
            role: 'assistant',
            content: generateWelcomeMessage()
          }
        ]);
      }
      
      setDocumentsLoaded(true);
    };
    
    fetchAllData();
  }, []);

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
      return documents;
    } catch (error) {
      console.error("Error fetching documents:", error);
      return [];
    }
  };

  const fetchCompanyData = async () => {
    try {
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/data-room?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
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
            documentStatus: getDocumentStatusContext(),
            formatInstructions: "Use markdown formatting for your response. Format lists with dashes (-) and use ** for bold text and * for italic. Use ### for section headings."
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

  return (
    <div className={`fixed top-0 right-0 bottom-0 z-10 bg-gray-900 shadow-lg transition-all duration-300 ease-in-out ${isExpanded ? `w-[500px]` : 'w-12'}`}>
      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 p-2 rounded-full shadow-md hover:bg-gray-700 transition-colors z-20 text-gray-300 border-2 border-indigo-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-6 w-6 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Ora Logo - Always visible */}
      {!isExpanded && (
        <div className="flex items-center justify-center h-12 mt-2">
          <OraIcon className="w-7 h-7" />
        </div>
      )}

      {isExpanded && (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800 flex items-center">
            <OraIcon className="w-8 h-8 mr-3" />
            <h2 className="text-lg font-semibold text-gray-100">Ora</h2>
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900 ora-messages-container">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
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
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-700 bg-gray-800 shadow-inner flex-shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-2">
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
      )}
    </div>
  );
}