import { useState } from 'react';
import {
  CheckCircle2, Circle, Package, Layers, Database, Settings, Shield, Code2,
  LayoutGrid, ListChecks, User,
} from 'lucide-react';
import type { ModuleSpec, SectionProgress } from './types';
import type { LiveTask } from './useConversationFlow';
import { generateTaskPlan } from './TaskGenerator';

type Tab = 'spec' | 'wireframe' | 'tasks';

interface Props {
  spec: Partial<ModuleSpec>;
  sectionProgress: SectionProgress[];
  isComplete: boolean;
  wireframe: string;
  liveTasks: LiveTask[];
  onGenerateTasks: () => void;
  onExportJson: () => void;
}

const complexityColors: Record<string, string> = {
  simple: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  complex: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const agentColors: Record<string, string> = {
  coder: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'senior-coder': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  designer: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'lead-engineer': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  writer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  researcher: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export default function SpecPreviewPanel({
  spec, sectionProgress, isComplete, wireframe, liveTasks, onGenerateTasks, onExportJson,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('spec');

  let complexity = 'simple';
  try {
    const plan = generateTaskPlan(spec as ModuleSpec);
    complexity = plan.priority === 'p0' ? 'complex' : plan.priority === 'p1' ? 'medium' : 'simple';
  } catch { /* spec incomplete */ }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'spec', label: 'Spec', icon: <Package size={14} /> },
    { id: 'wireframe', label: 'Wireframe', icon: <LayoutGrid size={14} />, badge: wireframe ? 1 : 0 },
    { id: 'tasks', label: 'Tasks', icon: <ListChecks size={14} />, badge: liveTasks.length },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Header with tabs */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package size={18} />
            {spec.name || 'Untitled Module'}
          </h2>
          <div className="flex gap-1.5">
            {spec.type && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                {spec.type}
              </span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${complexityColors[complexity]}`}>
              {complexity}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {(tab.badge ?? 0) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] rounded-full bg-blue-500 text-white font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'spec' && <SpecTab spec={spec} sectionProgress={sectionProgress} />}
        {activeTab === 'wireframe' && <WireframeTab wireframe={wireframe} spec={spec} />}
        {activeTab === 'tasks' && <TasksTab liveTasks={liveTasks} />}
      </div>

      {/* Action buttons */}
      <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <button
          onClick={onGenerateTasks}
          disabled={!isComplete}
          className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Push to froggo-db
        </button>
        <button
          onClick={onExportJson}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium rounded-lg transition-colors"
        >
          Export JSON
        </button>
      </div>
    </div>
  );
}

// ─── Spec Tab ──────────────────────────────────────────────────────

function SpecTab({ spec, sectionProgress }: { spec: Partial<ModuleSpec>; sectionProgress: SectionProgress[] }) {
  return (
    <div className="px-5 py-4 space-y-5">
      {spec.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{spec.description}</p>
      )}

      {/* Section checklist */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Sections
        </h3>
        <div className="space-y-1.5">
          {sectionProgress.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              {s.complete ? (
                <CheckCircle2 size={16} className="text-green-500" />
              ) : (
                <Circle size={16} className="text-gray-300 dark:text-gray-600" />
              )}
              <span className={s.complete ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>
                {s.label}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">
                {s.answeredCount}/{s.questionCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Manifest preview */}
      {spec.id && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Code2 size={13} /> manifest.json
          </h3>
          <pre className="bg-gray-900 dark:bg-gray-800 text-green-400 text-xs p-3 rounded-lg overflow-x-auto font-mono">
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
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Layers size={13} /> Components & Views
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {spec.views?.map(v => (
              <div key={v.id} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{v.name}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{v.components.join(', ') || 'view'}</div>
              </div>
            ))}
            {spec.components?.map(c => (
              <div key={c.id} className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-3 text-center">
                <div className="text-xs font-medium text-blue-700 dark:text-blue-400">{c.name}</div>
                <div className="text-[10px] text-blue-400 dark:text-blue-500 mt-0.5">{c.type}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies / Services */}
      {((spec.services?.length ?? 0) > 0 || (spec.externalApis?.length ?? 0) > 0) && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Database size={13} /> Dependencies
          </h3>
          <ul className="space-y-1">
            {spec.services?.map(s => (
              <li key={s.id} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {s.name} <span className="text-gray-400 text-xs">({s.type})</span>
              </li>
            ))}
            {spec.externalApis?.map(api => (
              <li key={api} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                {api}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* IPC channels */}
      {((spec.ipcChannels?.handle?.length ?? 0) + (spec.ipcChannels?.on?.length ?? 0) > 0) && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            IPC Channels
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {spec.ipcChannels?.handle?.map(ch => (
              <span key={ch} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono">
                {ch}
              </span>
            ))}
            {spec.ipcChannels?.on?.map(ch => (
              <span key={ch} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono">
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      {(spec.settings?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Settings size={13} /> Settings
          </h3>
          <ul className="space-y-1">
            {spec.settings?.map(s => (
              <li key={s.key} className="text-sm text-gray-700 dark:text-gray-300">
                {s.label} <span className="text-gray-400">({s.type})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Permissions */}
      {(spec.permissions?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Shield size={13} /> Permissions
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {spec.permissions?.map(p => (
              <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!spec.name && !spec.id && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600">
          <Package size={48} strokeWidth={1} />
          <p className="mt-3 text-sm">Answer questions to build your module spec</p>
        </div>
      )}
    </div>
  );
}

// ─── Wireframe Tab ─────────────────────────────────────────────────

function WireframeTab({ wireframe, spec }: { wireframe: string; spec: Partial<ModuleSpec> }) {
  if (!wireframe) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 px-8">
        <LayoutGrid size={48} strokeWidth={1} />
        <p className="mt-3 text-sm text-center">
          Wireframe will generate after you complete the <strong>Features & UI</strong> section
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {spec.name || 'Module'} Layout
      </h3>
      <pre className="bg-gray-900 dark:bg-gray-800 text-green-400 text-xs p-4 rounded-lg overflow-x-auto font-mono leading-snug whitespace-pre">
{wireframe}
      </pre>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        Auto-generated wireframe based on layout: {spec.layout || 'single-panel'} with {spec.views?.length || 0} views
      </p>
    </div>
  );
}

// ─── Tasks Tab ─────────────────────────────────────────────────────

function TasksTab({ liveTasks }: { liveTasks: LiveTask[] }) {
  if (liveTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 px-8">
        <ListChecks size={48} strokeWidth={1} />
        <p className="mt-3 text-sm text-center">
          Tasks will appear as you complete each section
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Build Plan ({liveTasks.length} tasks)
        </h3>
      </div>

      {liveTasks.map((task, i) => (
        <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {/* Task header */}
          <div className="px-4 py-3 bg-white dark:bg-gray-900">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                {task.title}
              </h4>
              <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${agentColors[task.agent] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                <User size={10} />
                {task.agent}
              </span>
            </div>

            {/* Plan */}
            {task.plan && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                {task.plan}
              </p>
            )}
          </div>

          {/* Subtasks */}
          {task.subtasks.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
              <ul className="space-y-1">
                {task.subtasks.map((sub, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <Circle size={10} className="mt-0.5 flex-shrink-0 text-gray-300 dark:text-gray-600" />
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
