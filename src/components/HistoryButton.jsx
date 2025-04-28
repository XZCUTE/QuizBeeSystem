import { useState, useEffect } from "react";

/**
 * HistoryButton - A component that displays a history icon button
 * that opens the history page in a new tab when clicked
 * 
 * @param {Object} props - Component props
 * @param {string} props.quizCode - The quiz code to pass to the history page
 * @param {boolean} props.visible - Whether the button should be visible
 */
export default function HistoryButton({ quizCode, visible = false }) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Add a slight delay to the visibility for a nice animation effect
    if (visible) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [visible]);
  
  const handleClick = () => {
    if (!quizCode) return;
    
    // Open history page in a new tab
    window.open(`/history?code=${quizCode}`, "_blank");
  };
  
  if (!visible) return null;
  
  return (
    <div 
      className={`fixed top-4 right-4 z-50 transition-all duration-300 transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <button
        onClick={handleClick}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow duration-300 focus:outline-none"
        title="View Quiz History"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-6 w-6 text-primary" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
      </button>
    </div>
  );
} 