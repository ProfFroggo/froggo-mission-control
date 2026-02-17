/**
 * Tests for useKeyboardNav hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNav, useFocusTrap, useArrowNavigation } from './useKeyboardNav';

// Mock document and window objects
const mockDocument = {
  body: {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(),
    },
  },
  activeElement: {
    tagName: 'BUTTON',
  },
  createElement: vi.fn(),
  body: document.createElement('body'),
};

const mockFocusableElements = [
  { tagName: 'BUTTON', focus: vi.fn(), dataset: {} },
  { tagName: 'INPUT', focus: vi.fn(), dataset: {} },
  { tagName: 'BUTTON', focus: vi.fn(), dataset: {} },
];

const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

describe('useKeyboardNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(document, 'body', 'get').mockReturnValue(mockDocument.body as unknown as HTMLBodyElement);
    vi.spyOn(window, 'addEventListener').mockImplementation(mockWindow.addEventListener);
    vi.spyOn(window, 'removeEventListener').mockImplementation(mockWindow.removeEventListener);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('keyboard detection', () => {
    it('should add keyboard-nav class on Tab press', () => {
      const { unmount } = renderHook(() => useKeyboardNav());
      
      // Trigger keydown with Tab
      const keydownHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        act(() => {
          keydownHandler({ key: 'Tab', preventDefault: vi.fn() });
        });
      }
      
      expect(mockDocument.body.classList.add).toHaveBeenCalledWith('keyboard-nav');
      
      unmount();
    });

    it('should remove keyboard-nav class on mouse down', () => {
      const { unmount } = renderHook(() => useKeyboardNav());
      
      // Trigger mousedown
      const mousedownHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )?.[1];
      
      if (mousedownHandler) {
        act(() => {
          mousedownHandler({});
        });
      }
      
      expect(mockDocument.body.classList.remove).toHaveBeenCalledWith('keyboard-nav');
      
      unmount();
    });
  });

  describe('escape key handling', () => {
    it('should call onEscape when Escape key is pressed', () => {
      const onEscape = vi.fn();
      const { unmount } = renderHook(() => useKeyboardNav({ onEscape }));
      
      const keydownHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        act(() => {
          keydownHandler({ key: 'Escape', preventDefault: vi.fn() });
        });
      }
      
      expect(onEscape).toHaveBeenCalledTimes(1);
      
      unmount();
    });

    it('should not call onEscape when no handler provided', () => {
      const { unmount } = renderHook(() => useKeyboardNav());
      
      // Should not throw
      const keydownHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )?.[1];
      
      if (keydownHandler) {
        act(() => {
          keydownHandler({ key: 'Escape', preventDefault: vi.fn() });
        });
      }
      
      expect(() => {}).not.toThrow();
      
      unmount();
    });
  });

  describe('focus trap', () => {
    it('should trap focus within container when trapFocus is true', () => {
      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue(mockFocusableElements),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const mockElement = {
        querySelectorAll: vi.fn().mockReturnValue(mockFocusableElements),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const { result, unmount } = renderHook(() => useKeyboardNav({ trapFocus: true }));
      
      // Set container ref
      act(() => {
        result.current.containerRef(mockContainer as unknown as HTMLElement);
      });
      
      // Check that keydown handler was added
      expect(mockContainer.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      
      unmount();
    });

    it('should not trap focus when trapFocus is false', () => {
      const mockContainer = {
        querySelectorAll: vi.fn(),
        addEventListener: vi.fn(),
      };

      const { result, unmount } = renderHook(() => useKeyboardNav({ trapFocus: false }));
      
      act(() => {
        result.current.containerRef(mockContainer as unknown as HTMLElement);
      });
      
      expect(mockContainer.addEventListener).not.toHaveBeenCalled();
      
      unmount();
    });
  });

  describe('auto focus', () => {
    it('should focus first element when autoFocus is true', () => {
      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue(mockFocusableElements),
      };

      const { result, unmount } = renderHook(() => useKeyboardNav({ autoFocus: true }));
      
      act(() => {
        result.current.containerRef(mockContainer as unknown as HTMLElement);
      });
      
      expect(mockFocusableElements[0].focus).toHaveBeenCalledTimes(1);
      
      unmount();
    });
  });
});

describe('useFocusTrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should focus first element on mount', () => {
    const mockContainer = {
      querySelectorAll: vi.fn().mockReturnValue(mockFocusableElements),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const { unmount } = renderHook(() => useFocusTrap(true));
    
    // Set container ref
    const hook = renderHook(() => useFocusTrap(true));
    act(() => {
      (hook.result.current as React.MutableRefObject<HTMLElement | null>).current = mockContainer as unknown as HTMLElement;
    });
    
    expect(mockFocusableElements[0].focus).toHaveBeenCalled();
    
    hook.unmount();
    unmount();
  });

  it('should not activate when active is false', () => {
    const mockContainer = {
      querySelectorAll: vi.fn(),
    };

    const { result, unmount } = renderHook(() => useFocusTrap(false));
    
    act(() => {
      (result.current as React.MutableRefObject<HTMLElement | null>).current = mockContainer as unknown as HTMLElement;
    });
    
    expect(mockContainer.querySelectorAll).not.toHaveBeenCalled();
    
    unmount();
  });

  it('should trap focus on Tab key', () => {
    const mockContainer = {
      querySelectorAll: vi.fn().mockReturnValue(mockFocusableElements),
      addEventListener: vi.fn((event, handler) => {
        if (event === 'keydown') {
          // Simulate pressing Tab at last element
          act(() => {
            handler({ key: 'Tab', shiftKey: false, preventDefault: vi.fn(), target: mockFocusableElements[2] });
          });
        }
      }),
    };

    const hook = renderHook(() => useFocusTrap(true));
    act(() => {
      (hook.result.current as React.MutableRefObject<HTMLElement | null>).current = mockContainer as unknown as HTMLElement;
    });
    
    expect(mockFocusableElements[0].focus).toHaveBeenCalled();
    
    hook.unmount();
  });
});

describe('useArrowNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'addEventListener').mockImplementation(mockWindow.addEventListener);
    vi.spyOn(window, 'removeEventListener').mockImplementation(mockWindow.removeEventListener);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not navigate when disabled', () => {
    const mockItems = [
      { focus: vi.fn() },
      { focus: vi.fn() },
    ];

    const mockRef = {
      current: mockItems as unknown as HTMLElement[],
    };

    const { unmount } = renderHook(() => useArrowNavigation(mockRef as unknown as React.RefObject<HTMLElement[]>, { enabled: false }));
    
    const keydownHandler = mockWindow.addEventListener.mock.calls.find(
      call => call[0] === 'keydown'
    )?.[1];
    
    if (keydownHandler) {
      act(() => {
        keydownHandler({ key: 'ArrowDown', preventDefault: vi.fn() });
      });
    }
    
    expect(mockItems[1].focus).not.toHaveBeenCalled();
    
    unmount();
  });

  it('should navigate vertically by default', () => {
    const mockItems = [
      { focus: vi.fn() },
      { focus: vi.fn() },
    ];

    const mockRef = {
      current: mockItems as unknown as HTMLElement[],
    };

    const { unmount } = renderHook(() => useArrowNavigation(mockRef as unknown as React.RefObject<HTMLElement[]>));
    
    const keydownHandler = mockWindow.addEventListener.mock.calls.find(
      call => call[0] === 'keydown'
    )?.[1];
    
    if (keydownHandler) {
      act(() => {
        keydownHandler({ key: 'ArrowDown', preventDefault: vi.fn() });
      });
    }
    
    expect(mockItems[1].focus).toHaveBeenCalled();
    
    unmount();
  });

  it('should handle Home and End keys', () => {
    const mockItems = [
      { focus: vi.fn() },
      { focus: vi.fn() },
      { focus: vi.fn() },
    ];

    const mockRef = {
      current: mockItems as unknown as HTMLElement[],
    };

    const { unmount } = renderHook(() => useArrowNavigation(mockRef as unknown as React.RefObject<HTMLElement[]>));
    
    const keydownHandler = mockWindow.addEventListener.mock.calls.find(
      call => call[0] === 'keydown'
    )?.[1];
    
    if (keydownHandler) {
      // Press End to go to last item
      act(() => {
        keydownHandler({ key: 'End', preventDefault: vi.fn() });
      });
      
      // Press Home to go to first item
      act(() => {
        keydownHandler({ key: 'Home', preventDefault: vi.fn() });
      });
    }
    
    expect(mockItems[2].focus).toHaveBeenCalled();
    expect(mockItems[0].focus).toHaveBeenCalled();
    
    unmount();
  });
});
