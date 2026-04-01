'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw, X, ArrowRight, Mic, MicOff } from 'lucide-react';
import { GeminiStt } from '../../lib/globalStt';
import MicSelector from '../MicSelector';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useMissionControlRuntime, type InternalMessage } from '../chat/ChatRuntime';
import { MissionControlThread, MissionControlComposer } from '../chat/ThreadStyles';
import {
  useCanvasStore,
  flowToWorkflow,
  type SerializedWorkflow,
  type WorkflowMeta,
} from './store';
import { wsClient } from '@/lib/workflow-studio-client';

interface AIBuilderTabProps {
  onSwitchToCanvas: () => void;
}

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
}

export default function AIBuilderTab({ onSwitchToCanvas }: AIBuilderTabProps) {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [pendingWorkflow, setPendingWorkflow] = useState<SerializedWorkflow | null>(null);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [listening, setListening] = useState(false);
  const [micDeviceId, setMicDeviceId] = useState('');
  const sttRef = useRef<GeminiStt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setWorkflow = useCanvasStore((s) => s.setWorkflow);
  const workflowId = useCanvasStore((s) => s.workflowId);
  const nodes = useCanvasStore((s) => s.nodes);

  const extractWorkflow = useCallback((text: string): SerializedWorkflow | null => {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.version && Array.isArray(parsed.blocks)) return parsed;
    } catch { /* ignore */ }
    return null;
  }, []);

  const getCurrentWorkflow = useCallback((): SerializedWorkflow | undefined => {
    if (!workflowId || nodes.length === 0) return undefined;
    const s = useCanvasStore.getState();
    return flowToWorkflow(s.nodes, s.edges);
  }, [workflowId, nodes]);

  const applyWorkflowToCanvas = useCallback(async (wf: SerializedWorkflow, switchTab = false) => {
    try {
      let id = workflowId;
      if (!id) {
        const result = await wsClient.createWorkflow({ name: 'AI-Built Workflow', state: wf });
        id = result.id;
      } else {
        await wsClient.updateWorkflow(id, { state: wf });
      }
      const meta: WorkflowMeta = {
        id: id!,
        name: 'AI-Built Workflow',
        description: '',
        color: '#7c3aed',
        is_deployed: false,
        run_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setWorkflow(id!, meta, wf);
      if (switchTab) onSwitchToCanvas();
    } catch (err) {
      console.error('Failed to apply workflow:', err);
    }
  }, [workflowId, setWorkflow, onSwitchToCanvas]);

  useEffect(() => {
    if (pendingWorkflow) {
      applyWorkflowToCanvas(pendingWorkflow);
      setPendingWorkflow(null);
    }
  }, [pendingWorkflow, applyWorkflowToCanvas]);

  // ── Speech recognition — Gemini STT ──────────────────────────
  useEffect(() => {
    return () => { sttRef.current?.stop(); };
  }, []);

  const toggleVoice = useCallback(() => {
    if (listening && sttRef.current) {
      sttRef.current.stop();
      setListening(false);
      return;
    }

    const stt = new GeminiStt({
      deviceId: micDeviceId || undefined,
      continuous: false,
      chunkDurationMs: 10000,
      onTranscript: (text) => {
        if (text.trim()) {
          handleSend(text.trim());
        }
        setListening(false);
      },
      onError: () => setListening(false),
      onEnd: () => setListening(false),
    });
    sttRef.current = stt;
    stt.start();
    setListening(true);
  }, [listening, micDeviceId]);

  // ── File attachment ─────────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const newAttachments: AttachedFile[] = [];
    for (const file of fileArr) {
      const text = await file.text().catch(() => `[Binary file: ${file.name}, ${(file.size / 1024).toFixed(1)}KB]`);
      newAttachments.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        content: text,
      });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Send message ────────────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    if ((!text.trim() && attachments.length === 0) || isRunning) return;

    // Build message content with attachments
    let content = text.trim();
    if (attachments.length > 0) {
      const fileContext = attachments.map((a) =>
        `\n\n--- Attached file: ${a.name} (${(a.size / 1024).toFixed(1)}KB) ---\n${a.content}`
      ).join('');
      content += fileContext;
      setAttachments([]);
    }

    const userMsg: InternalMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setIsRunning(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((m) => [...m, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
    }]);

    try {
      const conversationMessages = [...messages, userMsg]
        .filter(m => m.role === 'user' || (m.role === 'assistant' && !m.streaming))
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        }));

      const currentWorkflow = getCurrentWorkflow();

      const res = await fetch('/api/workflow-studio/ai-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationMessages,
          currentWorkflow,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errBody.error || `API error: ${res.status}`);
      }

      const data = await res.json();
      const assistantText = data.text || '';
      const workflow = extractWorkflow(assistantText);

      if (workflow) {
        setPendingWorkflow(workflow);
      }

      setMessages((m) => m.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: assistantText, streaming: false }
          : msg
      ));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((m) => m.map((msg) =>
        msg.id === assistantId
          ? {
              ...msg,
              content: `Failed to reach the AI: ${errorMsg}\n\nMake sure you have a Gemini or Anthropic API key configured in Settings.`,
              streaming: false,
            }
          : msg
      ));
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, messages, attachments, getCurrentWorkflow, extractWorkflow]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setAttachments([]);
  }, []);

  const runtime = useMissionControlRuntime(messages, isRunning, handleSend);

  const suggestions = [
    { label: 'Daily standup digest', prompt: 'Build a workflow that collects standup updates from agents every morning and posts a summary to Slack' },
    { label: 'Content review pipeline', prompt: 'Create a multi-agent content review workflow where one agent drafts, another reviews, and a third publishes' },
    { label: 'GitHub issue triage', prompt: 'Build a workflow that monitors new GitHub issues, classifies them by priority using AI, and assigns them to the right team' },
    { label: 'Webhook notification flow', prompt: 'Set up a workflow triggered by a webhook that processes the payload and sends notifications to Slack and email' },
    { label: 'Competitor monitor', prompt: 'Create a workflow that searches for competitor mentions daily, summarizes findings with AI, and posts a report' },
    { label: 'X/Twitter engagement', prompt: 'Build a workflow that monitors X/Twitter for brand mentions, generates AI replies, and queues them for approval' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Pane header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-mission-control-border shrink-0">
        <Sparkles size={14} className="text-mission-control-accent" />
        <span className="text-xs font-medium text-mission-control-text">AI Workflow Builder</span>
        <span className="text-[10px] text-mission-control-text-dim ml-1">Powered by AI</span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            className="ml-auto text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            title="Clear conversation"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {/* Chat — uses same assistant-ui Thread + Composer as main ChatPanel */}
      <AssistantRuntimeProvider runtime={runtime}>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-4 overflow-y-auto">
              <div className="text-center mb-2">
                <Sparkles size={24} className="text-mission-control-accent mx-auto mb-2" />
                <p className="text-sm font-medium text-mission-control-text">What workflow would you like to build?</p>
                <p className="text-xs text-mission-control-text-dim mt-1">Describe it in plain English or pick a suggestion below</p>
              </div>
              <div className="flex flex-col gap-1.5 w-full max-w-[320px]">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => handleSend(s.prompt)}
                    className="flex items-center gap-2 text-left px-3 py-2 rounded-lg text-xs transition-colors hover:bg-mission-control-bg group"
                    style={{ border: '1px solid var(--mission-control-border)' }}
                  >
                    <span className="flex-1 text-mission-control-text">{s.label}</span>
                    <ArrowRight size={12} className="text-mission-control-text-dim opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <MissionControlThread />
            </div>
          )}

          {/* Context hint */}
          {workflowId && (
            <div className="text-[10px] text-mission-control-text-dim px-4 py-1 shrink-0"
              style={{ background: 'var(--mission-control-surface)', borderTop: '1px solid var(--mission-control-border)' }}
            >
              Editing workflow on canvas — AI can modify the current workflow
            </div>
          )}

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2 shrink-0" style={{ background: 'var(--mission-control-surface)' }}>
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-mission-control-text"
                  style={{ background: 'var(--mission-control-bg)', border: '1px solid var(--mission-control-border)' }}
                >
                  <span className="truncate max-w-[120px]">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="text-mission-control-text-dim hover:text-mission-control-text"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          {/* Composer with attach + voice */}
          <div className="shrink-0 px-3 pb-3 pt-2" style={{ background: 'var(--mission-control-surface)' }}>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <MissionControlComposer
                  placeholder="Describe the workflow you want to build..."
                  onAttach={handleAttach}
                  isListening={listening}
                  onToggleVoice={toggleVoice}
                />
              </div>
              <MicSelector value={micDeviceId} onChange={setMicDeviceId} compact />
            </div>
          </div>
        </div>
      </AssistantRuntimeProvider>
    </div>
  );
}
