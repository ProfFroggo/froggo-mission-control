/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: useFirstTimeUser hook uses file-level suppression for mount-only effect.
// The effect only runs once on mount to check localStorage - intentional pattern.
// Review: 2026-02-28 - refactored to accept tour functions as params (shared state with App)

import { useEffect } from 'react';

/**
 * Hook to detect first-time users and show welcome tour.
 * Accepts startTour/hasCompletedTour from the caller's useTour() so the tour
 * state is shared with the TourGuide component rendered in App.tsx.
 */
export function useFirstTimeUser(
  startTour: (id: string) => void,
  hasCompletedTour: (id: string) => boolean
) {
  useEffect(() => {
    // Check if user has seen the welcome tour
    const hasSeenWelcome = localStorage.getItem('froggo-welcome-tour-seen');

    if (!hasSeenWelcome && !hasCompletedTour('getting-started')) {
      // Show welcome tour after a brief delay to let UI settle
      const timer = setTimeout(() => {
        startTour('gettingStarted');
        localStorage.setItem('froggo-welcome-tour-seen', 'true');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  return {
    isFirstTime: !localStorage.getItem('froggo-welcome-tour-seen'),
  };
}
