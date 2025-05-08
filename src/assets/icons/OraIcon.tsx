import React from 'react';
import Image from 'next/image';

interface OraIconProps {
  className?: string;
}

export const OraIcon: React.FC<OraIconProps> = ({ 
  className = "h-8 w-8"
}) => (
  <div className={className} style={{ position: 'relative' }}>
    <Image
      src="/ora-icon.png"
      alt="Ora AI Assistant"
      fill
      style={{ objectFit: 'contain' }}
      priority
    />
  </div>
); 