'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/Button';
import Modal from '@/components/Modal'; // Assuming a generic Modal component exists

// Define the Lifecycle type to match the data structure
type Lifecycle = {
  id: string;
  name: string;
  processes?: {
    process_categories?: Array<{
      name: string;
    }>;
  };
};

interface CreateTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  lifecycles: Lifecycle[];
}

export default function CreateTranscriptModal({ isOpen, onClose, lifecycles }: CreateTranscriptModalProps) {
  const router = useRouter();
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;

  const [transcriptName, setTranscriptName] = useState('');
  const [selectedLifecycleId, setSelectedLifecycleId] = useState<string>('');
  const [selectedJourneyRef, setSelectedJourneyRef] = useState('Entire_Lifecycle');
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setTranscriptName('');
      setSelectedLifecycleId('');
      setSelectedJourneyRef('Entire_Lifecycle');
      setError(null);
    }
  }, [isOpen]);

  const selectedLifecycle = useMemo(() => {
    return lifecycles.find(lc => lc.id === selectedLifecycleId);
  }, [selectedLifecycleId, lifecycles]);

  const journeyOptions = useMemo(() => {
    return selectedLifecycle?.processes?.process_categories?.map(cat => ({
      name: cat.name,
      value: cat.name.replace(/ /g, '_'),
    })) || [];
  }, [selectedLifecycle]);

  // Effect to reset journey ref when lifecycle changes
  useEffect(() => {
    setSelectedJourneyRef('Entire_Lifecycle');
  }, [selectedLifecycleId]);

  const handleCreate = () => {
    if (!transcriptName.trim()) {
      setError('Transcript Name is required.');
      return;
    }
    if (!selectedLifecycleId) {
      setError('A Lifecycle must be selected.');
      return;
    }
    setError(null);

    const url = `/tenants/${tenantSlug}/workspace/${workspaceId}/scan/${scanId}/interview-copilot/${selectedLifecycleId}?journey=${selectedJourneyRef}&transcript_name=${encodeURIComponent(transcriptName)}&new=true`;
    
    router.push(url);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Interview">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="transcript-name" className="block text-sm font-medium text-gray-700">
            Interview Name
          </label>
          <input
            type="text"
            id="transcript-name"
            value={transcriptName}
            onChange={(e) => setTranscriptName(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="e.g., Q3 Stakeholder Interview"
          />
        </div>
        <div>
          <label htmlFor="lifecycle" className="block text-sm font-medium text-gray-700">
            Lifecycle
          </label>
          <select
            id="lifecycle"
            value={selectedLifecycleId}
            onChange={(e) => setSelectedLifecycleId(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="" disabled>-- Select a Lifecycle --</option>
            {lifecycles.map(lc => (
              <option key={lc.id} value={lc.id}>{lc.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="journey-ref" className="block text-sm font-medium text-gray-700">
            Journey Ref
          </label>
          <select
            id="journey-ref"
            value={selectedJourneyRef}
            onChange={(e) => setSelectedJourneyRef(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={!selectedLifecycleId || journeyOptions.length === 0}
          >
            <option value="Entire_Lifecycle">Entire Lifecycle</option>
            {journeyOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleCreate}>
          Create
        </Button>
      </div>
    </Modal>
  );
}
