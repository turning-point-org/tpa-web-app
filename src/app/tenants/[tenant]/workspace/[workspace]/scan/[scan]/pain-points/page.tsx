'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'next/navigation';
import Modal from '@/components/Modal';

// Using a more generic type to avoid TypeScript errors with the Speech SDK
type SpeechRecognizer = {
  recognized: any;
  canceled: any;
  startContinuousRecognitionAsync: Function;
  stopContinuousRecognitionAsync: Function;
};

export default function PainPointsPage() {
  // Get URL parameters
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [summary, setSummary] = useState<string>('Conversation summary will appear here...');
  const [speakers, setSpeakers] = useState<{ [id: string]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isUpdatingSummary, setIsUpdatingSummary] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingTranscription, setIsLoadingTranscription] = useState(true);
  const [isSavingTranscription, setIsSavingTranscription] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const azureSpeechServiceRef = useRef<SpeechRecognizer | null>(null);
  const summaryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionRef = useRef<string>('');
  const transcriptionContainerRef = useRef<HTMLDivElement>(null);
  const isTranscribingRef = useRef<boolean>(false);

  // Load existing transcription and summary when component mounts
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        // Load transcription
        setIsLoadingTranscription(true);
        const transcriptionResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/pain-points-transcription?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`,
          { 
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        );
        
        if (transcriptionResponse.ok) {
          const data = await transcriptionResponse.json();
          if (data.transcription) {
            setTranscription(data.transcription);
            transcriptionRef.current = data.transcription;
            
            // Load saved speakers if available
            if (data.speakers && Object.keys(data.speakers).length > 0) {
              setSpeakers(data.speakers);
            }
            
            console.log('Loaded existing transcription from database');
          } else {
            // No transcription data found, ensure local state is clean
            setTranscription('');
            transcriptionRef.current = '';
            console.log('No existing transcription found');
          }
        } else if (transcriptionResponse.status === 404) {
          // If 404, ensure local state is clean
          setTranscription('');
          transcriptionRef.current = '';
          console.log('No transcription found (404)');
        } else {
          console.warn('Error loading transcription:', transcriptionResponse.status);
        }
        
        // Load summary
        setIsLoadingSummary(true);
        const summaryResponse = await fetch(
          `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`,
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
          if (data.summary) {
            setSummary(data.summary);
            
            // If there's a timestamp, update it
            if (data.updated_at) {
              const updatedDate = new Date(data.updated_at);
              setLastUpdated(updatedDate.toLocaleTimeString());
            }
            
            console.log('Loaded existing summary from database');
          } else {
            // No summary data found, ensure local state is clean
            setSummary('Conversation summary will appear here...');
            setLastUpdated(null);
            console.log('No existing summary found');
          }
        } else if (summaryResponse.status === 404) {
          // If 404, ensure local state is clean
          setSummary('Conversation summary will appear here...');
          setLastUpdated(null);
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
  }, [tenantSlug, workspaceId, scanId]);

  // Reset transcription and summary data
  const resetData = async () => {
    if (isTranscribing) {
      // Can't reset while recording is in progress
      setError('Please stop recording before resetting.');
      setIsResetModalOpen(false);
      return;
    }
    
    try {
      setIsResetting(true);
      setError(null);
      
      console.log('Starting reset process...');
      
      // First, clear local state immediately to give immediate feedback to user
      setTranscription('');
      transcriptionRef.current = '';
      setSummary('Conversation summary will appear here...');
      setLastUpdated(null);
      setSpeakers({});
      
      console.log('Local state cleared immediately');
      
      // Function to retry API call with exponential backoff
      const retryDelete = async (url: string, maxRetries = 3) => {
        let retries = 0;
        let success = false;
        
        while (retries < maxRetries && !success) {
          try {
            const response = await fetch(url, { 
              method: 'DELETE',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
            
            if (response.ok) {
              success = true;
              console.log(`Successfully deleted data at ${url}`);
            } else {
              const errorText = await response.text();
              console.error(`Delete failed (attempt ${retries + 1}):`, response.status, errorText);
              retries++;
              
              if (retries < maxRetries) {
                // Wait longer between each retry
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
              }
            }
          } catch (err) {
            console.error(`Network error on delete (attempt ${retries + 1}):`, err);
            retries++;
            
            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
            }
          }
        }
        
        return success;
      };
      
      // Delete transcription and summary data with retries
      const transcriptionUrl = `/api/tenants/by-slug/workspaces/scans/pain-points-transcription?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`;
      const summaryUrl = `/api/tenants/by-slug/workspaces/scans/pain-points-summary?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`;
      
      const [transcriptionDeleted, summaryDeleted] = await Promise.all([
        retryDelete(transcriptionUrl),
        retryDelete(summaryUrl)
      ]);
      
      if (!transcriptionDeleted || !summaryDeleted) {
        throw new Error('Failed to delete all data after multiple attempts');
      }
      
      // Double-check that data is gone by fetching it again
      console.log('Verifying data is deleted...');
      
      // Check transcription is gone
      const checkTranscription = await fetch(transcriptionUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // Check summary is gone
      const checkSummary = await fetch(summaryUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // Log verification results
      console.log('Transcription check status:', checkTranscription.status);
      console.log('Summary check status:', checkSummary.status);
      
      // Force the page to reload to guarantee a clean start
      // This is more reliable than just managing state
      if (typeof window !== 'undefined') {
        console.log('Forcing page reload for clean state');
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        // If we can't reload (SSR context), at least refresh the loading states
        setIsLoadingTranscription(true);
        setIsLoadingSummary(true);
        setTimeout(() => {
          setIsLoadingTranscription(false);
          setIsLoadingSummary(false);
          console.log('Reset process complete (without page reload)');
        }, 500);
      }
    } catch (err: unknown) {
      console.error('Error during reset process:', err);
      setError(`Failed to reset data: ${err instanceof Error ? err.message : String(err)}. Please try again or refresh the page.`);
      setIsResetting(false);
      setIsResetModalOpen(false);
    }
  };

  // Update the ref whenever isTranscribing changes
  useEffect(() => {
    isTranscribingRef.current = isTranscribing;
    console.log('Transcribing state changed:', isTranscribing);
  }, [isTranscribing]);

  // This function will toggle the transcription on/off
  const toggleTranscription = async () => {
    if (isTranscribing) {
      stopTranscription();
    } else {
      startTranscription();
    }
  };

  // Function to save transcription to the database
  const saveTranscriptionToDatabase = async (transcriptionText: string) => {
    if (isSavingTranscription) return; // Prevent multiple concurrent saves
    
    try {
      setIsSavingTranscription(true);
      
      const response = await fetch('/api/tenants/by-slug/workspaces/scans/pain-points-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription: transcriptionText,
          speakers: speakers, // Also save the speakers mapping
          tenantSlug,
          workspaceId,
          scanId
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
  };

  // Keep a ref with the current transcription to use in the interval
  useEffect(() => {
    transcriptionRef.current = transcription;
    
    // Auto-scroll to the bottom of the transcription container
    if (transcriptionContainerRef.current) {
      const container = transcriptionContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
    
    // Debug: Log transcription changes
    console.log(`Transcription updated, length: ${transcription.length}`);
  }, [transcription]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isTranscribing) {
        stopTranscription();
      } else {
        // If we're not transcribing but the component is unmounting,
        // save the current transcription if it exists
        if (transcriptionRef.current.trim()) {
          saveTranscriptionToDatabase(transcriptionRef.current);
          // Also save a final summary
          updateSummary();
        }
      }
      clearSummaryInterval();
    };
  }, [isTranscribing]);

  // Function to start the transcription
  const startTranscription = async () => {
    setError(null);
    
    try {
      // First update the state to show we're starting
      setIsTranscribing(true);
      
      // Dynamically import the Speech SDK to avoid SSR issues
      const { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason, PropertyId } = await import('microsoft-cognitiveservices-speech-sdk');
      
      // Get the subscription key and region from environment variables
      const response = await fetch('/api/azure-speech-token');
      
      if (!response.ok) {
        throw new Error('Failed to get Azure Speech Service credentials');
      }
      
      const { key, region } = await response.json();
      
      // Configure the speech service
      const speechConfig = SpeechConfig.fromSubscription(key, region);
      speechConfig.speechRecognitionLanguage = 'en-GB';
      speechConfig.enableDictation();
      
      // Request word-level timestamps but disable speaker diarization
      speechConfig.requestWordLevelTimestamps();
      speechConfig.enableAudioLogging();
      
      // Use the default microphone
      const audioConfig = AudioConfig.fromDefaultMicrophoneInput();
      
      // Create the speech recognizer
      const recognizer = new SpeechRecognizer(speechConfig, audioConfig);
      
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
      
      // Handle errors
      recognizer.canceled = (s, e) => {
        setError(`Transcription canceled: ${e.errorDetails}`);
        setIsTranscribing(false);
        clearSummaryInterval();
        
        // Save the final transcription if it exists when canceled
        if (transcriptionRef.current.trim()) {
          saveTranscriptionToDatabase(transcriptionRef.current);
          updateSummary();
        }
      };
      
      // Start continuous recognition
      recognizer.startContinuousRecognitionAsync(
        () => {
          console.log('Transcription started');
          
          // Start the summary interval - update summary every 20 seconds
          // We're still calculating the summary in real-time for display,
          // but only saving it when recording stops
          startSummaryInterval();
          
          // Trigger an initial summary after a short delay to let some transcription happen
          setTimeout(() => {
            if (isTranscribingRef.current && transcriptionRef.current.trim()) {
              updateSummary(false); // Don't save to DB during recording
            }
          }, 5000);
        },
        (err: unknown) => {
          setError(`Error starting transcription: ${err instanceof Error ? err.message : String(err)}`);
          setIsTranscribing(false);
        }
      );
      
    } catch (err: unknown) {
      setError(`Failed to start transcription: ${err instanceof Error ? err.message : String(err)}`);
      setIsTranscribing(false);
    }
  };

  // Function to stop the transcription
  const stopTranscription = () => {
    if (azureSpeechServiceRef.current) {
      const recognizer = azureSpeechServiceRef.current;
      recognizer.stopContinuousRecognitionAsync(
        () => {
          console.log('Transcription stopped');
          setIsTranscribing(false);
          clearSummaryInterval();
          
          // Trigger a final summary after stopping and save it to the database
          if (transcriptionRef.current.trim()) {
            // Generate a summary and save it to the database
            updateSummary(true);
            
            // Save the final transcription
            saveTranscriptionToDatabase(transcriptionRef.current);
          }
        },
        (err: unknown) => {
          setError(`Error stopping transcription: ${err instanceof Error ? err.message : String(err)}`);
        }
      );
    }
  };

  // Function to start the interval for summary updates
  const startSummaryInterval = () => {
    // Clear any existing interval first
    clearSummaryInterval();
    
    console.log('Starting summary interval');
    
    // Update summary immediately if there's already transcription
    if (transcriptionRef.current.trim()) {
      console.log('Initial summary triggered');
      updateSummary(false); // Don't save to DB during recording
    }
    
    // Set up an interval to update the summary every 20 seconds
    // Use a more reliable approach with setTimeout recursion instead of setInterval
    const createSummaryTimer = () => {
      summaryIntervalRef.current = setTimeout(() => {
        console.log('Summary timer triggered, isTranscribing:', isTranscribingRef.current);
        if (transcriptionRef.current.trim()) {
          updateSummary(false).then(() => { // Don't save to DB during recording
            // Set up the next timer only if still transcribing
            if (isTranscribingRef.current) {
              createSummaryTimer();
            } else {
              console.log('Not creating next timer - no longer transcribing');
            }
          });
        } else {
          // Still set up next timer even if no transcription yet
          if (isTranscribingRef.current) {
            createSummaryTimer();
          } else {
            console.log('Not creating next timer - no longer transcribing');
          }
        }
      }, 20000); // 20 seconds in milliseconds
    };
    
    // Start the recursive timer
    createSummaryTimer();
  };

  // Function to clear the summary interval
  const clearSummaryInterval = () => {
    if (summaryIntervalRef.current) {
      console.log('Clearing summary interval');
      clearTimeout(summaryIntervalRef.current);
      summaryIntervalRef.current = null;
    }
  };

  // Function to update the summary using GPT
  const updateSummary = async (saveToDatabase = true) => {
    try {
      const currentTranscription = transcriptionRef.current;
      if (!currentTranscription.trim()) {
        console.log('No transcription to summarize');
        return;
      }
      
      setIsUpdatingSummary(true);
      
      console.log('Sending transcription for summary, length:', currentTranscription.length);
      
      // Call our API endpoint to generate a summary
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: currentTranscription,
          tenantSlug: tenantSlug,
          workspaceId: workspaceId,
          scanId: scanId,
          saveToDatabase: saveToDatabase // Only save to database when recording stops
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Summary API error:', response.status, errorData);
        throw new Error(`Failed to generate summary: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Summary response received:', data);
      
      if (data.summary) {
        setSummary(data.summary);
        
        // Update the timestamp
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString());
        
        console.log('Summary updated successfully');
        if (saveToDatabase) {
          console.log('Summary saved to database');
        }
      } else {
        console.warn('Summary API returned no summary text');
      }
    } catch (err: unknown) {
      console.error('Error generating summary:', err);
    } finally {
      setIsUpdatingSummary(false);
    }
  };

  // Update the summary container styles for better markdown rendering
  const markdownStyles = {
    h1: 'text-2xl font-bold mt-4 mb-2',
    h2: 'text-xl font-bold mt-4 mb-2',
    h3: 'text-lg font-bold mt-3 mb-1',
    p: 'mt-2 mb-2',
    ul: 'list-disc pl-5 mt-2 mb-2',
    ol: 'list-decimal pl-5 mt-2 mb-2',
    li: 'mt-1',
    strong: 'font-bold',
    em: 'italic',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-4">Pain Points Identification</h2>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Transcription */}
        <div className="border rounded-md p-4 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-medium">Transcription</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsResetModalOpen(true)}
                disabled={isLoadingTranscription || isTranscribing || isResetting}
                className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : 'Reset'}
              </button>
              <button
                onClick={toggleTranscription}
                disabled={isLoadingTranscription || isResetting}
                className={`px-4 py-2 rounded-md ${
                  isTranscribing
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } disabled:opacity-50`}
              >
                {isTranscribing ? 'Stop Recording' : 'Start Recording'}
              </button>
            </div>
          </div>
          
          <div 
            ref={transcriptionContainerRef}
            className="h-[500px] overflow-y-auto border p-4 rounded-md bg-gray-50"
          >
            {isLoadingTranscription ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <p className="text-gray-500">Loading transcription...</p>
                </div>
              </div>
            ) : transcription ? (
              <pre className="whitespace-pre-wrap font-sans">{transcription}</pre>
            ) : (
              <p className="text-gray-500">
                {isTranscribing
                  ? 'Listening for conversation...'
                  : 'Click "Start Recording" to begin transcribing the conversation.'}
              </p>
            )}
          </div>
          {isSavingTranscription && (
            <div className="text-xs text-gray-500 mt-2 flex items-center">
              <div className="animate-spin h-3 w-3 border border-gray-500 rounded-full mr-2"></div>
              Saving transcription...
            </div>
          )}
        </div>
        
        {/* Right Column - Summary */}
        <div className="border rounded-md p-4 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-medium">Live Summary</h3>
            <div>
              {lastUpdated && (
                <span className="text-sm text-gray-500 mr-3">
                  Last updated: {lastUpdated}
                </span>
              )}
              <button
                onClick={() => updateSummary(true)}
                disabled={isUpdatingSummary || !transcription || isLoadingSummary || isResetting}
                className="px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              >
                {isUpdatingSummary ? 'Updating...' : 'Update Now'}
              </button>
            </div>
          </div>
          <div className="h-[500px] overflow-y-auto border p-4 rounded-md bg-gray-50">
            {isLoadingSummary ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <p className="text-gray-500">Loading summary...</p>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 className={markdownStyles.h1} {...props} />,
                    h2: ({node, ...props}) => <h2 className={markdownStyles.h2} {...props} />,
                    h3: ({node, ...props}) => <h3 className={markdownStyles.h3} {...props} />,
                    p: ({node, ...props}) => <p className={markdownStyles.p} {...props} />,
                    ul: ({node, ...props}) => <ul className={markdownStyles.ul} {...props} />,
                    ol: ({node, ...props}) => <ol className={markdownStyles.ol} {...props} />,
                    li: ({node, ...props}) => <li className={markdownStyles.li} {...props} />,
                    strong: ({node, ...props}) => <strong className={markdownStyles.strong} {...props} />,
                    em: ({node, ...props}) => <em className={markdownStyles.em} {...props} />,
                  }}
                >
                  {summary}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Reset Confirmation Modal */}
      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)}>
        <div className="text-center">
          <h3 className="text-lg font-medium mb-3">Reset Transcription and Summary</h3>
          <p className="text-gray-600 mb-6">
            Are you sure you want to reset? This will permanently delete all transcription 
            and summary data for this session. This action cannot be undone.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setIsResetModalOpen(false)}
              className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800"
              disabled={isResetting}
            >
              Cancel
            </button>
            <button
              onClick={resetData}
              className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
              disabled={isResetting}
            >
              {isResetting ? (
                <span className="flex items-center">
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full mr-2"></div>
                  Resetting...
                </span>
              ) : (
                'Reset Data'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 