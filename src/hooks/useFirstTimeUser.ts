/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: useFirstTimeUser hook uses file-level suppression for mount-only effect.
// The effect only runs once on mount to check localStorage - intentional pattern.
// Review: 2026-02-28 - extended to manage onboarding wizard before tour

import { useState, useEffect, useCallback } from 'react';

const ONBOARDING_KEY = 'mission-control-onboarding-completed';
const TOUR_SEEN_KEY = 'mission-control-welcome-tour-seen';

/**
 * Hook to detect first-time users and manage onboarding wizard + tour lifecycle.
 *
 * Flow: wizard (if not completed) -> optional tour -> normal use
 * Accepts startTour/hasCompletedTour from the caller's useTour() so the tour
 * state is shared with the TourGuide component rendered in App.tsx.
 */
export function useFirstTimeUser(
  startTour: (id: string) => void,
  hasCompletedTour: (id: string) => boolean
) {
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);

  useEffect(() => {
    const onboardingDone = localStorage.getItem(ONBOARDING_KEY);
    const tourSeen = localStorage.getItem(TOUR_SEEN_KEY);

    if (!onboardingDone) {
      // Wizard not completed -- show it first
      setShowOnboardingWizard(true);
    } else if (!tourSeen && !hasCompletedTour('getting-started')) {
      // Wizard done but tour not seen -- auto-start tour after brief delay
      const timer = setTimeout(() => {
        startTour('gettingStarted');
        localStorage.setItem(TOUR_SEEN_KEY, 'true');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  /**
   * Called when the onboarding wizard finishes (user completed or reached last step).
   * @param startTourAfter - true to launch guided tour immediately after wizard
   */
  const completeOnboarding = useCallback((startTourAfter: boolean) => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboardingWizard(false);

    if (startTourAfter) {
      // Small delay to let wizard unmount before tour starts
      setTimeout(() => {
        startTour('gettingStarted');
        localStorage.setItem(TOUR_SEEN_KEY, 'true');
      }, 500);
    } else {
      // User chose to skip tour too
      localStorage.setItem(TOUR_SEEN_KEY, 'true');
    }
  }, [startTour]);

  /**
   * Called when user clicks "Skip Setup" on the wizard.
   * Marks both onboarding and tour as done so neither shows again.
   */
  const skipOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
    setShowOnboardingWizard(false);
  }, []);

  return {
    isFirstTime: !localStorage.getItem(ONBOARDING_KEY),
    showOnboardingWizard,
    completeOnboarding,
    skipOnboarding,
  };
}
