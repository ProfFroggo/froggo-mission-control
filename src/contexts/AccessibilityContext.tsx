/**
 * AccessibilityContext - Global accessibility settings and management
 * 
 * Features:
 * - Reduced motion preference
 * - High contrast mode
 * - Screen reader announcements
 * - Keyboard navigation state
 * - Focus management
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: number; // Percentage
  screenReaderEnabled: boolean;
  keyboardNavVisible: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  isKeyboardNavigating: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const DEFAULT_SETTINGS: AccessibilitySettings = {
  reducedMotion: false,
  highContrast: false,
  fontSize: 100,
  screenReaderEnabled: false,
  keyboardNavVisible: true,
};

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('froggo-a11y-settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }

    // Detect system preferences
    return {
      ...DEFAULT_SETTINGS,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      highContrast: window.matchMedia('(prefers-contrast: high)').matches,
    };
  });

  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);

  // Update settings and save to localStorage
  const updateSettings = useCallback((newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('froggo-a11y-settings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      updateSettings({ reducedMotion: e.matches });
    };

    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      updateSettings({ highContrast: e.matches });
    };

    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    highContrastQuery.addEventListener('change', handleHighContrastChange);

    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
    };
  }, [updateSettings]);

  // Detect keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardNavigating(true);
        if (settings.keyboardNavVisible) {
          document.body.classList.add('keyboard-nav');
        }
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardNavigating(false);
      document.body.classList.remove('keyboard-nav');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [settings.keyboardNavVisible]);

  // Apply settings to document
  useEffect(() => {
    // Font size
    document.documentElement.style.setProperty(
      '--clawd-font-size',
      `${14 * (settings.fontSize / 100)}px`
    );

    // Reduced motion
    if (settings.reducedMotion) {
      document.documentElement.style.setProperty('--animation-duration', '0.01ms');
    } else {
      document.documentElement.style.removeProperty('--animation-duration');
    }

    // High contrast
    if (settings.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [settings]);

  // Screen reader announcement function
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Create live region if it doesn't exist
    let liveRegion = document.getElementById('a11y-announcer');
    
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'a11y-announcer';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegion);
    }

    // Update live region
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      liveRegion!.textContent = '';
    }, 1000);
  }, []);

  const value: AccessibilityContextType = {
    settings,
    updateSettings,
    announce,
    isKeyboardNavigating,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
}

/**
 * Hook to announce messages to screen readers
 */
export function useAnnounce() {
  const { announce } = useAccessibility();
  return announce;
}

/**
 * Hook to check if user prefers reduced motion
 */
export function useReducedMotion() {
  const { settings } = useAccessibility();
  return settings.reducedMotion;
}

/**
 * Hook to check if keyboard navigation is active
 */
export function useKeyboardNavigating() {
  const { isKeyboardNavigating } = useAccessibility();
  return isKeyboardNavigating;
}
