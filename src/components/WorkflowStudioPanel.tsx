'use client';

import { useCallback, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import {
  Workflow, Play, Save, Loader2, Check, Sparkles,
  LayoutTemplate, History, List,
} from 'lucide-react';
import PanelHeader from './PanelHeader';
import TabNav, { type TabNavItem } from './TabNav';
import WorkflowsTab from './workflow-studio/WorkflowsTab';
import CanvasTab from './workflow-studio/CanvasTab';
import TemplatesTab from './workflow-studio/TemplatesTab';
import RunsTab from './workflow-studio/RunsTab';
import AIBuilderPane from './workflow-studio/AIBuilderTab';
import WorkflowListDialog from './workflow-studio/WorkflowListDialog';
import {
  useCanvasStore,
  type WorkflowMeta,
  type SerializedWorkflow,
} from './workflow-studio/store';
import { wsClient } from '@/lib/workflow-studio-client';

const TABS: TabNavItem[] = [
  { id: 'workflows', label: 'Workflows', icon: List },
  { id: 'canvas', label: 'Canvas', icon: Workflow },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'runs', label: 'Runs', icon: History },
];

function WorkflowStudioInner() {
  const [activeTab, setActiveTab] = useState('workflows');
  const [showWorkflowList, setShowWorkflowList] = useState(false);
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [lastRunResult, setLastRunResult] = useState<{ status: string; result?: Record<string, unknown>; error?: string; duration_ms?: number } | null>(null);

  const {
    workflowId, workflowMeta, dirty, executing, nodes,
    setWorkflow, setExecuting, getSerializedWorkflow, setDirty,
    setBlockExecState, resetBlockExecStates,
  } = useCanvasStore();

  // Create new workflow
  const handleNew = useCallback(async (name?: string, description?: string) => {
    try {
      const workflowName = name || 'New Workflow';
      const emptyState: SerializedWorkflow = { version: '1', blocks: [], connections: [], loops: {} };
      const result = await wsClient.createWorkflow({ name: workflowName, state: emptyState, description });
      const meta: WorkflowMeta = {
        id: result.id,
        name: workflowName,
        description: description || '',
        color: '#7c3aed',
        is_deployed: false,
        run_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setWorkflow(result.id, meta, emptyState);
      setActiveTab('canvas');
    } catch (err) {
      console.error('Create failed:', err);
    }
  }, [setWorkflow]);

  // Save workflow
  const handleSave = useCallback(async () => {
    if (!workflowId) return;
    setSaving(true);
    try {
      const wf = getSerializedWorkflow();
      await wsClient.updateWorkflow(workflowId, { state: wf, name: workflowMeta?.name });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [workflowId, workflowMeta, getSerializedWorkflow, setDirty]);

  // Execute workflow — always saves first, then runs and surfaces results
  const handleExecute = useCallback(async () => {
    if (!workflowId) return;
    setLastRunResult(null);
    resetBlockExecStates();
    setExecuting(true);

    try {
      // ── 1. Force-save current canvas state to DB before execution ──
      const wf = getSerializedWorkflow();
      await wsClient.updateWorkflow(workflowId, { state: wf, name: workflowMeta?.name });
      setDirty(false);

      // Mark all blocks as running
      for (const block of wf.blocks) {
        setBlockExecState(block.id, 'running');
      }

      // ── 2. Execute ──
      const result = await wsClient.executeWorkflow(workflowId);

      // ── 3. Update per-block status from results ──
      if (result.result) {
        for (const [blockId, blockResult] of Object.entries(result.result)) {
          const r = blockResult as Record<string, unknown> | null;
          if (r && typeof r === 'object' && r.skipped) {
            setBlockExecState(blockId, 'idle');
          } else if (r && typeof r === 'object' && r.error) {
            setBlockExecState(blockId, 'errored');
          } else {
            setBlockExecState(blockId, 'completed');
          }
        }
      }

      setLastRunResult({
        status: result.status,
        result: result.result,
        error: result.error,
        duration_ms: result.duration_ms,
      });
      setExecuting(false, result.id);
    } catch (err) {
      console.error('Execute failed:', err);
      setLastRunResult({ status: 'failed', error: err instanceof Error ? err.message : String(err) });
      setExecuting(false);
    }
  }, [workflowId, workflowMeta, getSerializedWorkflow, setDirty, setExecuting, setBlockExecState, resetBlockExecStates]);

  // Build subtitle
  const subtitle = workflowMeta?.name
    ? `${workflowMeta.name}${dirty ? ' (unsaved)' : ''}${saveStatus === 'saving' ? ' — saving...' : saveStatus === 'saved' ? ' — saved' : ''}`
    : 'Visual workflow editor';

  const headerActions = undefined;

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Header + Tabs */}
      <div className="border-b border-mission-control-border bg-mission-control-surface shrink-0">
        <PanelHeader
          icon={Workflow}
          title="Workflow Studio"
          subtitle={subtitle}
          border={false}
          actions={headerActions}
        />
        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          border={false}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Main tab content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {activeTab === 'workflows' && (
            <WorkflowsTab onSwitchToCanvas={() => setActiveTab('canvas')} />
          )}
          {activeTab === 'canvas' && (
            <CanvasTab
              onSaveStatus={setSaveStatus}
              onSave={handleSave}
              onRun={handleExecute}
              onToggleAI={() => setShowAIBuilder(!showAIBuilder)}
              saving={saving}
              saved={saved}
              showAIBuilder={showAIBuilder}
              lastRunResult={lastRunResult}
              onDismissResult={() => setLastRunResult(null)}
              onCreate={handleNew}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesTab onSwitchToCanvas={() => setActiveTab('canvas')} />
          )}
          {activeTab === 'runs' && (
            <RunsTab />
          )}
        </div>

        {/* Persistent AI Builder right pane */}
        {showAIBuilder && (
          <div
            className="w-[380px] shrink-0 flex flex-col border-l border-mission-control-border"
            style={{ background: 'var(--mission-control-surface)' }}
          >
            <AIBuilderPane onSwitchToCanvas={() => setActiveTab('canvas')} />
          </div>
        )}

        {/* Workflow list dialog */}
        <WorkflowListDialog
          open={showWorkflowList}
          onClose={() => setShowWorkflowList(false)}
          onNew={handleNew}
        />
      </div>
    </div>
  );
}

export default function WorkflowStudioPanel() {
  return (
    <ReactFlowProvider>
      <WorkflowStudioInner />
    </ReactFlowProvider>
  );
}
