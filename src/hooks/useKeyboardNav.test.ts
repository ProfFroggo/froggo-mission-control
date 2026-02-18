/**
 * Tests for useKeyboardNav hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNav, useFocusTrap, useArrowNavigation } from './useKeyboardNav';

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
    mockFocusableElements.forEach(el => el.focus.mockClear());
    vi.spyOn(document.body.classList, 'add');
    vi.spyOn(document.body.classList, 'remove');
    vi.spyOn(window, 'addEventListener').mockImplementation(mockWindow.addEventListener);
    vi.spyOn(window, 'removeEventListener').mockImplementation(mockWindow.removeEventListener);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (document as any).activeElement;
  });

  describe('keyboard detection', () => {
    it('should add keyboard-nav class on Tab press', () => {
      const { unmount } = renderHook(() => useKeyboardNav());

      // Find the keyboard detection keydown handler (first one registered)
      const keydownHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )?.[1];

      if (keydownHandler) {
        act(() => {
          keydownHandler({ key: 'Tab', preventDefault: vi.fn() });
        });
      }

      expect(document.body.classList.add).toHaveBeenCalledWith('keyboard-nav');

      unmount();
    });

    it('should remove keyboard-nav class on mouse down', () => {
      const { unmount } = renderHook(() => useKeyboardNav());

      const mousedownHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )?.[1];

      if (mousedownHandler) {
        act(() => {
          mousedownHandler({});
        });
      }

      expect(document.body.classList.remove).toHaveBeenCalledWith('keyboard-nav');

      unmount();
    });
  });

  describe('escape key handling', () => {
    it('should call onEscape when Escape key is pressed', () => {
      const onEscape = vi.fn();
      const { unmount } = renderHook(() => useKeyboardNav({ onEscape }));

      // Find ALL keydown handlers and fire them — the escape handler is separate from keyboard detection
      const keydownHandlers = mockWindow.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown')
        .map(call => call[1]);

      keydownHandlers.forEach(handler => {
        act(() => {
          handler({ key: 'Escape', preventDefault: vi.fn() });
        });
      });

      expect(onEscape).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('should not call onEscape when no handler provided', () => {
      const { unmount } = renderHook(() => useKeyboardNav());

      const keydownHandlers = mockWindow.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown')
        .map(call => call[1]);

      // Should not throw
      keydownHandlers.forEach(handler => {
        act(() => {
          handler({ key: 'Escape', preventDefault: vi.fn() });
        });
      });

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

      // Start with trapFocus disabled, set the ref, then enable it
      const { result, rerender, unmount } = renderHook(
        ({ trapFocus }) => useKeyboardNav({ trapFocus }),
        { initialProps: { trapFocus: false } }
      );

      // Set container ref while inactive
      act(() => {
        result.current.containerRef(mockContainer as unknown as HTMLElement);
      });

      // Enable trap — triggers the effect with the ref set
      rerender({ trapFocus: true });

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

      // Start with autoFocus disabled, set the ref, then enable it
      const { result, rerender, unmount } = renderHook(
        ({ autoFocus }) => useKeyboardNav({ autoFocus }),
        { initialProps: { autoFocus: false } }
      );

      act(() => {
        result.current.containerRef(mockContainer as unknown as HTMLElement);
      });

      rerender({ autoFocus: true });

      expect(mockFocusableElements[0].focus).toHaveBeenCalledTimes(1);

      unmount();
    });
  });
});

describe('useFocusTrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFocusableElements.forEach(el => el.focus.mockClear());
  });

  afterEach(() => {
    delete (document as any).activeElement;
  });

  it('should focus first element on mount', () => {
    const mockContainer = {
      querySelectorAll: vi.fn().mockReturnValue(mockFocusableElements),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const { result, rerender, unmount } = renderHook(
      ({ active }) => useFocusTrap(active),
      { initialProps: { active: false } }
    );

    // Set ref while inactive
    (result.current as React.MutableRefObject<HTMLElement | null>).current = mockContainer as unknown as HTMLElement;

    // Activate
    rerender({ active: true });

    expect(mockFocusableElements[0].focus).toHaveBeenCalled();

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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const { result, rerender, unmount } = renderHook(
      ({ active }) => useFocusTrap(active),
      { initialProps: { active: false } }
    );

    (result.current as React.MutableRefObject<HTMLElement | null>).current = mockContainer as unknown as HTMLElement;
    rerender({ active: true });

    // Get the keydown handler
    const keydownHandler = mockContainer.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'keydown'
    )?.[1];

    expect(keydownHandler).toBeDefined();

    // Simulate Tab from last element — should wrap to first
    Object.defineProperty(document, 'activeElement', {
      value: mockFocusableElements[2],
      configurable: true,
    });

    const event = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() };
    keydownHandler(event);

    // Called once for initial focus, once for Tab wrap
    expect(mockFocusableElements[0].focus).toHaveBeenCalledTimes(2);

    unmount();
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
    delete (document as any).activeElement;
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

    // No keydown handler should be registered when disabled
    const keydownHandler = mockWindow.addEventListener.mock.calls.find(
      call => call[0] === 'keydown'
    )?.[1];

    // Either no handler registered, or handler doesn't navigate
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

    // Set activeElement to the first item so the handler can find currentIndex
    Object.defineProperty(document, 'activeElement', {
      value: mockItems[0],
      configurable: true,
    });

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

    // Start with activeElement as the first item
    Object.defineProperty(document, 'activeElement', {
      value: mockItems[0],
      configurable: true,
    });

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
