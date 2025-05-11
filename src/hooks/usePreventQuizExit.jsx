import { useEffect } from 'react';
import { preventNavigation } from '@/utils/navigationPrevention';

/**
 * React hook to prevent accidental navigation away from quiz pages
 * 
 * @param {boolean} enabled - Whether the prevention should be active
 * @param {string} customMessage - Optional custom message for the confirmation dialog
 */
export default function usePreventQuizExit(enabled = true, customMessage) {
  useEffect(() => {
    // Only apply prevention when explicitly enabled
    if (!enabled) return;
    
    // Set up navigation prevention
    const cleanup = preventNavigation(customMessage);
    
    // Clean up event listeners when component unmounts
    return cleanup;
  }, [enabled, customMessage]);
} 