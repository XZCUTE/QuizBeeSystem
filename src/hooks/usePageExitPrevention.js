/**
 * This file exists for compatibility with code that might be referencing it.
 * It re-exports the navigation prevention utility functionality.
 */

import { preventNavigation, isQuizView, useNavigationPrevention } from '@/utils/navigationPrevention';

export { preventNavigation, isQuizView, useNavigationPrevention };

// Default export for backwards compatibility
export default useNavigationPrevention; 