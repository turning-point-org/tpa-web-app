"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useSearchParams } from 'next/navigation';
import { ChatMessage } from "@/types";
import ReactMarkdown from 'react-markdown';
import { OraIcon } from "@/assets/icons";
import { InterviewIcon, PainPointIcon } from "@/assets/icons/interview-icons";
import Button from './Button';

interface OraInterviewPanelProps {
  scanId: string;
  tenantSlug: string;
  workspaceId: string;
  lifecycleId: string; // Required to focus the interview on a specific lifecycle
  lifecycleName?: string | null; // Optional lifecycle name that can be passed directly
}

type ModeName = 'chat' | 'interview' | 'painpoint';

interface ActiveModes {
  chat: boolean;
  interview: boolean;
  painpoint: boolean;
}

interface ExpandedStates {
  chat: boolean;
}

// Define lifecycle type
interface Lifecycle {
  id: string;
  name: string;
  description: string;
  processes?: {
    process_categories?: Array<{
      name: string;
      description?: string;
      score?: number;
      process_groups?: Array<{
        name: string;
        description?: string;
        score?: number;
      }>;
    }>;
  };
  stakeholders?: Array<{
    name: string;
    role: string;
  }>;
  [key: string]: any; // Allow for additional properties
}

// Define PainPoint interface
interface PainPoint {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  // Remove the cost_to_serve property
  // Allow for strategic objective properties (so_*)
  [key: string]: any; 
}

// Define Summary interface
interface SummaryData {
  pain_points: PainPoint[];
  overallSummary: string;
}

// Add Speech-to-Text types
type SpeechRecognizer = {
  recognized: (s: any, e: any) => void;
  canceled: (s: any, e: any) => void;
  sessionStarted: (s: any, e: any) => void;
  sessionStopped: (s: any, e: any) => void;
  startContinuousRecognitionAsync: (successCallback: () => void, errorCallback: (error: unknown) => void) => void;
  stopContinuousRecognitionAsync: (successCallback?: () => void, errorCallback?: (error: unknown) => void) => void;
};



// PainPointCard component to display individual pain points
const PainPointCard = ({ 
  painPoint, 
  onDeleteClick,
  allProcessGroups = [],
  onProcessGroupChange,
  isLoadingProcessGroups = false,
  tenantSlug,
  workspaceId,
  scanId,
  lifecycleId,
  painPointSummaryData,
  dispatchLifecycleUpdateEvent,
  onPainPointUpdate
}: { 
  painPoint: PainPoint;
  onDeleteClick: (id: string) => void;
  allProcessGroups?: Array<{ name: string, description?: string }>;
  onProcessGroupChange: (painPointId: string, newProcessGroup: string) => void;
  isLoadingProcessGroups?: boolean;
  tenantSlug: string;
  workspaceId: string;
  scanId: string;
  lifecycleId: string;
  painPointSummaryData: SummaryData;
  dispatchLifecycleUpdateEvent: () => void;
  onPainPointUpdate: (updatedPainPoint: PainPoint) => void;
}) => {
  // Add state to track if strategic objectives are expanded
  const [objectivesExpanded, setObjectivesExpanded] = useState(false);

  const handleProcessGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onProcessGroupChange(painPoint.id, e.target.value);
  };

  // Add handler for strategic objective score change
  const handleStratObjScoreChange = async (objKey: string, newScore: number) => {
    try {
      // Create updated pain point with the new strategic objective score
      const updatedPainPoint = { ...painPoint };
      updatedPainPoint[objKey] = newScore;
      
      // First immediately update the UI via parent's state
      onPainPointUpdate(updatedPainPoint);
      
      // Then update database
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}&t=${Date.now()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify({
            summary: {
              ...painPointSummaryData,
              pain_points: painPointSummaryData.pain_points.map((point: PainPoint) => 
                point.id === painPoint.id ? updatedPainPoint : point
              )
            },
            tenantSlug,
            workspaceId,
            scanId,
            lifecycleId
          })
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to update strategic objective score: ${response.status}`);
      }
      
      // Notify the parent component that pain points have changed
      dispatchLifecycleUpdateEvent();
      
    } catch (error) {
      console.error('Error updating strategic objective score:', error);
    }
  };

  // Add function to calculate total score from strategic objectives
  const calculateTotalScore = (): number => {
    let totalScore = 0;
    
    // Loop through all properties of the pain point
    Object.entries(painPoint).forEach(([key, value]) => {
      // Check if the key starts with "so_" (strategic objective) and value is a number
      if (key.startsWith('so_') && typeof value === 'number') {
        totalScore += value;
      }
    });
    
    return totalScore;
  };

  // Calculate the total score
  const totalScore = calculateTotalScore();

  // Get a list of strategic objectives for display
  const getStrategicObjectives = () => {
    return Object.entries(painPoint)
      .filter(([key, value]) => key.startsWith('so_') && typeof value === 'number' && value >= 0)
      .map(([key, value]) => ({
        name: key.replace('so_', '').split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        score: value
      }));
  };

  const strategicObjectives = getStrategicObjectives();

  // Add toggle handler
  const toggleObjectives = () => {
    setObjectivesExpanded(prev => !prev);
  };

  return (
    <div className="bg-gray-700 rounded-md p-3 mb-3 shadow-sm border border-gray-600 relative">
      {/* Delete button */}
      <button
        onClick={() => onDeleteClick(painPoint.id)}
        className="absolute top-2 right-2 p-1 rounded-full bg-gray-600 hover:bg-red-700 transition-colors text-gray-300 hover:text-white"
        title="Delete pain point"
        aria-label="Delete pain point"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {/* Score display - use flex to show horizontally */}
      <div className="mb-1.5">
        {/* Show total strategic objective score (not editable) */}
        <span className="text-xs px-2 py-0.5 rounded-md bg-[#0EA394] text-white">
          {totalScore} {totalScore === 1 ? 'point' : 'points'}
        </span>
      </div>
      
      <h3 className="font-medium text-white text-sm mb-1.5 pr-7">{painPoint.name}</h3>
      
      <p className="text-gray-300 text-xs mb-2">{painPoint.description}</p>
      
      {/* Show strategic objectives that contribute to the score */}
      {strategicObjectives.length > 0 && (
        <div className="mt-2 mb-2">
          <div 
            className="text-xs text-gray-400 mb-1 flex items-center cursor-pointer" 
            onClick={toggleObjectives}
          >
            <Button
              variant="primary"
              className="mr-1 p-0 border-0 shadow-none min-w-[16px] min-h-[16px] w-4 h-4 text-gray-300"
              iconOnly
              colorOverride="#1f2937"
              icon={
                <svg 
                  className={`w-3 h-3 transition-transform duration-200 ${objectivesExpanded ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              }
            />
            Strategic Objective Applicability:
          </div>
          {objectivesExpanded && (
            <div className="flex flex-wrap gap-1">
              {strategicObjectives.map(obj => {
                // Get the original key by converting back to so_ format
                const objKey = 'so_' + obj.name.toLowerCase().replace(/ /g, '_');
                
                return (
                  <span 
                    key={obj.name} 
                    className="text-xs px-1.5 py-0.5 rounded bg-gray-600 text-gray-300 flex items-center"
                    title={`${obj.name}`}
                  >
                    <select
                      value={obj.score}
                      onChange={(e) => handleStratObjScoreChange(objKey, parseInt(e.target.value))}
                      className="mr-1.5 bg-gray-500 rounded text-xs border-none text-white py-0.5 px-1"
                      aria-label={`Set priority for ${obj.name}`}
                    >
                      <option value="0">N/A (0)</option>
                      <option value="1">Low (1)</option>
                      <option value="2">Med (2)</option>
                      <option value="3">High (3)</option>
                    </select>
                    {obj.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Process Group Select Dropdown */}
      <div className="mt-2">
        <div className="text-xs text-gray-400 mb-1">Assigned Process:</div>
        <select 
          value={painPoint.assigned_process_group || "Unassigned"}
          onChange={handleProcessGroupChange}
          className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-md py-1 px-2 text-xs"
          aria-label="Assign process group"
          disabled={isLoadingProcessGroups}
        >
          <option value="Unassigned">Unassigned</option>
          
          {isLoadingProcessGroups ? (
            <option disabled>Loading process groups...</option>
          ) : (
            <>
              {allProcessGroups.map(group => (
                <option key={group.name} value={group.name}>
                  {group.name}
                </option>
              ))}
              
              {/* Add currently assigned group if not in the list */}
              {painPoint.assigned_process_group && 
              painPoint.assigned_process_group !== "Unassigned" && 
              !allProcessGroups.some(g => g.name === painPoint.assigned_process_group) && (
                <option key={painPoint.assigned_process_group} value={painPoint.assigned_process_group}>
                  {painPoint.assigned_process_group} (Not in current lifecycle)
                </option>
              )}
            </>
          )}
        </select>
      </div>
    </div>
  );
};

// Add a confirmation modal component
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md mx-4 border border-gray-700">
        <h3 className="text-xl font-semibold text-gray-100 mb-3">{title}</h3>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 rounded-md text-gray-300 hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 rounded-md text-white hover:bg-red-700"
          >
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  );
};

// Add DeleteConfirmModal component (reusing the existing ConfirmModal structure)
const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  painPointName
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  painPointName: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md mx-4 border border-gray-700">
        <h3 className="text-xl font-semibold text-gray-100 mb-3">Delete Pain Point</h3>
        <p className="text-gray-300 mb-6">
          Are you sure you want to delete the pain point <span className="font-semibold">"{painPointName}"</span>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 rounded-md text-gray-300 hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 rounded-md text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default function OraInterviewPanel({ scanId, tenantSlug, workspaceId, lifecycleId, lifecycleName }: OraInterviewPanelProps) {
  const { user: _user, isLoading: _userLoading } = useUser();
  const searchParams = useSearchParams();
  const transcriptNameFromUrl = searchParams.get('transcript_name');
  const journeyFromUrl = searchParams.get('journey');

  // Refs to hold the latest URL params to solve stale closure in useEffect cleanup
  const transcriptNameRef = useRef(transcriptNameFromUrl);
  const journeyRef = useRef(journeyFromUrl);
  useEffect(() => {
    transcriptNameRef.current = transcriptNameFromUrl;
    journeyRef.current = journeyFromUrl;
  }, [transcriptNameFromUrl, journeyFromUrl]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I'm Ora, your interview copilot. ${lifecycleName ? `I'll help you explore the **${lifecycleName}** lifecycle and identify opportunities for improvement.` : `I'll help you analyze this business lifecycle and identify opportunities for improvement.`} Let's collaborate on understanding the current processes and challenges.`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [isLoadingLifecycle, setIsLoadingLifecycle] = useState(true);
  const [error, setError] = useState<string>("");
  
  // Track which modes are active - default to having all panels open for pain point interview
  const [activeModes, setActiveModes] = useState<ActiveModes>({
    chat: true,
    interview: true, // Open transcript panel by default for pain point interviews
    painpoint: true  // Open pain points panel by default for pain point interviews
  });

  // Track expanded state separately for each panel that can be expanded/collapsed
  // Always default to expanded chat for pain point interviews
  const [expandedStates, setExpandedStates] = useState<ExpandedStates>({
    chat: true 
  });
  
  // No transitions or animations used for panels

  // Add custom scrollbar styles for all panels
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Firefox scrollbar styles */
      .ora-messages-container, 
      .ora-transcript-container, 
      .ora-painpoints-container {
        scrollbar-width: thin;
        scrollbar-color: #D0D0D0 transparent;
      }
      
      /* Webkit scrollbar styles (Chrome, Safari, Edge) */
      .ora-messages-container::-webkit-scrollbar,
      .ora-transcript-container::-webkit-scrollbar,
      .ora-painpoints-container::-webkit-scrollbar {
        width: 6px;
      }
      
      /* Hide tracks by matching parent background */
      .ora-messages-container::-webkit-scrollbar-track {
        background-color: transparent; 
        background: transparent;
      }
      
      .ora-transcript-container::-webkit-scrollbar-track,
      .ora-painpoints-container::-webkit-scrollbar-track {
        background-color: transparent;
        background: transparent;
      }
      
      /* Common thumb styles */
      .ora-messages-container::-webkit-scrollbar-thumb,
      .ora-transcript-container::-webkit-scrollbar-thumb,
      .ora-painpoints-container::-webkit-scrollbar-thumb {
        background-color: #D0D0D0;
        border-radius: 20px;
      }
      
      /* Hover state */
      .ora-messages-container::-webkit-scrollbar-thumb:hover,
      .ora-transcript-container::-webkit-scrollbar-thumb:hover,
      .ora-painpoints-container::-webkit-scrollbar-thumb:hover {
        background-color: #A0A0A0;
      }
      
      /* Individual panel targeting for better specificity */
      div.ora-transcript-container::-webkit-scrollbar-thumb {
        background-color: #D0D0D0 !important;
      }
      
      div.ora-painpoints-container::-webkit-scrollbar-thumb {
        background-color: #D0D0D0 !important;
      }
      
      /* For IE and Edge */
      .ora-messages-container, 
      .ora-transcript-container, 
      .ora-painpoints-container {
        -ms-overflow-style: auto;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Fetch lifecycle data to provide context for the interview
  useEffect(() => {
    async function fetchLifecycleData() {
      try {
        // If we already have the lifecycle name, create a basic lifecycle object
        if (lifecycleName && !lifecycle) {
          // Create a basic lifecycle object with the provided name
          setLifecycle({
            name: lifecycleName,
            description: "",
            id: lifecycleId
          });
          
          // Only set welcome message if there are no messages yet
          if (messages.length <= 1) {
            setMessages([
              {
                role: 'assistant',
                content: `# ${lifecycleName}
                
I'll collaborate with you to identify opportunities and challenges in the **${lifecycleName}** lifecycle. As your copilot, I'm here to guide our conversation about process improvement.

Let's explore together:
- What specific challenges are you experiencing in this process?
- Where do bottlenecks or inefficiencies occur?
- What improvements would have the greatest impact?
- How do these issues affect stakeholders and business outcomes?

Let's begin by discussing what aspects of this lifecycle you'd like to explore first.`
              }
            ]);
          }
          
          // Even if we have a basic lifecycle object, still fetch the complete data
          // but don't overwrite the name or messages if the fetch succeeds
        }
        
        // Fetch complete lifecycle data regardless, but be careful about what we update
        setIsLoadingLifecycle(true);
        setError(""); // Reset error on new load attempt
        
        const response = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycles?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to load lifecycle: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Very important: If we already have a lifecycle object with a name, preserve that name
        if (lifecycle && lifecycle.name) {
          // Update lifecycle with new data but keep the existing name
          setLifecycle((prev: Lifecycle | null) => ({
            ...data,
            name: prev?.name || data.name // Keep existing name if available
          }));
        } else {
          // No existing lifecycle, set it with the new data
          setLifecycle(data);
          
          // Only update the welcome message if we don't already have one with a name
          if (messages.length <= 1 && data.name) {
            setMessages([
              {
                role: 'assistant',
                content: `# ${data.name}
                
I'll collaborate with you to identify opportunities and challenges in the **${data.name}** lifecycle. As your copilot, I'm here to guide our conversation about process improvement.

Let's explore together:
- What specific challenges are you experiencing in this process?
- Where do bottlenecks or inefficiencies occur?
- What improvements would have the greatest impact?
- How do these issues affect stakeholders and business outcomes?

Let's begin by discussing what aspects of this lifecycle you'd like to explore first.`
              }
            ]);
          }
        }
      } catch (error) {
        console.error("Error fetching lifecycle:", error);
        
        // Only set error message if we don't already have a valid lifecycle
        if (!lifecycle || !lifecycle.name) {
          setMessages([
            {
              role: 'assistant',
              content: "I'm having trouble loading the lifecycle details. Let's proceed with the pain point interview anyway. What challenges do you observe in this business process?"
            }
          ]);
        }
      } finally {
        setIsLoadingLifecycle(false);
      }
    }
    
    fetchLifecycleData();
  }, [tenantSlug, workspaceId, scanId, lifecycleId, lifecycleName]);

  // Toggle a specific mode on/off
  const toggleMode = (mode: ModeName) => {
    setActiveModes(prev => ({
      ...prev,
      [mode]: !prev[mode]
    }));
    
    // If we're activating chat, also expand it
    if (mode === 'chat' && !activeModes.chat) {
      setExpandedStates(prev => ({
        ...prev,
        chat: true
      }));
    }
  };

  // Toggle the expanded state of a specific panel without animation
  const toggleExpanded = (panel: keyof ExpandedStates) => {
    // No transitions for expanded states
    setExpandedStates(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
  };

  // Instantly collapse without animation
  const instantCollapse = (panel: keyof ExpandedStates) => {
    setExpandedStates(prev => ({
      ...prev,
      [panel]: false
    }));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Create lifecycle context for the AI
      let interviewContext = "";
      
      if (lifecycle) {
        interviewContext = `### Interview Context\n\n`;
        interviewContext += `- **Lifecycle Name**: ${lifecycle.name}\n`;
        interviewContext += `- **Description**: ${lifecycle.description || 'No description provided'}\n\n`;
        
        // Add lifecycle ID to ensure the backend can fetch the complete data
        interviewContext += `- **Lifecycle ID**: ${lifecycle.id}\n`;
        
        interviewContext += `- **Active Modes**: ${Object.entries(activeModes)
          .filter(([_mode, isActive]) => isActive)
          .map(([mode]) => mode)
          .join(', ')}\n\n`;
        
        // Add process categories if available - fix possible undefined errors
        const processCategories = lifecycle.processes?.process_categories;
        if (processCategories && processCategories.length > 0) {
          interviewContext += `### Process Categories\n\n`;
          processCategories.forEach((category: any, index: number) => {
            interviewContext += `${index + 1}. **${category.name}**: ${category.description || 'No description'}\n`;
            
            // Add process groups if available
            if (category.process_groups?.length > 0) {
              category.process_groups.forEach((group: any) => {
                interviewContext += `   - ${group.name}: ${group.description || 'No description'}\n`;
              });
            }
          });
        }
        
        // Add stakeholders if available
        if (lifecycle.stakeholders && lifecycle.stakeholders.length > 0) {
          interviewContext += `\n### Stakeholders\n\n`;
          lifecycle.stakeholders.forEach((stakeholder: any) => {
            interviewContext += `- **${stakeholder.name}** (${stakeholder.role})\n`;
          });
        }
        
        // Add pain points data if available
        if (painPointSummaryData && painPointSummaryData.pain_points && painPointSummaryData.pain_points.length > 0) {
          interviewContext += `\n### Current Pain Points\n\n`;
          
          // Add overall summary if available
          if (painPointSummaryData.overallSummary) {
            interviewContext += `**Overall Summary**: ${painPointSummaryData.overallSummary}\n\n`;
          }
          
          // Add detailed pain points
          painPointSummaryData.pain_points.forEach((point, index) => {
            interviewContext += `${index + 1}. **[${point.id}] ${point.name}** (Score: ${point.score || 'N/A'}, Process Group: ${point.assigned_process_group || 'Unassigned'})\n`;
            interviewContext += `   - Description: ${point.description}\n`;
            interviewContext += '\n';
          });
          
          // Add instruction for Ora to understand the pain points context
          interviewContext += `When the user asks about specific pain points, you can refer to them by their ID (e.g., "${painPointSummaryData.pain_points[0]?.id}") or name. You should be able to answer questions about these pain points based on the information provided above.\n\n`;
        }
      }

      // Use the pain points specific chat endpoint
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/pain-points/chat?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: userMessage,
            conversationHistory: messages,
            lifecycleContext: interviewContext,
            activeModes: activeModes,
            formatInstructions: "Use extremely compact markdown formatting with minimal spacing. Use dashes (-) for lists. Avoid line breaks between paragraphs, list items, and headers. Use ### for section headings, ** for bold, and * for italic. Keep line breaks to absolute minimum."
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.message || "I'm analyzing this business process. Can you tell me more about the specific pain points you're experiencing?" 
      }]);
    } catch (error) {
      console.error('Error in pain point interview:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your message. Let\'s continue with the interview. What pain points are you identifying in this business process?'
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

  // Add custom markdown styles with improved line spacing
  const compactMarkdownStyles = {
    h1: 'text-xl font-bold mt-2 mb-1',
    h2: 'text-lg font-bold mt-2 mb-1',
    h3: 'text-base font-bold mt-1.5 mb-1',
    p: 'mt-1 mb-1 leading-relaxed',
    ul: 'list-disc pl-3 mt-0.5 mb-0.5',
    ol: 'list-decimal pl-3 mt-0.5 mb-0.5',
    li: 'mt-0.5 mb-0.5 leading-relaxed',
    strong: 'font-bold',
    em: 'italic',
  };

  // Show sidebar when chat is not active or not expanded
  const showSidebar = !activeModes.chat || !expandedStates.chat;

  // Add new state for transcription
  const [transcription, setTranscription] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSavingTranscription, setIsSavingTranscription] = useState(false);
  const [isLoadingTranscription, setIsLoadingTranscription] = useState(true);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
  // Add state for transcript editing
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  
  // Add new state for pain point summary using the structured format
  const [painPointSummaryRaw, setPainPointSummaryRaw] = useState<string>('');
  const [painPointSummaryData, setPainPointSummaryData] = useState<SummaryData>({
    pain_points: [],
    overallSummary: ''
  });
  const [isUpdatingSummary, setIsUpdatingSummary] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [lastSummaryUpdate, setLastSummaryUpdate] = useState<string | null>(null);
  
  // Add state to track if transcript has changed since last summary generation
  const [transcriptChangedSinceLastSummary, setTranscriptChangedSinceLastSummary] = useState(false);
  const [lastSummarizedTranscript, setLastSummarizedTranscript] = useState<string>('');
  
  // Refs for recording and transcription
  const azureSpeechServiceRef = useRef<SpeechRecognizer | null>(null);
  const transcriptionRef = useRef<string>('');
  const isRecordingRef = useRef<boolean>(false);
  const summaryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionContainerRef = useRef<HTMLDivElement>(null);
  
// ... (inside the OraInterviewPanel component)

// ...

  // Load existing transcription and summary when component mounts
  useEffect(() => {
    const loadExistingData = async () => {
      if (!lifecycleId) return;
      
      try {
        const transcriptionId = searchParams.get('transcription_id');
        const isNewInterview = searchParams.get('new') === 'true'; // New check for 'new' parameter

        // Check if transcript was recently reset
        let wasTranscriptReset = false;
        try {
          wasTranscriptReset = sessionStorage.getItem(`interview-transcript-reset-${lifecycleId}`) === 'true';
          const resetTime = parseInt(sessionStorage.getItem(`interview-transcript-reset-time-${lifecycleId}`) || '0');
          
          // Only consider reset state valid for 5 minutes
          if (Date.now() - resetTime > 5 * 60 * 1000) {
            wasTranscriptReset = false;
            sessionStorage.removeItem(`interview-transcript-reset-${lifecycleId}`);
            sessionStorage.removeItem(`interview-transcript-reset-time-${lifecycleId}`);
          }
        } catch (e) {
          console.warn('Error checking session storage:', e);
        }
        
        // Set initial loading states
        setIsLoadingTranscription(true);
        setIsLoadingSummary(true);
        
        // Load transcript only if not recently reset AND not a new interview
        if (!wasTranscriptReset && !isNewInterview) { // Added !isNewInterview condition
          let transcriptionUrl = `/api/tenants/by-slug/workspaces/scans/pain-points-transcription?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&t=${Date.now()}`;
          if (transcriptionId) {
            // If a specific transcription ID is provided, fetch by that ID
            transcriptionUrl += `&transcription_id=${transcriptionId}&fetch_by=id`;
          } else {
            // Otherwise, fall back to the original behavior of fetching the latest for the lifecycle
            transcriptionUrl += `&lifecycle_id=${lifecycleId}`;
          }

          const transcriptionResponse = await fetch(transcriptionUrl, { 
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          if (transcriptionResponse.ok) {
            const data = await transcriptionResponse.json();
            if (data.transcription) {
              setTranscription(data.transcription);
              transcriptionRef.current = data.transcription;
              console.log(`Loaded transcription ${transcriptionId ? `(ID: ${transcriptionId})` : '(latest)'} from database`);
            } else {
              setTranscription('');
              transcriptionRef.current = '';
              console.log('No existing transcription content found');
            }
          } else if (transcriptionResponse.status === 404) {
            setTranscription('');
            transcriptionRef.current = '';
            console.log('No transcription found (404)');
          } else {
            console.warn('Error loading transcription:', transcriptionResponse.status);
          }
        } else {
          // If it's a new interview or recently reset, ensure transcription is empty
          console.log('Starting new interview or transcript was recently reset, skipping transcription data load');
          setTranscription('');
          transcriptionRef.current = '';
        }
        
        // Always load pain points summary for the lifecycle (this logic remains unchanged)
        const summaryResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}&t=${Date.now()}`,
          {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        );
        
        if (summaryResponse.ok) {
          const data = await summaryResponse.json();
          if (data.pain_points || data.painPoints || data.summary) {
            if (data.pain_points) {
              setPainPointSummaryData(data);
              setPainPointSummaryRaw(JSON.stringify(data, null, 2));
              setLastSummarizedTranscript(transcriptionRef.current);
            } else if (data.painPoints) {
              setPainPointSummaryData({
                pain_points: data.painPoints,
                overallSummary: data.overallSummary || 'No summary available'
              });
              setPainPointSummaryRaw(JSON.stringify(data, null, 2));
              setLastSummarizedTranscript(transcriptionRef.current);
            } else if (typeof data.summary === 'string') {
              try {
                const parsed = JSON.parse(data.summary);
                setPainPointSummaryData({
                  pain_points: parsed.pain_points || parsed.painPoints || [],
                  overallSummary: parsed.overallSummary || 'No structured summary available'
                });
                setPainPointSummaryRaw(data.summary || '');
                setLastSummarizedTranscript(transcriptionRef.current);
              } catch (e) {
                setPainPointSummaryData({
                  pain_points: [],
                  overallSummary: data.summary || 'No structured pain points available'
                });
                setPainPointSummaryRaw(data.summary || '');
                setLastSummarizedTranscript(transcriptionRef.current);
              }
            }
            
            if (data.updated_at) {
              const updatedDate = new Date(data.updated_at);
              setLastSummaryUpdate(updatedDate.toLocaleTimeString());
            }
            
            console.log('Loaded existing summary from database');
          } else {
            setPainPointSummaryData({ pain_points: [], overallSummary: '' });
            setPainPointSummaryRaw('');
            setLastSummaryUpdate(null);
            console.log('No existing summary found');
          }
        } else if (summaryResponse.status === 404) {
          setPainPointSummaryData({ pain_points: [], overallSummary: '' });
          setPainPointSummaryRaw('');
          setLastSummaryUpdate(null);
          console.log('No summary found (404)');
        } else {
          console.warn('Error loading summary:', summaryResponse.status);
        }
      } catch (err) {
        console.error('Error loading existing data:', err);
      } finally {
        setIsLoadingTranscription(false);
        setIsLoadingSummary(false);
      }
    };
    
    loadExistingData();
  }, [tenantSlug, workspaceId, scanId, lifecycleId, searchParams]);
  
  // Add specific event listener for pain point updates from LifecycleViewer
  useEffect(() => {
    // Function to load pain point summary data
    const fetchPainPointsData = async () => {
      if (!lifecycleId) return;
      
      try {
        setIsLoadingSummary(true);
        
        const response = await fetch(
          `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}&t=${Date.now()}`,
          {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.pain_points) {
            setPainPointSummaryData(data);
            setPainPointSummaryRaw(JSON.stringify(data, null, 2));
            
            if (data.updated_at) {
              const updatedDate = new Date(data.updated_at);
              setLastSummaryUpdate(updatedDate.toLocaleTimeString());
            }
            
            console.log('Successfully refreshed pain points data after update from LifecycleViewer');
          }
        }
      } catch (err) {
        console.error('Error refreshing pain points after update:', err);
      } finally {
        setIsLoadingSummary(false);
      }
    };
    
    // Handler for pain point updates from LifecycleViewer
    const handlePainPointsUpdated = (event: CustomEvent) => {
      // Check if this update is for the current lifecycle
      if (event.detail.lifecycleId === lifecycleId) {
        console.log('Received pain-points-updated event, reloading pain points data');
        fetchPainPointsData();
      }
    };
    
    // Add event listener with type assertion
    window.addEventListener('pain-points-updated', handlePainPointsUpdated as EventListener);
    
    // Clean up event listener when component unmounts
    return () => {
      window.removeEventListener('pain-points-updated', handlePainPointsUpdated as EventListener);
    };
  }, [tenantSlug, workspaceId, scanId, lifecycleId]);
  
  // Update the ref whenever isRecording changes
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  
  // Keep a ref with the current transcription to use in the interval
  useEffect(() => {
    transcriptionRef.current = transcription;
    
    // Auto-scroll to the bottom of the transcription container
    if (transcriptionContainerRef.current) {
      const container = transcriptionContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [transcription]);
  
  // Track when transcript changes to determine if we need to generate a new summary
  useEffect(() => {
    // Only mark as changed if we have a previous summarized transcript to compare against
    // and the current transcript is different and not empty
    if (lastSummarizedTranscript && transcription && transcription !== lastSummarizedTranscript) {
      setTranscriptChangedSinceLastSummary(true);
    }
  }, [transcription, lastSummarizedTranscript]);
  
  // Function to save transcription to the database
  const saveTranscriptionToDatabase = useCallback(async (
    transcriptionText: string,
    transcriptName?: string | null,
    journeyRef?: string | null
  ) => {
    if (isSavingTranscription || !lifecycleId) return; // Prevent multiple concurrent saves
    
    try {
      setIsSavingTranscription(true);
      
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/pain-points-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription: transcriptionText,
          tenantSlug,
          workspaceId,
          scanId,
          lifecycleId,
          transcript_name: transcriptName, // Pass the name
          journey_ref: journeyRef,       // Pass the journey ref
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Transcription save error:', response.status, errorData);
      } else {
        console.log('Transcription saved successfully');
      }
    } catch (err) {
      console.error('Error saving transcription:', err);
    } finally {
      setIsSavingTranscription(false);
    }
  }, [tenantSlug, workspaceId, scanId, lifecycleId]);
  
  // Function to dispatch lifecycle data update event
  const dispatchLifecycleUpdateEvent = useCallback(() => {
    // Create and dispatch custom event to notify other components that lifecycle data has changed
    const event = new CustomEvent('lifecycle-data-updated', {
      detail: {
        lifecycleId,
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(event);
    console.log('Dispatched lifecycle-data-updated event');
  }, [lifecycleId]);
  
  // Function to update the summary using GPT
  const updateSummary = useCallback(async (saveToDatabase = true) => {
    try {
      const currentTranscription = transcriptionRef.current;
      if (!currentTranscription.trim() || !lifecycleId) {
        return;
      }
      
      setIsUpdatingSummary(true);
      
      let summaryDataFromApi = null;
      if (!saveToDatabase) {
        // This branch is for real-time UI updates during recording (not saving to DB)
        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            text: currentTranscription,
            tenantSlug,
            workspaceId,
            scanId,
            lifecycleId,
            saveToDatabase: false // Explicitly false here
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Summary API error:', response.status, errorData);
          throw new Error(`Failed to generate summary: ${response.status}`);
        }
        
        const data = await response.json();
        summaryDataFromApi = data.summary;
      } else {
        // This branch is executed when a transcription has just been saved to the DB.
        // The backend has already triggered the summarization, so we just need to re-fetch the latest summary.
        const response = await fetch(
          `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}&t=${Date.now()}`,
          {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to re-fetch summary after backend save:', response.status, errorData);
          throw new Error(`Failed to re-fetch summary: ${response.status}`);
        }
        const data = await response.json();
        summaryDataFromApi = data; // The GET endpoint returns the summary data directly
      }
      
      if (summaryDataFromApi) {
        // Store the raw JSON summary data
        const summaryData = summaryDataFromApi;
        
        // Update the pain point summary data state
        setPainPointSummaryData(summaryData);
        
        // Also keep the raw text format for debugging
        setPainPointSummaryRaw(JSON.stringify(summaryData, null, 2));
        
        // Update the timestamp
        const now = new Date();
        setLastSummaryUpdate(now.toLocaleTimeString());
        
        // Track that we've generated a summary for the current transcript
        setLastSummarizedTranscript(currentTranscription);
        setTranscriptChangedSinceLastSummary(false);
        
        if (saveToDatabase && summaryData.pain_points && summaryData.pain_points.length > 0) {
          dispatchLifecycleUpdateEvent();
        }
        
        console.log('Summary updated successfully');
      } else {
        console.warn('Summary API returned no summary data');
      }
    } catch (err) {
      console.error('Error generating summary:', err);
    } finally {
      setIsUpdatingSummary(false);
    }
  }, [tenantSlug, workspaceId, scanId, lifecycleId, dispatchLifecycleUpdateEvent]);
  
  // Function to clear the summary interval
  const clearSummaryInterval = () => {
    if (summaryIntervalRef.current) {
      clearTimeout(summaryIntervalRef.current);
      summaryIntervalRef.current = null;
    }
  };
  
  // Function to start the interval for summary updates
  const startSummaryInterval = useCallback(() => {
    // Clear any existing interval first
    clearSummaryInterval();
    
    // Update summary immediately if there's already transcription and it has changed
    if (transcriptionRef.current.trim() && transcriptChangedSinceLastSummary) {
      updateSummary(false); // Don't save to DB during recording
    }
    
    // Set up an interval to update the summary every 30 seconds
    const createSummaryTimer = () => {
      summaryIntervalRef.current = setTimeout(() => {
        if (transcriptionRef.current.trim()) {
          updateSummary(false).then(() => { // Don't save to DB during recording
            // Set up the next timer only if still recording
            if (isRecordingRef.current) {
              createSummaryTimer();
            }
          });
        } else {
          // Still set up next timer even if no transcription yet
          if (isRecordingRef.current) {
            createSummaryTimer();
          }
        }
      }, 30000); // 30 seconds in milliseconds
    };
    
    // Start the recursive timer
    createSummaryTimer();
  }, [updateSummary, transcriptChangedSinceLastSummary]);
  
  // Function to stop recording
  const stopRecording = useCallback(() => {
    if (azureSpeechServiceRef.current) {
      const recognizer = azureSpeechServiceRef.current;
      recognizer.stopContinuousRecognitionAsync(
        () => {
          console.log('Recording stopped');
          setIsRecording(false);
          clearSummaryInterval();
          
          // Trigger a final summary after stopping and save it to the database
          if (transcriptionRef.current.trim()) {
            // Generate a summary and save it to the database
            updateSummary(true);
            
            // Save the final transcription, including name and journey from URL
            saveTranscriptionToDatabase(
              transcriptionRef.current,
              transcriptNameFromUrl,
              journeyFromUrl
            );
          }
        },
        (err: unknown) => {
          setRecordingError(`Error stopping recording: ${err instanceof Error ? err.message : String(err)}`);
        }
      );
    }
  }, [updateSummary, saveTranscriptionToDatabase, transcriptNameFromUrl, journeyFromUrl]);
  
  // Clean up on unmount - NO DEPENDENCIES to prevent re-running during component lifecycle
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        // Use the ref directly to avoid dependency issues
        if (azureSpeechServiceRef.current) {
          const recognizer = azureSpeechServiceRef.current;
          recognizer.stopContinuousRecognitionAsync(
            () => {
              // Don't call setIsRecording here as component is unmounting
            },
            (err: unknown) => {
              console.error('Error stopping recording during cleanup:', err);
            }
          );
        }
      }
      
      // Save transcription if it exists
      if (transcriptionRef.current.trim()) {
        // Use fetch directly to avoid dependency issues
        fetch('/api/tenants/by-slug/workspaces/scans/pain-points-transcription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcription: transcriptionRef.current,
            tenantSlug,
            workspaceId,
            scanId,
            lifecycleId,
            transcript_name: transcriptNameRef.current,
            journey_ref: journeyRef.current,
          }),
        }).catch(err => {
          console.error('Error saving transcription during cleanup:', err);
        });
      }
      
      // Clear intervals
      if (summaryIntervalRef.current) {
        clearTimeout(summaryIntervalRef.current);
        summaryIntervalRef.current = null;
      }
      
      // Clean up recognizer
      if (azureSpeechServiceRef.current) {
        try {
          azureSpeechServiceRef.current.stopContinuousRecognitionAsync();
        } catch (e) {
          console.error("Error cleaning up speech recognizer:", e);
        }
        azureSpeechServiceRef.current = null;
      }
    };
  }, []);
  
  // Function to start recording
  const startRecording = useCallback(async () => {
    setRecordingError(null);
    
    try {
      // First check if microphone access is available
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop the stream immediately after testing
          stream.getTracks().forEach(track => track.stop());
        } catch (micError) {
          throw new Error(`Microphone access denied: ${micError instanceof Error ? micError.message : String(micError)}`);
        }
      } else {
        throw new Error('Your browser does not support microphone access. Please try a modern browser like Chrome, Edge, or Firefox.');
      }
      
      // First update the state to show we're starting
      setIsRecording(true);
      
      // Dynamically import the Speech SDK to avoid SSR issues
      const { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason } = await import('microsoft-cognitiveservices-speech-sdk');
      
      // Get the subscription key and region from environment variables
      const response = await fetch('/api/azure-speech-token');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get Azure Speech Service credentials: ${response.status} ${errorText}`);
      }
      
      const tokenData = await response.json();
      
      if (!tokenData.key || !tokenData.region) {
        throw new Error('Speech token is missing key or region');
      }
      
      const { key, region } = tokenData;
      
      // Configure the speech service
      const speechConfig = SpeechConfig.fromSubscription(key, region);
      speechConfig.speechRecognitionLanguage = 'en-GB';
      speechConfig.enableDictation();
      
      // Request word-level timestamps
      speechConfig.requestWordLevelTimestamps();
      speechConfig.enableAudioLogging();
      
      // Use the default microphone
      let audioConfig;
      try {
        audioConfig = AudioConfig.fromDefaultMicrophoneInput();
      } catch (audioError) {
        throw new Error(`Failed to access microphone: ${audioError instanceof Error ? audioError.message : String(audioError)}`);
      }
      
      // Create the speech recognizer
      let recognizer;
      try {
        recognizer = new SpeechRecognizer(speechConfig, audioConfig);
      } catch (recognizerError) {
        throw new Error(`Failed to create speech recognizer: ${recognizerError instanceof Error ? recognizerError.message : String(recognizerError)}`);
      }
      
      // Store the recognizer in the ref
      azureSpeechServiceRef.current = recognizer;

      // Set up event listeners for real-time transcription
      recognizer.recognized = async (s, e) => {
        if (e.result.reason === ResultReason.RecognizedSpeech) {
          // Get the latest text
          const newText = e.result.text;
          if (!newText.trim()) return; // Skip empty text
          
          // Format with timestamp
          const timestamp = new Date().toLocaleTimeString();
          const formattedText = `[${timestamp}] ${newText}`;
          
          // Update the transcription with timestamp
          setTranscription(prev => 
            prev ? `${prev}\n\n${formattedText}` : formattedText
          );
        }
      };
      
      // Add session started/stopped events
      recognizer.sessionStarted = (s, e) => {
        // Session started
      };
      
      recognizer.sessionStopped = (s, e) => {
        // Session stopped
      };
      
      // Handle errors
      recognizer.canceled = (s, e) => {
        // Be much more aggressive about treating errors as transient
        // Most Azure Speech Service errors during active recording are transient
        const genuineErrorCodes = [
          'NoMatch', // No speech detected
          'InitialSilenceTimeout', // User stopped talking
          'BabbleTimeout', // Too much noise
          'Error' // Generic unrecoverable error
        ];
        
        const isGenuineError = genuineErrorCodes.includes(String(e.errorCode)) ||
                              e.errorDetails?.includes('microphone') ||
                              e.errorDetails?.includes('permission') ||
                              e.errorDetails?.includes('device not found');
        
        if (!isGenuineError) {
          // Treat everything else as transient - keep recording
          setRecordingError(`Connection issue (${e.errorCode}). Recording continues...`);
          
          // Clear the error after a few seconds
          setTimeout(() => {
            if (isRecordingRef.current) {
              setRecordingError(null);
            }
          }, 5000);
          
        } else {
          // For genuine errors (microphone issues, permissions, etc.), stop recording
          setRecordingError(`Recording stopped: ${e.errorDetails} (Code: ${e.errorCode})`);
          setIsRecording(false);
          clearSummaryInterval();
          
          // Save the final transcription if it exists when genuinely canceled
          if (transcriptionRef.current.trim()) {
            saveTranscriptionToDatabase(
              transcriptionRef.current,
              transcriptNameFromUrl,
              journeyFromUrl
            );
            updateSummary(true);
          }
        }
      };
      
      // Start continuous recognition
      recognizer.startContinuousRecognitionAsync(
        () => {
          console.log('Recording started');
          
          // Start the summary interval - update summary every 30 seconds
          startSummaryInterval();
          
          // Trigger an initial summary after a short delay to let some transcription happen
          setTimeout(() => {
            if (isRecordingRef.current && transcriptionRef.current.trim()) {
              updateSummary(false); // Don't save to DB during recording
            }
          }, 10000);
        },
        (err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setRecordingError(`Error starting recording: ${errorMessage}`);
          setIsRecording(false);
        }
      );
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setRecordingError(`Failed to start recording: ${errorMessage}`);
      setIsRecording(false);
    }
  }, [startSummaryInterval, updateSummary, saveTranscriptionToDatabase, transcriptNameFromUrl, journeyFromUrl]);
  
  // Function to toggle recording
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Add state for reset modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Update the reset interview function to only delete transcript data
  const handleResetInterview = async () => {
    if (!lifecycleId) return;
    
    try {
      setIsResetting(true);
      setResetError(null);
      
      // Make sure recording is stopped first if it's in progress
      if (isRecording) {
        await new Promise<void>((resolve) => {
          const recognizer = azureSpeechServiceRef.current;
          if (recognizer) {
            recognizer.stopContinuousRecognitionAsync(
              () => {
                console.log('Recording stopped before reset');
                setIsRecording(false);
                resolve();
              },
              (err: unknown) => {
                console.error('Error stopping recording during reset:', err);
                setIsRecording(false);
                resolve();
              }
            );
          } else {
            resolve();
          }
        });
      }
      
      // Clear intervals to prevent any pending operations
      clearSummaryInterval();
      
      // Delete transcript record with aggressive cache control
      const transcriptResponse = await fetch(
        `/api/tenants/by-slug/workspaces/scans/pain-points-transcription?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}&t=${Date.now()}`,
        {
          method: 'DELETE',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
      
      if (!transcriptResponse.ok && transcriptResponse.status !== 404) {
        throw new Error(`Failed to delete transcript: ${transcriptResponse.status}`);
      }
      
      // Force cleanup of local transcript state and refs
      setTranscription('');
      transcriptionRef.current = '';
      
      // Store reset state in sessionStorage to persist across navigations
      // But only for the transcript, not the pain points
      try {
        sessionStorage.setItem(`interview-transcript-reset-${lifecycleId}`, 'true');
        sessionStorage.setItem(`interview-transcript-reset-time-${lifecycleId}`, Date.now().toString());
      } catch (e) {
        console.warn('Could not store reset state in sessionStorage:', e);
      }
      
      // Close the modal
      setIsResetModalOpen(false);
      
      console.log('Transcript reset successfully');
    } catch (error) {
      console.error('Error resetting transcript:', error);
      setResetError(error instanceof Error ? error.message : 'An unknown error occurred while resetting');
    } finally {
      setIsResetting(false);
    }
  };

  // Add state for pain point deletion
  const [painPointToDelete, setPainPointToDelete] = useState<string | null>(null);
  const [deletingPainPoint, setDeletingPainPoint] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Get the name of the pain point being deleted
  const getPainPointName = (id: string) => {
    const painPoint = painPointSummaryData.pain_points.find(p => p.id === id);
    return painPoint ? painPoint.name : 'this pain point';
  };

  // Handler for when delete button is clicked
  const handleDeletePainPointClick = (id: string) => {
    setPainPointToDelete(id);
    setDeleteError(null);
  };

  // Handler for confirming pain point deletion
  const handleConfirmDeletePainPoint = async () => {
    if (!painPointToDelete || !lifecycleId) return;
    
    try {
      setDeletingPainPoint(true);
      setDeleteError(null);
      
      // Get the current pain points
      const currentPainPoints = [...painPointSummaryData.pain_points];
      
      // Filter out the one to delete
      const updatedPainPoints = currentPainPoints.filter(p => p.id !== painPointToDelete);
      
      // Create the updated summary object
      const updatedSummary = {
        ...painPointSummaryData,
        pain_points: updatedPainPoints,
      };
      
      // Send the update to the server
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}&t=${Date.now()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify({
            summary: updatedSummary,
            tenantSlug,
            workspaceId,
            scanId,
            lifecycleId
          })
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to delete pain point: ${response.status}`);
      }
      
      // Update local state
      setPainPointSummaryData(updatedSummary);
      setPainPointSummaryRaw(JSON.stringify(updatedSummary, null, 2));
      
      // Update timestamp
      const now = new Date();
      setLastSummaryUpdate(now.toLocaleTimeString());
      
      console.log(`Pain point ${painPointToDelete} deleted successfully`);
      
      // Notify LifecycleViewer to refresh data
      dispatchLifecycleUpdateEvent();
      
      // Close the modal
      setPainPointToDelete(null);
    } catch (error) {
      console.error('Error deleting pain point:', error);
      setDeleteError(error instanceof Error ? error.message : 'An unknown error occurred while deleting');
    } finally {
      setDeletingPainPoint(false);
    }
  };

  // Add state for all process groups
  const [allProcessGroups, setAllProcessGroups] = useState<Array<{ name: string, description?: string }>>([]);
  const [isLoadingProcessGroups, setIsLoadingProcessGroups] = useState(false);
  
  // Fetch process groups from API when component mounts
  useEffect(() => {
    async function fetchProcessGroups() {
      if (!lifecycleId) return;
      
      try {
        setIsLoadingProcessGroups(true);
        
        // Call the API to get process groups for this lifecycle
        const response = await fetch(
          `/api/tenants/by-slug/workspaces/scans/lifecycles/process-groups?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch process groups: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.processGroups && Array.isArray(data.processGroups)) {
          // Sort process groups alphabetically
          const sortedGroups = [...data.processGroups].sort((a, b) => 
            a.name.localeCompare(b.name)
          );
          
          console.log(`Fetched ${sortedGroups.length} process groups from API:`, 
            sortedGroups.map(pg => pg.name).join(', '));
          
          setAllProcessGroups(sortedGroups);
        } else {
          console.warn('API returned invalid process groups data:', data);
          setAllProcessGroups([]);
        }
      } catch (error) {
        console.error('Error fetching process groups:', error);
        setAllProcessGroups([]);
      } finally {
        setIsLoadingProcessGroups(false);
      }
    }
    
    fetchProcessGroups();
  }, [tenantSlug, workspaceId, scanId, lifecycleId]);
  
  // Add this console log to help debug what's displayed
  useEffect(() => {
    console.log('Available process groups for cards:', allProcessGroups.map(pg => pg.name));
  }, [allProcessGroups]);

  // Add function to handle process group change
  const handleProcessGroupChange = async (painPointId: string, newProcessGroup: string) => {
    if (!painPointSummaryData || !painPointSummaryData.pain_points || !lifecycleId) return;
    
    console.log(`Changing process group for pain point ${painPointId} to "${newProcessGroup}"`);
    
    try {
      // Find the pain point to update
      const updatedPainPoints = painPointSummaryData.pain_points.map(point => {
        if (point.id === painPointId) {
          return { ...point, assigned_process_group: newProcessGroup };
        }
        return point;
      });
      
      // Create updated summary data
      const updatedSummary = {
        ...painPointSummaryData,
        pain_points: updatedPainPoints
      };
      
      // Update UI immediately for better responsiveness
      setPainPointSummaryData(updatedSummary);
      setPainPointSummaryRaw(JSON.stringify(updatedSummary, null, 2));
      
      // Update timestamp
      const now = new Date();
      setLastSummaryUpdate(now.toLocaleTimeString());
      
      // Send update to server
      const response = await fetch(
        `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}&lifecycle_id=${lifecycleId}&t=${Date.now()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify({
            summary: updatedSummary,
            tenantSlug,
            workspaceId,
            scanId,
            lifecycleId
          })
        }
      );
      
      if (!response.ok) {
        console.error(`Failed to update process group: ${response.status}`);
        // Could revert state here if needed
      } else {
        console.log('Successfully updated process group on server');
        
        // Dispatch event to notify LifecycleViewer to refresh data
        dispatchLifecycleUpdateEvent();
      }
      
    } catch (error) {
      console.error('Error updating process group:', error);
    }
  };

  // Add this function for handling direct pain point updates (score, cost_to_serve)
  const handlePainPointUpdate = (updatedPainPoint: PainPoint) => {
    if (!painPointSummaryData || !painPointSummaryData.pain_points) return;
    
    console.log(`Updating pain point ${updatedPainPoint.id} with new values`, updatedPainPoint);
    
    // Update local state first for immediate UI feedback
    const updatedPainPoints = painPointSummaryData.pain_points.map(point => 
      point.id === updatedPainPoint.id ? updatedPainPoint : point
    );
    
    // Create updated summary data
    const updatedSummary = {
      ...painPointSummaryData,
      pain_points: updatedPainPoints
    };
    
    // Update UI immediately for better responsiveness
    setPainPointSummaryData(updatedSummary);
    setPainPointSummaryRaw(JSON.stringify(updatedSummary, null, 2));
    
    // Update timestamp
    const now = new Date();
    setLastSummaryUpdate(now.toLocaleTimeString());
  };

  // Add functions for transcript editing
  const handleStartEdit = () => {
    setEditedTranscript(transcription);
    setIsEditingTranscript(true);
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setIsEditingTranscript(false);
    setEditedTranscript('');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!lifecycleId || editedTranscript.trim() === transcription.trim()) {
      handleCancelEdit();
      return;
    }
  
    try {
      setIsSavingEdit(true);
      setEditError(null);
  
      // Call the centralized save function
      await saveTranscriptionToDatabase(
        editedTranscript.trim(),
        transcriptNameFromUrl,
        journeyFromUrl
      );
  
      // Update the local transcript state
      setTranscription(editedTranscript.trim());
      transcriptionRef.current = editedTranscript.trim();
  
      // Mark transcript as changed since it was manually edited
      setTranscriptChangedSinceLastSummary(true);
  
      // Exit edit mode
      setIsEditingTranscript(false);
      setEditedTranscript('');
  
      console.log('Transcript edited and saved successfully');
  
      // Optionally trigger a summary update with the new transcript
      if (editedTranscript.trim()) {
        updateSummary(true);
      }
  
    } catch (error) {
      console.error('Error saving edited transcript:', error);
      setEditError(error instanceof Error ? error.message : 'Failed to save transcript');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 z-10 flex">
      {/* Add delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={!!painPointToDelete}
        onClose={() => setPainPointToDelete(null)}
        onConfirm={handleConfirmDeletePainPoint}
        painPointName={painPointToDelete ? getPainPointName(painPointToDelete) : ''}
      />
      
      {/* Existing Reset confirmation modal */}
      <ConfirmModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetInterview}
        title="Reset Transcript"
        message="This will permanently delete the interview transcript data. Pain points will be preserved. This action cannot be undone. Are you sure you want to continue?"
      />
      
      {/* Only show the sidebar when chat is NOT expanded or chat mode is inactive */}
      {showSidebar && (
        <div className="w-16 bg-gray-900 shadow-lg flex flex-col items-center h-full py-4 relative">
          {/* Ora Logo */}
          <div className="flex items-center justify-center h-12 mt-2 mb-6">
            <OraIcon className="w-10 h-10" />
          </div>
          
          {/* Mode buttons - vertical alignment */}
          <div className="flex flex-col gap-4">
            {/* Chat button removed from sidebar as requested */}
            <button 
              onClick={() => toggleMode('interview')}
              className={`p-2 rounded-full ${activeModes.interview ? 'bg-indigo-600' : 'bg-gray-700'} hover:bg-indigo-500 transition-colors`}
              title={activeModes.interview ? "Hide Transcript" : "Show Transcript"}
            >
              <InterviewIcon className="w-6 h-6 text-white" />
            </button>
            
            <button 
              onClick={() => toggleMode('painpoint')}
              className={`p-2 rounded-full ${activeModes.painpoint ? 'bg-indigo-600' : 'bg-gray-700'} hover:bg-indigo-500 transition-colors`}
              title={activeModes.painpoint ? "Hide Pain Points" : "Show Pain Points"}
            >
              <PainPointIcon className="w-6 h-6 text-white" />
            </button>
          </div>
          
          {/* Expand button at bottom */}
          {activeModes.chat && (
            <button
              onClick={() => toggleExpanded('chat')}
              className="absolute left-1/2 bottom-4 -translate-x-1/2 bg-gray-700 p-2 rounded-lg hover:bg-gray-600 transition-colors z-20 text-gray-300 border border-gray-600 flex-shrink-0"
              title="Expand Chat Panel"
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
          )}
        </div>
      )}

      {/* Panels container - this will have the chat, interview, and pain points panels side by side */}
      <div className="flex h-full">
        {/* Chat Panel */}
        {activeModes.chat && (
          <div className={`flex flex-col h-full border-r border-gray-700 ${expandedStates.chat 
            ? 'w-[500px]' 
            : 'w-0 overflow-hidden'}`}>
            {/* Only show chat content if expanded */}
            {expandedStates.chat && (
              <>
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800 flex justify-between items-center h-16">
                  <div className="flex items-center">
                    <OraIcon className="w-10 h-10 mr-3" />
                    <h2 className="text-lg font-semibold text-gray-100">Interview Copilot</h2>
                  </div>
                  
                  {/* Mode buttons - horizontal alignment in chat header */}
                  <div className="flex gap-2">
                    {/* Chat button removed as requested */}
                    <button 
                      onClick={() => toggleMode('interview')}
                      className={`p-2 rounded-full ${activeModes.interview ? 'bg-indigo-600' : 'bg-gray-700'} hover:bg-indigo-500 transition-colors`}
                      title={activeModes.interview ? "Hide Transcript" : "Show Transcript"}
                    >
                      <InterviewIcon className="w-5 h-5 text-white" />
                    </button>
                    
                    <button 
                      onClick={() => toggleMode('painpoint')}
                      className={`p-2 rounded-full ${activeModes.painpoint ? 'bg-indigo-600' : 'bg-gray-700'} hover:bg-indigo-500 transition-colors`}
                      title={activeModes.painpoint ? "Hide Pain Points" : "Show Pain Points"}
                    >
                      <PainPointIcon className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-900 ora-messages-container">
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
                            <ReactMarkdown
                              components={{
                                h1: ({ ...props }) => <h1 className={compactMarkdownStyles.h1} {...props} />,
                                h2: ({ ...props }) => <h2 className={compactMarkdownStyles.h2} {...props} />,
                                h3: ({ ...props }) => <h3 className={compactMarkdownStyles.h3} {...props} />,
                                p: ({node, children, ...props}) => {
                                  // Use a more type-safe approach
                                  const parentNode = (node as any)?.parent;
                                  const isInListItem = parentNode?.type === 'listItem';
                                  return isInListItem 
                                    ? <span className="inline" {...props}>{children}</span>
                                    : <p className={compactMarkdownStyles.p} {...props}>{children}</p>;
                                },
                                ul: ({ ...props }) => <ul className={compactMarkdownStyles.ul} {...props} />,
                                ol: ({ ...props }) => <ol className={compactMarkdownStyles.ol} {...props} />,
                                li: ({ ...props }) => <li className={compactMarkdownStyles.li} {...props} />,
                                strong: ({ ...props }) => <strong className={compactMarkdownStyles.strong} {...props} />,
                                em: ({ ...props }) => <em className={compactMarkdownStyles.em} {...props} />,
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

                {/* Input with collapse button */}
                <div className="p-4 border-t border-gray-700 bg-gray-800 shadow-inner flex-shrink-0">
                  <div className="flex gap-2">
                    {/* Collapse button - only collapses the chat panel, with no animation */}
                    <button
                      onClick={() => instantCollapse('chat')}
                      className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-gray-300 border border-gray-600 flex-shrink-0"
                      title="Collapse Chat Panel"
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
              </>
            )}
            
            {/* Expand chat button when chat is collapsed */}
            {!expandedStates.chat && (
              <div className="flex items-center justify-center h-full">
                <button
                  onClick={() => toggleExpanded('chat')}
                  className="p-2 bg-gray-700 rounded-full hover:bg-indigo-500 transition-colors text-gray-300"
                  title="Expand Chat Panel"
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
              </div>
            )}
          </div>
        )}
        
        {/* Transcript Panel (formerly Interview) */}
        {activeModes.interview && (
          <div className="w-[400px] h-full bg-gray-800 border-r border-gray-700 overflow-y-auto flex flex-col">
            <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800 flex justify-between items-center h-16">
              <h2 className="text-lg font-semibold text-gray-100">Transcript</h2>
              <div className="flex items-center space-x-2">
                {resetError && (
                  <div className="absolute top-16 left-0 right-0 bg-red-900/90 text-red-200 p-2 text-xs text-center">
                    {resetError}
                  </div>
                )}
                
                {editError && (
                  <div className="absolute top-16 left-0 right-0 bg-red-900/90 text-red-200 p-2 text-xs text-center">
                    {editError}
                  </div>
                )}
                
                {/* Show edit button only when not recording and transcript exists */}
                {!isRecording && !isLoadingTranscription && transcription && !isEditingTranscript && (
                  <button
                    onClick={handleStartEdit}
                    disabled={isResetting}
                    className="p-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    title="Edit Transcript"
                  >
                    Edit
                  </button>
                )}
                
                <button
                  onClick={() => setIsResetModalOpen(true)}
                  disabled={isResetting || isLoadingTranscription || isEditingTranscript}
                  className="p-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50"
                  title="Reset Interview"
                >
                  {isResetting ? 'Resetting...' : 'Reset'}
                </button>
                
                <button
                  onClick={toggleRecording}
                  disabled={isLoadingTranscription || isEditingTranscript}
                  className={`p-2 rounded-full ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white disabled:opacity-50`}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  {isRecording ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="6" fill="currentColor" />
                    </svg>
                  )}
                </button>
                <button 
                  onClick={() => toggleMode('interview')}
                  className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
                  title="Close Transcript Lane"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Transcription Container */}
            <div 
              ref={transcriptionContainerRef}
              className="flex-1 p-3 text-gray-200 overflow-y-auto ora-transcript-container"
            >
              {recordingError && (
                <div className="bg-red-900/50 text-red-200 p-2 rounded mb-2 text-sm">
                  {recordingError}
                </div>
              )}
              
              {isLoadingTranscription ? (
                <div className="flex items-center justify-center h-24 mt-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-200"></div>
                </div>
              ) : isEditingTranscript ? (
                /* Edit Mode - Show textarea and buttons */
                <div className="flex flex-col h-full">
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    onKeyDown={(e) => {
                      // Handle keyboard shortcuts
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelEdit();
                      } else if (e.ctrlKey || e.metaKey) {
                        if (e.key === 'Enter' || e.key === 's') {
                          e.preventDefault();
                          handleSaveEdit();
                        }
                      }
                    }}
                    className="flex-1 w-full p-3 text-sm font-sans bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Edit your transcript here..."
                    style={{ minHeight: '200px' }}
                    autoFocus
                  />
                  
                  {/* Save/Cancel buttons */}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-600">
                    <div className="text-xs text-gray-400">
                      Ctrl+Enter to save • Esc to cancel
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSavingEdit}
                        className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSavingEdit || editedTranscript.trim() === transcription.trim()}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                      >
                        {isSavingEdit ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : transcription ? (
                <pre className="whitespace-pre-wrap font-sans text-sm">{transcription}</pre>
              ) : (
                <div className="text-center py-8 px-4 text-gray-400">
                  <p>{isRecording ? 'Listening for conversation...' : 'Click the record button to start capturing the interview transcript.'}</p>
                </div>
              )}
              
              {(isSavingTranscription || isSavingEdit) && (
                <div className="bg-gray-700/50 text-gray-300 text-xs py-1 px-2 rounded mt-2 flex items-center">
                  <div className="animate-spin h-3 w-3 border border-gray-300 rounded-full mr-2"></div>
                  {isSavingEdit ? 'Saving edited transcript...' : 'Saving transcript...'}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Pain Points Panel */}
        {activeModes.painpoint && (
          <div className="w-[400px] h-full bg-gray-800 border-r border-gray-700 overflow-y-auto flex flex-col">
            <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800 h-16 flex flex-col justify-center">
              <div className="flex justify-between items-center w-full">
                <div>
                  <h2 className="text-lg font-semibold text-gray-100 leading-tight">Pain Points</h2>
                  {lastSummaryUpdate && (
                    <span className="text-xs text-gray-400 leading-tight">
                      Updated {lastSummaryUpdate}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => updateSummary(true)}
                    disabled={isUpdatingSummary || !transcription || isLoadingSummary}
                    className="p-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50"
                    title="Update Pain Points Summary"
                  >
                    {isUpdatingSummary ? 'Updating...' : 'Update'}
                  </button>
                  <button 
                    onClick={() => toggleMode('painpoint')}
                    className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
                    title="Close Pain Points Lane"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Pain Points Summary Container */}
            <div className="flex-1 p-4 overflow-y-auto ora-painpoints-container">
              {isLoadingSummary ? (
                <div className="flex items-center justify-center h-24 mt-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-200"></div>
                </div>
              ) : (
                <div>
                  {/* Show delete error if any */}
                  {deleteError && (
                    <div className="bg-red-900/50 text-red-200 p-2 rounded mb-3 text-xs">
                      {deleteError}
                    </div>
                  )}
                  
                  {/* Overall Summary */}
                  {painPointSummaryData.overallSummary && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-300 mb-1">Summary</h3>
                      <p className="text-sm text-gray-300">{painPointSummaryData.overallSummary}</p>
                    </div>
                  )}
                  
                  {/* Pain Points List */}
                  {painPointSummaryData.pain_points && painPointSummaryData.pain_points.length > 0 ? (
                    <>
                      <h3 className="text-sm font-medium text-gray-300 mb-2">
                        {painPointSummaryData.pain_points.length} Pain Point{painPointSummaryData.pain_points.length !== 1 ? 's' : ''} Identified
                      </h3>
                      {painPointSummaryData.pain_points.map((painPoint) => (
                        <PainPointCard 
                          key={painPoint.id} 
                          painPoint={painPoint} 
                          onDeleteClick={handleDeletePainPointClick}
                          allProcessGroups={allProcessGroups}
                          onProcessGroupChange={handleProcessGroupChange}
                          isLoadingProcessGroups={isLoadingProcessGroups}
                          tenantSlug={tenantSlug}
                          workspaceId={workspaceId}
                          scanId={scanId}
                          lifecycleId={lifecycleId}
                          painPointSummaryData={painPointSummaryData}
                          dispatchLifecycleUpdateEvent={dispatchLifecycleUpdateEvent}
                          onPainPointUpdate={handlePainPointUpdate}
                        />
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      {/* Empty state - no content */}
                    </div>
                  )}
                </div>
              )}
              
              {(isUpdatingSummary || deletingPainPoint) && (
                <div className="bg-gray-700/50 text-gray-300 text-xs py-1 px-2 rounded mt-4 flex items-center">
                  <div className="animate-spin h-3 w-3 border border-gray-300 rounded-full mr-2"></div>
                  {deletingPainPoint ? 'Deleting pain point...' : 'Analyzing transcript and updating pain points...'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 