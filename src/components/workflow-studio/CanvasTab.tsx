'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, Save, Check, Sparkles, Play, X, CheckCircle, AlertCircle, Workflow, Plus } from 'lucide-react';
import BlockNode from './BlockNode';
import BlockInspector from './BlockInspector';
import BlockPalette from './BlockPalette';
import {
  useCanvasStore,
  type BlockDefinition,
} from './store';
import { wsClient } from '@/lib/workflow-studio-client';

const nodeTypes = { workflowBlock: BlockNode };

interface RunResult {
  status: string;
  result?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
}

interface CanvasTabProps {
  onSaveStatus?: (status: 'idle' | 'saving' | 'saved') => void;
  onSave?: () => void;
  onRun?: () => void;
  onToggleAI?: () => void;
  saving?: boolean;
  saved?: boolean;
  showAIBuilder?: boolean;
  lastRunResult?: RunResult | null;
  onDismissResult?: () => void;
  onCreate?: (name: string, description?: string) => void;
}

export default function CanvasTab({
  onSaveStatus,
  onSave,
  onRun,
  onToggleAI,
  saving,
  saved,
  showAIBuilder,
  lastRunResult,
  onDismissResult,
  onCreate,
}: CanvasTabProps) {
  const {
    nodes, edges, dirty, workflowId, workflowMeta, executing,
    selectedBlockId,
    onNodesChange, onEdgesChange, onConnect,
    addBlock, selectBlock,
    setDirty, getSerializedWorkflow,
  } = useCanvasStore();

  const reactFlowInstance = useReactFlow();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save: debounced 3s after changes
  useEffect(() => {
    if (!dirty || !workflowId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      onSaveStatus?.('saving');
      try {
        const wf = getSerializedWorkflow();
        await wsClient.updateWorkflow(workflowId, {
          state: wf,
          name: workflowMeta?.name,
        });
        setDirty(false);
        onSaveStatus?.('saved');
        setTimeout(() => onSaveStatus?.('idle'), 2000);
      } catch (err) {
        console.error('Auto-save failed:', err);
        onSaveStatus?.('idle');
      }
    }, 3000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [dirty, workflowId, workflowMeta, getSerializedWorkflow, setDirty, onSaveStatus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (workflowId && dirty) {
          onSaveStatus?.('saving');
          const wf = getSerializedWorkflow();
          wsClient.updateWorkflow(workflowId, { state: wf, name: workflowMeta?.name })
            .then(() => { setDirty(false); onSaveStatus?.('saved'); setTimeout(() => onSaveStatus?.('idle'), 2000); })
            .catch(() => onSaveStatus?.('idle'));
        }
      }
      if (e.key === 'Escape') {
        selectBlock(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [workflowId, dirty, workflowMeta, getSerializedWorkflow, setDirty, selectBlock, onSaveStatus]);

  const handleAddBlock = useCallback((def: BlockDefinition) => {
    const center = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addBlock(def, center);
  }, [addBlock, reactFlowInstance]);

  const handlePaneClick = useCallback(() => {
    selectBlock(null);
  }, [selectBlock]);

  const SaveIcon = saving ? Loader2 : saved ? Check : Save;

  return (
    <div className="flex flex-1 min-h-0">
      {/* ── Left sidebar: toolbar + block palette ── */}
      <div
        className="w-60 shrink-0 flex flex-col border-r border-mission-control-border"
        style={{ background: 'var(--mission-control-surface)' }}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2.5 py-2 border-b border-mission-control-border shrink-0">
          <button
            type="button"
            onClick={onSave}
            disabled={!workflowId || saving}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-mission-control-bg disabled:opacity-40"
            title="Save"
          >
            <SaveIcon size={15} className={`${saving ? 'animate-spin' : ''} ${saved ? 'text-green-500' : 'text-mission-control-text-dim'}`} />
          </button>
          <button
            type="button"
            onClick={onToggleAI}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
              showAIBuilder
                ? 'bg-[var(--brand)] text-white'
                : 'hover:bg-mission-control-bg text-mission-control-text-dim'
            }`}
            title="AI Builder"
          >
            <Sparkles size={15} />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onRun}
            disabled={!workflowId || executing || nodes.length === 0}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              background: 'var(--brand)',
              color: 'white',
            }}
            title="Run workflow"
          >
            {executing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} />
            )}
            Run
          </button>
        </div>

        {/* Block palette — always visible */}
        <BlockPalette onAddBlock={handleAddBlock} />
      </div>

      {/* ── Canvas ── */}
      <div className="relative flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
          className="workflow-canvas"
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: 'var(--mission-control-border)', strokeWidth: 2 },
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--mission-control-text-dim)"
            style={{ opacity: 0.3 }}
          />
          <Controls
            showInteractive={false}
            className="!border-mission-control-border !bg-mission-control-surface !shadow-subtle [&>button]:!bg-mission-control-surface [&>button]:!border-mission-control-border [&>button]:!text-mission-control-text [&>button:hover]:!bg-mission-control-bg"
          />
          <MiniMap
            className="!bg-mission-control-surface !border-mission-control-border"
            nodeColor="var(--brand)"
            maskColor="var(--mission-control-bg)"
            style={{ opacity: 0.8 }}
          />
        </ReactFlow>

        {/* Block inspector */}
        {selectedBlockId && <BlockInspector />}

        {/* Execution overlay */}
        {executing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full z-30"
            style={{ background: 'var(--mission-control-surface)', border: '1px solid var(--mission-control-border)' }}>
            <Loader2 size={12} className="animate-spin text-mission-control-accent" />
            <span className="text-xs text-mission-control-text">Saving & running...</span>
          </div>
        )}

        {/* Execution result banner */}
        {lastRunResult && !executing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-xl z-30 max-w-[500px]"
            style={{ background: 'var(--mission-control-surface)', border: `1px solid ${lastRunResult.status === 'completed' ? '#22c55e' : '#ef4444'}40`, boxShadow: 'var(--shadow-overlay)' }}>
            {lastRunResult.status === 'completed' ? (
              <CheckCircle size={14} className="text-green-500 shrink-0" />
            ) : (
              <AlertCircle size={14} className="text-red-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-mission-control-text">
                {lastRunResult.status === 'completed' ? 'Workflow completed' : 'Workflow failed'}
              </span>
              {lastRunResult.duration_ms != null && (
                <span className="text-[10px] text-mission-control-text-dim ml-1.5">
                  {lastRunResult.duration_ms < 1000
                    ? `${lastRunResult.duration_ms}ms`
                    : `${(lastRunResult.duration_ms / 1000).toFixed(1)}s`}
                </span>
              )}
              {lastRunResult.error && (
                <p className="text-[10px] text-red-400 mt-0.5 truncate">{lastRunResult.error}</p>
              )}
              {lastRunResult.status === 'completed' && lastRunResult.result && (
                <p className="text-[10px] text-mission-control-text-dim mt-0.5">
                  {Object.keys(lastRunResult.result).length} blocks executed
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onDismissResult}
              className="text-mission-control-text-dim hover:text-mission-control-text shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Empty state — create prompt when no workflow, hint when workflow exists but empty */}
        {nodes.length === 0 && !workflowId && onCreate && (
          <CreateWorkflowOverlay onCreate={onCreate} />
        )}
        {nodes.length === 0 && workflowId && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center pointer-events-auto">
              <p className="text-sm text-mission-control-text-dim">
                Click a block on the left to add it to your workflow
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Workflow Overlay ──────────────────────────────────

function CreateWorkflowOverlay({ onCreate }: { onCreate: (name: string, description?: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim() || undefined);
  }, [name, description, onCreate]);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--mission-control-bg)' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-6 rounded-2xl flex flex-col gap-4" style={{ background: 'var(--mission-control-surface)', border: '1px solid var(--mission-control-border)' }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-alpha-10, rgba(124,58,237,0.1))' }}>
            <Workflow size={20} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-mission-control-text">New Workflow</h3>
            <p className="text-[11px] text-mission-control-text-dim">Give your workflow a name to get started</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-mission-control-text-dim uppercase tracking-wider">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily Standup Digest"
            autoFocus
            className="w-full text-sm rounded-lg px-3 py-2"
            style={{ background: 'var(--mission-control-bg)', border: '1px solid var(--mission-control-border)', color: 'var(--mission-control-text)' }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-mission-control-text-dim uppercase tracking-wider">Description <span className="opacity-50">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this workflow do?"
            rows={2}
            className="w-full text-xs rounded-lg px-3 py-2 resize-none"
            style={{ background: 'var(--mission-control-bg)', border: '1px solid var(--mission-control-border)', color: 'var(--mission-control-text)' }}
          />
        </div>

        <button
          type="submit"
          disabled={!name.trim()}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
          style={{ background: 'var(--brand)' }}
        >
          <Plus size={14} />
          Create Workflow
        </button>
      </form>
    </div>
  );
}
