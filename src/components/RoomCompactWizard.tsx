// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Compact wizard — step-by-step progress overlay for room context compaction.
// Shows per-agent progress with avatars, a global progress bar, and streaming preview.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Check, Loader2, AlertCircle, FileText, Archive } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import AgentAvatar from './AgentAvatar';
import MarkdownMessage from './MarkdownMessage';
import { useChatRoomStore, type RoomMessage } from '../store/chatRoomStore';
import { useArtifactStore } from '../store/artifactStore';
import { useStore } from '../store/store';

type AgentStatus = 'pending' | 'active' | 'done' | 'error';

interface AgentProgress {
  agentId: string;
  status: AgentStatus;
  messageCount: number;
  text: string;
  artifactCount: number;
  error?: string;
}

interface RoomCompactWizardProps {
  roomId: string;
  open: boolean;
  onClose: () => void;
}

type WizardPhase = 'confirm' | 'compacting' | 'done' | 'error';

/** Avatar that handles both agents and the human user */
function ParticipantAvatar({ id, size = 'sm' }: { id: string; size?: 'xs' | 'sm' | 'md' }) {
  if (id === 'user') {
    const px = size === 'xs' ? 'w-6 h-6 text-[10px]' : size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';
    return (
      <div className={`${px} rounded-full bg-mission-control-accent flex items-center justify-center text-white font-semibold flex-shrink-0`}>
        K
      </div>
    );
  }
  return <AgentAvatar agentId={id} size={size} />;
}

export default function RoomCompactWizard({ roomId, open, onClose }: RoomCompactWizardProps) {
  const { rooms, addMessage, updateMessage, loadMessages } = useChatRoomStore();
  const agents = useStore(s => s.agents);
  const room = rooms.find(r => r.id === roomId);

  const [phase, setPhase] = useState<WizardPhase>('confirm');
  const [agentProgress, setAgentProgress] = useState<AgentProgress[]>([]);
  const [currentAgentIdx, setCurrentAgentIdx] = useState(-1);
  const [archivedCount, setArchivedCount] = useState(0);
  const [summaryCount, setSummaryCount] = useState(0);
  const [globalError, setGlobalError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentName = useCallback(
    (id: string) => agents.find(a => a.id === id)?.name || id,
    [agents]
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setAgentProgress([]);
      setCurrentAgentIdx(-1);
      setArchivedCount(0);
      setSummaryCount(0);
      setGlobalError('');
    }
  }, [open]);

  // Auto-scroll preview to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [agentProgress]);

  const startCompact = useCallback(async () => {
    if (!room) return;
    setPhase('compacting');

    // Collect artifacts from store
    const sessionArtifacts = useArtifactStore.getState().artifacts
      .filter(a => a.sessionId === roomId)
      .map(a => ({ title: a.title, type: a.type, content: a.content, messageId: a.messageId, metadata: a.metadata }));

    try {
      const res = await fetch(`/api/chat-rooms/${roomId}/compact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifacts: sessionArtifacts }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setGlobalError(err.error || res.statusText);
        setPhase('error');
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.startsWith('data: ') ? part.slice(6) : part;
          if (line === '[DONE]') break;
          try {
            const ev = JSON.parse(line);

            if (ev.type === 'agent_start') {
              setAgentProgress(prev => [
                ...prev,
                {
                  agentId: ev.agentId,
                  status: 'active',
                  messageCount: ev.messageCount,
                  text: '',
                  artifactCount: 0,
                },
              ]);
              setCurrentAgentIdx(prev => prev + 1);
            } else if (ev.type === 'text_delta' && ev.agentId) {
              setAgentProgress(prev =>
                prev.map(a =>
                  a.agentId === ev.agentId
                    ? { ...a, text: a.text + ev.text }
                    : a
                )
              );
            } else if (ev.type === 'agent_done') {
              setAgentProgress(prev =>
                prev.map(a =>
                  a.agentId === ev.agentId
                    ? { ...a, status: 'done' }
                    : a
                )
              );
            } else if (ev.type === 'agent_error') {
              setAgentProgress(prev =>
                prev.map(a =>
                  a.agentId === ev.agentId
                    ? { ...a, status: 'error', error: ev.error }
                    : a
                )
              );
            } else if (ev.type === 'compact_done') {
              setArchivedCount(ev.archivedCount);
              setSummaryCount(ev.summaryCount);
              await loadMessages(roomId);
              setPhase('done');
            }
          } catch { /* skip */ }
        }
      }

      // If we didn't get compact_done, check if we at least got summaries
      setAgentProgress(prev => {
        const anyDone = prev.some(a => a.status === 'done');
        if (anyDone && phase !== 'done') setPhase('done');
        return prev;
      });
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [room, roomId, loadMessages]);

  if (!room) return null;

  const totalAgents = agentProgress.length || room.agents.length;
  const completedAgents = agentProgress.filter(a => a.status === 'done').length;
  const progressPct = phase === 'done' ? 100 : totalAgents > 0 ? Math.round((completedAgents / totalAgents) * 100) : 0;
  const activeAgent = agentProgress.find(a => a.status === 'active');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && phase !== 'compacting') onClose(); }}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogTitle className="sr-only">Compact Room</DialogTitle>

        {/* Header */}
        <div className="p-6 pb-4 flex items-center gap-3 border-b border-mission-control-border">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            phase === 'done' ? 'bg-success/10' : phase === 'error' ? 'bg-error/10' : 'bg-mission-control-accent/10'
          }`}>
            {phase === 'done' ? (
              <Check size={20} className="text-success" />
            ) : phase === 'error' ? (
              <AlertCircle size={20} className="text-error" />
            ) : (
              <Zap size={20} className={`text-mission-control-accent ${phase === 'compacting' ? 'animate-pulse' : ''}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-mission-control-text">
              {phase === 'confirm' && 'Compact Room'}
              {phase === 'compacting' && 'Compacting...'}
              {phase === 'done' && 'Compact Complete'}
              {phase === 'error' && 'Compact Failed'}
            </h2>
            <p className="text-xs text-mission-control-text-dim truncate">
              {phase === 'confirm' && `${room.messages.length} messages across ${room.agents.length} agents`}
              {phase === 'compacting' && `Agent ${completedAgents + 1} of ${totalAgents}`}
              {phase === 'done' && `${archivedCount} messages archived, ${summaryCount} summaries created`}
              {phase === 'error' && globalError}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {(phase === 'compacting' || phase === 'done') && (
          <div className="px-6 pt-4">
            <div className="w-full h-1.5 bg-mission-control-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  phase === 'done' ? 'bg-success' : 'bg-mission-control-accent'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
          {/* Confirm phase */}
          {phase === 'confirm' && (
            <div className="p-6 space-y-4">
              <p className="text-sm text-mission-control-text-dim leading-relaxed">
                Each agent will summarize their own work, decisions, and artifacts.
                Old messages will be archived and replaced with compact summaries.
              </p>
              <div className="space-y-2">
                {room.agents.map(id => {
                  const msgCount = room.messages.filter(m => m.agentId === id).length;
                  return (
                    <div key={id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-mission-control-bg">
                      <ParticipantAvatar id={id} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-mission-control-text truncate">{agentName(id)}</div>
                        <div className="text-xs text-mission-control-text-dim">{msgCount} messages</div>
                      </div>
                      {msgCount >= 2 ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-mission-control-accent/10 text-mission-control-accent">
                          Will summarize
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-mission-control-border text-mission-control-text-dim">
                          Too few
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compacting phase — per-agent progress */}
          {(phase === 'compacting' || phase === 'done') && (
            <div className="p-6 space-y-3">
              {agentProgress.map((ap) => (
                <div
                  key={ap.agentId}
                  className={`rounded-xl border transition-colors ${
                    ap.status === 'active'
                      ? 'border-mission-control-accent/30 bg-mission-control-accent/5'
                      : ap.status === 'done'
                      ? 'border-success/20 bg-success/5'
                      : ap.status === 'error'
                      ? 'border-error/20 bg-error/5'
                      : 'border-mission-control-border bg-mission-control-bg'
                  }`}
                >
                  {/* Agent header */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <ParticipantAvatar id={ap.agentId} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-mission-control-text truncate">
                        {agentName(ap.agentId)}
                      </div>
                      <div className="text-xs text-mission-control-text-dim">
                        {ap.messageCount} messages
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {ap.status === 'active' && (
                        <Loader2 size={14} className="text-mission-control-accent animate-spin" />
                      )}
                      {ap.status === 'done' && (
                        <Check size={14} className="text-success" />
                      )}
                      {ap.status === 'error' && (
                        <AlertCircle size={14} className="text-error" />
                      )}
                      <span className={`text-[11px] font-medium ${
                        ap.status === 'active' ? 'text-mission-control-accent'
                        : ap.status === 'done' ? 'text-success'
                        : ap.status === 'error' ? 'text-error'
                        : 'text-mission-control-text-dim'
                      }`}>
                        {ap.status === 'active' ? 'Summarizing...'
                        : ap.status === 'done' ? 'Done'
                        : ap.status === 'error' ? 'Failed'
                        : 'Waiting'}
                      </span>
                    </div>
                  </div>

                  {/* Streaming preview (only for active or done agent) */}
                  {ap.text && (ap.status === 'active' || ap.status === 'done') && (
                    <div className="px-3 pb-3">
                      <div className="max-h-32 overflow-y-auto rounded-lg bg-mission-control-surface border border-mission-control-border p-3 text-xs">
                        <MarkdownMessage content={ap.text} />
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {ap.status === 'error' && ap.error && (
                    <div className="px-3 pb-3">
                      <p className="text-xs text-error">{ap.error}</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Pending agents that haven't started yet */}
              {phase === 'compacting' && room.agents
                .filter(id => !agentProgress.some(a => a.agentId === id))
                .filter(id => room.messages.filter(m => m.agentId === id).length >= 2)
                .map(id => (
                  <div key={id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-mission-control-border bg-mission-control-bg opacity-50">
                    <ParticipantAvatar id={id} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-mission-control-text truncate">{agentName(id)}</div>
                    </div>
                    <span className="text-[11px] text-mission-control-text-dim">Waiting</span>
                  </div>
                ))
              }
            </div>
          )}

          {/* Done phase — summary stats */}
          {phase === 'done' && (
            <div className="px-6 pb-2">
              <div className="flex items-center gap-4 p-3 rounded-xl bg-success/5 border border-success/20">
                <Archive size={18} className="text-success flex-shrink-0" />
                <div className="text-sm text-mission-control-text">
                  <span className="font-semibold">{archivedCount}</span> messages archived.{' '}
                  <span className="font-semibold">{summaryCount}</span> agent summaries created with artifacts preserved.
                </div>
              </div>
            </div>
          )}

          {/* Error phase */}
          {phase === 'error' && (
            <div className="p-6">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-error/5 border border-error/20">
                <AlertCircle size={18} className="text-error flex-shrink-0 mt-0.5" />
                <p className="text-sm text-mission-control-text">{globalError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-6 pt-4 border-t border-mission-control-border">
          {phase === 'confirm' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startCompact}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-mission-control-accent text-white hover:bg-mission-control-accent/90 transition-colors flex items-center gap-2"
              >
                <Zap size={14} />
                Compact {room.agents.filter(id => room.messages.filter(m => m.agentId === id).length >= 2).length} agents
              </button>
            </>
          )}
          {phase === 'compacting' && (
            <span className="text-xs text-mission-control-text-dim">
              Please wait while agents summarize their work...
            </span>
          )}
          {(phase === 'done' || phase === 'error') && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-mission-control-accent text-white hover:bg-mission-control-accent/90 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
