// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandSafeStorage } from '../utils/safeStorage';

// Migrate old localStorage key on first load
if (typeof window !== 'undefined' && localStorage.getItem('clawd-user-settings') && !localStorage.getItem('mission-control-user-settings')) {
  localStorage.setItem('mission-control-user-settings', localStorage.getItem('clawd-user-settings')!);
}

export interface UserIdentity {
  name: string;
  email: string;
  phone: string;
  emailAccounts: { email: string; label: string; color?: string }[];
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
}

interface UserSettingsState extends UserIdentity, UserPreferences {
  updateSettings: (settings: Partial<UserIdentity & UserPreferences>) => void;
  reset: () => void;
}

const defaults: UserIdentity & UserPreferences = {
  name: '',
  email: '',
  phone: '',
  emailAccounts: [],
  theme: 'dark',
  notifications: true,
};

export const useUserSettings = create<UserSettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
      reset: () => set({ ...defaults }),
    }),
    {
      name: 'mission-control-user-settings',
      storage: zustandSafeStorage,
      partialize: (state) => {
        const { updateSettings: _updateSettings, reset: _reset, ...data } = state;
        return data;
      },
    }
  )
);
