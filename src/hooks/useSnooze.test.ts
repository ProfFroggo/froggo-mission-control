// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/// <reference types="vitest" />
/**
 * Tests for useSnooze hook
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSnooze } from './useSnooze';

// Mock fetch globally
global.fetch = vi.fn();

describe('useSnooze', () => {
  const mockFetch = global.fetch as unknown as Mock;
  
  const mockSnoozeData = [
    {
      session_id: 'session-1',
      snooze_until: Date.now() + 3600000, // 1 hour from now
      snooze_reason: 'Busy',
      reminder_sent: 0,
      created_at: Date.now(),
    },
    {
      session_id: 'session-2',
      snooze_until: Date.now() - 3600000, // 1 hour ago (expired)
      snooze_reason: 'Meeting',
      reminder_sent: 0,
      created_at: Date.now() - 7200000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should start with empty snoozed state and loading true', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      const { result } = renderHook(() => useSnooze());
      
      // Initially loading should be true
      expect(result.current.loading).toBe(true);
      // snoozed should be empty initially (before fetch completes)
      expect(Object.keys(result.current.snoozed)).toHaveLength(0);
    });

    it('should fetch snoozed conversations on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      renderHook(() => useSnooze());
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:3742/api/snooze/list');
      });
    });

    it('should set loading to false after fetch completes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should map fetched data to SnoozedSessions object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.snoozed['session-1']).toBeDefined();
        expect(result.current.snoozed['session-2']).toBeDefined();
        expect(result.current.snoozed['session-1'].snooze_reason).toBe('Busy');
      });
    });

    it('should handle fetch error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(Object.keys(result.current.snoozed)).toHaveLength(0);
      });
    });
  });

  describe('snoozeConversation', () => {
    it('should call API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      }); // Initial fetch
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      }); // Snooze request

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      const snoozeUntil = Date.now() + 3600000;
      
      await act(async () => {
        const success = await result.current.snoozeConversation('session-new', snoozeUntil, 'Test reason');
        expect(success).toBe(true);
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3742/api/snooze',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: 'session-new',
            until: snoozeUntil,
            reason: 'Test reason',
          }),
        })
      );
    });

    it('should update local state on successful snooze', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      const snoozeUntil = Date.now() + 3600000;
      
      await act(async () => {
        await result.current.snoozeConversation('session-new', snoozeUntil, 'New snooze');
      });
      
      expect(result.current.snoozed['session-new']).toBeDefined();
      expect(result.current.snoozed['session-new'].snooze_reason).toBe('New snooze');
    });

    it('should return false on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      await act(async () => {
        const success = await result.current.snoozeConversation('session-fail', Date.now());
        expect(success).toBe(false);
      });
    });
  });

  describe('unsnoozeConversation', () => {
    it('should call API with correct session ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      await act(async () => {
        const success = await result.current.unsnoozeConversation('session-1');
        expect(success).toBe(true);
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3742/api/snooze/session-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should remove session from local state on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      expect(result.current.snoozed['session-1']).toBeDefined();
      
      await act(async () => {
        await result.current.unsnoozeConversation('session-1');
      });
      
      expect(result.current.snoozed['session-1']).toBeUndefined();
    });
  });

  describe('isSnoozed', () => {
    it('should return true for snoozed session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      expect(result.current.isSnoozed('session-1')).toBe(true);
      expect(result.current.isSnoozed('session-2')).toBe(true);
    });

    it('should return false for non-snoozed session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      expect(result.current.isSnoozed('session-999')).toBe(false);
    });
  });

  describe('getSnoozeData', () => {
    it('should return snooze data for session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      const data = result.current.getSnoozeData('session-1');
      expect(data).toBeDefined();
      expect(data?.session_id).toBe('session-1');
      expect(data?.snooze_reason).toBe('Busy');
    });

    it('should return null for non-snoozed session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      const data = result.current.getSnoozeData('nonexistent');
      expect(data).toBeNull();
    });
  });

  describe('getExpiredSnoozes', () => {
    it('should return only expired snoozes with no reminder sent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      const expired = result.current.getExpiredSnoozes();
      expect(expired.length).toBe(1);
      expect(expired[0].session_id).toBe('session-2');
    });

    it('should not return expired snoozes with reminder sent', async () => {
      const dataWithReminder = [
        {
          session_id: 'session-expired',
          snooze_until: Date.now() - 3600000,
          snooze_reason: 'Old',
          reminder_sent: 1, // Reminder already sent
          created_at: Date.now() - 7200000,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dataWithReminder,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      const expired = result.current.getExpiredSnoozes();
      expect(expired.length).toBe(0);
    });
  });

  describe('refresh', () => {
    it('should re-fetch snoozed conversations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnoozeData,
      });

      const { result } = renderHook(() => useSnooze());
      
      await waitFor(() => !result.current.loading);
      
      const callCountBefore = mockFetch.mock.calls.length;
      
      await act(async () => {
        await result.current.refresh();
      });
      
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });
});
