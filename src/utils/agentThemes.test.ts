/**
 * Tests for agentThemes utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  agentThemes,
  defaultTheme,
  generateThemeFromColor,
  registerAgentTheme,
  getAgentTheme,
  getAgentColor,
  AgentTheme,
} from './agentThemes';

describe('agentThemes utilities', () => {
  describe('agentThemes', () => {
    it('should have themes for known agents', () => {
      expect(agentThemes['froggo']).toBeDefined();
      expect(agentThemes['coder']).toBeDefined();
      expect(agentThemes['researcher']).toBeDefined();
      expect(agentThemes['writer']).toBeDefined();
      expect(agentThemes['chief']).toBeDefined();
      expect(agentThemes['hr']).toBeDefined();
      expect(agentThemes['designer']).toBeDefined();
      expect(agentThemes['clara']).toBeDefined();
    });

    it('should have required properties for each theme', () => {
      const theme = agentThemes['froggo'];
      expect(theme).toHaveProperty('color');
      expect(theme).toHaveProperty('border');
      expect(theme).toHaveProperty('bg');
      expect(theme).toHaveProperty('text');
      expect(theme).toHaveProperty('ring');
      expect(theme).toHaveProperty('dot');
      expect(theme).toHaveProperty('pic');
    });

    it('should have unique colors for each agent', () => {
      const colors = Object.values(agentThemes).map(t => t.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });

    it('should use green theme for froggo and main', () => {
      expect(agentThemes['froggo'].color).toBe('#4CAF50');
      expect(agentThemes['main'].color).toBe('#4CAF50');
    });
  });

  describe('defaultTheme', () => {
    it('should have fallback properties', () => {
      expect(defaultTheme.color).toBe('#666');
      expect(defaultTheme.border).toBe('border-clawd-border');
      expect(defaultTheme.bg).toBe('bg-clawd-surface');
      expect(defaultTheme.text).toBe('text-clawd-text-dim');
      expect(defaultTheme.ring).toBe('ring-clawd-border');
      expect(defaultTheme.dot).toBe('bg-gray-400');
      expect(defaultTheme.pic).toBe('');
    });
  });

  describe('generateThemeFromColor', () => {
    it('should generate theme for valid hex color', () => {
      const theme = generateThemeFromColor('#FF5733');
      expect(theme.color).toBe('#FF5733');
      expect(theme.border).toContain('#FF5733');
      expect(theme.bg).toContain('#FF5733');
      expect(theme.text).toContain('#FF5733');
      expect(theme.ring).toContain('#FF5733');
      expect(theme.dot).toBe('#FF5733');
    });

    it('should return default theme for invalid hex color', () => {
      const theme = generateThemeFromColor('not-a-color');
      expect(theme).toEqual(defaultTheme);
    });

    it('should return default theme for empty string', () => {
      const theme = generateThemeFromColor('');
      expect(theme).toEqual(defaultTheme);
    });

    it('should use custom picture if provided', () => {
      const theme = generateThemeFromColor('#FF5733', 'custom-pic.png');
      expect(theme.pic).toBe('custom-pic.png');
    });

    it('should cache generated themes', () => {
      const theme1 = generateThemeFromColor('#123456');
      const theme2 = generateThemeFromColor('#123456');
      expect(theme1).toBe(theme2); // Same reference
    });

    it('should handle short hex format', () => {
      const theme = generateThemeFromColor('#F00');
      expect(theme.color).toBe('#F00');
    });

    it('should handle hex without hash', () => {
      const theme = generateThemeFromColor('FF5733');
      expect(theme.color).toBe('FF5733');
    });
  });

  describe('registerAgentTheme', () => {
    beforeEach(() => {
      // Clear any dynamically registered themes
      // Note: In a real test, we'd need to access the internal cache
    });

    it('should register new theme for unknown agent', () => {
      const theme = generateThemeFromColor('#ABC123', 'new-agent.png');
      registerAgentTheme('new-agent', '#ABC123', 'new-agent.png');
      
      // The theme should now be available via getAgentTheme
      const retrievedTheme = getAgentTheme('new-agent');
      expect(retrievedTheme.color).toBe('#ABC123');
      expect(retrievedTheme.pic).toBe('new-agent.png');
    });

    it('should not override existing hardcoded theme', () => {
      const originalTheme = agentThemes['coder'];
      registerAgentTheme('coder', '#OVERRIDE', 'override.png');
      
      const theme = getAgentTheme('coder');
      expect(theme.color).toBe(originalTheme.color);
    });
  });

  describe('getAgentTheme', () => {
    it('should return hardcoded theme for known agents', () => {
      const froggoTheme = getAgentTheme('froggo');
      expect(froggoTheme.color).toBe('#4CAF50');
      expect(froggoTheme.border).toBe('border-green-500/40');
    });

    it('should return hardcoded theme for case-insensitive known agents', () => {
      const theme1 = getAgentTheme('Coder');
      const theme2 = getAgentTheme('CODER');
      const theme3 = getAgentTheme('coder');
      expect(theme1).toEqual(theme2);
      expect(theme2).toEqual(theme3);
    });

    it('should return default theme for unknown agents', () => {
      const theme = getAgentTheme('unknown-agent-123');
      expect(theme).toEqual(defaultTheme);
    });

    it('should return cached theme for dynamically registered agents', () => {
      const customColor = '#PINK123';
      registerAgentTheme('custom-agent', customColor, 'custom.png');
      
      const theme = getAgentTheme('custom-agent');
      expect(theme.color).toBe(customColor);
    });
  });

  describe('getAgentColor', () => {
    it('should return color hex for known agent', () => {
      const color = getAgentColor('froggo');
      expect(color).toBe('#4CAF50');
    });

    it('should return default color for unknown agent', () => {
      const color = getAgentColor('unknown');
      expect(color).toBe('#666');
    });

    it('should be case-insensitive', () => {
      const color1 = getAgentColor('Coder');
      const color2 = getAgentColor('CODER');
      const color3 = getAgentColor('coder');
      expect(color1).toBe(color2);
      expect(color2).toBe(color3);
    });
  });

  describe('theme consistency', () => {
    it('should have matching color values across properties', () => {
      Object.entries(agentThemes).forEach(([agent, theme]) => {
        expect(theme.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(theme.dot).toBe(theme.color);
      });
    });

    it('should have unique pictures for each agent', () => {
      const pics = Object.values(agentThemes).map(t => t.pic);
      const uniquePics = new Set(pics);
      expect(uniquePics.size).toBe(pics.length);
    });
  });
});
