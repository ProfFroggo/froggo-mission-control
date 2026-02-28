/**
 * Tests for snoozeFilter utilities
 */

import { describe, it, expect } from 'vitest';
import {
  filterSessionsBySnooze,
  getSnoozeStatus,
  sortSessionsWithReminders,
  formatSnoozeTime,
  getTimeUntilExpiry,
  SnoozedSessions,
} from './snoozeFilter';
import type { Session } from '../store/store';

describe('snoozeFilter utilities', () => {
  describe('filterSessionsBySnooze', () => {
    const baseTime = Date.now();
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;

    const mockSessions = [
      { key: 'session-1', title: 'Active Session', agentId: 'coder' },
      { key: 'session-2', title: 'Snoozed Session', agentId: 'researcher' },
      { key: 'session-3', title: 'Expired Snooze', agentId: 'writer' },
      { key: 'session-4', title: 'No Snooze', agentId: 'chief' },
    ] as unknown as Session[];

    const mockSnoozed: SnoozedSessions = {
      'session-2': {
        session_id: 'session-2',
        snooze_until: baseTime + dayMs, // 1 day in future
        snooze_reason: 'Busy',
        reminder_sent: 0,
        created_at: baseTime - hourMs,
      },
      'session-3': {
        session_id: 'session-3',
        snooze_until: baseTime - hourMs, // 1 hour ago (expired)
        snooze_reason: 'Meeting',
        reminder_sent: 0,
        created_at: baseTime - 2 * hourMs,
      },
    };

    it('should return all sessions with snooze metadata when showSnoozed is true', () => {
      const result = filterSessionsBySnooze(mockSessions, mockSnoozed, true, false);
      expect(result.length).toBe(4);
      expect(result[1]).toHaveProperty('snoozeData');
    });

    it('should filter out active snoozed sessions when showSnoozed is false', () => {
      const result = filterSessionsBySnooze(mockSessions, mockSnoozed, false, false);
      // session-2 has active snooze and should be hidden
      expect(result.length).toBe(3);
      expect(result.find(s => s.key === 'session-2')).toBeUndefined();
    });

    it('should show expired snoozes even when showSnoozed is false', () => {
      const result = filterSessionsBySnooze(mockSessions, mockSnoozed, false, false);
      // session-3 has expired snooze and should be visible
      expect(result.find(s => s.key === 'session-3')).toBeDefined();
    });

    it('should add hasReminder flag for expired snoozes with no reminder sent', () => {
      const result = filterSessionsBySnooze(mockSessions, mockSnoozed, false, true);
      const session3 = result.find(s => s.key === 'session-3');
      expect(session3).toBeDefined();
      expect((session3 as any).hasReminder).toBe(true);
    });

    it('should not show reminders when showReminders is false', () => {
      const result = filterSessionsBySnooze(mockSessions, mockSnoozed, false, false);
      const session3 = result.find(s => s.key === 'session-3');
      expect((session3 as any).hasReminder).toBeFalsy();
    });

    it('should handle sessions with no snooze data', () => {
      const result = filterSessionsBySnooze(mockSessions, mockSnoozed, true, false);
      const session1 = result.find(s => s.key === 'session-1');
      expect(session1).toBeDefined();
      expect((session1 as any).snoozeData).toBeUndefined();
    });

    it('should handle empty sessions array', () => {
      const result = filterSessionsBySnooze([], mockSnoozed, true, false);
      expect(result.length).toBe(0);
    });

    it('should handle empty snoozed object', () => {
      const result = filterSessionsBySnooze(mockSessions, {}, true, false);
      expect(result.length).toBe(4);
      result.forEach(session => {
        expect((session as any).snoozeData).toBeUndefined();
      });
    });
  });

  describe('getSnoozeStatus', () => {
    const baseTime = Date.now();
    const hourMs = 60 * 60 * 1000;

    it('should return "none" for non-snoozed session', () => {
      const snoozed: SnoozedSessions = {};
      const status = getSnoozeStatus('session-1', snoozed);
      expect(status).toBe('none');
    });

    it('should return "active" for session with future snooze_until', () => {
      const snoozed: SnoozedSessions = {
        'session-1': {
          session_id: 'session-1',
          snooze_until: baseTime + hourMs,
          reminder_sent: 0,
          created_at: baseTime,
        },
      };
      const status = getSnoozeStatus('session-1', snoozed);
      expect(status).toBe('active');
    });

    it('should return "expired" for session with past snooze_until', () => {
      const snoozed: SnoozedSessions = {
        'session-1': {
          session_id: 'session-1',
          snooze_until: baseTime - hourMs,
          reminder_sent: 0,
          created_at: baseTime - 2 * hourMs,
        },
      };
      const status = getSnoozeStatus('session-1', snoozed);
      expect(status).toBe('expired');
    });
  });

  describe('sortSessionsWithReminders', () => {
    it('should put sessions with reminders first', () => {
      const sessions = [
        { key: 'a', hasReminder: false },
        { key: 'b', hasReminder: true },
        { key: 'c', hasReminder: false },
        { key: 'd', hasReminder: true },
      ];

      const result = sortSessionsWithReminders(sessions);
      expect(result[0].key).toBe('b');
      expect(result[1].key).toBe('d');
    });

    it('should sort by snooze expiry time within same reminder status', () => {
      const baseTime = Date.now();
      const hourMs = 60 * 60 * 1000;

      const sessions = [
        { key: 'a', hasReminder: false, snoozeData: { snooze_until: baseTime + 3 * hourMs, session_id: 'a', reminder_sent: 0, created_at: baseTime } },
        { key: 'b', hasReminder: false, snoozeData: { snooze_until: baseTime + 1 * hourMs, session_id: 'b', reminder_sent: 0, created_at: baseTime } },
        { key: 'c', hasReminder: false, snoozeData: { snooze_until: baseTime + 2 * hourMs, session_id: 'c', reminder_sent: 0, created_at: baseTime } },
      ];

      const result = sortSessionsWithReminders(sessions);
      expect((result[0] as any).key).toBe('b');
      expect((result[1] as any).key).toBe('c');
      expect((result[2] as any).key).toBe('a');
    });

    it('should handle sessions without snoozeData', () => {
      const sessions = [
        { key: 'a', hasReminder: false },
        { key: 'b', hasReminder: true },
        { key: 'c', hasReminder: false },
      ];

      const result = sortSessionsWithReminders(sessions);
      expect(result[0].key).toBe('b');
      expect(result[1].key).toBe('a');
      expect(result[2].key).toBe('c');
    });

    it('should preserve original order for equal priority sessions', () => {
      const sessions = [
        { key: 'a', hasReminder: false },
        { key: 'b', hasReminder: false },
        { key: 'c', hasReminder: false },
      ];

      const result = sortSessionsWithReminders(sessions);
      expect(result[0].key).toBe('a');
      expect(result[1].key).toBe('b');
      expect(result[2].key).toBe('c');
    });
  });

  describe('formatSnoozeTime', () => {
    it('should format time for today', () => {
      const now = new Date();
      const laterToday = new Date(now);
      laterToday.setHours(now.getHours() + 2);
      
      const result = formatSnoozeTime(laterToday.getTime());
      expect(result).toContain('Today at');
    });

    it('should format time for tomorrow', () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      
      const result = formatSnoozeTime(tomorrow.getTime());
      expect(result).toContain('Tomorrow at');
    });

    it('should format time for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      
      const result = formatSnoozeTime(future.getTime());
      expect(result).not.toContain('Today at');
      expect(result).not.toContain('Tomorrow at');
    });
  });

  describe('getTimeUntilExpiry', () => {
    const baseTime = Date.now();
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;

    it('should format future time in minutes', () => {
      const result = getTimeUntilExpiry(baseTime + 30 * minuteMs);
      expect(result).toMatch(/^in \d+ minute/);
    });

    it('should format future time in hours', () => {
      const result = getTimeUntilExpiry(baseTime + 3 * hourMs);
      expect(result).toMatch(/^in \d+ hour/);
    });

    it('should format future time in days', () => {
      const result = getTimeUntilExpiry(baseTime + 2 * dayMs);
      expect(result).toMatch(/^in \d+ day/);
    });

    it('should format past time in minutes', () => {
      const result = getTimeUntilExpiry(baseTime - 30 * minuteMs);
      expect(result).toMatch(/^\d+ minute/);
    });

    it('should format past time in hours', () => {
      const result = getTimeUntilExpiry(baseTime - 3 * hourMs);
      expect(result).toMatch(/^\d+ hour/);
    });

    it('should format past time in days', () => {
      const result = getTimeUntilExpiry(baseTime - 2 * dayMs);
      expect(result).toMatch(/^\d+ day/);
    });
  });
});
