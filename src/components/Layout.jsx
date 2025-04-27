import React from 'react';
import { motion } from 'framer-motion';

/**
 * Layout component for consistent page styling
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 */
export default function Layout({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen w-full bg-gray-50"
    >
      {/* Page background decorations */}
      <div className="absolute h-full w-full overflow-hidden pointer-events-none">
        <div className="absolute -left-[25vmin] -top-[25vmin] min-h-[50vmin] min-w-[50vmin] rounded-full bg-primary/10 animate-pulse-float"></div>
        <div className="absolute -bottom-[15vmin] -right-[15vmin] min-h-[45vmin] min-w-[45vmin] rotate-45 bg-primary/10 animate-pulse-float-reverse"></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
} 