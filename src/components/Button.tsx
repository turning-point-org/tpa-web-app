import React from 'react';

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'danger-secondary';
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  title?: string;
  colorOverride?: string;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'primary', 
  disabled = false,
  className = '',
  icon,
  iconOnly = false,
  title,
  colorOverride
}) => {
  // Base classes for all button variants
  const baseClasses = "inline-flex items-center justify-center border shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer";
  
  // Classes specific to each variant
  const variantClasses = {
    primary: "border-transparent text-white bg-[#5319A5] hover:bg-[#4A1694] focus:ring-[#5319A5] disabled:bg-[#5319A5]/50",
    secondary: "border-[#5319A5] text-[#5319A5] bg-white hover:bg-white focus:ring-[#5319A5]",
    danger: "border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-600/50",
    "danger-secondary": "border-red-600 text-red-600 bg-transparent hover:bg-white focus:ring-red-500"
  };

  // Size classes depending on whether it's an icon-only button
  const sizeClasses = iconOnly 
    ? "p-2" // Square padding for icon-only buttons
    : "px-4 py-2"; // Default padding for regular buttons

  // Style object for color override
  const styleProps = colorOverride ? { backgroundColor: colorOverride } : {};
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses} ${variantClasses[variant]} ${className}`}
      title={title}
      style={styleProps}
    >
      {icon && <span className={children ? "mr-2" : ""}>{icon}</span>}
      {children}
    </button>
  );
};

export default Button; 