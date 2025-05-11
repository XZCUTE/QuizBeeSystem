/**
 * Navigation Prevention Utility
 * 
 * This utility prevents users from accidentally navigating away from the quiz
 * during an active session by:
 * - Showing a confirmation dialog when trying to refresh, close, or navigate away
 * - Preventing back button usage
 * - Works across Participant, Host, and Audience views
 */

// The message to show when user tries to leave the page
const DEFAULT_WARNING_MESSAGE = "Warning: Leaving this page will end your quiz session. Are you sure you want to exit?";

/**
 * Enable navigation prevention for the current page
 * @param {string} customMessage - Optional custom warning message
 * @returns {Function} - Function to disable navigation prevention when called
 */
export const preventNavigation = (customMessage = DEFAULT_WARNING_MESSAGE) => {
  // Store the functions to remove event listeners
  const cleanupFunctions = [];
  
  // 1. Prevent page refresh/close with beforeunload
  const handleBeforeUnload = (event) => {
    // Standard way of showing a confirmation dialog
    event.preventDefault();
    event.returnValue = customMessage; // Required for Chrome
    return customMessage; // For older browsers
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  cleanupFunctions.push(() => window.removeEventListener('beforeunload', handleBeforeUnload));
  
  // 2. Prevent back button navigation
  const handlePopState = (event) => {
    // When user presses back button, we confirm and if canceled, we push a new state to stay on page
    if (window.confirm(customMessage)) {
      // User confirmed they want to leave - allow it to happen
      return;
    } else {
      // User wants to stay, so push a new state to remain on current page
      history.pushState(null, '', window.location.pathname);
      event.preventDefault();
    }
  };
  
  window.addEventListener('popstate', handlePopState);
  cleanupFunctions.push(() => window.removeEventListener('popstate', handlePopState));
  
  // Push a new state to enable the back button interception
  history.pushState(null, '', window.location.pathname);
  
  // Return cleanup function to disable navigation prevention
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
};

/**
 * Check if the current page is a quiz view that should have navigation prevention
 * @returns {boolean} - True if current page is a quiz view
 */
export const isQuizView = () => {
  const path = window.location.pathname;
  // Check if the current path is a quiz-related page
  return (
    path.includes('/participant') || 
    path.includes('/host') || 
    path.includes('/audience')
  );
};

/**
 * Hook to use in React components to enable navigation prevention
 * @param {boolean} enabled - Whether navigation prevention should be enabled
 * @param {string} customMessage - Optional custom warning message
 */
export const useNavigationPrevention = (enabled = true, customMessage = DEFAULT_WARNING_MESSAGE) => {
  if (typeof window === 'undefined') return; // For SSR safety
  
  // If enabled, set up the prevention
  if (enabled) {
    // Set up prevention when component mounts
    const cleanup = preventNavigation(customMessage);
    
    // Return function to clean up when component unmounts
    return cleanup;
  }
  
  return () => {}; // No-op if not enabled
}; 