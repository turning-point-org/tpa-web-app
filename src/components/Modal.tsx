"use client";

import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, children, maxWidth = "md" }: ModalProps) {
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
      <div className={`relative z-10 bg-white p-6 rounded shadow-lg ${maxWidthClass} w-full max-h-[90vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
}
