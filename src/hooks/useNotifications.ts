/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: useNotifications hook uses file-level suppression for intentional patterns.
// Hook for notification management - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

/**
 * useNotifications Hook
 * Handles system notifications, action buttons, and navigation from notifications
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

export function useNotifications() {
  const navigate = (path: string) => { logger.debug('Navigate:', path); };
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [recentNotifications, setRecentNotifications] = useState<SystemNotification[]>([]);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await window.clawdbot?.notifications.getPrefs();
      setPreferences((prefs as unknown as NotificationPreferences) || null);
    } catch (error) {
      // '[useNotifications] Failed to load preferences:', error;
    }
  }, []);

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    await window.clawdbot?.notifications.updatePrefs(updates);
    await loadPreferences();
  }, [loadPreferences]);

  const sendNotification = useCallback(async (options: {
    type: 'task-completed' | 'agent-failure' | 'approval-request' | 'chat-mention' | 'info';
    title: string;
    body: string;
    silent?: boolean;
    urgency?: 'low' | 'normal' | 'critical';
    actions?: { type: string; text: string }[];
    data?: any;
  }) => {
    await window.clawdbot?.notifications.send(options as unknown as Notification);
  }, []);

  const testNotification = useCallback(async () => {
    await window.clawdbot?.notifications.test();
  }, []);

  // Handle incoming notifications
  useEffect(() => {
    const unsubscribe = window.clawdbot?.notifications.onReceived((notification: unknown) => {
      
      // Add to recent notifications
      setRecentNotifications(prev => {
        const updated = [notification as SystemNotification, ...prev];
        // Keep last 50 notifications
        return updated.slice(0, 50);
      });

      // Could trigger in-app toast notification here
    });

    return unsubscribe;
  }, []);

  // Handle notification actions (from action buttons)
  useEffect(() => {
    const unsubscribe = window.clawdbot?.notifications.onAction((action: unknown) => {
      handleNotificationAction(action as NotificationAction);
    });

    return unsubscribe;
  }, []);

  // Handle navigation requests from notifications
  useEffect(() => {
    const unsubscribe = window.clawdbot?.onNavigate((view: string, data?: any) => {
      handleNavigationFromNotification(view, data);
    });

    return unsubscribe;
  }, [navigate]);

  // Handle notification action
  const handleNotificationAction = useCallback((action: NotificationAction) => {
    switch (action.actionType) {
      case 'approve':
        // Approve approval request
        if (action.data?.itemId) {
          // Navigate to inbox and auto-approve
          navigate(`/inbox?action=approve&id=${action.data.itemId}`);
        }
        break;

      case 'dismiss':
        // Dismiss notification
        break;

      case 'view-task':
        // View task details
        if (action.data?.taskId) {
          navigate(`/tasks?id=${action.data.taskId}`);
        }
        break;

      case 'view-chat':
        // View chat session
        if (action.data?.sessionId) {
          navigate(`/chat?session=${action.data.sessionId}`);
        }
        break;

      case 'view-agent':
        // View agent details
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
        if (data?.taskId) {
          navigate(`/tasks?id=${data.taskId}`);
        } else {
          navigate('/tasks');
        }
        break;

      case 'agents':
        if (data?.agentName) {
          navigate(`/agents?agent=${data.agentName}`);
        } else {
          navigate('/agents');
        }
        break;

      case 'inbox':
        if (data?.itemId) {
          navigate(`/inbox?id=${data.itemId}`);
        } else {
          navigate('/inbox');
        }
        break;

      case 'chat':
        if (data?.sessionId) {
          navigate(`/chat?session=${data.sessionId}`);
        } else {
          navigate('/chat');
        }
        break;

      default:
    }
  }, [navigate]);

  // Convenience methods for common notifications
  const notifyTaskCompleted = useCallback(async (taskTitle: string, taskId: string) => {
    await sendNotification({
      type: 'task-completed',
      title: '✅ Task Completed',
      body: taskTitle,
      urgency: 'normal',
      data: { taskId },
    });
  }, [sendNotification]);

  const notifyAgentFailed = useCallback(async (agentName: string, taskTitle: string, reason: string, taskId?: string) => {
    await sendNotification({
      type: 'agent-failure',
      title: `⚠️ ${agentName} Blocked`,
      body: `${taskTitle}\n${reason}`,
      urgency: 'critical',
      data: { taskId, agentName, reason },
    });
  }, [sendNotification]);

  const notifyApprovalNeeded = useCallback(async (itemTitle: string, itemId: string) => {
    await sendNotification({
      type: 'approval-request',
      title: '🔔 Approval Needed',
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
      title: `💬 ${from} mentioned you`,
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
