import { useState, useEffect, useRef } from 'react';
import { Inbox, Check, X, XCircle, MessageSquare, Send, Mail, Calendar, Bot, ChevronDown, ChevronUp, Edit3, Clock, Filter, Trash2, CheckCircle, RefreshCw, Plus, AlertTriangle, ShieldAlert, CalendarClock } from 'lucide-react';
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
  
  // Schedule modal state
  const [scheduleModal, setScheduleModal] = useState<{
    item: InboxItem;
    showDatePicker: boolean;
    date: string;
    time: string;
  } | null>(null);

  const loadInbox = async () => {
    setLoading(true);
    try {
      // Check if running in Electron with clawdbot API
      if (!window.clawdbot?.inbox?.list) {
        console.warn('[InboxPanel] clawdbot.inbox not available (web mode)');
        setItems([]);
        return;
      }
      
      // Load inbox items
      const result = await window.clawdbot.inbox.list();
      let allItems = result.success ? (result.items || []) : [];
      
      // Also load tasks in "review" status
      try {
        const tasksResult = await window.clawdbot.tasks.list('review');
        if (tasksResult?.success && tasksResult.tasks?.length > 0) {
          // Convert tasks to inbox item format
          const taskItems = tasksResult.tasks.map((t: any) => ({
            id: `task-review-${t.id}`, // Prefix to distinguish from inbox items
            type: 'task' as const,
            title: `✅ Review: ${t.title}`,
            content: t.description || t.last_agent_update || 'Task completed, ready for review',
            context: `Project: ${t.project || 'General'}`,
            status: 'pending',
            source_channel: 'kanban',
            created: new Date(t.created_at || Date.now()).toISOString(),
            metadata: JSON.stringify({ taskId: t.id, project: t.project }),
            isTask: true, // Flag to handle differently
          }));
          allItems = [...taskItems, ...allItems];
        }
      } catch (e) {
        console.warn('[InboxPanel] Failed to load review tasks:', e);
      }
      
      console.log('[Inbox] loadInbox setting items:', allItems.length, 'pending:', allItems.filter(i => i.status === 'pending').length);
      setItems(allItems);
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
    // For tweets, show schedule modal
    if (item.type === 'tweet') {
      // Set default time to next hour rounded
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().slice(0, 5);
      
      setScheduleModal({
        item,
        showDatePicker: false,
        date: dateStr,
        time: timeStr,
      });
      return;
    }
    
    // For emails: 2-stage workflow
    if (item.type === 'email') {
      // Parse metadata to check if this is Stage 2 (ready to send)
      let metadata: any = {};
      if (item.metadata) {
        try {
          metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        } catch {}
      }
      
      // Stage 2: Email is ready to send - show Send/Schedule modal
      if (metadata.readyToSend) {
        const now = new Date();
        now.setHours(now.getHours() + 1, 0, 0, 0);
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().slice(0, 5);
        
        setScheduleModal({
          item,
          showDatePicker: false,
          date: dateStr,
          time: timeStr,
        });
        return;
      }
      
      // Stage 1: Content approved - create "Send Email to [recipient]" item
      const recipient = metadata.recipient || metadata.to || 'recipient';
      const subject = metadata.subject || 'No Subject';
      const account = metadata.account || '';
      
      // Create Stage 2 inbox item
      const stage2Item = {
        type: 'email',
        title: `📤 Send Email to ${recipient}`,
        content: item.content,
        context: `Subject: ${subject}${account ? ` | From: ${account}` : ''}\n\nApproved content ready to send.`,
        channel: 'email-stage2',
        metadata: JSON.stringify({
          ...metadata,
          readyToSend: true,
          originalInboxId: item.id,
          recipient,
          subject,
          account,
        }),
      };
      
      try {
        // Add Stage 2 item to inbox
        const result = await window.clawdbot.inbox.addWithMetadata(stage2Item);
        
        if (result.success) {
          // Mark original as approved (Stage 1 complete)
          setItems(prev => prev.filter(i => i.id !== item.id));
          await window.clawdbot.inbox.update(item.id, { status: 'approved' });
          showToast('success', 'Email content approved', `Ready to send to ${recipient}`);
        } else {
          showToast('error', 'Failed to create send task', result.error);
        }
      } catch (error: any) {
        console.error('[Inbox] Stage 1 email approval error:', error);
        showToast('error', 'Approval failed', error.message);
      }
      return;
    }
    
    // For other types, execute immediately (existing behavior)
    executeApproval(item);
  };
  
  const executeApproval = async (item: InboxItem) => {
    // OPTIMISTIC UI: Remove item immediately for instant feedback
    setItems(prev => prev.filter(i => i.id !== item.id));
    showToast('success', 'Approved ✓', item.title);
    
    // Then sync in background
    try {
      // Check if this is a task review (not a regular inbox item)
      if ((item as any).isTask && item.metadata) {
        // This is a task in review status - mark it as done
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        if (meta.taskId) {
          await window.clawdbot.tasks.update(meta.taskId, { status: 'done' });
          console.log('[Inbox] Task approved and marked done:', meta.taskId);
          return;
        }
      }
      
      // Regular inbox item - update and create execution task
      await window.clawdbot.inbox.update(item.id, { status: 'approved' });
      
      // Create task as IN-PROGRESS so watcher picks it up and executes
      const projectMap: Record<string, string> = {
        'tweet': 'X',
        'reply': 'X',
        'email': 'Email',
        'message': 'Message',
        'whatsapp': 'Message',
        'telegram': 'Message',
      };
      
      // Parse metadata safely
      let metadata = {};
      if (item.metadata) {
        try {
          metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        } catch (e) {
          console.warn('[Inbox] Failed to parse metadata:', e);
        }
      }
      
      const taskData = {
        id: `task-${Date.now()}`,
        title: item.title,
        description: item.content,
        status: 'in-progress',
        project: projectMap[item.type] || 'Approved',
        assignedTo: 'main',
        metadata,
      };
      
      const result = await window.clawdbot.tasks.sync(taskData);
      if (!result.success) {
        console.error('[Inbox] Task creation failed:', result.error);
      } else {
        // SAFEGUARD: Verify the status is correct after a brief delay
        setTimeout(async () => {
          try {
            await window.clawdbot.tasks.update(taskData.id, { status: 'in-progress' });
            console.log('[Inbox] Status verified for task:', taskData.id);
          } catch (e) {
            console.warn('[Inbox] Status verify failed:', e);
          }
        }, 500);
      }
    } catch (error) {
      // Revert on error
      console.error('[Inbox] Error in handleApprove:', error);
      showToast('error', 'Approval failed', 'Reverting...');
      loadInbox(); // Reload to revert
    }
  };

  const handleReject = (item: InboxItem, reason?: string) => {
    if (reason) {
      // Direct reject with provided reason (for bulk operations)
      directReject(item, reason);
    } else {
      // Open rejection dialog for manual reason
      setRejectDialogItem(item);
      setRejectReason('');
      setTimeout(() => rejectInputRef.current?.focus(), 100);
    }
  };

  const directReject = async (item: InboxItem, reason: string) => {
    // OPTIMISTIC UI: Remove immediately
    setItems(prev => prev.filter(i => i.id !== item.id));
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
    } catch (error) {
      console.error('Reject error:', error);
    }
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
      // Check if this is a task review item (has string ID like "task-review-XXX")
      const isTaskItem = (item as any).isTask || String(item.id).startsWith('task-review-');
      
      if (isTaskItem && item.metadata) {
        // For task items, update the task status back to in-progress with feedback
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        if (meta.taskId) {
          await window.clawdbot.tasks.update(meta.taskId, { status: 'in-progress' });
          // Log activity with rejection reason
          gateway.sendToMain(`[TASK_REVISION] Task "${item.title}" needs revision.\nReason: ${reason}`);
        }
      } else {
        // Regular inbox item
        await window.clawdbot.inbox.update(item.id, { 
          status: 'rejected',
          feedback: reason 
        });
      }
      
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
    
    console.log('[Inbox] handleAdjust called for item:', item.id, item.title, 'isTask:', (item as any).isTask);
    
    // OPTIMISTIC UI: Remove from pending list immediately
    setItems(prev => prev.filter(i => i.id !== item.id));
    showToast('info', 'Revision requested', 'Creating task...');
    
    // Check if this is a task review item
    const isTaskItem = (item as any).isTask || String(item.id).startsWith('task-review-');
    console.log('[Inbox] isTaskItem:', isTaskItem, 'metadata:', item.metadata);
    
    if (isTaskItem && item.metadata) {
      // For task items, update the task status back to in-progress with feedback
      const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
      if (meta.taskId) {
        await window.clawdbot.tasks.update(meta.taskId, { status: 'in-progress' });
        // Send feedback to agent
        gateway.sendToMain(`[TASK_FEEDBACK] Task "${item.title}" needs revision.\nFeedback: ${feedbackText}`);
        showToast('success', 'Feedback sent', 'Task moved back to In Progress');
      }
    } else {
      // Regular inbox item - update status and create revision task
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
        project: item.type === 'tweet' || item.type === 'reply' ? 'X' : 
                 item.type === 'email' ? 'Email' : 'Revisions',
        assignedTo: 'main',
      };
      
      const result = await window.clawdbot.tasks.sync(taskData);
      if (result?.success) {
        showToast('success', 'Revision task created', 'Check Tasks tab');
        await window.clawdbot.tasks.update?.(taskData.id, { status: 'in-progress' });
      } else {
        console.error('[Inbox] Task creation failed:', result);
        showToast('error', 'Revision task failed', result?.error || 'Unknown error');
      }
      
      console.log('[Inbox] Created revision task:', taskData.id);
    }
    
    setFeedbackId(null);
    setFeedbackText('');
    // Don't reload - already removed optimistically
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

      {/* Schedule Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setScheduleModal(null)}>
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${typeConfig[scheduleModal.item.type].color}`}>
                {scheduleModal.item.type === 'tweet' ? <Send size={20} /> : <Mail size={20} />}
              </div>
              <div>
                <h3 className="text-lg font-semibold">Send or Schedule?</h3>
                <p className="text-sm text-zinc-400">{scheduleModal.item.title}</p>
              </div>
            </div>

            {/* Content Preview */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 mb-6 max-h-32 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono text-zinc-300">
                {scheduleModal.item.content}
              </pre>
            </div>

            {/* Date/Time Picker (shown when Schedule is clicked) */}
            {scheduleModal.showDatePicker && (
              <div className="mb-6 p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarClock size={18} className="text-clawd-accent" />
                  <span className="text-sm font-medium">Schedule for:</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-zinc-400 mb-1 block">Date</label>
                    <input
                      type="date"
                      value={scheduleModal.date}
                      onChange={(e) => setScheduleModal({ ...scheduleModal, date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clawd-accent"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-zinc-400 mb-1 block">Time</label>
                    <input
                      type="time"
                      value={scheduleModal.time}
                      onChange={(e) => setScheduleModal({ ...scheduleModal, time: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clawd-accent"
                    />
                  </div>
                </div>
                {/* Friendly time display */}
                {scheduleModal.date && scheduleModal.time && (
                  <p className="text-xs text-zinc-400 mt-2">
                    Will be sent on {new Date(`${scheduleModal.date}T${scheduleModal.time}`).toLocaleString(undefined, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!scheduleModal.showDatePicker ? (
                <>
                  {/* Initial state: Send Now / Schedule */}
                  <button
                    onClick={async () => {
                      const item = scheduleModal.item;
                      setScheduleModal(null);
                      
                      // For emails (Stage 2), send via email:send IPC
                      if (item.type === 'email') {
                        let metadata: any = {};
                        if (item.metadata) {
                          try {
                            metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
                          } catch {}
                        }
                        
                        const recipient = metadata.recipient || metadata.to;
                        const subject = metadata.subject || 'No Subject';
                        const account = metadata.account;
                        
                        if (!recipient) {
                          showToast('error', 'No recipient', 'Email needs a recipient address');
                          return;
                        }
                        
                        // Optimistic UI
                        setItems(prev => prev.filter(i => i.id !== item.id));
                        showToast('info', 'Sending email...', `To: ${recipient}`);
                        
                        try {
                          const result = await window.clawdbot.email.send({
                            to: recipient,
                            subject,
                            body: item.content,
                            account,
                          });
                          
                          if (result.success) {
                            await window.clawdbot.inbox.update(item.id, { status: 'approved' });
                            showToast('success', 'Email sent ✓', `To: ${recipient}`);
                          } else {
                            showToast('error', 'Email failed', result.error);
                            loadInbox(); // Revert
                          }
                        } catch (e: any) {
                          showToast('error', 'Send error', e.message);
                          loadInbox();
                        }
                        return;
                      }
                      
                      // For tweets, use existing executeApproval
                      executeApproval(item);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                  >
                    <Send size={18} />
                    Send Now
                  </button>
                  <button
                    onClick={() => setScheduleModal({ ...scheduleModal, showDatePicker: true })}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 transition-colors font-medium"
                  >
                    <Calendar size={18} />
                    Schedule
                  </button>
                </>
              ) : (
                <>
                  {/* Schedule picker state: Back / Confirm */}
                  <button
                    onClick={() => setScheduleModal({ ...scheduleModal, showDatePicker: false })}
                    className="px-4 py-3 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      if (!scheduleModal.date || !scheduleModal.time) {
                        showToast('error', 'Please select date and time');
                        return;
                      }
                      
                      const scheduledFor = `${scheduleModal.date}T${scheduleModal.time}:00`;
                      const item = scheduleModal.item;
                      
                      // Parse metadata for email details
                      let metadata: any = {};
                      if (item.metadata) {
                        try {
                          metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
                        } catch {}
                      }
                      
                      // Add to schedule
                      try {
                        const result = await window.clawdbot.schedule.add({
                          type: item.type,
                          content: item.content,
                          scheduledFor,
                          metadata: {
                            ...metadata,
                            title: item.title,
                            originalInboxId: item.id,
                          },
                        });
                        
                        if (result.success) {
                          // Remove from inbox
                          setItems(prev => prev.filter(i => i.id !== item.id));
                          await window.clawdbot.inbox.update(item.id, { status: 'scheduled' });
                          
                          const friendlyTime = new Date(scheduledFor).toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          });
                          showToast('success', `Scheduled for ${friendlyTime}`, item.title);
                        } else {
                          showToast('error', 'Failed to schedule', (result as any).error || 'Unknown error');
                        }
                      } catch (e: any) {
                        showToast('error', 'Schedule error', e.message);
                      }
                      
                      setScheduleModal(null);
                    }}
                    disabled={!scheduleModal.date || !scheduleModal.time}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CalendarClock size={18} />
                    Confirm Schedule
                  </button>
                </>
              )}
            </div>

            {/* Cancel link */}
            <button
              onClick={() => setScheduleModal(null)}
              className="w-full mt-3 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
