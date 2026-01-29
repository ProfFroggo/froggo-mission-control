/**
 * useKeyboardNav - Enhanced keyboard navigation support
 * 
 * Features:
 * - Detects keyboard navigation mode
 * - Manages focus trap for modals
 * - Provides focus management utilities
 * - Handles escape key for dialogs
 */

import { useEffect, useCallback, useRef } from 'react';

interface UseKeyboardNavOptions {
  onEscape?: () => void;
  trapFocus?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
}

export function useKeyboardNav(options: UseKeyboardNavOptions = {}) {
  const {
    onEscape,
    trapFocus = false,
    autoFocus = false,
    restoreFocus = false,
  } = options;

  const containerRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Detect keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-nav');
      }
    };

    const handleMouseDown = () => {
      document.body.classList.remove('keyboard-nav');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!onEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);

  // Focus trap for modals
  useEffect(() => {
    if (!trapFocus || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [trapFocus]);

  // Auto focus
  useEffect(() => {
    if (!autoFocus || !containerRef.current) return;

    // Save previous focus
    if (restoreFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    // Focus first focusable element
    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Restore focus on cleanup
    return () => {
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [autoFocus, restoreFocus]);

  const setContainerRef = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
  }, []);

  return {
    containerRef: setContainerRef,
  };
}

/**
 * useFocusTrap - Simple focus trap for modals and dialogs
 */
export function useFocusTrap(active: boolean = true) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element on mount
    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);
    return () => container.removeEventListener('keydown', handleTab);
  }, [active]);

  return containerRef;
}

/**
 * useArrowNavigation - Arrow key navigation for lists
 */
export function useArrowNavigation(itemsRef: React.RefObject<HTMLElement[]>, options: {
  enabled?: boolean;
  loop?: boolean;
  orientation?: 'vertical' | 'horizontal';
} = {}) {
  const {
    enabled = true,
    loop = true,
    orientation = 'vertical',
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = itemsRef.current;
      if (!items || items.length === 0) return;

      const currentIndex = items.findIndex(item => item === document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      const isVertical = orientation === 'vertical';
      const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';
      const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';

      if (e.key === prevKey) {
        e.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? items.length - 1 : 0;
        }
      } else if (e.key === nextKey) {
        e.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
          nextIndex = loop ? 0 : items.length - 1;
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = items.length - 1;
      }

      if (nextIndex !== currentIndex) {
        items[nextIndex]?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, loop, orientation, itemsRef]);
}

/**
 * announceToScreenReader - Announce messages to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}
