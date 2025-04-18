import React from 'react';

/**
 * LoadingSpinner component
 * @param {Object} props - Component props
 * @param {string} props.size - Size of the spinner (sm, md, lg)
 * @param {string} props.className - Additional CSS classes
 */
export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.md;
  
  return (
    <div className={`animate-spin rounded-full border-4 border-primary border-t-transparent ${spinnerSize} ${className}`}></div>
  );
} 