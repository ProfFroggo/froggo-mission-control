import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      name: 'clawd-user-settings',
      partialize: (state) => {
        const { updateSettings: _updateSettings, reset: _reset, ...data } = state;
        return data;
      },
    }
  )
);
