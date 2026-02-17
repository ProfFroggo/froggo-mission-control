/**
 * Tests for useAccessibility hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useAnnounce,
  useFocusTrap,
  useAutoFocus,
  useReducedMotion,
  useHighContrast,
  useKeyboardNavigation,
  useFocusRestore,
} from './hooks/useAccessibility';

describe('useAccessibility hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock document elements
    const mockAnnouncer = {
      setAttribute: vi.fn(),
      textContent: '',
    };
    
    const mockFocusable = {
      focus: vi.fn(),
    };
    
    const mockContainer = {
      querySelectorAll: vi.fn().mockReturnValue([mockFocusable, mockFocusable, mockFocusable]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    
    (global as any).document = {
      getElementById: vi.fn().mockReturnValue(mockAnnouncer),
      activeElement: mockFocusable,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    
    (global as any).HTMLElement = class {
      focus() {}
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useAnnounce', () => {
    it('should return announce function', () => {
      const { result } = renderHook(() => useAnnounce());
      
      expect(typeof result.current).toBe('function');
    });

    it('should set aria-live attribute', () => {
      const mockAnnouncer = {
        setAttribute: vi.fn(),
        textContent: '',
      };
      (document.getElementById as vi.Mock).mockReturnValue(mockAnnouncer);
      
      const { result } = renderHook(() => useAnnounce());
      
      act(() => {
        result.current('Test announcement');
      });
      
      expect(mockAnnouncer.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
    });

    it('should default to polite priority', () => {
      const mockAnnouncer = {
        setAttribute: vi.fn(),
        textContent: '',
      };
      (document.getElementById as vi.Mock).mockReturnValue(mockAnnouncer);
      
      const { result } = renderHook(() => useAnnounce());
      
      act(() => {
        result.current('Test message');
      });
      
      expect(mockAnnouncer.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
    });

    it('should support assertive priority', () => {
      const mockAnnouncer = {
        setAttribute: vi.fn(),
        textContent: '',
      };
      (document.getElementById as vi.Mock).mockReturnValue(mockAnnouncer);
      
      const { result } = renderHook(() => useAnnounce());
      
      act(() => {
        result.current('Urgent message', 'assertive');
      });
      
      expect(mockAnnouncer.setAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
    });

    it('should set announcement text', () => {
      const mockAnnouncer = {
        setAttribute: vi.fn(),
        textContent: '',
      };
      (document.getElementById as vi.Mock).mockReturnValue(mockAnnouncer);
      
      const { result } = renderHook(() => useAnnounce());
      
      act(() => {
        result.current('Important announcement');
      });
      
      expect(mockAnnouncer.textContent).toBe('Important announcement');
    });

    it('should clear announcement after timeout', () => {
      vi.useFakeTimers();
      
      const mockAnnouncer = {
        setAttribute: vi.fn(),
        textContent: '',
      };
      (document.getElementById as vi.Mock).mockReturnValue(mockAnnouncer);
      
      const { result } = renderHook(() => useAnnounce());
      
      act(() => {
        result.current('Timed announcement');
      });
      
      expect(mockAnnouncer.textContent).toBe('Timed announcement');
      
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(mockAnnouncer.textContent).toBe('');
      
      vi.useRealTimers();
    });

    it('should handle missing announcer element', () => {
      (document.getElementById as vi.Mock).mockReturnValue(null);
      
      const { result } = renderHook(() => useAnnounce());
      
      // Should not throw
      act(() => {
        result.current('No announcer');
      });
    });
  });

  describe('useFocusTrap', () => {
    it('should return container ref', () => {
      const { result } = renderHook(() => useFocusTrap(true));
      
      expect(result.current).toHaveProperty('current');
    });

    it('should trap focus when active', () => {
      const mockFirst = { focus: vi.fn() };
      const mockLast = { focus: vi.fn() };
      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([mockFirst, {}, mockLast]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      
      const { result, unmount } = renderHook(() => useFocusTrap(true));
      
      // Set the ref
      act(() => {
        result.current.current = mockContainer as unknown as HTMLElement;
      });
      
      expect(mockFirst.focus).toHaveBeenCalled();
      expect(mockContainer.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      
      unmount();
      expect(mockContainer.removeEventListener).toHaveBeenCalled();
    });

    it('should not trap focus when inactive', () => {
      const mockContainer = {
        querySelectorAll: vi.fn(),
        addEventListener: vi.fn(),
      };
      
      const { result } = renderHook(() => useFocusTrap(false));
      
      act(() => {
        result.current.current = mockContainer as unknown as HTMLElement;
      });
      
      expect(mockContainer.querySelectorAll).not.toHaveBeenCalled();
    });

    it('should cycle focus on Tab', () => {
      const mockFirst = { focus: vi.fn() };
      const mockLast = { focus: vi.fn() };
      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([mockFirst, {}, mockLast]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      
      const { result, unmount } = renderHook(() => useFocusTrap(true));
      
      act(() => {
        result.current.current = mockContainer as unknown as HTMLElement;
      });
      
      // Simulate Tab from last element
      const keydownHandler = mockContainer.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        Object.defineProperty(document, 'activeElement', {
          value: mockLast,
          configurable: true,
        });
        
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false });
        keydownHandler(event);
        
        expect(mockFirst.focus).toHaveBeenCalled();
      }
      
      unmount();
    });

    it('should cycle focus on Shift+Tab', () => {
      const mockFirst = { focus: vi.fn() };
      const mockLast = { focus: vi.fn() };
      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([mockFirst, {}, mockLast]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      
      const { result, unmount } = renderHook(() => useFocusTrap(true));
      
      act(() => {
        result.current.current = mockContainer as unknown as HTMLElement;
      });
      
      const keydownHandler = mockContainer.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        Object.defineProperty(document, 'activeElement', {
          value: mockFirst,
          configurable: true,
        });
        
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
        keydownHandler(event);
        
        expect(mockLast.focus).toHaveBeenCalled();
      }
      
      unmount();
    });
  });

  describe('useAutoFocus', () => {
    it('should return ref', () => {
      const { result } = renderHook(() => useAutoFocus<HTMLElement>());
      
      expect(result.current).toHaveProperty('current');
    });

    it('should focus element on mount', () => {
      const mockElement = { focus: vi.fn() };
      
      const { result } = renderHook(() => useAutoFocus<HTMLElement>());
      
      act(() => {
        result.current.current = mockElement;
      });
      
      expect(mockElement.focus).toHaveBeenCalled();
    });
  });

  describe('useReducedMotion', () => {
    it('should return motion preference', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      
      const { result } = renderHook(() => useReducedMotion());
      
      expect(result.current).toBe(false);
    });

    it('should return true when reduced motion is preferred', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });
      
      const { result } = renderHook(() => useReducedMotion());
      
      expect(result.current).toBe(true);
    });
  });

  describe('useHighContrast', () => {
    it('should return contrast preference', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      
      const { result } = renderHook(() => useHighContrast());
      
      expect(result.current).toBe(false);
    });

    it('should return true when high contrast is preferred', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });
      
      const { result } = renderHook(() => useHighContrast());
      
      expect(result.current).toBe(true);
    });
  });

  describe('useKeyboardNavigation', () => {
    it('should return container ref and current index', () => {
      const onSelect = vi.fn();
      
      const { result } = renderHook(() => 
        useKeyboardNavigation(5, onSelect, { loop: true, orientation: 'vertical' })
      );
      
      expect(result.current).toHaveProperty('containerRef');
      expect(typeof result.current.currentIndex).toBe('number');
    });

    it('should call onSelect on arrow key press', () => {
      const onSelect = vi.fn();
      const mockContainer = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      
      const { result, unmount } = renderHook(() => 
        useKeyboardNavigation(5, onSelect, { loop: true, orientation: 'vertical' })
      );
      
      act(() => {
        result.current.containerRef.current = mockContainer as unknown as HTMLElement;
      });
      
      const keydownHandler = mockContainer.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        keydownHandler(event);
        
        expect(onSelect).toHaveBeenCalledWith(1);
      }
      
      unmount();
    });

    it('should handle upward navigation', () => {
      const onSelect = vi.fn();
      const mockContainer = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      
      const { result, unmount } = renderHook(() => 
        useKeyboardNavigation(5, onSelect, { loop: true, orientation: 'vertical' })
      );
      
      act(() => {
        result.current.containerRef.current = mockContainer as unknown as HTMLElement;
      });
      
      const keydownHandler = mockContainer.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        keydownHandler(event);
        
        expect(onSelect).toHaveBeenCalledWith(4); // Should wrap to last
      }
      
      unmount();
    });

    it('should handle Home key', () => {
      const onSelect = vi.fn();
      const mockContainer = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      
      const { result, unmount } = renderHook(() => 
        useKeyboardNavigation(5, onSelect)
      );
      
      act(() => {
        result.current.containerRef.current = mockContainer as unknown as HTMLElement;
      });
      
      const keydownHandler = mockContainer.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        const event = new KeyboardEvent('keydown', { key: 'Home' });
        keydownHandler(event);
        
        expect(onSelect).toHaveBeenCalledWith(0);
      }
      
      unmount();
    });

    it('should handle End key', () => {
      const onSelect = vi.fn();
      const mockContainer = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      
      const { result, unmount } = renderHook(() => 
        useKeyboardNavigation(5, onSelect)
      );
      
      act(() => {
        result.current.containerRef.current = mockContainer as unknown as HTMLElement;
      });
      
      const keydownHandler = mockContainer.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        const event = new KeyboardEvent('keydown', { key: 'End' });
        keydownHandler(event);
        
        expect(onSelect).toHaveBeenCalledWith(4);
      }
      
      unmount();
    });

    it('should not loop when loop is false', () => {
      const onSelect = vi.fn();
      const mockContainer = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      
      const { result, unmount } = renderHook(() => 
        useKeyboardNavigation(5, onSelect, { loop: false })
      );
      
      act(() => {
        result.current.containerRef.current = mockContainer as unknown as HTMLElement;
      });
      
      const keydownHandler = mockContainer.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        // Press Down at last item
        Object.defineProperty(result.current, 'currentIndex', { value: 4 });
        
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        keydownHandler(event);
        
        expect(onSelect).toHaveBeenCalledWith(4); // Should stay at max
      }
      
      unmount();
    });

    it('should support horizontal orientation', () => {
      const onSelect = vi.fn();
      const mockContainer = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      
      const { result, unmount } = renderHook(() => 
        useKeyboardNavigation(5, onSelect, { orientation: 'horizontal' })
      );
      
      act(() => {
        result.current.containerRef.current = mockContainer as unknown as HTMLElement;
      });
      
      const keydownHandler = mockContainer.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        keydownHandler(event);
        
        expect(onSelect).toHaveBeenCalledWith(1);
      }
      
      unmount();
    });
  });

  describe('useFocusRestore', () => {
    it('should return saveFocus and restoreFocus functions', () => {
      const { result } = renderHook(() => useFocusRestore());
      
      expect(typeof result.current.saveFocus).toBe('function');
      expect(typeof result.current.restoreFocus).toBe('function');
    });

    it('should save current focus', () => {
      const mockElement = { focus: vi.fn() };
      Object.defineProperty(document, 'activeElement', {
        value: mockElement,
        configurable: true,
      });
      
      const { result } = renderHook(() => useFocusRestore());
      
      act(() => {
        result.current.saveFocus();
      });
      
      expect(result.current.previousActiveElement.current).toBe(mockElement);
    });

    it('should restore saved focus', () => {
      const mockElement = { focus: vi.fn() };
      
      const { result } = renderHook(() => useFocusRestore());
      
      act(() => {
        result.current.previousActiveElement.current = mockElement;
        result.current.restoreFocus();
      });
      
      expect(mockElement.focus).toHaveBeenCalled();
    });

    it('should handle null saved element', () => {
      const { result } = renderHook(() => useFocusRestore());
      
      act(() => {
        result.current.restoreFocus();
      });
      
      // Should not throw
    });
  });
});
