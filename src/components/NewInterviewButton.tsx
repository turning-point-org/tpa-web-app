'use client';

import { useState } from 'react';
import Button from '@/components/Button';
import CreateTranscriptModal from '@/components/CreateTranscriptModal';

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

interface NewInterviewButtonProps {
  lifecycles: Lifecycle[];
}

export default function NewInterviewButton({ lifecycles }: NewInterviewButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          + New Interview
        </Button>
      </div>
      <CreateTranscriptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lifecycles={lifecycles}
      />
    </>
  );
}
