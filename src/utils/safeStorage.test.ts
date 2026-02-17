/**
 * Tests for safeStorage utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeStorage } from './safeStorage';

describe('safeStorage', () => {
  const mockStorage: Record<string, string> = {};
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock localStorage
    (global as any).localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
    };
    
    // Clear mock storage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getItem', () => {
    it('should return stored value', () => {
      mockStorage['test-key'] = 'test-value';
      
      const result = safeStorage.getItem('test-key');
      
      expect(result).toBe('test-value');
    });

    it('should return null for non-existent key', () => {
      const result = safeStorage.getItem('non-existent');
      
      expect(result).toBeNull();
    });

    it('should call localStorage.getItem', () => {
      mockStorage['get-item-test'] = 'value';
      
      safeStorage.getItem('get-item-test');
      
      expect(localStorage.getItem).toHaveBeenCalledWith('get-item-test');
    });

    it('should handle errors gracefully', () => {
      (localStorage.getItem as vi.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const result = safeStorage.getItem('error-test');
      
      expect(result).toBeNull();
    });
  });

  describe('setItem', () => {
    it('should store value', () => {
      safeStorage.setItem('new-key', 'new-value');
      
      expect(mockStorage['new-key']).toBe('new-value');
    });

    it('should call localStorage.setItem', () => {
      safeStorage.setItem('set-item-test', 'value');
      
      expect(localStorage.setItem).toHaveBeenCalledWith('set-item-test', 'value');
    });

    it('should handle errors gracefully', () => {
      (localStorage.setItem as vi.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const result = safeStorage.setItem('error-test', 'value');
      
      expect(result).toBe(false);
    });

    it('should store JSON stringified values', () => {
      const data = { key: 'value', nested: { deep: true } };
      
      safeStorage.setItem('json-data', JSON.stringify(data));
      
      const stored = JSON.parse(mockStorage['json-data']);
      expect(stored).toEqual(data);
    });
  });

  describe('removeItem', () => {
    it('should remove stored value', () => {
      mockStorage['remove-test'] = 'value';
      
      safeStorage.removeItem('remove-test');
      
      expect(mockStorage['remove-test']).toBeUndefined();
    });

    it('should call localStorage.removeItem', () => {
      safeStorage.removeItem('remove-item-test');
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('remove-item-test');
    });

    it('should handle errors gracefully', () => {
      (localStorage.removeItem as vi.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const result = safeStorage.removeItem('error-test');
      
      expect(result).toBe(false);
    });
  });

  describe('getJSON', () => {
    it('should return parsed JSON', () => {
      mockStorage['json-item'] = JSON.stringify({ parsed: true });
      
      const result = safeStorage.getJSON('json-item', {} as any);
      
      expect(result).toEqual({ parsed: true });
    });

    it('should return default value for non-existent key', () => {
      const result = safeStorage.getJSON('non-existent', { default: true });
      
      expect(result).toEqual({ default: true });
    });

    it('should return default value for invalid JSON', () => {
      mockStorage['invalid-json'] = 'not valid json';
      
      const result = safeStorage.getJSON('invalid-json', { fallback: true });
      
      expect(result).toEqual({ fallback: true });
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        array: [1, 2, 3],
        nested: {
          deep: {
            value: 'string',
            number: 42,
            boolean: true,
            null: null,
          },
        },
      };
      
      mockStorage['complex'] = JSON.stringify(complexData);
      
      const result = safeStorage.getJSON('complex', {} as any);
      
      expect(result).toEqual(complexData);
    });
  });

  describe('setJSON', () => {
    it('should store object as JSON', () => {
      const data = { key: 'value' };
      
      safeStorage.setJSON('json-set', data);
      
      expect(mockStorage['json-set']).toBe(JSON.stringify(data));
    });

    it('should call setItem internally', () => {
      const setItemSpy = vi.spyOn(safeStorage, 'setItem');
      
      safeStorage.setJSON('spy-test', { test: true });
      
      expect(setItemSpy).toHaveBeenCalledWith('spy-test', '{"test":true}');
    });
  });

  describe('data integrity', () => {
    it('should round-trip string values', () => {
      const original = 'simple string';
      safeStorage.setItem('round-trip', original);
      const result = safeStorage.getItem('round-trip');
      
      expect(result).toBe(original);
    });

    it('should round-trip numeric strings', () => {
      const original = '12345';
      safeStorage.setItem('numbers', original);
      const result = safeStorage.getItem('numbers');
      
      expect(result).toBe(original);
    });

    it('should round-trip special characters', () => {
      const original = 'Special: @#$%^&*()';
      safeStorage.setItem('special', original);
      const result = safeStorage.getItem('special');
      
      expect(result).toBe(original);
    });

    it('should round-trip unicode characters', () => {
      const original = 'Unicode: 你好世界 🎉';
      safeStorage.setItem('unicode', original);
      const result = safeStorage.getItem('unicode');
      
      expect(result).toBe(original);
    });

    it('should round-trip multi-line strings', () => {
      const original = 'Line 1\nLine 2\nLine 3';
      safeStorage.setItem('multiline', original);
      const result = safeStorage.getItem('multiline');
      
      expect(result).toBe(original);
    });
  });
});
