// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/useSettings.ts
// Type-safe per-key settings hook — pairs with the settings API.
//
// Usage:
//   const [enabled, setEnabled] = useSetting('automation.enabled', false);
//
// On mount, fetches the current value from the API; updates optimistically on write.
// Failures on read are silent (falls back to defaultValue).
// Failures on write bubble up to the caller via the returned promise.

import { useState, useEffect } from 'react';
import { settingsApi } from './api';

/**
 * Returns a stateful value backed by the settings API, and an async updater.
 *
 * @param key           The settings key (e.g. 'automation.enabled')
 * @param defaultValue  Returned while loading or if the key is unset
 */
export function useSetting<T>(key: string, defaultValue: T): [T, (value: T) => Promise<void>] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    let cancelled = false;
    settingsApi
      .get(key)
      .then((result: { value?: unknown } | null) => {
        if (!cancelled && result?.value !== undefined && result.value !== null) {
          setValue(result.value as T);
        }
      })
      .catch(() => {
        // Silently fall back to defaultValue — settings failures must never crash the UI
      });
    return () => { cancelled = true; };
  }, [key]);

  const update = async (newValue: T): Promise<void> => {
    setValue(newValue); // optimistic update
    await settingsApi.set(key, newValue);
  };

  return [value, update];
}
