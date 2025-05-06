import React from 'react';

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

const Tag: React.FC<TagProps> = ({ children, className = '' }) => {
  // Base classes for the tag
  const baseClasses = "inline-block px-2.5 py-1 rounded-full text-xs font-bold";
  
  // Custom background and text color
  const styleClasses = "bg-[#0EA394] text-white";

  return (
    <span 
      className={`${baseClasses} ${styleClasses} ${className}`}
    >
      {children}
    </span>
  );
};

export default Tag; 