import { useState } from 'react';
import { Bell, Check, X, Clock, MessageSquare, Calendar, Mail, Twitter, AlertCircle, CheckCircle } from 'lucide-react';
import { useStore } from '../store/store';
import { gateway } from '../lib/gateway';

interface Notification {
  id: string;
  type: 'approval' | 'alert' | 'info';
  title: string;
  description: string;
  timestamp: number;
  action?: {
    approve?: string;
    reject?: string;
    data?: any;
  };
  read: boolean;
}

// This would normally come from the gateway/backend
const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'approval',
    title: 'Weekly Content Plan Ready',
    description: '7 tweets drafted for @Prof_Frogo. Review and approve to schedule.',
    timestamp: Date.now() - 300000,
    action: { approve: 'Approve & Schedule', reject: 'Edit', data: { file: 'content-plans/prof-frogo-week-2026-01-27.md' } },
    read: false,
  },
  {
    id: 'notif-2',
    type: 'approval',
    title: '5 Draft Replies Pending',
    description: 'Replies to X mentions need your approval before posting.',
    timestamp: Date.now() - 600000,
    action: { approve: 'Approve All', reject: 'Review', data: { file: 'content-plans/prof-frogo-replies-draft.md' } },
    read: false,
  },
  {
    id: 'notif-3',
    type: 'alert',
    title: 'Calendar: Meeting in 30 min',
    description: 'Team Sync at 2:00 PM',
    timestamp: Date.now() - 900000,
    read: false,
  },
  {
    id: 'notif-4',
    type: 'info',
    title: 'Hourly Check Complete',
    description: 'No urgent messages in WhatsApp/Telegram',
    timestamp: Date.now() - 3600000,
    read: true,
  },
];

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const { addActivity } = useStore();

  const unreadCount = notifications.filter(n => !n.read).length;
  const pendingApprovals = notifications.filter(n => n.type === 'approval' && !n.read);

  const handleApprove = async (notif: Notification) => {
    addActivity({ type: 'task', message: `Approved: ${notif.title}`, timestamp: Date.now() });
    setNotifications(prev => prev.map(n => 
      n.id === notif.id ? { ...n, read: true } : n
    ));
    
    // Would send approval to gateway
    // await gateway.sendChat(`[APPROVED] ${notif.title}`);
  };

  const handleReject = (notif: Notification) => {
    addActivity({ type: 'task', message: `Needs edit: ${notif.title}`, timestamp: Date.now() });
    // Would open editor or request changes
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'approval': return <Clock size={16} className="text-yellow-500" />;
      case 'alert': return <AlertCircle size={16} className="text-red-500" />;
      default: return <Bell size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
              <Bell size={24} /> Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-sm bg-clawd-accent text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-clawd-text-dim">Approvals, alerts, and updates</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-clawd-accent hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Pending Approvals */}
        {pendingApprovals.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-clawd-text-dim uppercase tracking-wider mb-3">
              Pending Approvals ({pendingApprovals.length})
            </h2>
            <div className="space-y-3">
              {pendingApprovals.map((notif) => (
                <div
                  key={notif.id}
                  className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <Clock size={20} className="text-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{notif.title}</h3>
                      <p className="text-sm text-clawd-text-dim">{notif.description}</p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleApprove(notif)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                        >
                          <Check size={14} /> {notif.action?.approve || 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(notif)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-clawd-border text-clawd-text text-sm rounded-lg hover:bg-clawd-border/80"
                        >
                          {notif.action?.reject || 'Reject'}
                        </button>
                      </div>
                    </div>
                    <span className="text-xs text-clawd-text-dim">
                      {formatTime(notif.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Notifications */}
        <div>
          <h2 className="text-sm font-medium text-clawd-text-dim uppercase tracking-wider mb-3">
            Recent
          </h2>
          <div className="space-y-2">
            {notifications.filter(n => n.type !== 'approval' || n.read).map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                  notif.read ? 'bg-clawd-surface/50' : 'bg-clawd-surface'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  notif.read ? 'bg-clawd-border/50' : 'bg-clawd-border'
                }`}>
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium ${notif.read ? 'text-clawd-text-dim' : ''}`}>
                    {notif.title}
                  </h3>
                  <p className="text-sm text-clawd-text-dim truncate">{notif.description}</p>
                </div>
                <span className="text-xs text-clawd-text-dim whitespace-nowrap">
                  {formatTime(notif.timestamp)}
                </span>
                {!notif.read && (
                  <span className="w-2 h-2 bg-clawd-accent rounded-full" />
                )}
              </div>
            ))}
          </div>
        </div>

        {notifications.length === 0 && (
          <div className="text-center py-12 text-clawd-text-dim">
            <Bell size={48} className="mx-auto mb-4 opacity-30" />
            <p>No notifications</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
