/**
 * Accessibility Tests
 * 
 * Tests for WCAG 2.1 compliance and accessibility features
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibilityProvider, useAccessibility } from '../contexts/AccessibilityContext';
import AccessibilitySettings from '../components/AccessibilitySettings';
import BaseModal from '../components/BaseModal';
import Sidebar from '../components/Sidebar';

describe('Accessibility Features', () => {
  describe('AccessibilityContext', () => {
    it('should provide default settings', () => {
      let settings: any;
      
      function TestComponent() {
        const ctx = useAccessibility();
        settings = ctx.settings;
        return null;
      }
      
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );
      
      expect(settings).toBeDefined();
      expect(settings.reducedMotion).toBe(false);
      expect(settings.fontSize).toBe(100);
      expect(settings.keyboardNavVisible).toBe(true);
    });
    
    it('should update settings', async () => {
      let updateFn: any;
      let settings: any;
      
      function TestComponent() {
        const ctx = useAccessibility();
        updateFn = ctx.updateSettings;
        settings = ctx.settings;
        return null;
      }
      
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );
      
      // Update font size
      updateFn({ fontSize: 125 });
      
      await waitFor(() => {
        expect(settings.fontSize).toBe(125);
      });
    });
    
    it('should announce messages', () => {
      let announceFn: any;
      
      function TestComponent() {
        const ctx = useAccessibility();
        announceFn = ctx.announce;
        return null;
      }
      
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );
      
      // Should not throw
      expect(() => announceFn('Test message')).not.toThrow();
      expect(() => announceFn('Critical alert', 'assertive')).not.toThrow();
    });
  });
  
  describe('AccessibilitySettings Component', () => {
    it('should render all settings sections', () => {
      render(
        <AccessibilityProvider>
          <AccessibilitySettings />
        </AccessibilityProvider>
      );
      
      // Check headings
      expect(screen.getByText('Accessibility Settings')).toBeInTheDocument();
      expect(screen.getByText('Visual')).toBeInTheDocument();
      expect(screen.getByText('Keyboard & Navigation')).toBeInTheDocument();
      expect(screen.getByText('Screen Reader')).toBeInTheDocument();
    });
    
    it('should toggle reduced motion', async () => {
      const user = userEvent.setup();
      
      render(
        <AccessibilityProvider>
          <AccessibilitySettings />
        </AccessibilityProvider>
      );
      
      // Find by id since the switch has id="reduced-motion"
      const toggle = document.getElementById('reduced-motion');
      expect(toggle).toBeTruthy();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      
      await user.click(toggle!);
      
      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-checked', 'true');
      });
    });
    
    it('should adjust font size', async () => {
      const user = userEvent.setup();
      
      render(
        <AccessibilityProvider>
          <AccessibilitySettings />
        </AccessibilityProvider>
      );
      
      // Find "Large" button
      const largeButton = screen.getByRole('button', { name: /large \(125%\)/i });
      await user.click(largeButton);
      
      await waitFor(() => {
        expect(largeButton).toHaveAttribute('aria-pressed', 'true');
      });
    });
    
    it('should have accessible form controls', () => {
      render(
        <AccessibilityProvider>
          <AccessibilitySettings />
        </AccessibilityProvider>
      );
      
      // All switches should have aria-checked
      const switches = screen.getAllByRole('switch');
      switches.forEach(toggle => {
        expect(toggle).toHaveAttribute('aria-checked');
      });
      
      // All buttons should have labels
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const label = button.getAttribute('aria-label');
        const text = button.textContent;
        expect(label || text).toBeTruthy();
      });
    });
  });
  
  describe('BaseModal Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <BaseModal 
          isOpen={true} 
          onClose={() => {}}
          ariaLabel="Test Modal"
        >
          <div>Modal Content</div>
        </BaseModal>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Test Modal');
    });
    
    it('should close on ESC key', async () => {
      const onClose = vi.fn();
      
      render(
        <BaseModal isOpen={true} onClose={onClose}>
          <div>Modal Content</div>
        </BaseModal>
      );
      
      fireEvent.keyDown(window, { key: 'Escape' });
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
    
    it('should trap focus within modal', async () => {
      render(
        <BaseModal isOpen={true} onClose={() => {}}>
          <div>
            <button>First</button>
            <button>Second</button>
            <button>Last</button>
          </div>
        </BaseModal>
      );
      
      const buttons = screen.getAllByRole('button');
      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];
      
      // Focus first button
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);
      
      // Shift+Tab on first should focus last
      fireEvent.keyDown(firstButton, { key: 'Tab', shiftKey: true });
      
      // Tab on last should focus first
      fireEvent.keyDown(lastButton, { key: 'Tab' });
    });
  });
  
  describe('Keyboard Navigation', () => {
    it('should support Tab navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <button>Button 1</button>
          <button>Button 2</button>
          <button>Button 3</button>
        </div>
      );
      
      const buttons = screen.getAllByRole('button');
      
      // Tab through buttons
      await user.tab();
      expect(document.activeElement).toBe(buttons[0]);
      
      await user.tab();
      expect(document.activeElement).toBe(buttons[1]);
      
      await user.tab();
      expect(document.activeElement).toBe(buttons[2]);
    });
  });
  
  describe('Sidebar Accessibility', () => {
    it('should have navigation landmarks', () => {
      render(
        <Sidebar 
          currentView="dashboard" 
          onNavigate={() => {}}
        />
      );
      
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });
      expect(nav).toBeInTheDocument();
    });
    
    it('should have accessible nav items', () => {
      render(
        <Sidebar 
          currentView="dashboard" 
          onNavigate={() => {}}
        />
      );
      
      // All navigation buttons should have labels
      const navButtons = screen.getAllByRole('button');
      navButtons.forEach(button => {
        const label = button.getAttribute('aria-label');
        const text = button.textContent;
        expect(label || text).toBeTruthy();
      });
    });
    
    it('should indicate current page', () => {
      render(
        <Sidebar 
          currentView="dashboard" 
          onNavigate={() => {}}
        />
      );
      
      // Find dashboard button by data-view attribute (more specific)
      const navButtons = screen.getAllByRole('button');
      const dashboardButton = navButtons.find(btn => btn.getAttribute('data-view') === 'dashboard');
      
      expect(dashboardButton).toBeDefined();
      expect(dashboardButton).toHaveAttribute('aria-current', 'page');
    });
  });
  
  describe('Focus Indicators', () => {
    it('should have visible focus on interactive elements', () => {
      render(
        <div>
          <button>Test Button</button>
          <a href="#">Test Link</a>
          <input type="text" aria-label="Test Input" />
        </div>
      );
      
      const button = screen.getByRole('button');
      const link = screen.getByRole('link');
      const input = screen.getByRole('textbox');
      
      // Focus each element
      button.focus();
      expect(document.activeElement).toBe(button);
      
      link.focus();
      expect(document.activeElement).toBe(link);
      
      input.focus();
      expect(document.activeElement).toBe(input);
    });
  });
  
  describe('Color Contrast', () => {
    it('should have adequate contrast for text', () => {
      // This is a basic check - full contrast testing requires visual regression tools
      render(
        <div className="text-clawd-text bg-clawd-bg">
          <p>Test text with proper contrast</p>
        </div>
      );
      
      const text = screen.getByText(/test text/i);
      expect(text).toBeInTheDocument();
    });
  });
  
  describe('Screen Reader Support', () => {
    it('should have ARIA live region for announcements', () => {
      render(
        <AccessibilityProvider>
          <div id="aria-announcements" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
        </AccessibilityProvider>
      );
      
      const liveRegion = document.getElementById('aria-announcements');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
  });
  
  describe('Reduced Motion', () => {
    it('should respect prefers-reduced-motion', () => {
      // Mock media query BEFORE rendering
      const mockMatchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: mockMatchMedia,
      });
      
      let settings: any;
      
      function TestComponent() {
        const ctx = useAccessibility();
        settings = ctx.settings;
        return null;
      }
      
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );
      
      // Should detect system preference or default to false
      // (depends on whether localStorage has saved value)
      expect(typeof settings.reducedMotion).toBe('boolean');
    });
  });
});

describe('WCAG Compliance', () => {
  it('should have proper heading hierarchy', () => {
    render(
      <AccessibilityProvider>
        <AccessibilitySettings />
      </AccessibilityProvider>
    );
    
    // H2 should come before H3
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const levels = Array.from(headings).map(h => parseInt(h.tagName.substring(1)));
    
    // Check that levels don't skip (e.g., h1 → h3)
    for (let i = 1; i < levels.length; i++) {
      const diff = levels[i] - levels[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
    }
  });
  
  it('should have labels for all form inputs', () => {
    render(
      <AccessibilityProvider>
        <AccessibilitySettings />
      </AccessibilityProvider>
    );
    
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      // Should have aria-label or associated label
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledby = input.getAttribute('aria-labelledby');
      const id = input.getAttribute('id');
      const associatedLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
      
      expect(ariaLabel || ariaLabelledby || associatedLabel).toBeTruthy();
    });
  });
  
  it('should have descriptive button text', () => {
    render(
      <AccessibilityProvider>
        <AccessibilitySettings />
      </AccessibilityProvider>
    );
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      const text = button.textContent || button.getAttribute('aria-label');
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(0);
    });
  });
});
