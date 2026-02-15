/**
 * Safe localStorage wrapper with error handling
 * Prevents crashes in private mode or when storage is full
 */

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`[safeStorage] Failed to get item "${key}":`, error);
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`[safeStorage] Failed to set item "${key}":`, error);
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`[safeStorage] Failed to remove item "${key}":`, error);
      return false;
    }
  },

  getJSON<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch (error) {
      console.warn(`[safeStorage] Failed to get/parse JSON "${key}":`, error);
      return defaultValue;
    }
  },

  setJSON<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[safeStorage] Failed to set JSON "${key}":`, error);
      return false;
    }
  },
};

export default safeStorage;
