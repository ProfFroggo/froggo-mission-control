// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * useKeyboardShortcuts — map-based global shortcut manager.
 *
 * Accepts a flat map of key strings → handlers.
 * Key strings are built as: [cmd+][shift+][alt+]<key.toLowerCase()>
 *   e.g. "cmd+k", "cmd+shift+n", "escape", "?"
 *
 * Input elements are skipped unless the key is "escape".
 *
 * For two-key chord shortcuts (e.g. "g d"), use the companion
 * useChordShortcuts hook below.
 */

import { useEffect } from 'react';

export type ShortcutMap = Record<string, () => void>;

export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push('cmd');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      const key = parts.join('+');

      // Skip inputs — unless escape (always fires)
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.contentEditable === 'true';
      if (isInput && key !== 'escape') return;

      const fn = shortcuts[key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}

// ---------------------------------------------------------------------------
// Chord shortcut support — "g d", "g t", etc.
// Module-level state: safe because there is only one document.
// ---------------------------------------------------------------------------

let _lastChordKey = '';
let _lastChordTime = 0;
const CHORD_TIMEOUT_MS = 500;

/**
 * useChordShortcuts — registers two-key chord shortcuts.
 *
 * chords is a map from the *second* key (lowercase) to its handler.
 * The first key is always "g" (GitHub/Gmail-style navigation pattern).
 *
 * Example: { d: () => navigate('dashboard'), t: () => navigate('kanban') }
 */
export function useChordShortcuts(chords: Record<string, () => void>): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Never fire inside inputs
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.contentEditable === 'true';
      if (isInput) return;

      // Skip if any modifier is held — chords are bare keys only
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const key = e.key.toLowerCase();
      const now = Date.now();

      if (_lastChordKey === 'g' && (now - _lastChordTime) < CHORD_TIMEOUT_MS) {
        const fn = chords[key];
        if (fn) {
          e.preventDefault();
          fn();
          _lastChordKey = '';
          _lastChordTime = 0;
          return;
        }
      }

      // Record this key as a potential chord start
      _lastChordKey = key;
      _lastChordTime = now;
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [chords]);
}
