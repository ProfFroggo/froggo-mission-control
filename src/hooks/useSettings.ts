// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { settingsApi } from '../lib/api';

export interface AppSettings {
  externalActionsEnabled?: boolean;
  rateLimitTweets?: number;
  rateLimitEmails?: number;
  defaultEmailAccount?: string;
  defaultCalendarAccount?: string;
  emailAccounts?: Array<{
    id: string;
    label: string;
    address: string;
    color?: string;
  }>;
  [key: string]: any;
}

let cachedSettings: AppSettings | null = null;
const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const resp = await settingsApi.getAll();
    if (resp) {
      cachedSettings = resp as AppSettings;
      notifyListeners();
      return cachedSettings;
    }
  } catch (_e) {
    // Settings load failed — return cached or empty
  }
  return cachedSettings || {};
}

export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(cachedSettings || {});

  useEffect(() => {
    const update = () => setSettings({ ...cachedSettings });
    listeners.add(update);

    // Load if not cached
    if (!cachedSettings) {
      loadSettings().then(s => setSettings(s));
    }

    return () => { listeners.delete(update); };
  }, []);

  return settings;
}
