// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState } from 'react';
import { ShieldQuestion, Check, Lock, X, MessageSquare } from 'lucide-react';

export interface ToolPermissionRequest {
  approvalId: string;
  toolName: string;
  reason: string;
  agentId: string;
  sessionKey?: string;
}

interface ToolPermissionCardProps {
  request: ToolPermissionRequest;
  onResolved: (approvalId: string, granted: boolean) => void;
}

/** Format mcp__mission-control-db__image_generate → image_generate (mission-control-db) */
function formatToolName(raw: string): { name: string; server: string } {
  const parts = raw.split('__');
  if (parts.length >= 3) {
    return { name: parts.slice(2).join('__').replace(/_/g, ' '), server: parts[1] };
  }
  return { name: raw.replace(/_/g, ' '), server: '' };
}

export default function ToolPermissionCard({ request, onResolved }: ToolPermissionCardProps) {
  const [loading, setLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [resolved, setResolved] = useState<'granted' | 'granted_session' | 'rejected' | null>(null);

  const { name, server } = formatToolName(request.toolName);

  const resolve = async (action: 'grant' | 'grant_session' | 'reject' | 'reject_reason', reason?: string) => {
    setLoading(true);
    try {
      await fetch(`/api/agents/${request.agentId}/tools/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: request.toolName,
          approvalId: request.approvalId,
          action,
          reason,
          sessionKey: request.sessionKey,
        }),
      });
      const granted = action === 'grant' || action === 'grant_session';
      setResolved(action === 'grant' ? 'granted' : action === 'grant_session' ? 'granted_session' : 'rejected');
      onResolved(request.approvalId, granted);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  };

  if (resolved) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-mission-control-border bg-mission-control-surface/60 text-xs text-mission-control-text-dim">
        {resolved === 'rejected' ? (
          <>
            <Lock size={13} className="text-error shrink-0" />
            <span className="font-mono opacity-70">{name}</span>
            <span>— access denied</span>
          </>
        ) : (
          <>
            <Check size={13} className="text-success shrink-0" />
            <span className="font-mono opacity-70">{name}</span>
            <span>— {resolved === 'granted' ? 'permanently granted' : 'granted for this session'}</span>
            <span className="ml-auto opacity-60">Resend your message to continue</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-3 space-y-2.5 text-sm">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <ShieldQuestion size={16} className="text-info mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-mission-control-text">Tool Permission Required</span>
            {server && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-info/10 text-info font-mono">{server}</span>
            )}
          </div>
          <p className="text-mission-control-text-dim mt-0.5">
            <span className="font-mono text-mission-control-text">{name}</span>
            {request.reason && <> — {request.reason}</>}
          </p>
        </div>
      </div>

      {/* Reject with reason input */}
      {showRejectInput && (
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs border border-mission-control-border bg-mission-control-bg focus:outline-none focus:ring-1 focus:ring-error/50"
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') resolve('reject_reason', rejectReason); }}
            autoFocus
          />
          <button
            onClick={() => resolve('reject_reason', rejectReason)}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-error text-white hover:bg-error/80 transition-colors disabled:opacity-50"
          >
            Send
          </button>
          <button
            onClick={() => setShowRejectInput(false)}
            className="p-1.5 rounded-lg hover:bg-mission-control-border transition-colors text-mission-control-text-dim"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!showRejectInput && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => resolve('grant')}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success text-white hover:bg-success/80 transition-colors disabled:opacity-50"
          >
            <Check size={12} />
            Grant
          </button>
          <button
            onClick={() => resolve('grant_session')}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-info text-white hover:bg-info/80 transition-colors disabled:opacity-50"
          >
            <Check size={12} />
            Grant for Session
          </button>
          <button
            onClick={() => resolve('reject')}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-error/40 text-error hover:bg-error/10 transition-colors disabled:opacity-50"
          >
            <X size={12} />
            Reject
          </button>
          <button
            onClick={() => setShowRejectInput(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border transition-colors disabled:opacity-50"
          >
            <MessageSquare size={12} />
            Reject with Reason
          </button>
        </div>
      )}
    </div>
  );
}
