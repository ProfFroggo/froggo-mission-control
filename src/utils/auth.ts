// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useUserSettings } from '../store/userSettings';

/**
 * Get the current authenticated user's name
 * Uses the user settings store (persisted to localStorage)
 * Falls back to environment variable or default
 */
export function getCurrentUserName(): string {
  // Try to get from user settings store
  const state = useUserSettings.getState();
  if (state.name && state.name.trim()) {
    return state.name;
  }
  
  // Fallback to env var or default
  return process.env.NEXT_PUBLIC_DEFAULT_USER_NAME || 'user';
}

/**
 * Hook version for React components
 * Returns the current user name from settings
 */
export function useCurrentUserName(): string {
  const name = useUserSettings((state) => state.name);
  return name && name.trim() ? name : process.env.NEXT_PUBLIC_DEFAULT_USER_NAME || 'user';
}
