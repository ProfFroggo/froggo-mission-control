// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Theme toggle utility
 * Provides keyboard shortcut support for quick theme switching
 */

import { safeStorage } from './safeStorage';

export type Theme = 'dark' | 'light' | 'system';

export interface ThemeState {
  theme: Theme;
  accentColor: string;
}

/**
 * Apply theme to document root.
 * Surface/text colors are managed by the .radix-themes CSS bridge — we only
 * update the root class and dispatch themeChange so App.tsx can sync Radix appearance.
 */
export function applyTheme(theme: Theme, _accentColor: string) {
  const root = document.documentElement;

  const actualTheme: 'dark' | 'light' = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  // Update root class (used by non-Radix CSS)
  root.classList.remove('dark', 'light');
  root.classList.add(actualTheme);

  // Clear any stale inline vars so the .radix-themes bridge takes over
  const bridgeVars = [
    '--mission-control-bg', '--mission-control-surface', '--mission-control-border',
    '--mission-control-text', '--mission-control-text-dim',
    '--mission-control-accent', '--mission-control-accent-dim',
    '--mission-control-bg-alt', '--mission-control-bg0', '--mission-control-card',
  ];
  bridgeVars.forEach(v => root.style.removeProperty(v));

  // Notify App.tsx to sync Radix <Theme appearance>
  window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme: actualTheme } }));
}

/**
 * Get current theme from localStorage
 */
export function getCurrentTheme(): ThemeState {
  const saved = safeStorage.getItem('mission-control-settings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      return {
        theme: settings.theme || 'dark',
        accentColor: settings.accentColor || '#22c55e',
      };
    } catch (_e) {
      // '[themeToggle] Failed to parse settings'
    }
  }
  return { theme: 'dark', accentColor: '#22c55e' };
}

/**
 * Toggle between light and dark mode
 * If currently in system mode, switches to explicit dark/light
 * Returns the new theme
 */
export function toggleTheme(): Theme {
  const currentState = getCurrentTheme();
  const currentTheme = currentState.theme;
  
  // Toggle logic:
  // system → dark
  // dark → light
  // light → dark
  let newTheme: Theme;
  
  if (currentTheme === 'system') {
    // If system, determine actual theme and toggle
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    newTheme = isSystemDark ? 'light' : 'dark';
  } else {
    // Simple toggle between light and dark
    newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  }
  
  // Apply theme
  applyTheme(newTheme, currentState.accentColor);
  
  // Save to localStorage
  const saved = safeStorage.getItem('mission-control-settings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      settings.theme = newTheme;
      safeStorage.setItem('mission-control-settings', JSON.stringify(settings));
    } catch (_e) {
      // '[themeToggle] Failed to save theme'
    }
  }

  return newTheme;
}

/**
 * Get friendly theme name for display
 */
export function getThemeDisplayName(theme: Theme): string {
  return theme === 'dark' ? 'Dark Mode' : 'Light Mode';
}
