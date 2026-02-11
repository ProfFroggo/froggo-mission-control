/**
 * Snooze Filter Utilities
 * Integrate these into your Sessions panel/list component
 */

import { Session } from '../store/store';

export interface SnoozeData {
  session_id: string;
  snooze_until: number;
  snooze_reason?: string;
  reminder_sent: number;
  created_at: number;
}

export interface SnoozedSessions {
  [sessionId: string]: SnoozeData;
}

/**
 * Filter sessions based on snooze status
 * 
 * @param sessions - All sessions
 * @param snoozed - Map of snoozed session data
 * @param showSnoozed - Whether to show snoozed conversations
 * @param showReminders - Whether to show reminder badges on expired snoozes
 * @returns Filtered sessions with snooze metadata
 */
export const filterSessionsBySnooze = (
  sessions: Session[],
  snoozed: SnoozedSessions,
  showSnoozed: boolean = false,
  showReminders: boolean = true
): Array<Session & { snoozeData?: SnoozeData; hasReminder?: boolean }> => {
  const now = Date.now();

  return sessions
    .map((session) => {
      const snoozeData = snoozed[session.key];
      
      if (!snoozeData) {
        return { ...session };
      }

      const isExpired = snoozeData.snooze_until <= now;
      const hasReminder = isExpired && snoozeData.reminder_sent === 0;

      return {
        ...session,
        snoozeData,
        hasReminder: showReminders && hasReminder,
      };
    })
    .filter((session) => {
      // If we're not showing snoozed conversations, filter them out
      if (!showSnoozed && (session as any).snoozeData) {
        const isExpired = (session as any).snoozeData.snooze_until <= now;
        // Show if expired (needs attention), hide if still snoozed
        return isExpired;
      }
      
      return true;
    });
};

/**
 * Get snooze status for a session
 */
export const getSnoozeStatus = (
  sessionId: string,
  snoozed: SnoozedSessions
): 'active' | 'expired' | 'none' => {
  const snoozeData = snoozed[sessionId];
  
  if (!snoozeData) return 'none';
  
  const now = Date.now();
  return snoozeData.snooze_until > now ? 'active' : 'expired';
};

/**
 * Sort sessions to prioritize reminders
 */
export const sortSessionsWithReminders = <T extends { hasReminder?: boolean; snoozeData?: SnoozeData }>(
  sessions: T[]
): T[] => {
  return sessions.sort((a, b) => {
    // Reminders first
    if (a.hasReminder && !b.hasReminder) return -1;
    if (!a.hasReminder && b.hasReminder) return 1;
    
    // Then by snooze expiry time (soonest first)
    if (a.snoozeData && b.snoozeData) {
      return a.snoozeData.snooze_until - b.snoozeData.snooze_until;
    }
    
    // Default order
    return 0;
  });
};

/**
 * Format snooze time for display
 */
export const formatSnoozeTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  if (isTomorrow) {
    return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Get time until/since snooze expiry
 */
export const getTimeUntilExpiry = (snoozeUntil: number): string => {
  const now = Date.now();
  const diff = Math.abs(snoozeUntil - now);
  const isPast = snoozeUntil < now;
  
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  
  let timeStr = '';
  
  if (days > 0) {
    timeStr = `${days} day${days !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    timeStr = `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    timeStr = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  return isPast ? `${timeStr} ago` : `in ${timeStr}`;
};
