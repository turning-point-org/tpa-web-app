"use client";

import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  title?: string;
}

export default function Modal({ isOpen, onClose, children, maxWidth = "md", title }: ModalProps) {
  if (!isOpen) return null;
  
  // Map maxWidth to appropriate Tailwind classes
  const maxWidthClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    full: "max-w-full"
  };

  const maxWidthClass = maxWidthClasses[maxWidth] || "max-w-md";
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black opacity-50" 
        onClick={onClose}
      ></div>
      <div className={`relative z-10 bg-white p-6 rounded-lg shadow-xl ${maxWidthClass} w-full max-h-[90vh] flex flex-col`}>
        {/* Optional Title and Close Button */}
        {title && (
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {/* Modal Content */}
        <div className="flex-grow overflow-auto max-h-[90vh] p-1">
          {children}
        </div>
      </div>
    </div>
  );
}
