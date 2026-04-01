'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Loader2, Workflow, Trash2, Pencil, Check, X,
  Search, Play, ExternalLink, Clock, Zap, Globe, Hand,
  List, History, CheckCircle, XCircle,
} from 'lucide-react';
import { Switch } from '@radix-ui/themes';
import { wsClient, type WorkflowSummary } from '@/lib/workflow-studio-client';
import { useCanvasStore, type WorkflowMeta, type SerializedWorkflow } from './store';
import WorkflowBuilderDialog from './WorkflowBuilderDialog';

interface WorkflowsTabProps {
  onSwitchToCanvas: () => void;
}

// ─── Trigger type badge ──────────────────────────────────────────────────────

const TRIGGER_ICONS: Record<string, React.ElementType> = {
  schedule: Clock,
  webhook: Globe,
  manual: Hand,
  api: Zap,
};

function TriggerBadge({ triggerType }: { triggerType: string }) {
  const Icon = TRIGGER_ICONS[triggerType] ?? Zap;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-mission-control-text-dim"
      style={{ background: 'var(--mission-control-bg)' }}
    >
      <Icon size={10} className="flex-shrink-0" />
      {triggerType}
    </span>
  );
}

// ─── Status badge (matches AutomationsPanel pattern) ─────────────────────────

function StatusBadge({ deployed, isOpen }: { deployed: boolean | number; isOpen: boolean }) {
  if (isOpen) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--mission-control-accent)]/10 text-[var(--mission-control-accent)]">
        <span className="w-1.5 h-1.5 rounded-full bg-current inline-block flex-shrink-0" />
        Editing
      </span>
    );
  }
  if (deployed) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-current inline-block flex-shrink-0" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-mission-control-border/50 text-mission-control-text-dim">
      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block flex-shrink-0" />
      Draft
    </span>
  );
}

function formatTime(ts: string | undefined): string {
  if (!ts) return '\u2014';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Extract trigger type from workflow state */
function getTriggerType(wf: WorkflowSummary): string {
  try {
    const state = typeof wf.state === 'string' ? JSON.parse(wf.state) : wf.state;
    const starter = state?.blocks?.find((b: any) => b.config?.tool === 'starter' || b.config?.tool === 'generic_webhook');
    if (starter?.config?.tool === 'generic_webhook') return 'webhook';
    return starter?.config?.params?.triggerType ?? 'manual';
  } catch { return 'manual'; }
}

/** Get block count from workflow state */
function getBlockCount(wf: WorkflowSummary): number {
  try {
    const state = typeof wf.state === 'string' ? JSON.parse(wf.state) : wf.state;
    return state?.blocks?.length ?? 0;
  } catch { return 0; }
}

// ─── Workflow card (matches AutomationCard layout exactly) ───────────────────

interface WorkflowCardProps {
  wf: WorkflowSummary;
  isOpen: boolean;
  editingId: string | null;
  editName: string;
  running: string | null;
  lastRunResult: { id: string; status: string; error?: string } | null;
  onOpen: (wf: WorkflowSummary) => void;
  onRun: (wf: WorkflowSummary) => void;
  onToggleDeploy: (wf: WorkflowSummary) => void;
  onStartRename: (wf: WorkflowSummary) => void;
  onRename: (id: string) => void;
  onCancelRename: () => void;
  onEditNameChange: (name: string) => void;
  onDelete: (id: string) => void;
}

function WorkflowCard({
  wf, isOpen, editingId, editName, running, lastRunResult,
  onOpen, onRun, onToggleDeploy, onStartRename, onRename, onCancelRename, onEditNameChange, onDelete,
}: WorkflowCardProps) {
  const isEditing = editingId === wf.id;
  const isRunning = running === wf.id;
  const blockCount = getBlockCount(wf);
  const triggerType = getTriggerType(wf);

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 hover:border-mission-control-accent/30 transition-colors flex flex-col gap-2.5">
      {/* Row 1: Name + status badge + trigger badge + toggle */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onRename(wf.id); if (e.key === 'Escape') onCancelRename(); }}
                autoFocus
                className="flex-1 text-sm font-semibold rounded px-2 py-1"
                style={{
                  background: 'var(--mission-control-bg)',
                  border: '1px solid var(--mission-control-border)',
                  color: 'var(--mission-control-text)',
                }}
              />
              <button type="button" onClick={() => onRename(wf.id)} className="text-[var(--mission-control-accent)]">
                <Check size={14} />
              </button>
              <button type="button" onClick={onCancelRename} className="text-mission-control-text-dim">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-mission-control-text overflow-hidden text-ellipsis whitespace-nowrap">
                {wf.name}
              </span>
              <StatusBadge deployed={wf.is_deployed ?? 0} isOpen={isOpen} />
              <TriggerBadge triggerType={triggerType} />
            </div>
          )}
          {wf.description && !isEditing && (
            <p className="text-xs text-mission-control-text-dim mt-1 line-clamp-2">{wf.description}</p>
          )}
        </div>
        <Switch
          checked={!!wf.is_deployed}
          onCheckedChange={() => onToggleDeploy(wf)}
          title={wf.is_deployed ? 'Deactivate workflow' : 'Activate workflow'}
          aria-label={wf.is_deployed ? 'Deactivate workflow' : 'Activate workflow'}
        />
      </div>

      {/* Row 2: Meta — last run, next run, block count */}
      <div className="flex gap-4 flex-wrap text-[10px] text-mission-control-text-dim tabular-nums">
        <span>Last run: {formatTime(wf.updated_at)}</span>
        <span>Next run: {wf.is_deployed ? 'scheduled' : '\u2014'}</span>
        <span>{blockCount} step{blockCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Row 3: Actions — Run now | Edit | Steps | History | (spacer) | Delete */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <button
          type="button"
          onClick={() => onRun(wf)}
          disabled={isRunning}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
          style={{
            background: 'transparent',
            color: 'var(--mission-control-accent)',
            border: '1px solid var(--mission-control-accent)',
            opacity: isRunning ? 0.5 : 1,
          }}
        >
          {isRunning
            ? <Loader2 size={12} className="animate-spin" />
            : <Play size={12} />
          }
          Run now
        </button>
        <button
          type="button"
          onClick={() => onStartRename(wf)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30 transition-colors"
        >
          <Pencil size={12} /> Edit
        </button>
        <button
          type="button"
          onClick={() => onOpen(wf)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30 transition-colors"
        >
          <List size={12} /> Steps
        </button>
        <button
          type="button"
          onClick={() => onOpen(wf)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30 transition-colors"
        >
          <History size={12} /> History
        </button>
        <button
          type="button"
          onClick={() => onOpen(wf)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30 transition-colors"
        >
          <ExternalLink size={12} /> Open
        </button>
        <button
          type="button"
          onClick={() => onDelete(wf.id)}
          title="Delete workflow"
          aria-label="Delete workflow"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-error hover:bg-mission-control-border/40 transition-colors ml-auto"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Run result banner */}
      {lastRunResult && lastRunResult.id === wf.id && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            background: lastRunResult.status === 'completed' && !lastRunResult.error
              ? 'rgba(34,197,94,0.08)'
              : 'rgba(239,68,68,0.08)',
            border: `1px solid ${lastRunResult.status === 'completed' && !lastRunResult.error ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: lastRunResult.status === 'completed' && !lastRunResult.error
              ? 'var(--color-success)'
              : 'var(--color-error)',
          }}
        >
          {lastRunResult.status === 'completed' && !lastRunResult.error ? (
            <CheckCircle size={14} className="shrink-0 mt-0.5" />
          ) : (
            <XCircle size={14} className="shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <span className="font-medium">
              {lastRunResult.status === 'completed' && !lastRunResult.error ? 'Run completed' : 'Run failed'}
            </span>
            {lastRunResult.error && (
              <p className="mt-0.5 text-[11px] opacity-80 break-words">{lastRunResult.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────

export default function WorkflowsTab({ onSwitchToCanvas }: WorkflowsTabProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const workflowId = useCanvasStore((s) => s.workflowId);
  const setWorkflow = useCanvasStore((s) => s.setWorkflow);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const wfs = await wsClient.listWorkflows();
      setWorkflows(wfs);
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const handleOpen = useCallback(async (wf: WorkflowSummary) => {
    try {
      const detail = await wsClient.getWorkflow(wf.id);
      const state: SerializedWorkflow = detail.state
        ? (typeof detail.state === 'string' ? JSON.parse(detail.state) : detail.state)
        : { version: '1', blocks: [], connections: [], loops: {} };
      const meta: WorkflowMeta = {
        id: wf.id,
        name: wf.name,
        description: wf.description ?? '',
        color: wf.color ?? '#7c3aed',
        is_deployed: wf.is_deployed ?? false,
        run_count: wf.run_count ?? 0,
        created_at: wf.created_at,
        updated_at: wf.updated_at,
      };
      setWorkflow(wf.id, meta, state);
      onSwitchToCanvas();
    } catch (err) {
      console.error('Failed to load workflow:', err);
    }
  }, [setWorkflow, onSwitchToCanvas]);

  const handleCreated = useCallback((id: string, meta: WorkflowMeta, state: SerializedWorkflow) => {
    setWorkflow(id, meta, state);
    setShowBuilder(false);
    fetchWorkflows();
    onSwitchToCanvas();
  }, [setWorkflow, fetchWorkflows, onSwitchToCanvas]);

  const [lastRunResult, setLastRunResult] = useState<{ id: string; status: string; error?: string } | null>(null);

  const handleRun = useCallback(async (wf: WorkflowSummary) => {
    setRunning(wf.id);
    setLastRunResult(null);
    try {
      const result = await wsClient.executeWorkflow(wf.id);
      setLastRunResult({ id: wf.id, status: result.status, error: (result as any).error });
      fetchWorkflows();
    } catch (err) {
      setLastRunResult({ id: wf.id, status: 'failed', error: String(err) });
    } finally {
      setRunning(null);
    }
  }, [fetchWorkflows]);

  const handleRename = useCallback(async (id: string) => {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    try {
      await wsClient.updateWorkflow(id, { name });
      setWorkflows((wfs) => wfs.map((w) => w.id === id ? { ...w, name } : w));
      setEditingId(null);
    } catch (err) {
      console.error('Rename failed:', err);
    }
  }, [editName]);

  const handleToggleDeploy = useCallback(async (wf: WorkflowSummary) => {
    const newState = wf.is_deployed ? 0 : 1;
    try {
      await wsClient.updateWorkflow(wf.id, { is_deployed: newState } as any);
      setWorkflows((wfs) => wfs.map((w) => w.id === wf.id ? { ...w, is_deployed: newState } : w));
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await wsClient.deleteWorkflow(id);
      setWorkflows((wfs) => wfs.filter((w) => w.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, []);

  const filtered = search.trim()
    ? workflows.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))
    : workflows;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-mission-control-border shrink-0">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mission-control-text-dim)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows..."
            className="w-full text-xs rounded-lg pl-8 pr-3 py-1.5"
            style={{
              background: 'var(--mission-control-bg)',
              border: '1px solid var(--mission-control-border)',
              color: 'var(--mission-control-text)',
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--mission-control-accent)', color: '#fff' }}
        >
          <Plus size={14} />
          New
        </button>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-mission-control-text-dim" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Workflow size={32} className="mx-auto mb-3 text-mission-control-text-dim opacity-40" />
            <p className="text-sm text-mission-control-text-dim">
              {workflows.length === 0 ? 'No workflows yet' : 'No matching workflows'}
            </p>
            {workflows.length === 0 && (
              <button
                type="button"
                onClick={() => setShowBuilder(true)}
                className="mt-3 flex items-center gap-1.5 mx-auto text-xs font-medium"
                style={{ color: 'var(--mission-control-accent)' }}
              >
                <Plus size={14} />
                Create your first workflow
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((wf) => (
              <WorkflowCard
                key={wf.id}
                wf={wf}
                isOpen={workflowId === wf.id}
                editingId={editingId}
                editName={editName}
                running={running}
                lastRunResult={lastRunResult}
                onOpen={handleOpen}
                onRun={handleRun}
                onToggleDeploy={handleToggleDeploy}
                onStartRename={(w) => { setEditingId(w.id); setEditName(w.name); }}
                onRename={handleRename}
                onCancelRename={() => setEditingId(null)}
                onEditNameChange={setEditName}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Builder dialog */}
      <WorkflowBuilderDialog
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
