'use client';

import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Zap, Bot, Code, Globe, GitBranch, MessageSquare, Mail,
  Webhook, Clock, Send, Circle, Trash2, Power, PowerOff,
  Brain, Sparkles, CheckCircle, Shield, Route, MessageCircle,
  AtSign, FileText, Database, HardDrive, Table2, File,
  StickyNote, Variable, Hand, ArrowRight, Github, Workflow,
} from 'lucide-react';
import { useCanvasStore, type SerializedBlock, type BlockExecStatus } from './store';

const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Bot, Code, Globe, GitBranch, MessageSquare, Mail,
  Webhook, Clock, Send, Circle, Brain, Sparkles, CheckCircle,
  Shield, Route, MessageCircle, AtSign, FileText, Database,
  HardDrive, Table2, File, StickyNote, Variable, Hand,
  ArrowRight, Github, Workflow,
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
  google_gmail: '#ea4335', google_docs: '#4285f4', google_drive: '#0f9d58',
  google_sheets: '#0f9d58', google_calendar: '#4285f4',
  send_message: '#818cf8', create_task: '#22c55e', assign_task: '#60a5fa',
  update_task_status: '#f59e0b', send_approval: '#e879f9', notify_agent: '#06b6d4',
  send_email_mc: '#fb7185', run_workflow: '#a78bfa', save_to_library: '#14b8a6',
};

const EXEC_RING: Record<BlockExecStatus, string> = {
  idle: '',
  running: '0 0 0 3px rgba(251,191,36,0.4)',
  completed: '0 0 0 3px rgba(34,197,94,0.4)',
  errored: '0 0 0 3px rgba(239,68,68,0.4)',
};

function BlockNode({ id, data, selected }: { id: string; data: SerializedBlock & { type?: string; name?: string }; selected?: boolean }) {
  const selectBlock = useCanvasStore((s) => s.selectBlock);
  const removeBlock = useCanvasStore((s) => s.removeBlock);
  const updateBlockData = useCanvasStore((s) => s.updateBlockData);
  const execState = useCanvasStore((s) => s.blockExecStates[id] ?? 'idle');

  const blockType = data.config?.tool ?? data.type ?? 'function';
  const meta = data.metadata;
  const blockName = meta?.name ?? data.name ?? blockType;
  const iconName = meta?.icon ?? 'Circle';
  const color = meta?.color ?? TYPE_COLORS[blockType] ?? '#6b7280';
  const enabled = data.enabled !== false;
  const hasMultipleOutputs = blockType === 'condition' || blockType === 'router';

  const Icon = ICON_MAP[iconName] ?? Circle;

  const handleClick = useCallback(() => {
    selectBlock(id);
  }, [id, selectBlock]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    removeBlock(id);
  }, [id, removeBlock]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    updateBlockData(id, { enabled: !enabled });
  }, [id, enabled, updateBlockData]);

  return (
    <div
      onClick={handleClick}
      className="group relative"
      style={{ opacity: enabled ? 1 : 0.5 }}
    >
      {/* Input handle */}
      {blockType !== 'starter' && blockType !== 'generic_webhook' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !border-2 !rounded-full"
          style={{ background: 'var(--mission-control-surface)', borderColor: color }}
        />
      )}

      {/* Block body */}
      <div
        className={`flex items-center gap-2.5 rounded-xl px-4 py-3 min-w-[160px] max-w-[240px] transition-shadow${execState === 'running' ? ' animate-pulse' : ''}`}
        style={{
          background: 'var(--mission-control-surface)',
          border: `2px solid ${selected ? color : 'var(--mission-control-border)'}`,
          boxShadow: selected
            ? `0 0 0 2px ${color}33`
            : EXEC_RING[execState] || 'var(--shadow-subtle)',
        }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
          style={{ background: `${color}22` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: 'var(--mission-control-text)' }}>
            {blockName}
          </div>
          <div className="text-[10px] truncate" style={{ color: 'var(--mission-control-text-dim)' }}>
            {blockType}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={handleToggle}
          className="w-5 h-5 flex items-center justify-center rounded-full"
          style={{ background: 'var(--mission-control-surface)', border: '1px solid var(--mission-control-border)' }}
          title={enabled ? 'Disable block' : 'Enable block'}
        >
          {enabled ? <Power size={10} style={{ color: 'var(--mission-control-text-dim)' }} /> : <PowerOff size={10} style={{ color: 'var(--mission-control-text-dim)' }} />}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="w-5 h-5 flex items-center justify-center rounded-full"
          style={{ background: 'var(--mission-control-surface)', border: '1px solid var(--mission-control-border)' }}
          title="Delete block"
        >
          <Trash2 size={10} style={{ color: 'var(--color-error)' }} />
        </button>
      </div>

      {/* Output handles */}
      {hasMultipleOutputs ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!w-3 !h-3 !border-2 !rounded-full"
            style={{ background: 'var(--mission-control-surface)', borderColor: 'var(--color-success)', top: '35%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="!w-3 !h-3 !border-2 !rounded-full"
            style={{ background: 'var(--mission-control-surface)', borderColor: 'var(--color-error)', top: '65%' }}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !border-2 !rounded-full"
          style={{ background: 'var(--mission-control-surface)', borderColor: color }}
        />
      )}
    </div>
  );
}

export default memo(BlockNode);
