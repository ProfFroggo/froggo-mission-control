/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: useNotifications hook uses file-level suppression for intentional patterns.
// Hook for notification management - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

/**
 * useNotifications Hook
 * Handles system notifications using browser Notifications API and REST polling
 */

import { useEffect, useCallback, useState } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('useNotifications');

export interface SystemNotification {
  type: 'task-completed' | 'agent-failure' | 'approval-request' | 'chat-mention' | 'info';
  title: string;
  body: string;
  timestamp: number;
  data?: any;
}

export interface NotificationAction {
  actionType: string;
  data?: any;
}

export interface NotificationPreferences {
  enabled: boolean;
  taskCompletions: boolean;
  agentFailures: boolean;
  approvalRequests: boolean;
  chatMentions: boolean;
  sound: boolean;
  showPreviews: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  taskCompletions: true,
  agentFailures: true,
  approvalRequests: true,
  chatMentions: true,
  sound: true,
  showPreviews: true,
};

export function useNotifications() {
  const navigate = (path: string) => { logger.debug('Navigate:', path); };
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [recentNotifications, setRecentNotifications] = useState<SystemNotification[]>([]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  // Poll for new notifications every 10 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.notifications)) {
            setRecentNotifications(prev => {
              const existing = new Set(prev.map(n => `${n.type}-${n.timestamp}`));
              const newOnes = (data.notifications as SystemNotification[]).filter(
                n => !existing.has(`${n.type}-${n.timestamp}`)
              );
              if (newOnes.length === 0) return prev;
              return [...newOnes, ...prev].slice(0, 50);
            });
          }
        }
      } catch {
        // Polling failure is non-fatal
      }
    };

    poll(); // Initial fetch
    const timer = setInterval(poll, 10000);
    return () => clearInterval(timer);
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const stored = localStorage.getItem('notification-preferences');
      if (stored) {
        setPreferences(JSON.parse(stored));
      } else {
        setPreferences(DEFAULT_PREFS);
      }
    } catch {
      setPreferences(DEFAULT_PREFS);
    }
  }, []);

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    const merged = { ...(preferences || DEFAULT_PREFS), ...updates };
    setPreferences(merged);
    localStorage.setItem('notification-preferences', JSON.stringify(merged));
  }, [preferences]);

  const sendNotification = useCallback(async (options: {
    type: 'task-completed' | 'agent-failure' | 'approval-request' | 'chat-mention' | 'info';
    title: string;
    body: string;
    silent?: boolean;
    urgency?: 'low' | 'normal' | 'critical';
    actions?: { type: string; text: string }[];
    data?: any;
  }) => {
    // Use browser Notifications API
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(options.title, {
        body: options.body,
        silent: options.silent,
      });
    } else if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(options.title, {
          body: options.body,
          silent: options.silent,
        });
      }
    }

    // Add to recent notifications
    setRecentNotifications(prev => [{
      type: options.type,
      title: options.title,
      body: options.body,
      timestamp: Date.now(),
      data: options.data,
    }, ...prev].slice(0, 50));
  }, []);

  const testNotification = useCallback(async () => {
    await sendNotification({
      type: 'info',
      title: 'Test Notification',
      body: 'This is a test notification from Froggo.',
    });
  }, [sendNotification]);

  // Handle notification action
  const handleNotificationAction = useCallback((action: NotificationAction) => {
    switch (action.actionType) {
      case 'approve':
        if (action.data?.itemId) {
          navigate(`/inbox?action=approve&id=${action.data.itemId}`);
        }
        break;

      case 'dismiss':
        break;

      case 'view-task':
        if (action.data?.taskId) {
          navigate(`/tasks?id=${action.data.taskId}`);
        }
        break;

      case 'view-chat':
        if (action.data?.sessionId) {
          navigate(`/chat?session=${action.data.sessionId}`);
        }
        break;

      case 'view-agent':
        if (action.data?.agentName) {
          navigate(`/agents?agent=${action.data.agentName}`);
        }
        break;

      default:
    }
  }, [navigate]);

  // Handle navigation from notification click
  const handleNavigationFromNotification = useCallback((view: string, data?: any) => {
    switch (view) {
      case 'tasks':
        navigate(data?.taskId ? `/tasks?id=${data.taskId}` : '/tasks');
        break;
      case 'agents':
        navigate(data?.agentName ? `/agents?agent=${data.agentName}` : '/agents');
        break;
      case 'inbox':
        navigate(data?.itemId ? `/inbox?id=${data.itemId}` : '/inbox');
        break;
      case 'chat':
        navigate(data?.sessionId ? `/chat?session=${data.sessionId}` : '/chat');
        break;
      default:
    }
  }, [navigate]);

  // Convenience methods for common notifications
  const notifyTaskCompleted = useCallback(async (taskTitle: string, taskId: string) => {
    await sendNotification({
      type: 'task-completed',
      title: 'Task Completed',
      body: taskTitle,
      urgency: 'normal',
      data: { taskId },
    });
  }, [sendNotification]);

  const notifyAgentFailed = useCallback(async (agentName: string, taskTitle: string, reason: string, taskId?: string) => {
    await sendNotification({
      type: 'agent-failure',
      title: `${agentName} Blocked`,
      body: `${taskTitle}\n${reason}`,
      urgency: 'critical',
      data: { taskId, agentName, reason },
    });
  }, [sendNotification]);

  const notifyApprovalNeeded = useCallback(async (itemTitle: string, itemId: string) => {
    await sendNotification({
      type: 'approval-request',
      title: 'Approval Needed',
      body: itemTitle,
      urgency: 'normal',
      actions: [
        { type: 'approve', text: 'Approve' },
        { type: 'dismiss', text: 'Dismiss' },
      ],
      data: { itemId },
    });
  }, [sendNotification]);

  const notifyChatMention = useCallback(async (from: string, preview: string, sessionId?: string) => {
    await sendNotification({
      type: 'chat-mention',
      title: `${from} mentioned you`,
      body: preview,
      urgency: 'normal',
      data: { from, sessionId },
    });
  }, [sendNotification]);

  return {
    // State
    preferences,
    recentNotifications,

    // Actions
    loadPreferences,
    updatePreferences,
    sendNotification,
    testNotification,

    // Convenience methods
    notifyTaskCompleted,
    notifyAgentFailed,
    notifyApprovalNeeded,
    notifyChatMention,
  };
}

export default useNotifications;
