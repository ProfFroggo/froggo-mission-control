import { useState, useEffect } from 'react';
import { Inbox, Check, X, MessageSquare, Send, Mail, Calendar, Bot, ChevronDown, ChevronUp, Edit3, Clock, Filter, Trash2, CheckCircle, RefreshCw } from 'lucide-react';
import { useStore, ApprovalItem, ApprovalType, ApprovalStatus } from '../store/store';
import { gateway } from '../lib/gateway';

const typeConfig: Record<ApprovalType, { icon: any; color: string; label: string }> = {
  tweet: { icon: Send, color: 'text-sky-400 bg-sky-500/20', label: 'Tweet' },
  reply: { icon: MessageSquare, color: 'text-blue-400 bg-blue-500/20', label: 'Reply' },
  email: { icon: Mail, color: 'text-green-400 bg-green-500/20', label: 'Email' },
  message: { icon: MessageSquare, color: 'text-purple-400 bg-purple-500/20', label: 'Message' },
  task: { icon: Bot, color: 'text-yellow-400 bg-yellow-500/20', label: 'Task' },
  action: { icon: Calendar, color: 'text-orange-400 bg-orange-500/20', label: 'Action' },
};

export default function InboxPanel() {
  const { approvals, approveItem, rejectItem, adjustItem, clearCompletedApprovals, addActivity } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [filter, setFilter] = useState<ApprovalType | 'all'>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  const pendingItems = approvals.filter(i => i.status === 'pending');
  const completedItems = approvals.filter(i => i.status !== 'pending');
  const filteredPending = filter === 'all' ? pendingItems : pendingItems.filter(i => i.type === filter);

  const handleApprove = (item: ApprovalItem) => {
    approveItem(item.id);
    addActivity({ type: 'task', message: `✅ Approved: ${item.title}`, timestamp: Date.now() });
  };

  const handleReject = (item: ApprovalItem) => {
    rejectItem(item.id);
    addActivity({ type: 'task', message: `❌ Rejected: ${item.title}`, timestamp: Date.now() });
  };

  const handleAdjust = (item: ApprovalItem) => {
    if (!feedbackText.trim()) return;
    adjustItem(item.id, feedbackText);
    addActivity({ type: 'task', message: `📝 Feedback: ${item.title}`, timestamp: Date.now() });
    
    // Send feedback to gateway for revision
    gateway.sendChat(`[FEEDBACK] Revise this ${item.type} "${item.title}":\n\nOriginal:\n${item.content}\n\nFeedback:\n${feedbackText}`);
    
    setFeedbackId(null);
    setFeedbackText('');
  };

  const handleApproveAll = () => {
    pendingItems.forEach(item => handleApprove(item));
  };

  const formatTime = (ts: number) => {
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
            {completedItems.length > 0 && (
              <button
                onClick={clearCompletedApprovals}
                className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
              >
                <Trash2 size={14} />
                Clear Done
              </button>
            )}
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
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'all' ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            All ({pendingItems.length})
          </button>
          {Object.entries(typeConfig).map(([type, config]) => {
            const count = pendingItems.filter(i => i.type === type).length;
            if (count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setFilter(type as ApprovalType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === type ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                <config.icon size={14} />
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto">
        {filteredPending.length === 0 ? (
          <div className="p-12 text-center text-clawd-text-dim">
            <Inbox size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">All clear!</p>
            <p className="text-sm">No pending approvals</p>
            <p className="text-xs mt-4 max-w-sm mx-auto">
              When I draft tweets, emails, or actions, they'll appear here for your review before I execute them.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-clawd-border">
            {filteredPending.map((item) => {
              const config = typeConfig[item.type];
              const isExpanded = expandedId === item.id;
              const showingFeedback = feedbackId === item.id;

              return (
                <div key={item.id} className="p-4 hover:bg-clawd-surface/50 transition-colors">
                  {/* Header Row */}
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <config.icon size={18} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{item.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      
                      {item.metadata && (
                        <div className="flex flex-wrap gap-2 text-xs text-clawd-text-dim mb-2">
                          {item.metadata.platform && <span>📍 {item.metadata.platform}</span>}
                          {item.metadata.to && <span>→ {item.metadata.to}</span>}
                          {item.metadata.scheduledFor && <span>🕐 {item.metadata.scheduledFor}</span>}
                        </div>
                      )}

                      {item.context && (
                        <p className="text-sm text-clawd-text-dim mb-2">{item.context}</p>
                      )}

                      {/* Preview/Content */}
                      <div 
                        className={`text-sm bg-clawd-bg rounded-lg p-3 whitespace-pre-wrap ${
                          isExpanded ? '' : 'line-clamp-3'
                        }`}
                      >
                        {item.metadata?.replyTo && (
                          <div className="text-xs text-clawd-text-dim mb-2 pb-2 border-b border-clawd-border">
                            ↩️ {item.metadata.replyTo}
                          </div>
                        )}
                        {item.content}
                      </div>

                      {item.content.length > 200 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="text-xs text-clawd-accent mt-1 flex items-center gap-1"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}

                      {/* Feedback Input */}
                      {showingFeedback && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="What should I change?"
                            className="w-full p-3 bg-clawd-bg border border-clawd-border rounded-lg resize-none focus:outline-none focus:border-clawd-accent"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAdjust(item)}
                              disabled={!feedbackText.trim()}
                              className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim disabled:opacity-50"
                            >
                              Send Feedback
                            </button>
                            <button
                              onClick={() => { setFeedbackId(null); setFeedbackText(''); }}
                              className="px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/80"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {!showingFeedback && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleApprove(item)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => setFeedbackId(item.id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-clawd-border text-clawd-text text-sm rounded-lg hover:bg-clawd-border/80 transition-colors"
                          >
                            <Edit3 size={14} /> Adjust
                          </button>
                          <button
                            onClick={() => handleReject(item)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30 transition-colors"
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </div>

                    <span className="text-xs text-clawd-text-dim whitespace-nowrap">
                      {formatTime(item.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed Section */}
        {completedItems.length > 0 && (
          <div className="border-t border-clawd-border">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="w-full p-4 flex items-center justify-between text-clawd-text-dim hover:bg-clawd-surface/50"
            >
              <span className="text-sm">Completed ({completedItems.length})</span>
              {showCompleted ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {showCompleted && (
              <div className="divide-y divide-clawd-border opacity-60">
                {completedItems.slice(0, 20).map((item) => {
                  const config = typeConfig[item.type];
                  return (
                    <div key={item.id} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <config.icon size={16} />
                        </div>
                        <span className="flex-1 truncate">{item.title}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          item.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-clawd-text-dim">{formatTime(item.updatedAt || item.createdAt)}</span>
                      </div>
                      {item.feedback && (
                        <p className="text-sm text-clawd-text-dim mt-2 ml-11">
                          💬 {item.feedback}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
