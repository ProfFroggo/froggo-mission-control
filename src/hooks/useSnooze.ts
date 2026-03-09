// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';

interface SnoozeData {
  session_id: string;
  snooze_until: number;
  snooze_reason?: string;
  reminder_sent: number;
  created_at: number;
}

interface SnoozedSessions {
  [sessionId: string]: SnoozeData;
}

export const useSnooze = () => {
  const [snoozed, setSnoozed] = useState<SnoozedSessions>({});
  const [loading, setLoading] = useState(true);

  // Fetch snoozed conversations from backend
  const fetchSnoozed = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3742/api/snooze/list');
      if (response.ok) {
        const data = await response.json();
        const snoozedMap: SnoozedSessions = {};
        data.forEach((item: SnoozeData) => {
          snoozedMap[item.session_id] = item;
        });
        setSnoozed(snoozedMap);
      }
    } catch (error) {
      // 'Failed to fetch snoozed conversations:', error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Snooze a conversation
  const snoozeConversation = useCallback(async (
    sessionId: string,
    until: number,
    reason?: string
  ) => {
    try {
      const response = await fetch('http://localhost:3742/api/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, until, reason }),
      });

      if (response.ok) {
        // Update local state
        setSnoozed((prev) => ({
          ...prev,
          [sessionId]: {
            session_id: sessionId,
            snooze_until: until,
            snooze_reason: reason,
            reminder_sent: 0,
            created_at: Date.now(),
          },
        }));
        return true;
      }
      return false;
    } catch (error) {
      // 'Failed to snooze conversation:', error;
      return false;
    }
  }, []);

  // Unsnooze a conversation
  const unsnoozeConversation = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`http://localhost:3742/api/snooze/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update local state
        setSnoozed((prev) => {
          const updated = { ...prev };
          delete updated[sessionId];
          return updated;
        });
        return true;
      }
      return false;
    } catch (error) {
      // 'Failed to unsnooze conversation:', error;
      return false;
    }
  }, []);

  // Check if a conversation is snoozed
  const isSnoozed = useCallback((sessionId: string): boolean => {
    return sessionId in snoozed;
  }, [snoozed]);

  // Get snooze data for a conversation
  const getSnoozeData = useCallback((sessionId: string): SnoozeData | null => {
    return snoozed[sessionId] || null;
  }, [snoozed]);

  // Get expired snoozes that need reminders
  const getExpiredSnoozes = useCallback((): SnoozeData[] => {
    const now = Date.now();
    return Object.values(snoozed).filter(
      (item) => item.snooze_until <= now && item.reminder_sent === 0
    );
  }, [snoozed]);

  // Initial fetch
  useEffect(() => {
    fetchSnoozed();
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchSnoozed, 30000);
    return () => clearInterval(interval);
  }, [fetchSnoozed]);

  return {
    snoozed,
    loading,
    snoozeConversation,
    unsnoozeConversation,
    isSnoozed,
    getSnoozeData,
    getExpiredSnoozes,
    refresh: fetchSnoozed,
  };
};
