// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, memo, useCallback } from 'react';
import { ShieldQuestion, Check, Lock, X, MessageSquare } from 'lucide-react';
import { Button, TextField, Flex } from '@radix-ui/themes';

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

const ToolPermissionCard = memo(function ToolPermissionCard({ request, onResolved }: ToolPermissionCardProps) {
  const [loading, setLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [resolved, setResolved] = useState<'granted' | 'granted_session' | 'rejected' | null>(null);

  const { name, server } = formatToolName(request.toolName);

  const resolve = useCallback(async (action: 'grant' | 'grant_session' | 'reject' | 'reject_reason', reason?: string) => {
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
    } catch (err) {
      console.warn('[ToolPermissionCard] Non-critical:', err);
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [request, onResolved]);

  if (resolved) {
    return (
      <Flex align="center" gap="2" className="px-3 py-2 rounded-xl border border-mission-control-border bg-mission-control-surface text-xs text-mission-control-text-dim">
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
      </Flex>
    );
  }

  return (
    <div className="rounded-xl border border-info/30 bg-mission-control-surface p-3 space-y-2.5 text-sm hover:border-mission-control-accent/20 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <ShieldQuestion size={16} className="text-info mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-mission-control-text">Tool Permission Required</span>
            {server && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/30 font-mono">{server}</span>
            )}
          </div>
          <p className="text-xs text-mission-control-text-dim mt-0.5">
            <span className="font-mono text-mission-control-text">{name}</span>
            {request.reason && <> — {request.reason}</>}
          </p>
        </div>
      </div>

      {/* Reject with reason input */}
      {showRejectInput && (
        <Flex gap="2" align="center">
          <TextField.Root
            className="flex-1"
            size="1"
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') resolve('reject_reason', rejectReason); }}
            autoFocus
          />
          <Button
            onClick={() => resolve('reject_reason', rejectReason)}
            disabled={loading}
            variant="solid"
            color="red"
            size="1"
          >
            Send
          </Button>
          <button
            type="button"
            onClick={() => setShowRejectInput(false)}
            className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={12} />
          </button>
        </Flex>
      )}

      {/* Action buttons */}
      {!showRejectInput && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => resolve('grant')}
            disabled={loading}
            variant="solid"
            color="green"
            size="1"
          >
            <Check size={12} />
            Grant
          </Button>
          <Button
            onClick={() => resolve('grant_session')}
            disabled={loading}
            variant="solid"
            color="blue"
            size="1"
          >
            <Check size={12} />
            Grant for Session
          </Button>
          <Button
            onClick={() => resolve('reject')}
            disabled={loading}
            variant="outline"
            color="red"
            size="1"
          >
            <X size={12} />
            Reject
          </Button>
          <button
            type="button"
            onClick={() => setShowRejectInput(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <MessageSquare size={12} />
            Reject with Reason
          </button>
        </div>
      )}
    </div>
  );
});

export default ToolPermissionCard;
