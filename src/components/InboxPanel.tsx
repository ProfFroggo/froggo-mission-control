import { useState, useEffect, useRef } from 'react';
import { Inbox, Check, X, XCircle, MessageSquare, Send, Mail, Calendar, Bot, ChevronDown, ChevronUp, Edit3, Clock, Filter, Trash2, CheckCircle, RefreshCw, Plus, AlertTriangle, ShieldAlert } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';
import { SkeletonInbox } from './Skeleton';
import EmptyState from './EmptyState';

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
}

// Helper to parse metadata and extract injection warning
const getInjectionWarning = (item: InboxItem): InjectionWarning | null => {
  if (!item.metadata) return null;
  try {
    const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
    return meta.injectionWarning || null;
  } catch {
    return null;
  }
};

// Risk level styling
const riskStyles: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
  low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
};

const typeConfig: Record<ApprovalType, { icon: any; color: string; label: string }> = {
  tweet: { icon: Send, color: 'text-sky-400 bg-sky-500/20', label: 'Tweet' },
  reply: { icon: MessageSquare, color: 'text-blue-400 bg-blue-500/20', label: 'Reply' },
  email: { icon: Mail, color: 'text-green-400 bg-green-500/20', label: 'Email' },
  message: { icon: MessageSquare, color: 'text-purple-400 bg-purple-500/20', label: 'Message' },
  task: { icon: Bot, color: 'text-yellow-400 bg-yellow-500/20', label: 'Task' },
  action: { icon: Calendar, color: 'text-orange-400 bg-orange-500/20', label: 'Action' },
};

export default function InboxPanel() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [feedbackId, setFeedbackId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [filter, setFilter] = useState<ApprovalType | 'all'>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [rejectDialogItem, setRejectDialogItem] = useState<InboxItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const rejectInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const loadInbox = async () => {
    setLoading(true);
    try {
      // Check if running in Electron with clawdbot API
      if (!window.clawdbot?.inbox?.list) {
        console.warn('[InboxPanel] clawdbot.inbox not available (web mode)');
        setItems([]);
        return;
      }
      const result = await window.clawdbot.inbox.list();
      if (result.success) {
        setItems(result.items || []);
      }
    } catch (error) {
      console.error('Failed to load inbox:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
    const interval = setInterval(loadInbox, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  // Derive filtered lists from items (must be before useEffect that uses them!)
  const pendingItems = items.filter(i => i.status === 'pending');
  const completedItems = items.filter(i => i.status !== 'pending');
  const filteredPending = filter === 'all' ? pendingItems : pendingItems.filter(i => i.type === filter);

  // Keyboard navigation (J/K/A/R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const navItems = filteredPending;
      if (navItems.length === 0) return;
      
      switch (e.key.toLowerCase()) {
        case 'j': // Next item
          e.preventDefault();
          setFocusedIndex(i => Math.min(i + 1, navItems.length - 1));
          break;
        case 'k': // Previous item
          e.preventDefault();
          setFocusedIndex(i => Math.max(i - 1, 0));
          break;
        case 'a': // Approve focused item
          e.preventDefault();
          if (navItems[focusedIndex]) {
            handleApprove(navItems[focusedIndex]);
          }
          break;
        case 'r': // Reject focused item
          e.preventDefault();
          if (navItems[focusedIndex]) {
            setRejectDialogItem(navItems[focusedIndex]);
          }
          break;
        case 'enter':
        case ' ': // Toggle expand
          e.preventDefault();
          if (navItems[focusedIndex]) {
            setExpandedId(expandedId === navItems[focusedIndex].id ? null : navItems[focusedIndex].id);
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredPending, focusedIndex, expandedId]);

  const handleApprove = async (item: InboxItem) => {
    // OPTIMISTIC UI: Remove item immediately for instant feedback
    setItems(prev => prev.filter(i => i.id !== item.id));
    showToast('success', 'Approved ✓', item.title);
    
    // Then sync in background
    try {
      await window.clawdbot.inbox.update(item.id, { status: 'approved' });
      
      // Create task as IN-PROGRESS so watcher picks it up and executes
      const projectMap: Record<string, string> = {
        'tweet': 'X/Twitter',
        'reply': 'X/Twitter',
        'email': 'Email',
        'message': 'Message',
        'whatsapp': 'Message',
        'telegram': 'Message',
      };
      
      const taskData = {
        id: `task-${Date.now()}`,
        title: item.title,
        description: item.content,
        status: 'in-progress',
        project: projectMap[item.type] || 'Approved',
        assignedTo: 'main',
        metadata: item.context ? JSON.parse(item.context) : {},
      };
      
      const result = await window.clawdbot.tasks.sync(taskData);
      if (!result.success) {
        console.error('[Inbox] Task creation failed:', result.error);
      }
    } catch (error) {
      // Revert on error
      console.error('[Inbox] Error in handleApprove:', error);
      showToast('error', 'Approval failed', 'Reverting...');
      loadInbox(); // Reload to revert
    }
  };

  const handleReject = (item: InboxItem) => {
    // Open rejection dialog
    setRejectDialogItem(item);
    setRejectReason('');
    // Focus the input after dialog opens
    setTimeout(() => rejectInputRef.current?.focus(), 100);
  };

  const confirmReject = async () => {
    if (!rejectDialogItem) return;
    
    const reason = rejectReason.trim() || "No reason provided";
    const item = rejectDialogItem;
    
    // OPTIMISTIC UI: Remove immediately
    setItems(prev => prev.filter(i => i.id !== item.id));
    setRejectDialogItem(null);
    setRejectReason('');
    showToast('warning', 'Rejected ✗', item.title);
    
    // Sync in background
    try {
      await window.clawdbot.inbox.update(item.id, { 
        status: 'rejected',
        feedback: reason 
      });
      
      await window.clawdbot.rejections.log({
        type: item.type,
        title: item.title,
        content: item.content,
        reason: reason,
      });
      
      if (reason !== "No reason provided") {
        gateway.sendToMain(`[REJECTION_LESSON] ${item.type}: "${item.title}"\nReason: ${reason}\n\nLearn from this.`);
      }
    } catch (error) {
      console.error('[Inbox] Reject failed:', error);
      loadInbox(); // Revert
    }
  };

  const handleAdjust = async (item: InboxItem) => {
    if (!feedbackText.trim()) return;
    
    // Update inbox item status
    await window.clawdbot.inbox.update(item.id, { 
      status: 'needs-revision', 
      feedback: feedbackText 
    });
    
    // Create a TASK in Kanban for the revision
    const taskData = {
      id: `task-${Date.now()}`,
      title: `Revise: ${item.title}`,
      description: `Original:\n${item.content}\n\nFeedback:\n${feedbackText}\n\n[Inbox ID: ${item.id}]`,
      status: 'in-progress',
      project: item.type === 'tweet' || item.type === 'reply' ? 'X/Twitter' : 
               item.type === 'email' ? 'Email' : 'Revisions',
      assignedTo: 'main',
    };
    
    const result = await window.clawdbot.tasks.sync(taskData);
    if (result?.success) {
      showToast('success', 'Revision task created', 'Check Tasks tab');
    } else {
      showToast('info', 'Revision requested', 'Task creation may have failed');
    }
    
    console.log('[Inbox] Created revision task:', taskData.id);
    
    setFeedbackId(null);
    setFeedbackText('');
    loadInbox();
  };

  const handleApproveAll = () => {
    pendingItems.forEach(item => handleApprove(item));
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(pendingItems.map(i => i.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkApprove = () => {
    selectedIds.forEach(id => {
      const item = pendingItems.find(i => i.id === id);
      if (item) handleApprove(item);
    });
    clearSelection();
  };

  const handleBulkReject = () => {
    selectedIds.forEach(id => {
      const item = pendingItems.find(i => i.id === id);
      if (item) handleReject(item, 'Bulk rejected');
    });
    clearSelection();
  };

  const formatTime = (created: string) => {
    const ts = new Date(created).getTime();
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-clawd-accent/20 rounded-xl">
              <Inbox size={24} className="text-clawd-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Approval Inbox</h1>
              <p className="text-sm text-clawd-text-dim">
                {pendingItems.length} pending • {completedItems.length} completed
                <span className="ml-2 text-clawd-text-dim/50">• J/K to navigate • A approve • R reject</span>
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={loadInbox}
              className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-clawd-text-dim">{selectedIds.size} selected</span>
                <button
                  onClick={handleBulkApprove}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors text-sm"
                >
                  <CheckCircle size={14} />
                  Approve
                </button>
                <button
                  onClick={handleBulkReject}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm"
                >
                  <XCircle size={14} />
                  Reject
                </button>
                <button
                  onClick={clearSelection}
                  className="px-2 py-2 text-clawd-text-dim hover:text-clawd-text transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            ) : pendingItems.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={handleApproveAll}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                >
                  <CheckCircle size={16} />
                  Approve All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === 'all' 
                ? 'bg-clawd-accent text-white' 
                : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-border/70'
            }`}
          >
            All ({pendingItems.length})
          </button>
          {Object.entries(typeConfig).map(([type, config]) => {
            const Icon = config.icon;
            const count = pendingItems.filter(i => i.type === type).length;
            if (count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setFilter(type as ApprovalType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === type
                    ? 'bg-clawd-accent text-white'
                    : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-border/70'
                }`}
              >
                <Icon size={14} />
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Pending Items */}
      <div className="flex-1 overflow-y-auto">
        {loading && pendingItems.length === 0 ? (
          <div className="p-6">
            <SkeletonInbox />
          </div>
        ) : filteredPending.length === 0 ? (
          <EmptyState 
            type="inbox" 
            description="Items will appear here when they need your review"
          />
        ) : (
          <div className="p-6 space-y-4">
            {filteredPending.map((item, index) => {
              const config = typeConfig[item.type];
              const Icon = config.icon;
              const isExpanded = expandedId === item.id;
              const showFeedback = feedbackId === item.id;
              const isFocused = index === focusedIndex;

              return (
                <div
                  key={item.id}
                  className={`card overflow-hidden transition-all ${
                    isFocused 
                      ? 'border-clawd-accent ring-2 ring-clawd-accent/30' 
                      : 'hover:border-clawd-accent/30'
                  } ${(() => {
                    const warning = getInjectionWarning(item);
                    return warning ? riskStyles[warning.risk]?.border || '' : '';
                  })()}`}
                >
                  {/* Injection Warning Banner */}
                  {(() => {
                    const warning = getInjectionWarning(item);
                    if (!warning) return null;
                    const style = riskStyles[warning.risk] || riskStyles.high;
                    return (
                      <div className={`${style.bg} ${style.text} px-4 py-2 flex items-center gap-2 border-b ${style.border}`}>
                        <ShieldAlert size={18} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">⚠️ Potential {warning.type.replace('_', ' ')}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${style.bg} font-medium uppercase`}>
                              {warning.risk} risk
                            </span>
                          </div>
                          <p className="text-xs opacity-80 mt-0.5">
                            Pattern detected: <code className="bg-black/20 px-1 rounded">{warning.pattern}</code>
                          </p>
                        </div>
                        <AlertTriangle size={20} className="flex-shrink-0 animate-pulse" />
                      </div>
                    );
                  })()}
                  
                  {/* Header */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Selection checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 mt-1 rounded border-clawd-border text-clawd-accent focus:ring-clawd-accent focus:ring-offset-0 bg-clawd-bg cursor-pointer"
                      />
                      <div className={`p-2 rounded-lg ${config.color} flex-shrink-0`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium px-2 py-0.5 bg-clawd-border rounded">
                            {config.label}
                          </span>
                          {/* Warning badge in header too for collapsed view */}
                          {getInjectionWarning(item) && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1 ${
                              riskStyles[getInjectionWarning(item)!.risk]?.bg
                            } ${riskStyles[getInjectionWarning(item)!.risk]?.text}`}>
                              <AlertTriangle size={10} />
                              {getInjectionWarning(item)!.risk.toUpperCase()}
                            </span>
                          )}
                          <span className="text-xs text-clawd-text-dim flex items-center gap-1">
                            <Clock size={12} />
                            {formatTime(item.created)}
                          </span>
                          {item.source_channel && (
                            <span className="text-xs text-clawd-text-dim">
                              from {item.source_channel}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-medium truncate">{item.title}</h3>
                        {item.context && (
                          <p className="text-xs text-clawd-text-dim mt-1">{item.context}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-2 hover:bg-clawd-border rounded-lg transition-colors flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-clawd-border bg-clawd-bg/30">
                      <div className="mt-4 mb-4">
                        <div className="text-sm text-clawd-text-dim mb-2">Content:</div>
                        <pre className="bg-clawd-bg p-3 rounded-lg text-sm whitespace-pre-wrap font-mono border border-clawd-border">
                          {item.content}
                        </pre>
                      </div>

                      {/* Feedback Form */}
                      {showFeedback && (
                        <div className="mb-4 p-3 bg-clawd-bg rounded-lg border border-clawd-border">
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Enter your feedback for revision..."
                            className="w-full bg-clawd-surface border border-clawd-border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-clawd-accent"
                            rows={3}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleAdjust(item)}
                              className="px-3 py-1.5 bg-clawd-accent text-white rounded-lg text-sm hover:bg-clawd-accent/90 transition-colors"
                            >
                              Send Feedback
                            </button>
                            <button
                              onClick={() => {
                                setFeedbackId(null);
                                setFeedbackText('');
                              }}
                              className="px-3 py-1.5 bg-clawd-border text-clawd-text-dim rounded-lg text-sm hover:bg-clawd-border/70 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(item)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <Check size={16} />
                          Approve
                        </button>
                        <button
                          onClick={() => setFeedbackId(showFeedback ? null : item.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          <Edit3 size={16} />
                          Adjust
                        </button>
                        <button
                          onClick={() => handleReject(item)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <X size={16} />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Items (collapsible) */}
      {completedItems.length > 0 && (
        <div className="border-t border-clawd-border bg-clawd-surface/50">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full p-4 flex items-center justify-between hover:bg-clawd-surface/70 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm text-clawd-text-dim">
              <CheckCircle size={16} />
              Completed ({completedItems.length})
            </div>
            {showCompleted ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {showCompleted && (
            <div className="px-6 pb-4 max-h-64 overflow-y-auto space-y-2">
              {completedItems.map((item) => {
                const config = typeConfig[item.type];
                const Icon = config.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-clawd-bg rounded-lg border border-clawd-border opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className={config.color.split(' ')[0]} />
                      <div>
                        <div className="text-sm">{item.title}</div>
                        <div className="text-xs text-clawd-text-dim">{formatTime(item.created)}</div>
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      item.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      item.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {item.status}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rejection Dialog */}
      {rejectDialogItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setRejectDialogItem(null)}>
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Why are you rejecting this?</h3>
            <p className="text-sm text-zinc-400 mb-4">This helps me learn what you don't want.</p>
            <input
              ref={rejectInputRef}
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmReject();
                if (e.key === 'Escape') setRejectDialogItem(null);
              }}
              placeholder="e.g., Too promotional, wrong tone, not relevant..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectDialogItem(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
