// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook to announce messages to screen readers
 */
export function useAnnounce() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById('aria-announcements');
    if (announcer) {
      announcer.setAttribute('aria-live', priority);
      announcer.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  }, []);

  return announce;
}

/**
 * Hook to trap focus within a modal or dialog
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element when activated
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook to manage focus when component mounts
 */
export function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}

/**
 * Hook to detect reduced motion preference
 */
export function useReducedMotion() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return prefersReducedMotion;
}

/**
 * Hook to detect high contrast preference
 */
export function useHighContrast() {
  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
  return prefersHighContrast;
}

/**
 * Hook for keyboard navigation in lists
 */
export function useKeyboardNavigation<T extends HTMLElement>(
  itemsCount: number,
  onSelect: (index: number) => void,
  options: {
    loop?: boolean;
    orientation?: 'vertical' | 'horizontal';
  } = {}
) {
  const { loop = true, orientation = 'vertical' } = options;
  const currentIndex = useRef(0);
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isVertical = orientation === 'vertical';
      const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
      const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

      if (e.key === nextKey) {
        e.preventDefault();
        currentIndex.current = loop
          ? (currentIndex.current + 1) % itemsCount
          : Math.min(currentIndex.current + 1, itemsCount - 1);
        onSelect(currentIndex.current);
      } else if (e.key === prevKey) {
        e.preventDefault();
        currentIndex.current = loop
          ? (currentIndex.current - 1 + itemsCount) % itemsCount
          : Math.max(currentIndex.current - 1, 0);
        onSelect(currentIndex.current);
      } else if (e.key === 'Home') {
        e.preventDefault();
        currentIndex.current = 0;
        onSelect(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        currentIndex.current = itemsCount - 1;
        onSelect(itemsCount - 1);
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [itemsCount, onSelect, loop, orientation]);

  return { containerRef, currentIndex: currentIndex.current };
}

/**
 * Hook to restore focus after modal closes
 */
export function useFocusRestore() {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const saveFocus = () => {
    previousActiveElement.current = document.activeElement as HTMLElement;
  };

  const restoreFocus = () => {
    previousActiveElement.current?.focus();
  };

  return { saveFocus, restoreFocus };
}
