'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Loader2, Workflow, Trash2, Plus } from 'lucide-react';
import { wsClient, type WorkflowSummary } from '@/lib/workflow-studio-client';
import { useCanvasStore, type WorkflowMeta, type SerializedWorkflow } from './store';

interface WorkflowListDialogProps {
  open: boolean;
  onClose: () => void;
  onNew: () => void;
}

export default function WorkflowListDialog({ open, onClose, onNew }: WorkflowListDialogProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const setWorkflow = useCanvasStore((s) => s.setWorkflow);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    wsClient.listWorkflows()
      .then((wfs) => setWorkflows(wfs))
      .catch(() => setWorkflows([]))
      .finally(() => setLoading(false));
  }, [open]);

  const handleLoad = useCallback(async (wf: WorkflowSummary) => {
    try {
      const detail = await wsClient.getWorkflow(wf.id);
      const state: SerializedWorkflow = detail.state
        ? (typeof detail.state === 'string' ? JSON.parse(detail.state) : detail.state)
        : { version: '1', blocks: [], connections: [], loops: {} };
      const meta: WorkflowMeta = {
        id: wf.id,
        name: wf.name,
        description: wf.description ?? '',
        color: wf.color ?? 'var(--mission-control-accent)',
        is_deployed: wf.is_deployed ?? false,
        run_count: wf.run_count ?? 0,
        created_at: wf.created_at,
        updated_at: wf.updated_at,
      };
      setWorkflow(wf.id, meta, state);
      onClose();
    } catch (err) {
      console.error('Failed to load workflow:', err);
    }
  }, [setWorkflow, onClose]);

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await wsClient.deleteWorkflow(id);
      setWorkflows((wfs) => wfs.filter((w) => w.id !== id));
    } catch (err) {
      console.error('Failed to delete workflow:', err);
    }
  }, []);

  if (!open) return null;

  const filtered = search.trim()
    ? workflows.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))
    : workflows;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[440px] max-h-[60vh] rounded-xl overflow-hidden flex flex-col"
        style={{ background: 'var(--mission-control-surface)', border: '1px solid var(--mission-control-border)', boxShadow: 'var(--shadow-overlay)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border shrink-0">
          <span className="text-sm font-medium text-mission-control-text">Open Workflow</span>
          <button type="button" onClick={onClose} className="text-mission-control-text-dim hover:text-mission-control-text">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-mission-control-border shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows..."
            className="w-full text-xs rounded-lg px-3 py-1.5"
            style={{
              background: 'var(--mission-control-bg)',
              border: '1px solid var(--mission-control-border)',
              color: 'var(--mission-control-text)',
            }}
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-mission-control-text-dim" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-mission-control-text-dim">
                {workflows.length === 0 ? 'No workflows yet' : 'No matching workflows'}
              </p>
              {workflows.length === 0 && (
                <button
                  type="button"
                  onClick={() => { onClose(); onNew(); }}
                  className="mt-2 flex items-center gap-1 mx-auto text-xs font-medium"
                  style={{ color: 'var(--brand)' }}
                >
                  <Plus size={12} />
                  Create your first workflow
                </button>
              )}
            </div>
          ) : (
            filtered.map((wf) => (
              <button
                key={wf.id}
                type="button"
                onClick={() => handleLoad(wf)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-mission-control-bg group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${wf.color ?? 'var(--mission-control-accent)'}22` }}>
                  <Workflow size={14} style={{ color: wf.color ?? 'var(--mission-control-accent)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-mission-control-text truncate">{wf.name}</div>
                  <div className="text-[10px] text-mission-control-text-dim">
                    {wf.run_count ?? 0} runs · {new Date(wf.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, wf.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-mission-control-text-dim hover:text-red-400"
                  title="Delete workflow"
                >
                  <Trash2 size={12} />
                </button>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
