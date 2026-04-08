import { useState } from 'react';
import {
  CheckCircle2, Circle, Package, Layers, Database, Settings, Shield, Code2,
  LayoutGrid, ListChecks, User, RefreshCw,
} from 'lucide-react';
import { Button, Flex, IconButton } from '@radix-ui/themes';
import type { ModuleSpec, SectionProgress } from './types';
import type { LiveTask } from './useConversationFlow';
import { generateTaskPlan } from './TaskGenerator';
import { sanitizeHtml } from '../../utils/sanitize';

type Tab = 'spec' | 'wireframe' | 'tasks';

interface Props {
  spec: Partial<ModuleSpec>;
  sectionProgress: SectionProgress[];
  isComplete: boolean;
  wireframe: string;
  liveTasks: LiveTask[];
  onGenerateTasks: () => void;
  onExportJson: () => void;
  onRegenerateWireframe?: () => void;
}

const complexityColors: Record<string, string> = {
  simple: 'bg-success/10 text-success',
  medium: 'bg-review-subtle text-review',
  complex: 'bg-error/10 text-error',
};

const agentColors: Record<string, string> = {
  coder: 'bg-info/20 text-info',
  'senior-coder': 'bg-mission-control-border/30 text-mission-control-text-dim',
  designer: 'bg-warning/10 text-warning',
  writer: 'bg-success/10 text-success',
  researcher: 'bg-info/20 text-info',
};

export default function SpecPreviewPanel({
  spec, sectionProgress, isComplete, wireframe, liveTasks, onGenerateTasks, onExportJson, onRegenerateWireframe,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('spec');

  let complexity = 'simple';
  try {
    const plan = generateTaskPlan(spec as ModuleSpec);
    complexity = plan.priority === 'p0' ? 'complex' : plan.priority === 'p1' ? 'medium' : 'simple';
  } catch (err) { console.warn('[SpecPreviewPanel] Non-critical: spec incomplete:', err); }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number; action?: React.ReactNode }[] = [
    { id: 'spec', label: 'Spec', icon: <Package size={14} /> },
    {
      id: 'wireframe',
      label: 'Wireframe',
      icon: <LayoutGrid size={14} />,
      badge: wireframe ? 1 : 0,
      action: onRegenerateWireframe ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onRegenerateWireframe(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRegenerateWireframe(); } }}
          title="Regenerate wireframe"
          className="ml-1 p-0.5 hover:text-mission-control-text text-mission-control-text-dim rounded transition-colors inline-flex"
        >
          <RefreshCw size={11} />
        </span>
      ) : undefined,
    },
    { id: 'tasks', label: 'Tasks', icon: <ListChecks size={14} />, badge: liveTasks.length },
  ];

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Header with tabs */}
      <div className="px-4 py-3 border-b border-mission-control-border flex-shrink-0">
        <Flex align="center" justify="between" className="mb-3">
          <h2 className="text-base font-semibold text-mission-control-text flex items-center gap-2">
            <Package size={18} />
            {spec.name || 'Untitled Module'}
          </h2>
          <Flex gap="2">
            {spec.type && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-mission-control-accent/20 text-mission-control-accent font-medium">
                {spec.type}
              </span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${complexityColors[complexity]}`}>
              {complexity}
            </span>
          </Flex>
        </Flex>
        <Flex gap="1" className="border-b border-mission-control-border">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 -mb-px text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-mission-control-accent text-mission-control-accent'
                  : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {tab.icon}
              {tab.label}
              {(tab.badge ?? 0) > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[9px] rounded-full bg-mission-control-accent/20 text-mission-control-accent font-bold">
                  {tab.badge}
                </span>
              )}
              {tab.action}
            </button>
          ))}
        </Flex>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'spec' && <SpecTab spec={spec} sectionProgress={sectionProgress} />}
        {activeTab === 'wireframe' && <WireframeTab wireframe={wireframe} spec={spec} onRegenerate={onRegenerateWireframe} />}
        {activeTab === 'tasks' && <TasksTab liveTasks={liveTasks} />}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-mission-control-border flex-shrink-0">
        <Button
          size="2"
          variant="solid"
          disabled={!isComplete}
          className="flex-1"
          onClick={onGenerateTasks}
        >
          Push to mission-control-db
        </Button>
        <Button
          size="2"
          variant="surface"
          color="gray"
          onClick={onExportJson}
        >
          Export JSON
        </Button>
      </div>
    </div>
  );
}

// ─── Spec Tab ──────────────────────────────────────────────────────

function SpecTab({ spec, sectionProgress }: { spec: Partial<ModuleSpec>; sectionProgress: SectionProgress[] }) {
  return (
    <div className="px-5 py-4 space-y-5">
      {spec.description && (
        <p className="text-sm text-mission-control-text-dim">{spec.description}</p>
      )}

      {/* Section checklist */}
      <div>
        <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-2">
          Sections
        </h3>
        <div className="space-y-1.5">
          {sectionProgress.map(s => (
            <Flex key={s.id} align="center" gap="2" className="text-sm">
              {s.complete ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : (
                <Circle size={16} className="text-mission-control-border" />
              )}
              <span className={s.complete ? 'text-mission-control-text' : 'text-mission-control-text-dim'}>
                {s.label}
              </span>
              <span className="text-[10px] text-mission-control-text-dim ml-auto">
                {s.answeredCount}/{s.questionCount}
              </span>
            </Flex>
          ))}
        </div>
      </div>

      {/* Manifest preview */}
      {spec.id && (
        <div>
          <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Code2 size={13} /> manifest.json
          </h3>
          <pre className="bg-mission-control-surface text-success text-xs p-3 rounded-lg overflow-x-auto font-mono">
{JSON.stringify({
  id: spec.id,
  name: spec.name,
  type: spec.type,
  category: spec.category,
  icon: spec.icon || 'box',
  hasNavigation: spec.hasNavigation,
  layout: spec.layout,
}, null, 2)}
          </pre>
        </div>
      )}

      {/* Component wireframes */}
      {((spec.views?.length ?? 0) > 0 || (spec.components?.length ?? 0) > 0) && (
        <div>
          <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Layers size={13} /> Components & Views
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {spec.views?.map(v => (
              <div key={v.id} className="border-2 border-dashed border-mission-control-border rounded-lg p-3 text-center">
                <div className="text-xs font-medium text-mission-control-text">{v.name}</div>
                <div className="text-[10px] text-mission-control-text-dim mt-0.5">{v.components.join(', ') || 'view'}</div>
              </div>
            ))}
            {spec.components?.map(c => (
              <div key={c.id} className="border-2 border-dashed border-mission-control-accent/40 rounded-lg p-3 text-center">
                <div className="text-xs font-medium text-mission-control-accent">{c.name}</div>
                <div className="text-[10px] text-mission-control-accent/70 mt-0.5">{c.type}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies / Services */}
      {((spec.services?.length ?? 0) > 0 || (spec.externalApis?.length ?? 0) > 0) && (
        <div>
          <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Database size={13} /> Dependencies
          </h3>
          <ul className="space-y-1">
            {spec.services?.map(s => (
              <li key={s.id} className="text-sm text-mission-control-text flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-info" />
                {s.name} <span className="text-mission-control-text-dim text-xs">({s.type})</span>
              </li>
            ))}
            {spec.externalApis?.map(api => (
              <li key={api} className="text-sm text-mission-control-text flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent" />
                {api}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* IPC channels */}
      {((spec.ipcChannels?.handle?.length ?? 0) + (spec.ipcChannels?.on?.length ?? 0) > 0) && (
        <div>
          <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-2">
            IPC Channels
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {spec.ipcChannels?.handle?.map(ch => (
              <span key={ch} className="text-[10px] px-2 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim font-mono">
                {ch}
              </span>
            ))}
            {spec.ipcChannels?.on?.map(ch => (
              <span key={ch} className="text-[10px] px-2 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim font-mono">
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      {(spec.settings?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Settings size={13} /> Settings
          </h3>
          <ul className="space-y-1">
            {spec.settings?.map(s => (
              <li key={s.key} className="text-sm text-mission-control-text">
                {s.label} <span className="text-mission-control-text-dim">({s.type})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Permissions */}
      {(spec.permissions?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Shield size={13} /> Permissions
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {spec.permissions?.map(p => (
              <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-border/30 text-mission-control-text-dim">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!spec.name && !spec.id && (
        <div className="flex flex-col items-center justify-center py-12 text-mission-control-text-dim">
          <Package size={48} strokeWidth={1} />
          <p className="mt-3 text-sm">Answer questions to build your module spec</p>
        </div>
      )}
    </div>
  );
}

// ─── Wireframe Tab ─────────────────────────────────────────────────

function WireframeTab({ wireframe, spec, onRegenerate }: { wireframe: string; spec: Partial<ModuleSpec>; onRegenerate?: () => void }) {
  if (!wireframe) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim px-8">
        <LayoutGrid size={48} strokeWidth={1} />
        <p className="mt-3 text-sm text-center">
          Complete the Features section to generate wireframe
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <Flex align="center" justify="between">
        <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">
          {spec.name || 'Module'} Layout
        </h3>
        {onRegenerate && (
          <Button
            size="1"
            variant="surface"
            color="gray"
            onClick={onRegenerate}
          >
            <RefreshCw size={11} /> Regenerate
          </Button>
        )}
      </Flex>
      <div
        className="wireframe-preview-container bg-mission-control-bg rounded-xl p-4 overflow-y-auto overflow-x-hidden font-mono text-sm"
        style={{ maxHeight: '480px' }}
      >
        <div
          className="wireframe-canvas"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(wireframe) }}
        />
      </div>
      <p className="text-[10px] text-mission-control-text-dim">
        Auto-generated wireframe · layout: {spec.layout || 'single-panel'} · {spec.views?.length || 0} views
      </p>
    </div>
  );
}

// ─── Tasks Tab ─────────────────────────────────────────────────────

function TasksTab({ liveTasks }: { liveTasks: LiveTask[] }) {
  if (liveTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim px-8">
        <ListChecks size={48} strokeWidth={1} />
        <p className="mt-3 text-sm text-center">
          Tasks will appear as you complete each section
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      <Flex align="center" justify="between">
        <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">
          Build Plan ({liveTasks.length} tasks)
        </h3>
      </Flex>

      {liveTasks.map((task, i) => (
        <div key={i} className="border border-mission-control-border rounded-lg overflow-hidden">
          {/* Task header */}
          <div className="px-4 py-3 bg-mission-control-surface">
            <Flex align="start" justify="between" gap="2">
              <h4 className="text-sm font-medium text-mission-control-text leading-tight">
                {task.title}
              </h4>
              <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${agentColors[task.agent] || 'bg-mission-control-border text-mission-control-text-dim'}`}>
                <User size={10} />
                {task.agent}
              </span>
            </Flex>

            {/* Plan */}
            {task.plan && (
              <p className="text-xs text-mission-control-text-dim mt-1.5 leading-relaxed">
                {task.plan}
              </p>
            )}
          </div>

          {/* Subtasks */}
          {task.subtasks.length > 0 && (
            <div className="px-4 py-2 bg-mission-control-bg border-t border-mission-control-border/50">
              <ul className="space-y-1">
                {task.subtasks.map((sub, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-mission-control-text-dim">
                    <Circle size={10} className="mt-0.5 flex-shrink-0 text-mission-control-border" />
                    {sub}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
