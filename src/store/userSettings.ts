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
  name: 'Kevin MacArthur',
  email: 'kevin@carbium.io',
  phone: '+35054008841',
  emailAccounts: [
    { email: 'kevin@carbium.io', label: 'Carbium', color: 'text-green-400' },
    { email: 'kevin.macarthur@bitso.com', label: 'Bitso', color: 'text-blue-400' },
    { email: 'kmacarthur.gpt@gmail.com', label: 'Gmail', color: 'text-red-400' },
  ],
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
        const { updateSettings, reset, ...data } = state;
        return data;
      },
    }
  )
);
