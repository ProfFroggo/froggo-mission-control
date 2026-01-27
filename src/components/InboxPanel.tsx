import { useState, useEffect, useRef } from 'react';
import { Inbox, Check, X, MessageSquare, Send, Mail, Calendar, Bot, ChevronDown, ChevronUp, Edit3, Clock, Filter, Trash2, CheckCircle, RefreshCw } from 'lucide-react';
import { gateway } from '../lib/gateway';

type ApprovalType = 'tweet' | 'reply' | 'email' | 'message' | 'task' | 'action';

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

  const loadInbox = async () => {
    setLoading(true);
    try {
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

  const pendingItems = items.filter(i => i.status === 'pending');
  const completedItems = items.filter(i => i.status !== 'pending');
  const filteredPending = filter === 'all' ? pendingItems : pendingItems.filter(i => i.type === filter);

  const handleApprove = async (item: InboxItem) => {
    console.log('=== APPROVE CLICKED ===');
    console.log('[Inbox] Approving item:', item);
    
    try {
      await window.clawdbot.inbox.update(item.id, { status: 'approved' });
      console.log('[Inbox] Inbox updated');
      
      // Create task in TODO - Kevin will prioritize and move to In Progress when ready
      const taskData = {
        id: `task-${Date.now()}`,
        title: item.title,
        description: item.content,
        status: 'todo',
        project: item.type === 'tweet' || item.type === 'reply' ? 'X/Twitter' : 'Approved',
        assignedTo: 'main',
      };
      
      console.log('[Inbox] Creating task:', taskData);
      const result = await window.clawdbot.tasks.sync(taskData);
      console.log('[Inbox] Task sync result:', result);
      
      if (!result.success) {
        console.error('[Inbox] Failed to create task:', result.error);
        alert(`Failed to create task: ${result.error}`);
      } else {
        console.log('[Inbox] Task created successfully');
      }
      
      loadInbox();
    } catch (error) {
      console.error('[Inbox] Error in handleApprove:', error);
      alert(`Error: ${error}`);
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
    
    await window.clawdbot.inbox.update(rejectDialogItem.id, { 
      status: 'rejected',
      feedback: reason 
    });
    
    // Log rejection with reason so I can learn
    await window.clawdbot.rejections.log({
      type: rejectDialogItem.type,
      title: rejectDialogItem.title,
      content: rejectDialogItem.content,
      reason: reason,
    });
    
    // Notify Froggo about the rejection lesson (only if reason provided)
    if (reason !== "No reason provided") {
      gateway.sendToMain(`[REJECTION_LESSON] ${rejectDialogItem.type}: "${rejectDialogItem.title}"\nReason: ${reason}\n\nLearn from this and avoid similar mistakes.`);
    }
    
    setRejectDialogItem(null);
    setRejectReason('');
    loadInbox();
  };

  const handleAdjust = async (item: InboxItem) => {
    if (!feedbackText.trim()) return;
    
    await window.clawdbot.inbox.update(item.id, { 
      status: 'adjusted', 
      feedback: feedbackText 
    });
    
    // Send feedback to Froggo in main session for revision
    gateway.sendToMain(`[FEEDBACK] Revise this ${item.type} "${item.title}":\n\nOriginal:\n${item.content}\n\nFeedback:\n${feedbackText}`);
    
    setFeedbackId(null);
    setFeedbackText('');
    loadInbox();
  };

  const handleApproveAll = () => {
    pendingItems.forEach(item => handleApprove(item));
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
            {pendingItems.length > 1 && (
              <button
                onClick={handleApproveAll}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
              >
                <CheckCircle size={16} />
                Approve All
              </button>
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
        {filteredPending.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim">
            <Inbox size={64} className="opacity-20 mb-4" />
            <p className="text-lg">No pending approvals</p>
            <p className="text-sm">Items will appear here when they need your review</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {filteredPending.map((item) => {
              const config = typeConfig[item.type];
              const Icon = config.icon;
              const isExpanded = expandedId === item.id;
              const showFeedback = feedbackId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-clawd-surface border border-clawd-border rounded-xl overflow-hidden hover:border-clawd-accent/30 transition-colors"
                >
                  {/* Header */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${config.color} flex-shrink-0`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium px-2 py-0.5 bg-clawd-border rounded">
                            {config.label}
                          </span>
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
