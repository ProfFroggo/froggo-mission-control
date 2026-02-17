/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react';
import { useTour } from '../components/TourGuide';

/**
 * Hook to detect first-time users and show welcome tour
 */
export function useFirstTimeUser() {
  const { startTour, hasCompletedTour } = useTour();

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
