/**
 * Theme toggle utility
 * Provides keyboard shortcut support for quick theme switching
 */

export type Theme = 'dark' | 'light' | 'system';

export interface ThemeState {
  theme: Theme;
  accentColor: string;
}

/**
 * Apply theme to document root
 */
export function applyTheme(theme: Theme, accentColor: string) {
  const root = document.documentElement;
  
  // Determine actual theme
  let actualTheme = theme;
  if (theme === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  // Apply theme class
  root.classList.remove('dark', 'light');
  root.classList.add(actualTheme);
  
  // Apply theme colors
  if (actualTheme === 'dark') {
    root.style.setProperty('--clawd-bg', '#0a0a0a');
    root.style.setProperty('--clawd-surface', '#141414');
    root.style.setProperty('--clawd-border', '#262626');
    root.style.setProperty('--clawd-text', '#fafafa');
    root.style.setProperty('--clawd-text-dim', '#a1a1aa');
  } else {
    root.style.setProperty('--clawd-bg', '#fafafa');
    root.style.setProperty('--clawd-surface', '#ffffff');
    root.style.setProperty('--clawd-border', '#e4e4e7');
    root.style.setProperty('--clawd-text', '#18181b');
    root.style.setProperty('--clawd-text-dim', '#71717a');
  }
  
  // Apply accent color
  root.style.setProperty('--clawd-accent', accentColor);
  
  // Generate accent-dim (slightly darker)
  const hex = accentColor.replace('#', '');
  const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 30);
  root.style.setProperty('--clawd-accent-dim', `rgb(${r}, ${g}, ${b})`);
}

/**
 * Get current theme from localStorage
 */
export function getCurrentTheme(): ThemeState {
  const saved = localStorage.getItem('froggo-settings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      return {
        theme: settings.theme || 'dark',
        accentColor: settings.accentColor || '#22c55e',
      };
    } catch (e) {
      console.error('[themeToggle] Failed to parse settings:', e);
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
  const saved = localStorage.getItem('froggo-settings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      settings.theme = newTheme;
      localStorage.setItem('froggo-settings', JSON.stringify(settings));
    } catch (e) {
      console.error('[themeToggle] Failed to save theme:', e);
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
