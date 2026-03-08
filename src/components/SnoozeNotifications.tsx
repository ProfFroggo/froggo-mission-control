import React, { useEffect, useState, useCallback } from 'react';
import { Bell, X, Clock } from 'lucide-react';

interface SnoozeReminder {
  session_id: string;
  snooze_until: number;
  snooze_reason?: string;
  timestamp: number;
}

interface SnoozeNotificationsProps {
  onReminderClick?: (sessionId: string) => void;
}

export const SnoozeNotifications: React.FC<SnoozeNotificationsProps> = ({
  onReminderClick,
}) => {
  const [reminders, setReminders] = useState<SnoozeReminder[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Check for expired snoozes
  const checkExpired = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3742/api/snooze/expired');
      if (response.ok) {
        const data = await response.json();
        
        // Add new reminders
        const newReminders = data
          .filter((item: any) => !dismissed.has(item.session_id))
          .map((item: any) => ({
            session_id: item.session_id,
            snooze_until: item.snooze_until,
            snooze_reason: item.snooze_reason,
            timestamp: Date.now(),
          }));

        if (newReminders.length > 0) {
          setReminders((prev) => [...prev, ...newReminders]);
          
          // Show browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            newReminders.forEach((reminder: SnoozeReminder) => {
              new Notification('Snoozed Conversation Reminder', {
                body: reminder.snooze_reason || 'A snoozed conversation needs your attention',
                icon: '/agent-profiles/froggo.webp',
                tag: reminder.session_id,
              });
            });
          }

          // Mark as reminded in backend
          newReminders.forEach(async (reminder: SnoozeReminder) => {
            await fetch(`http://localhost:3742/api/snooze/mark-reminded/${encodeURIComponent(reminder.session_id)}`, {
              method: 'POST',
            });
          });
        }
      }
    } catch (error) {
      // 'Failed to check expired snoozes:', error;
    }
  }, [dismissed]);

  // Poll for expired snoozes
  useEffect(() => {
    checkExpired();
    const interval = setInterval(checkExpired, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [checkExpired]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const dismissReminder = (sessionId: string) => {
    setReminders((prev) => prev.filter((r) => r.session_id !== sessionId));
    setDismissed((prev) => new Set(prev).add(sessionId));
  };

  const handleReminderClick = (sessionId: string) => {
    if (onReminderClick) {
      onReminderClick(sessionId);
    }
    dismissReminder(sessionId);
  };

  const formatSessionId = (sessionId: string): string => {
    // Extract readable part from session ID
    const parts = sessionId.split(':');
    if (parts.length >= 3) {
      return parts[2]; // e.g., "whatsapp" from "agent:mission-control:whatsapp:xxx"
    }
    return sessionId;
  };

  if (reminders.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {reminders.map((reminder) => (
        <button
          key={reminder.session_id}
          className="w-full bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 shadow-lg animate-slide-in cursor-pointer text-left"
          onClick={() => handleReminderClick(reminder.session_id)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleReminderClick(reminder.session_id); }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Bell className="w-5 h-5 text-warning animate-ring" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-warning text-sm">
                  Snoozed Conversation
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissReminder(reminder.session_id);
                  }}
                  className="text-warning hover:text-warning"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-sm text-warning mb-2">
                {reminder.snooze_reason || 'This conversation needs your attention'}
              </p>
              
              <div className="flex items-center gap-2 text-xs text-warning">
                <Clock className="w-3 h-3" />
                <span>
                  Session: {formatSessionId(reminder.session_id)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-warning text-center">
            Click to view conversation
          </div>
        </button>
      ))}
    </div>
  );
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes ring {
    0%, 100% {
      transform: rotate(-15deg);
    }
    50% {
      transform: rotate(15deg);
    }
  }
  
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
  
  .animate-ring {
    animation: ring 0.5s ease-in-out infinite;
  }
`;
document.head.appendChild(style);
