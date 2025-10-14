import React from 'react';

interface ProcessMetricProps {
  title?: string;
  text?: string;
  type?: 'points' | 'aht' | 'cycleTime' | 'headcount' | 'cost';
}

const ProcessMetric: React.FC<ProcessMetricProps> = ({ title = '', text = '', type }) => {
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

  const emoji = getEmoji(type);
  const displayText = emoji ? `${emoji} ${text}` : text;
  
  return (
    <span 
      className={`${baseClasses}`}
      style={{ backgroundColor: '#0EA394' }}
      title={`${title}`}
    >
      {displayText}
    </span>
  );
};

export default ProcessMetric; 


