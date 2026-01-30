import { useState, useEffect, useRef } from 'react';
import { 
  Inbox, Check, X, Clock, MessageSquare, Mail, Send, 
  Calendar, Bot, AlertTriangle, ShieldAlert, 
  TrendingUp, Edit3, Search, Play
} from 'lucide-react';
import { showToast } from './Toast';
import { LoadingButton } from './LoadingStates';
import { calculatePriorityScore, getPriorityLevel } from '../lib/priorityScoring';
import IconBadge from './IconBadge';
import MarkdownMessage from './MarkdownMessage';

type ApprovalType = 'tweet' | 'reply' | 'email' | 'message' | 'task' | 'action';

interface InjectionWarning {
  detected: boolean;
  type: string;
  pattern: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
}

interface InboxItem {
  id: number;
  created: string;
  type: ApprovalType;
  title: string;
  content: string;
  context?: string;
  status: string;
  metadata?: string;
  source_channel?: string;
  source_session?: string;
  reviewed_at?: string;
  feedback?: string;
  priority_score?: number;
  priority_metadata?: string;
}

interface FolderType {
  id: string;
  name: string;
  icon: string;
  count: number;
  color?: string;
}

const typeConfig: Record<ApprovalType, { icon: any; color: string; label: string }> = {
  tweet: { icon: Send, color: 'text-sky-400 bg-sky-500/20', label: 'Tweet' },
  reply: { icon: MessageSquare, color: 'text-blue-400 bg-blue-500/20', label: 'Reply' },
  email: { icon: Mail, color: 'text-green-400 bg-green-500/20', label: 'Email' },
  message: { icon: MessageSquare, color: 'text-purple-400 bg-purple-500/20', label: 'Message' },
  task: { icon: Bot, color: 'text-yellow-400 bg-yellow-500/20', label: 'Task' },
  action: { icon: Play, color: 'text-green-400 bg-green-500/20', label: 'Action' },
};

const riskStyles: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
  low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
};

export default function ThreePaneInbox() {
  // State
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [processingItems, setProcessingItems] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const recentlyRejectedTaskIds = useRef<Set<string>>(new Set());

  // Folders
  const [folders] = useState<FolderType[]>([
    { id: 'all', name: 'All Items', icon: '📥', count: 0 },
    { id: 'pending', name: 'Pending', icon: '⏳', count: 0 },
    { id: 'tweets', name: 'Tweets', icon: '🐦', count: 0, color: 'text-sky-400' },
    { id: 'emails', name: 'Emails', icon: '✉️', count: 0, color: 'text-green-400' },
    { id: 'tasks', name: 'Tasks', icon: '✅', count: 0, color: 'text-yellow-400' },
    { id: 'high-priority', name: 'High Priority', icon: '🔴', count: 0, color: 'text-red-400' },
  ]);

  // Load inbox items
  const loadInbox = async () => {
    setLoading(true);
    try {
      if (!window.clawdbot?.inbox?.list) {
        console.warn('[ThreePaneInbox] clawdbot.inbox not available');
        setItems([]);
        return;
      }

      const result = await window.clawdbot.inbox.list();
      let allItems = result.success ? (result.items || []) : [];

      // Also load tasks in "review" status
      try {
        const tasksResult = await window.clawdbot.tasks.list('review');
        if (tasksResult?.success && tasksResult.tasks?.length > 0) {
          const taskItems = tasksResult.tasks
            .filter((t: any) => !recentlyRejectedTaskIds.current.has(t.id))
            .map((t: any) => ({
            id: `task-review-${t.id}`,
            type: 'task' as const,
            title: `✅ Review: ${t.title}`,
            content: t.description || t.last_agent_update || 'Task completed, ready for review',
            context: `Project: ${t.project || 'General'}`,
            status: 'pending',
            source_channel: 'kanban',
            created: new Date(t.created_at || Date.now()).toISOString(),
            metadata: JSON.stringify({ taskId: t.id, project: t.project }),
            isTask: true,
          }));
          allItems = [...taskItems, ...allItems];
        }
      } catch (e) {
        console.warn('[ThreePaneInbox] Failed to load review tasks:', e);
      }

      // Calculate priority scores if not present
      allItems = allItems.map(item => {
        if (item.priority_score === undefined || item.priority_score === null) {
          const metadata = item.metadata ? JSON.parse(item.metadata) : {};
          const score = calculatePriorityScore({
            type: item.type,
            title: item.title,
            content: item.content,
            context: item.context,
            metadata,
            created: item.created,
            source_channel: item.source_channel,
          });
          return { ...item, priority_score: score.total };
        }
        return item;
      });

      setItems(allItems);

      // Auto-select first item if none selected
      if (!selectedItemId && allItems.length > 0) {
        setSelectedItemId(allItems[0].id);
      }
    } catch (error) {
      console.error('Failed to load inbox:', error);
      showToast('error', 'Failed to load inbox', 'Check console for details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
    const interval = setInterval(loadInbox, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Filter items based on folder and search
  const filteredItems = items
    .filter(item => {
      // Folder filter
      if (selectedFolder === 'all') return true;
      if (selectedFolder === 'pending') return item.status === 'pending';
      if (selectedFolder === 'tweets') return item.type === 'tweet' || item.type === 'reply';
      if (selectedFolder === 'emails') return item.type === 'email';
      if (selectedFolder === 'tasks') return item.type === 'task';
      if (selectedFolder === 'high-priority') return (item.priority_score || 0) >= 60;
      return true;
    })
    .filter(item => {
      // Search filter
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query) ||
        item.context?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      // Sort by priority score (high to low)
      return (b.priority_score || 0) - (a.priority_score || 0);
    });

  const selectedItem = filteredItems.find(item => item.id === selectedItemId);

  // Handlers
  const handleApprove = async (item: InboxItem) => {
    setProcessingItems(prev => new Set(prev).add(item.id));

    try {
      // Optimistic UI update
      setItems(prev => prev.filter(i => i.id !== item.id));
      showToast('success', 'Approved ✓', item.title);

      // Check if this is a task review
      if ((item as any).isTask && item.metadata) {
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        if (meta.taskId) {
          await window.clawdbot!.tasks.update(meta.taskId, { status: 'done' });
          return;
        }
      }

      // Regular inbox item
      await window.clawdbot!.inbox.update(item.id, { status: 'approved' });

      // Create execution task
      const projectMap: Record<string, string> = {
        'tweet': 'X',
        'reply': 'X',
        'email': 'Email',
        'message': 'Message',
      };

      const metadata = item.metadata ? JSON.parse(item.metadata) : {};
      const taskData = {
        id: `task-${Date.now()}`,
        title: item.title,
        description: item.content,
        status: 'in-progress',
        project: projectMap[item.type] || 'Approved',
        assignedTo: 'coder',
        metadata,
      };

      await window.clawdbot!.tasks.sync(taskData);
    } catch (error) {
      console.error('Approval error:', error);
      showToast('error', 'Approval failed', 'Check console');
      loadInbox();
    } finally {
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleReject = async (item: InboxItem, reason: string) => {
    setProcessingItems(prev => new Set(prev).add(item.id));

    try {
      // Optimistic UI update
      setItems(prev => prev.filter(i => i.id !== item.id));
      showToast('warning', 'Rejected ✗', item.title);

      // Check if task review
      const isTaskItem = (item as any).isTask || String(item.id).startsWith('task-review-');
      if (isTaskItem && item.metadata) {
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        if (meta.taskId) {
          recentlyRejectedTaskIds.current.add(meta.taskId);
          setTimeout(() => recentlyRejectedTaskIds.current.delete(meta.taskId), 120000);
          try {
            await window.clawdbot!.tasks.update(meta.taskId, { status: 'in-progress' });
          } catch (updateErr) {
            console.error('[ThreePaneInbox] Failed to update task status on reject, retrying...', updateErr);
            setTimeout(async () => {
              try {
                await window.clawdbot!.tasks.update(meta.taskId, { status: 'in-progress' });
              } catch (retryErr) {
                console.error('[ThreePaneInbox] Retry also failed:', retryErr);
              }
            }, 2000);
          }
        }
      } else {
        await window.clawdbot!.inbox.update(item.id, {
          status: 'rejected',
          feedback: reason,
        });
      }

      await window.clawdbot!.rejections.log({
        type: item.type,
        title: item.title,
        content: item.content,
        reason: reason,
      });
    } catch (error) {
      console.error('Rejection error:', error);
      showToast('error', 'Rejection failed', 'Check console');
      loadInbox();
    } finally {
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleAdjust = async () => {
    if (!selectedItem || !feedbackText.trim()) return;

    try {
      // Optimistic UI update
      setItems(prev => prev.filter(i => i.id !== selectedItem.id));
      showToast('info', 'Revision requested', 'Creating task...');

      const isTaskItem = (selectedItem as any).isTask || String(selectedItem.id).startsWith('task-review-');
      if (isTaskItem && selectedItem.metadata) {
        const meta = typeof selectedItem.metadata === 'string' ? JSON.parse(selectedItem.metadata) : selectedItem.metadata;
        if (meta.taskId) {
          await window.clawdbot!.tasks.update(meta.taskId, { status: 'in-progress' });
        }
      } else {
        await window.clawdbot!.inbox.update(selectedItem.id, {
          status: 'needs-revision',
          feedback: feedbackText,
        });

        // Create revision task
        const taskData = {
          id: `task-${Date.now()}`,
          title: `Revise: ${selectedItem.title}`,
          description: `Original:\n${selectedItem.content}\n\nFeedback:\n${feedbackText}\n\n[Inbox ID: ${selectedItem.id}]`,
          status: 'in-progress',
          project: selectedItem.type === 'tweet' || selectedItem.type === 'reply' ? 'X' : 'Revisions',
          assignedTo: selectedItem.type === 'tweet' || selectedItem.type === 'reply' ? 'writer' : 'coder',
        };

        await window.clawdbot!.tasks.sync(taskData);
      }

      setShowFeedbackForm(false);
      setFeedbackText('');
    } catch (error) {
      console.error('Adjust error:', error);
      showToast('error', 'Failed to request revision', 'Check console');
      loadInbox();
    }
  };

  const getInjectionWarning = (item: InboxItem): InjectionWarning | null => {
    if (!item.metadata) return null;
    try {
      const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
      return meta.injectionWarning || null;
    } catch {
      return null;
    }
  };

  const formatTime = (created: string) => {
    const ts = new Date(created).getTime();
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  // Update folder counts
  const folderCounts = {
    all: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    tweets: items.filter(i => i.type === 'tweet' || i.type === 'reply').length,
    emails: items.filter(i => i.type === 'email').length,
    tasks: items.filter(i => i.type === 'task').length,
    'high-priority': items.filter(i => (i.priority_score || 0) >= 60).length,
  };

  return (
    <div className="h-full flex bg-clawd-bg">
      {/* LEFT PANE: Folders Sidebar */}
      <div className="w-64 border-r border-clawd-border bg-clawd-surface flex flex-col">
        <div className="p-4 border-b border-clawd-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-clawd-accent/20 rounded-lg">
              <Inbox size={20} className="text-clawd-accent" />
            </div>
            <h2 className="font-semibold">Inbox</h2>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-clawd-text-dim" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clawd-accent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {folders.map(folder => {
            const count = folderCounts[folder.id as keyof typeof folderCounts] || 0;
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  selectedFolder === folder.id
                    ? 'bg-clawd-accent text-white'
                    : 'hover:bg-clawd-border text-clawd-text'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{folder.icon}</span>
                  <span className={`text-sm font-medium ${folder.color || ''}`}>
                    {folder.name}
                  </span>
                </div>
                {count > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedFolder === folder.id
                      ? 'bg-white/20'
                      : 'bg-clawd-border'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTER PANE: Message List */}
      <div className="w-96 border-r border-clawd-border bg-clawd-surface flex flex-col">
        <div className="px-5 py-4 border-b border-clawd-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-clawd-text-dim">
              {folders.find(f => f.id === selectedFolder)?.name || 'Items'}
            </h3>
            <span className="text-xs text-clawd-text-dim tabular-nums">
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="p-4 space-y-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 px-5 py-4">
                  <div className="w-10 h-10 rounded-full bg-clawd-border/60 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-clawd-border/60 rounded w-2/3" />
                    <div className="h-3 bg-clawd-border/40 rounded w-full" />
                    <div className="h-3 bg-clawd-border/30 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-full bg-clawd-border/30 flex items-center justify-center mb-4">
                <Inbox size={28} className="text-clawd-text-dim opacity-50" />
              </div>
              <p className="text-sm font-medium text-clawd-text-dim mb-1">
                {searchQuery ? 'No results found' : 'All clear'}
              </p>
              <p className="text-xs text-clawd-text-dim/60">
                {searchQuery ? 'Try a different search term' : 'Nothing needs your attention right now'}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredItems.map(item => {
                const config = typeConfig[item.type];
                const Icon = config.icon;
                const isSelected = selectedItemId === item.id;
                const warning = getInjectionWarning(item);
                const isPending = item.status === 'pending';
                const isHighPriority = (item.priority_score || 0) >= 60;
                const { color: priorityColor } = getPriorityLevel(item.priority_score || 0);

                // Get initials from type for avatar
                const avatarColors: Record<string, string> = {
                  tweet: 'bg-sky-500/20 text-sky-400',
                  reply: 'bg-blue-500/20 text-blue-400',
                  email: 'bg-emerald-500/20 text-emerald-400',
                  message: 'bg-purple-500/20 text-purple-400',
                  task: 'bg-amber-500/20 text-amber-400',
                  action: 'bg-green-500/20 text-green-400',
                };

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`group relative flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-clawd-accent/10'
                        : 'hover:bg-clawd-bg/50'
                    }`}
                  >
                    {/* Selection indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-all duration-150 ${
                      isSelected ? 'bg-clawd-accent' : 'bg-transparent'
                    }`} />

                    {/* Unread dot */}
                    {isPending && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2">
                        <div className="w-2 h-2 rounded-full bg-clawd-accent" />
                      </div>
                    )}

                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      avatarColors[item.type] || 'bg-clawd-border text-clawd-text-dim'
                    }`}>
                      <Icon size={18} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Top row: sender/type + timestamp */}
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-sm truncate ${
                          isPending ? 'font-semibold text-clawd-text' : 'font-medium text-clawd-text/80'
                        }`}>
                          {config.label}
                          {item.source_channel && (
                            <span className="text-clawd-text-dim font-normal"> · {item.source_channel}</span>
                          )}
                        </span>
                        <span className="text-[11px] text-clawd-text-dim flex-shrink-0 tabular-nums">
                          {formatTime(item.created)}
                        </span>
                      </div>

                      {/* Subject line */}
                      <h4 className={`text-[13px] truncate mb-0.5 ${
                        isPending ? 'font-medium text-clawd-text' : 'text-clawd-text/70'
                      }`}>
                        {item.title}
                      </h4>

                      {/* Preview text */}
                      <p className="text-xs text-clawd-text-dim/70 line-clamp-1 leading-relaxed">
                        {item.content}
                      </p>

                      {/* Bottom indicators row */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {isHighPriority && (
                          <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityColor}`}>
                            <AlertTriangle size={9} className="mr-0.5" />
                            Priority
                          </span>
                        )}
                        {warning && (
                          <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            riskStyles[warning.risk]?.bg
                          } ${riskStyles[warning.risk]?.text}`}>
                            <ShieldAlert size={9} className="mr-0.5" />
                            {warning.risk}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Message Details */}
      <div className="flex-1 flex flex-col bg-clawd-bg">
        {selectedItem ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-clawd-border bg-clawd-surface">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-3 rounded-xl ${typeConfig[selectedItem.type].color}`}>
                    {(() => {
                      const Icon = typeConfig[selectedItem.type].icon;
                      return <Icon size={24} />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs px-2 py-1 bg-clawd-border rounded font-medium">
                        {typeConfig[selectedItem.type].label}
                      </span>
                      {(() => {
                        const { label, color } = getPriorityLevel(selectedItem.priority_score || 0);
                        return (
                          <span className={`text-xs px-2 py-1 rounded font-medium ${color}`}>
                            {label} ({selectedItem.priority_score})
                          </span>
                        );
                      })()}
                      <span className="text-xs text-clawd-text-dim">
                        {formatTime(selectedItem.created)}
                      </span>
                      {selectedItem.source_channel && (
                        <span className="text-xs text-clawd-text-dim">
                          via {selectedItem.source_channel}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold">{selectedItem.title}</h2>
                    {selectedItem.context && (
                      <p className="text-sm text-clawd-text-dim mt-1">
                        {selectedItem.context}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Injection Warning */}
              {(() => {
                const warning = getInjectionWarning(selectedItem);
                if (!warning) return null;
                const style = riskStyles[warning.risk] || riskStyles.high;
                return (
                  <div className={`${style.bg} ${style.text} px-4 py-3 rounded-lg border ${style.border} flex items-start gap-3`}>
                    <ShieldAlert size={20} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold mb-1">
                        ⚠️ Potential {warning.type.replace('_', ' ')}
                      </div>
                      <p className="text-xs opacity-90">
                        Pattern detected: <code className="bg-clawd-bg/20 px-1 rounded">{warning.pattern}</code>
                      </p>
                      <p className="text-xs opacity-75 mt-1">
                        Risk Level: {warning.risk.toUpperCase()}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <LoadingButton
                  loading={processingItems.has(selectedItem.id)}
                  onClick={() => handleApprove(selectedItem)}
                  variant="primary"
                  className="bg-green-500 hover:bg-green-600 flex-1"
                  icon={<Check size={16} />}
                >
                  Approve
                </LoadingButton>
                <LoadingButton
                  onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                  variant="primary"
                  className="bg-blue-500 hover:bg-blue-600 flex-1"
                  icon={<Edit3 size={16} />}
                >
                  Request Changes
                </LoadingButton>
                <LoadingButton
                  loading={processingItems.has(selectedItem.id)}
                  onClick={() => {
                    const reason = prompt('Why are you rejecting this?');
                    if (reason) handleReject(selectedItem, reason);
                  }}
                  variant="danger"
                  className="flex-1"
                  icon={<X size={16} />}
                >
                  Reject
                </LoadingButton>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Feedback Form */}
              {showFeedbackForm && (
                <div className="mb-6 p-4 bg-clawd-surface border border-clawd-border rounded-xl">
                  <h3 className="text-sm font-semibold mb-3">Request Changes</h3>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Describe what changes you'd like..."
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-clawd-accent"
                    rows={4}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAdjust}
                      disabled={!feedbackText.trim()}
                      className="px-4 py-2 bg-clawd-accent text-white rounded-lg text-sm hover:bg-clawd-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send Feedback
                    </button>
                    <button
                      onClick={() => {
                        setShowFeedbackForm(false);
                        setFeedbackText('');
                      }}
                      className="px-4 py-2 bg-clawd-border text-clawd-text-dim rounded-lg text-sm hover:bg-clawd-border/70 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Main Content */}
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-3 text-clawd-text-dim">Content</h3>
                <MarkdownMessage content={selectedItem.content} />
              </div>

              {/* Priority Breakdown */}
              {selectedItem.priority_metadata && (
                <div className="mt-6 bg-clawd-surface border border-clawd-border rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-clawd-accent" />
                    <h3 className="text-sm font-semibold">Priority Analysis</h3>
                  </div>
                  {(() => {
                    try {
                      const meta = JSON.parse(selectedItem.priority_metadata);
                      const { breakdown, flags } = meta;
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            {Object.entries(breakdown).map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="text-clawd-text-dim capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>
                                <span className="ml-2 text-clawd-accent font-medium">{value}</span>
                              </div>
                            ))}
                          </div>
                          {flags && flags.length > 0 && (
                            <div className="text-sm">
                              <span className="text-clawd-text-dim font-medium">Factors: </span>
                              <span className="text-clawd-text">{flags.join(', ')}</span>
                            </div>
                          )}
                        </>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}
                </div>
              )}

              {/* Metadata */}
              {selectedItem.metadata && (
                <div className="mt-6 bg-clawd-surface border border-clawd-border rounded-xl p-6">
                  <h3 className="text-sm font-semibold mb-3 text-clawd-text-dim">Metadata</h3>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-clawd-text-dim">
                    {JSON.stringify(
                      typeof selectedItem.metadata === 'string'
                        ? JSON.parse(selectedItem.metadata)
                        : selectedItem.metadata,
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <MessageSquare size={64} className="text-clawd-text-dim opacity-30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Item Selected</h3>
            <p className="text-sm text-clawd-text-dim max-w-md">
              Select an item from the list to view its details and take action
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
