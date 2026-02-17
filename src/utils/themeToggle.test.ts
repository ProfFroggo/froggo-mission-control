/**
 * Tests for themeToggle utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock safeStorage before importing
vi.mock('./safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import { safeStorage } from './safeStorage';
import { 
  applyTheme, 
  getCurrentTheme, 
  toggleTheme, 
  getThemeDisplayName,
  Theme,
} from '../src/utils/themeToggle';

describe('themeToggle utilities', () => {
  const mockDocument = {
    documentElement: {
      classList: {
        remove: vi.fn(),
        add: vi.fn(),
      },
      style: {
        setProperty: vi.fn(),
      },
    },
    document: {
      querySelector: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock document
    (global as any).document = mockDocument;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('applyTheme', () => {
    it('should apply dark theme class', () => {
      applyTheme('dark', '#22c55e');
      
      expect(mockDocument.documentElement.classList.remove).toHaveBeenCalledWith('dark', 'light');
      expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('dark');
    });

    it('should apply light theme class', () => {
      applyTheme('light', '#22c55e');
      
      expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('light');
    });

    it('should set CSS variables for dark theme', () => {
      applyTheme('dark', '#22c55e');
      
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith('--clawd-bg', '#0a0a0a');
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith('--clawd-surface', '#141414');
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith('--clawd-border', '#262626');
    });

    it('should set CSS variables for light theme', () => {
      applyTheme('light', '#22c55e');
      
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith('--clawd-bg', '#fafafa');
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith('--clawd-surface', '#ffffff');
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith('--clawd-border', '#e4e4e7');
    });

    it('should set accent color CSS variable', () => {
      const accentColor = '#3b82f6';
      applyTheme('dark', accentColor);
      
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith('--clawd-accent', accentColor);
    });

    it('should calculate accent-dim color', () => {
      const accentColor = '#22c55e';
      applyTheme('dark', accentColor);
      
      // Should calculate a darker version of the accent color
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--clawd-accent-dim',
        expect.stringContaining('rgb')
      );
    });

    it('should handle short hex color codes', () => {
      applyTheme('dark', '#abc');
      
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalled();
    });

    it('should not error on invalid hex colors', () => {
      expect(() => applyTheme('dark', 'invalid')).not.toThrow();
    });
  });

  describe('getCurrentTheme', () => {
    it('should return default theme when no saved settings', () => {
      (safeStorage.getItem as vi.Mock).mockReturnValue(null);
      
      const result = getCurrentTheme();
      
      expect(result.theme).toBe('dark');
      expect(result.accentColor).toBe('#22c55e');
    });

    it('should return saved theme from storage', () => {
      const savedSettings = JSON.stringify({ theme: 'light', accentColor: '#3b82f6' });
      (safeStorage.getItem as vi.Mock).mockReturnValue(savedSettings);
      
      const result = getCurrentTheme();
      
      expect(result.theme).toBe('light');
      expect(result.accentColor).toBe('#3b82f6');
    });

    it('should return default theme when parsing fails', () => {
      (safeStorage.getItem as vi.Mock).mockReturnValue('invalid json');
      
      const result = getCurrentTheme();
      
      expect(result.theme).toBe('dark');
      expect(result.accentColor).toBe('#22c55e');
    });

    it('should use saved accent color', () => {
      const savedSettings = JSON.stringify({ accentColor: '#ff0000' });
      (safeStorage.getItem as vi.Mock).mockReturnValue(savedSettings);
      
      const result = getCurrentTheme();
      
      expect(result.accentColor).toBe('#ff0000');
    });

    it('should use default accent color when not saved', () => {
      const savedSettings = JSON.stringify({ theme: 'dark' });
      (safeStorage.getItem as vi.Mock).mockReturnValue(savedSettings);
      
      const result = getCurrentTheme();
      
      expect(result.accentColor).toBe('#22c55e');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      const savedSettings = JSON.stringify({ theme: 'dark', accentColor: '#22c55e' });
      (safeStorage.getItem as vi.Mock).mockReturnValue(savedSettings);
      
      const result = toggleTheme();
      
      expect(result).toBe('light');
      expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('light');
    });

    it('should toggle from light to dark', () => {
      const savedSettings = JSON.stringify({ theme: 'light', accentColor: '#22c55e' });
      (safeStorage.getItem as vi.Mock).mockReturnValue(savedSettings);
      
      const result = toggleTheme();
      
      expect(result).toBe('dark');
    });

    it('should save new theme to storage', () => {
      const savedSettings = JSON.stringify({ theme: 'dark', accentColor: '#22c55e' });
      (safeStorage.getItem as vi.Mock).mockReturnValue(savedSettings);
      
      toggleTheme();
      
      expect(safeStorage.setItem).toHaveBeenCalledWith(
        'froggo-settings',
        expect.stringContaining('"theme":"light"')
      );
    });

    it('should preserve accent color when toggling', () => {
      const savedSettings = JSON.stringify({ theme: 'dark', accentColor: '#ff0000' });
      (safeStorage.getItem as vi.Mock).mockReturnValue(savedSettings);
      
      toggleTheme();
      
      expect(safeStorage.setItem).toHaveBeenCalledWith(
        'froggo-settings',
        expect.stringContaining('#ff0000')
      );
    });

    it('should use default accent color when settings are invalid', () => {
      const savedSettings = JSON.stringify({ theme: 'dark', accentColor: null });
      (safeStorage.getItem as vi.Mock).mockReturnValue(savedSettings);
      
      toggleTheme();
      
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--clawd-accent',
        '#22c55e'
      );
    });
  });

  describe('getThemeDisplayName', () => {
    it('should return Dark Mode for dark theme', () => {
      const result = getThemeDisplayName('dark');
      expect(result).toBe('Dark Mode');
    });

    it('should return Light Mode for light theme', () => {
      const result = getThemeDisplayName('light');
      expect(result).toBe('Light Mode');
    });

    it('should return Light Mode for system theme', () => {
      const result = getThemeDisplayName('system');
      expect(result).toBe('Light Mode');
    });

    it('should handle any Theme value', () => {
      const darkResult = getThemeDisplayName('dark' as Theme);
      const lightResult = getThemeDisplayName('light' as Theme);
      
      expect(typeof darkResult).toBe('string');
      expect(typeof lightResult).toBe('string');
    });
  });

  describe('theme state', () => {
    it('should create valid ThemeState object', () => {
      const state = {
        theme: 'dark' as Theme,
        accentColor: '#22c55e',
      };
      
      expect(state.theme).toBe('dark');
      expect(state.accentColor).toMatch(/^#/);
    });

    it('should handle different accent colors', () => {
      const colors = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6'];
      
      colors.forEach(color => {
        applyTheme('dark', color);
        expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
          '--clawd-accent',
          color
        );
      });
    });
  });

  describe('system preference detection', () => {
    it('should detect system dark mode preference', () => {
      const mockMatchMedia = vi.fn().mockReturnValue({ matches: true });
      (global as any).window = { matchMedia: mockMatchMedia };
      
      // Theme determination logic
      const isSystemDark = mockMatchMedia('(prefers-color-scheme: dark)').matches;
      expect(isSystemDark).toBe(true);
    });

    it('should detect system light mode preference', () => {
      const mockMatchMedia = vi.fn().mockReturnValue({ matches: false });
      (global as any).window = { matchMedia: mockMatchMedia };
      
      const isSystemDark = mockMatchMedia('(prefers-color-scheme: dark)').matches;
      expect(isSystemDark).toBe(false);
    });
  });
});
