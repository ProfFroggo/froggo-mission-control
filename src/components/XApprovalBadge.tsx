import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCircle, XCircle, Clock, MessageSquare, Send, FileText, Zap } from 'lucide-react';
import { approvalApi } from '../lib/api';
import { showToast } from './Toast';
import PromptDialog, { usePromptDialog } from './PromptDialog';

interface PendingApproval {
  id: number | string;
  type: string;
  content?: string;
  payload?: any;
  metadata?: any;
  status: string;
  created_at: number;
  requestedBy?: string;
}

function getTypeInfo(type: string): { label: string; icon: React.ReactNode; color: string } {
  switch (type) {
    case 'tweet':
      return { label: 'Tweet', icon: <Send size={12} />, color: 'text-info' };
    case 'x-reply':
      return { label: 'Reply', icon: <MessageSquare size={12} />, color: 'text-success' };
    case 'research':
      return { label: 'Research', icon: <Zap size={12} />, color: 'text-warning' };
    case 'plan':
      return { label: 'Plan', icon: <FileText size={12} />, color: 'text-review' };
    case 'draft':
      return { label: 'Draft', icon: <FileText size={12} />, color: 'text-info' };
    default:
      return { label: type, icon: <Clock size={12} />, color: 'text-mission-control-text-dim' };
  }
}

function getPreview(item: PendingApproval): string {
  if (item.content) {
    return item.content.length > 100 ? item.content.slice(0, 100) + '...' : item.content;
  }
  if (item.payload?.replyText) return item.payload.replyText;
  if (item.metadata?.title) return item.metadata.title;
  return 'Pending approval';
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function XApprovalBadge() {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [open, setOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { open: promptOpen, config: promptConfig, onSubmit: promptOnSubmit, showPrompt, closePrompt } = usePromptDialog();

  const loadItems = useCallback(async () => {
    try {
      const result = await approvalApi.getAll('pending');
      const all = Array.isArray(result) ? result : [];
      // Filter to social-related types
      const social = all.filter((a: any) =>
        ['tweet', 'x-reply', 'research', 'plan', 'draft'].includes(a.type)
      );
      setItems(social as PendingApproval[]);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    loadItems();
    const interval = setInterval(loadItems, 30_000);
    return () => clearInterval(interval);
  }, [loadItems]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleApprove = async (id: string | number) => {
    setActionLoading(String(id));
    try {
      await approvalApi.respond(String(id), 'approved', undefined, undefined);
      showToast('success', 'Approved');
      await loadItems();
    } catch {
      showToast('error', 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = (id: string | number) => {
    showPrompt({
      title: 'Reject',
      message: 'Rejection reason (optional):',
      placeholder: 'Reason...',
      confirmLabel: 'Reject',
    }, async (reason: string) => {
      setActionLoading(String(id));
      try {
        await approvalApi.respond(String(id), 'rejected', reason || undefined, undefined);
        showToast('success', 'Rejected');
        await loadItems();
      } catch {
        showToast('error', 'Failed to reject');
      } finally {
        setActionLoading(null);
      }
    });
  };

  const count = items.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <PromptDialog
        open={promptOpen}
        onClose={closePrompt}
        onSubmit={promptOnSubmit}
        {...promptConfig}
      />

      {/* Badge button */}
      <button
        onClick={() => setOpen(!open)}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
          open
            ? 'bg-warning-subtle text-warning font-medium'
            : count > 0
            ? 'text-warning hover:bg-warning-subtle/50'
            : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg-alt'
        }`}
        title={`${count} pending approvals`}
      >
        <Bell size={15} />
        {count > 0 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-warning text-white rounded-full">
            {count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-lg overflow-hidden z-50">
          {/* Dropdown header */}
          <div className="px-4 py-3 border-b border-mission-control-border">
            <h3 className="text-sm font-semibold text-mission-control-text">Pending Approvals</h3>
          </div>

          {/* Items */}
          <div className="max-h-[480px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle size={32} className="text-success mb-2" />
                <p className="text-sm font-medium text-mission-control-text">All clear</p>
                <p className="text-xs text-mission-control-text-dim mt-1">No pending approvals</p>
              </div>
            ) : (
              <div className="divide-y divide-mission-control-border">
                {items.map((item) => {
                  const info = getTypeInfo(item.type);
                  const isLoading = actionLoading === String(item.id);

                  return (
                    <div key={item.id} className="px-4 py-3 hover:bg-mission-control-bg-alt/50 transition-colors">
                      {/* Type + time */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`flex items-center gap-1 text-xs font-medium ${info.color}`}>
                          {info.icon}
                          {info.label}
                        </span>
                        <span className="text-[10px] text-mission-control-text-dim">
                          {timeAgo(item.created_at)}
                        </span>
                      </div>

                      {/* Preview */}
                      <p className="text-xs text-mission-control-text line-clamp-2 mb-2">
                        {getPreview(item)}
                      </p>

                      {/* Actions */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleApprove(item.id)}
                          disabled={isLoading}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-success/10 text-success hover:bg-success/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <CheckCircle size={12} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(item.id)}
                          disabled={isLoading}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-error/10 text-error hover:bg-error/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle size={12} />
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
