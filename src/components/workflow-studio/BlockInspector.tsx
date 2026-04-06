'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Zap, Bot, Code, Globe, GitBranch, MessageSquare, Mail,
  Webhook, Clock, Send, Circle, ChevronDown, Brain, Sparkles,
  CheckCircle, Shield, Route, MessageCircle, AtSign, FileText,
  Database, HardDrive, Table2, File, StickyNote, Variable, Hand,
  ArrowRight, Github, Workflow, Search, Megaphone, Plus, Trash2,
} from 'lucide-react';
import { useCanvasStore, BLOCK_FIELDS } from './store';

const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Bot, Code, Globe, GitBranch, MessageSquare, Mail,
  Webhook, Clock, Send, Circle, Brain, Sparkles, CheckCircle,
  Shield, Route, MessageCircle, AtSign, FileText, Database,
  HardDrive, Table2, File, StickyNote, Variable, Hand,
  ArrowRight, Github, Workflow, Search, Megaphone,
};

const TYPE_COLORS: Record<string, string> = {
  starter: '#22c55e', agent: '#a78bfa', function: '#60a5fa', api: '#f97316',
  condition: '#fbbf24', router: '#f59e0b', slack: '#e879f9', gmail: '#fb7185',
  webhook_request: '#22d3ee', wait: '#94a3b8', response: '#4ade80',
  thinking: '#818cf8', openai: '#10b981', evaluator: '#14b8a6',
  guardrails: '#ef4444', discord: '#5865f2', smtp: '#f87171',
  github: '#6b7280', notion: '#64748b', telegram: '#0ea5e9',
  search: '#f97316', knowledge: '#06b6d4', memory: '#8b5cf6',
  table: '#0ea5e9', file: '#64748b', note: '#fbbf24',
  variables: '#a78bfa', human_in_the_loop: '#f97316',
  generic_webhook: '#06b6d4',
  x_twitter: '#000000',
  google_gmail: '#ea4335', google_docs: '#4285f4', google_drive: '#0f9d58',
  google_sheets: '#0f9d58', google_calendar: '#4285f4',
  send_message: '#818cf8', create_task: '#22c55e', assign_task: '#60a5fa',
  update_task_status: '#f59e0b', send_approval: '#e879f9', notify_agent: '#06b6d4',
  send_email_mc: '#fb7185', run_workflow: '#a78bfa', save_to_library: '#14b8a6',
};

interface MCAgent {
  id: string;
  name: string;
  role?: string;
  emoji?: string;
  model?: string;
  status?: string;
}

export default function BlockInspector() {
  const selectedBlockId = useCanvasStore((s) => s.selectedBlockId);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateBlockData = useCanvasStore((s) => s.updateBlockData);
  const selectBlock = useCanvasStore((s) => s.selectBlock);
  const removeBlock = useCanvasStore((s) => s.removeBlock);

  // Fetch MC agents for agent-select fields
  const [mcAgents, setMcAgents] = useState<MCAgent[]>([]);
  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => setMcAgents(Array.isArray(data) ? data : []))
      .catch(() => setMcAgents([]));
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedBlockId),
    [nodes, selectedBlockId]
  );

  const handleParamChange = useCallback((key: string, value: string) => {
    if (!selectedBlockId) return;
    updateBlockData(selectedBlockId, {
      config: {
        tool: (selectedNode?.data as any)?.config?.tool ?? 'function',
        params: { ...((selectedNode?.data as any)?.config?.params ?? {}), [key]: value },
      },
    } as any);
  }, [selectedBlockId, selectedNode, updateBlockData]);

  const handleNameChange = useCallback((name: string) => {
    if (!selectedBlockId) return;
    const data = selectedNode?.data as any;
    updateBlockData(selectedBlockId, {
      metadata: { ...data?.metadata, name },
      name,
    } as any);
  }, [selectedBlockId, selectedNode, updateBlockData]);

  if (!selectedNode) return null;

  const data = selectedNode.data as Record<string, any>;
  const blockType = data.config?.tool ?? data.type ?? 'function';
  const meta = data.metadata ?? {};
  const blockName = meta.name ?? data.name ?? blockType;
  const color = meta.color ?? TYPE_COLORS[blockType] ?? '#6b7280';
  const iconName = meta.icon ?? 'Circle';
  const Icon = ICON_MAP[iconName] ?? Circle;
  const fields = BLOCK_FIELDS[blockType] ?? [];
  const params = data.config?.params ?? {};

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-80 z-20 flex flex-col overflow-hidden"
      style={{
        background: 'var(--mission-control-surface)',
        borderLeft: '1px solid var(--mission-control-border)',
        boxShadow: 'var(--shadow-overlay)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-mission-control-border shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={blockName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full text-sm font-medium bg-transparent border-none outline-none text-[var(--mission-control-text)] placeholder:text-[var(--mission-control-text-dim)]"
          />
          <div className="text-[10px] text-[var(--mission-control-text-dim)]">{blockType}</div>
        </div>
        <button
          type="button"
          onClick={() => selectBlock(null)}
          className="text-[var(--mission-control-text-dim)] hover:text-[var(--mission-control-text)] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {fields.length === 0 ? (
          <p className="text-xs text-[var(--mission-control-text-dim)] italic">No configurable settings for this block type.</p>
        ) : (
          fields
          // Hide model/temperature/maxTokens when an MC Agent is selected (agent brings its own config)
          .filter((field) => {
            if (params.agentId && ['model', 'temperature', 'maxTokens'].includes(field.key)) return false;
            return true;
          })
          .map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[var(--mission-control-text-dim)] uppercase tracking-wider">
                {field.label}
              </label>

              {field.type === 'agent-select' ? (
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <select
                      value={params[field.key] ?? ''}
                      onChange={(e) => handleParamChange(field.key, e.target.value)}
                      className="w-full text-xs rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer"
                      style={{
                        background: 'var(--mission-control-bg)',
                        border: '1px solid var(--mission-control-border)',
                        color: 'var(--mission-control-text)',
                      }}
                    >
                      <option value="">None — use model directly</option>
                      {mcAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}{agent.role ? ` (${agent.role})` : ''}{agent.status === 'active' ? ' — active' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--mission-control-text-dim)]" />
                  </div>
                  {params[field.key] && (
                    <p className="text-[10px] text-[var(--mission-control-text-dim)]">
                      Agent will be invoked with its own persona, skills, and memory.
                    </p>
                  )}
                </div>
              ) : field.type === 'subtask-list' ? (
                <SubtaskListField
                  value={params[field.key] ?? '[]'}
                  onChange={(v) => handleParamChange(field.key, v)}
                  agents={mcAgents}
                />
              ) : field.type === 'select' ? (
                <div className="relative">
                  <select
                    value={params[field.key] ?? field.defaultValue ?? ''}
                    onChange={(e) => handleParamChange(field.key, e.target.value)}
                    className="w-full text-xs rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer"
                    style={{
                      background: 'var(--mission-control-bg)',
                      border: '1px solid var(--mission-control-border)',
                      color: 'var(--mission-control-text)',
                    }}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--mission-control-text-dim)]" />
                </div>
              ) : field.type === 'textarea' || field.type === 'code' ? (
                <textarea
                  value={params[field.key] ?? field.defaultValue ?? ''}
                  onChange={(e) => handleParamChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={field.type === 'code' ? 10 : 4}
                  spellCheck={false}
                  className="w-full text-xs rounded-lg px-3 py-2 resize-y"
                  style={{
                    background: 'var(--mission-control-bg)',
                    border: '1px solid var(--mission-control-border)',
                    color: 'var(--mission-control-text)',
                    fontFamily: field.type === 'code' ? 'var(--font-mono, ui-monospace, monospace)' : 'inherit',
                  }}
                />
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  value={params[field.key] ?? field.defaultValue ?? ''}
                  onChange={(e) => handleParamChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full text-xs rounded-lg px-3 py-2"
                  style={{
                    background: 'var(--mission-control-bg)',
                    border: '1px solid var(--mission-control-border)',
                    color: 'var(--mission-control-text)',
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={params[field.key] ?? field.defaultValue ?? ''}
                  onChange={(e) => handleParamChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full text-xs rounded-lg px-3 py-2"
                  style={{
                    background: 'var(--mission-control-bg)',
                    border: '1px solid var(--mission-control-border)',
                    color: 'var(--mission-control-text)',
                  }}
                />
              )}
            </div>
          ))
        )}

        {/* Connections info */}
        <div className="mt-2 pt-3 border-t border-[var(--mission-control-border)]">
          <p className="text-[10px] font-medium text-[var(--mission-control-text-dim)] uppercase tracking-wider mb-2">Connections</p>
          <div className="flex gap-4 text-[11px] text-[var(--mission-control-text-dim)]">
            <div>
              <span className="font-medium">In:</span>{' '}
              {Object.keys(data.inputs ?? {}).length || 'any'}
            </div>
            <div>
              <span className="font-medium">Out:</span>{' '}
              {Object.keys(data.outputs ?? {}).join(', ') || 'response'}
            </div>
          </div>
        </div>

        {/* Variable reference help */}
        <div className="mt-1 pt-3 border-t border-[var(--mission-control-border)]">
          <p className="text-[10px] font-medium text-[var(--mission-control-text-dim)] uppercase tracking-wider mb-1.5">Variables</p>
          <div className="text-[10px] text-[var(--mission-control-text-dim)] space-y-1">
            <p><code className="text-[var(--brand)] bg-[var(--mission-control-bg)] px-1 rounded">{'{{input}}'}</code> — output from previous block</p>
            <p><code className="text-[var(--brand)] bg-[var(--mission-control-bg)] px-1 rounded">{'{{blockId.response}}'}</code> — specific block output</p>
            <p><code className="text-[var(--brand)] bg-[var(--mission-control-bg)] px-1 rounded">{'$.input'}</code> — in function blocks</p>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--mission-control-border)] shrink-0">
        <button
          type="button"
          onClick={() => { removeBlock(selectedBlockId!); selectBlock(null); }}
          className="flex-1 text-xs font-medium py-2 rounded-lg transition-colors"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
        >
          Delete Block
        </button>
      </div>
    </div>
  );
}

// ── Subtask List Field ──────────────────────────────────────

interface Subtask {
  title: string;
  assignedTo: string;
}

function SubtaskListField({
  value,
  onChange,
  agents,
}: {
  value: string;
  onChange: (v: string) => void;
  agents: MCAgent[];
}) {
  let subtasks: Subtask[];
  try {
    const parsed = JSON.parse(value);
    subtasks = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[BlockInspector] Non-critical:', err);
    subtasks = [];
  }

  const update = (next: Subtask[]) => onChange(JSON.stringify(next));

  const handleAdd = () => update([...subtasks, { title: '', assignedTo: '' }]);

  const handleRemove = (idx: number) => update(subtasks.filter((_, i) => i !== idx));

  const handleChange = (idx: number, field: keyof Subtask, val: string) => {
    const next = [...subtasks];
    next[idx] = { ...next[idx], [field]: val };
    update(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {subtasks.map((st, idx) => (
        <div
          key={idx}
          className="flex flex-col gap-1.5 p-2.5 rounded-lg"
          style={{ background: 'var(--mission-control-bg)', border: '1px solid var(--mission-control-border)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: 'var(--brand-alpha-10, rgba(124,58,237,0.1))', color: 'var(--brand)' }}>
              {idx + 1}
            </span>
            <input
              type="text"
              value={st.title}
              onChange={(e) => handleChange(idx, 'title', e.target.value)}
              placeholder="Subtask title..."
              className="flex-1 text-xs rounded-md px-2 py-1.5"
              style={{
                background: 'var(--mission-control-surface)',
                border: '1px solid var(--mission-control-border)',
                color: 'var(--mission-control-text)',
              }}
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="shrink-0 p-1 rounded-md transition-colors hover:bg-[rgba(239,68,68,0.1)]"
              title="Remove subtask"
            >
              <Trash2 size={12} className="text-[var(--mission-control-text-dim)]" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 pl-6">
            <span className="text-[10px] text-[var(--mission-control-text-dim)] shrink-0">Assign:</span>
            <div className="relative flex-1">
              <select
                value={st.assignedTo}
                onChange={(e) => handleChange(idx, 'assignedTo', e.target.value)}
                className="w-full text-[11px] rounded-md px-2 py-1 pr-6 appearance-none cursor-pointer"
                style={{
                  background: 'var(--mission-control-surface)',
                  border: '1px solid var(--mission-control-border)',
                  color: 'var(--mission-control-text)',
                }}
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}{agent.role ? ` (${agent.role})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--mission-control-text-dim)]" />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors"
        style={{
          border: '1px dashed var(--mission-control-border)',
          color: 'var(--mission-control-text-dim)',
        }}
      >
        <Plus size={12} />
        Add subtask
      </button>
    </div>
  );
}
