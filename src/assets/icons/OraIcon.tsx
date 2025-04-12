import React from 'react';

interface OraIconProps {
  className?: string;
  color?: string;
  bgColor?: string;
}

export const OraIcon: React.FC<OraIconProps> = ({ 
  className = "h-8 w-8", 
  color = "#FFFFFF", // Changed to white for better contrast
  bgColor = "#4F46E5" // indigo-600 color for background
}) => (
  <svg 
    className={className}
    viewBox="0 0 44 43" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="22.1328" cy="21.5" r="21.5" fill={bgColor}/>
    <circle cx="13.0366" cy="23.1538" r="5.78846" fill={color}/>
    <circle cx="30.402" cy="23.1538" r="5.78846" fill={color}/>
    <path d="M21.719 14.8846C16.4267 14.8846 11.9339 16.6763 10.1422 18.1923C9.72877 22.0513 15.9303 28.1154 15.9303 28.1154C19.238 25.2212 23.786 24.8077 26.6803 27.702L33.2959 18.1923C31.6421 17.0898 27.0113 14.8846 21.719 14.8846Z" fill={color}/>
    <circle cx="2.48077" cy="2.48077" r="2.48077" transform="matrix(-1 0 0 1 15.5175 20.6731)" fill="#4F46E5"/>
    <circle cx="2.48077" cy="2.48077" r="2.48077" transform="matrix(-1 0 0 1 32.8828 20.6731)" fill="#4F46E5"/>
  </svg>
); 