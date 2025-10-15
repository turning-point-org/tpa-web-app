"use client";

import React from 'react';

interface ProcessMetricProps {
  title?: string;
  value?: string | number;
  unit?: string;
  type?: 'points' | 'aht' | 'cycleTime' | 'headcount' | 'cost' | '';
}

const ProcessMetric: React.FC<ProcessMetricProps> = ({ 
  title = '', 
  value = '', 
  unit = '', 
  type = '' 
}) => {
  // Base classes for the process metric
  const baseClasses = "inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold";
  
  // Map type to emoji
  const getEmoji = (type?: string) => {
    switch (type) {
      case 'points':
        return '⭐';
      case 'aht':
        return '🕒';
      case 'cycleTime':
        return '🔁';
      case 'headcount':
        return '👤';
      case 'cost':
        return '💰';
      default:
        return '';
    }
  };

  // Format display text based on type
  const formatDisplayText = () => {
    const emoji = getEmoji(type);
    
    // Handle cost type specially - prepend currency symbol
    if (type === 'cost' && unit) {
      return emoji ? `${emoji} ${unit}${value}` : `${unit}${value}`;
    }
    
    // For other types, append unit with space
    const valueUnit = unit ? `${value} ${unit}` : value;
    return emoji ? `${emoji} ${valueUnit}` : valueUnit;
  };

  const displayText = formatDisplayText();
  
  return (
    <span 
      className={`${baseClasses}`}
      style={{ backgroundColor: '#0EA394' }}
      title={title || `${value} ${unit}`.trim()}
    >
      {displayText}
    </span>
  );
};

export default ProcessMetric; 


