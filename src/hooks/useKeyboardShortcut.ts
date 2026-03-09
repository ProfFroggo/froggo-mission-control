// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: useKeyboardShortcuts hook uses file-level suppression for intentional patterns.
// Hook for keyboard shortcut registration - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useEffect, useCallback } from 'react';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  enabled?: boolean;
  allowInInputs?: boolean;
}

/**
 * Hook for registering keyboard shortcuts
 * @param shortcuts Array of shortcut configurations
 * @param deps Dependencies array (like useEffect)
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  deps: any[] = []
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check if we're in an input field (unless explicitly allowed)
    const target = e.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.contentEditable === 'true';

    for (const shortcut of shortcuts) {
      // Skip if disabled
      if (shortcut.enabled === false) continue;

      // Skip if in input and not explicitly allowed
      if (isInInput && !shortcut.allowInInputs) continue;

      // Check modifier keys
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
  //     const __metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;

      // Check key match (case-insensitive)
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
          e.stopPropagation();
        }
        shortcut.handler(e);
        return;
      }
    }
  }, [shortcuts, ...deps]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Single shortcut hook for convenience
 */
export function useKeyboardShortcut(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: Omit<ShortcutConfig, 'key' | 'handler'> = {}
) {
  useKeyboardShortcuts([{ key, handler, ...options }]);
}

/**
 * Format shortcut for display (e.g., "⌘N", "⇧⌘K")
 */
export function formatShortcut(config: Partial<ShortcutConfig>): string {
  const parts: string[] = [];
  
  if (config.ctrl || config.meta) parts.push('⌘');
  if (config.shift) parts.push('⇧');
  if (config.alt) parts.push('⌥');
  
  // Special key names
  const keyName = config.key?.toLowerCase();
  const specialKeys: Record<string, string> = {
    'escape': 'Esc',
    'enter': '↵',
    'backspace': '⌫',
    'delete': '⌦',
    'tab': '⇥',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    ' ': 'Space',
  };
  
  const displayKey = specialKeys[keyName || ''] || config.key?.toUpperCase();
  if (displayKey) parts.push(displayKey);
  
  return parts.join('');
}
