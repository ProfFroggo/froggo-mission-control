import { CheckCircle2, Circle, Package, Layers, Database, Settings, Shield, Code2 } from 'lucide-react';
import { ModuleSpec, ConversationSection } from './types';

interface Props {
  spec: ModuleSpec;
  sections: ConversationSection[];
  complexity: 'simple' | 'medium' | 'complex';
  onGenerateTasks: () => void;
  onExportJson: () => void;
  isComplete: boolean;
}

const complexityColors = {
  simple: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  complex: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function SpecPreviewPanel({ spec, sections, complexity, onGenerateTasks, onExportJson, isComplete }: Props) {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Package size={20} />
          {spec.name || 'Untitled Module'}
        </h2>
        {spec.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{spec.description}</p>
        )}
        <div className="flex gap-2 mt-2">
          {spec.type && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
              {spec.type}
            </span>
          )}
          {spec.category && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium">
              {spec.category}
            </span>
          )}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${complexityColors[complexity]}`}>
            {complexity} complexity
          </span>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Section checklist */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Sections
          </h3>
          <div className="space-y-1.5">
            {sections.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                {s.completed ? (
                  <CheckCircle2 size={16} className="text-green-500" />
                ) : (
                  <Circle size={16} className="text-gray-300 dark:text-gray-600" />
                )}
                <span className={s.completed ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>
                  {s.name}
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
        {(spec.views.length > 0 || spec.components.length > 0) && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers size={13} /> Components
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {spec.views.map(v => (
                <div key={v.id} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{v.name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{v.layout}</div>
                </div>
              ))}
              {spec.components.map(c => (
                <div key={c.id} className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-3 text-center">
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-400">{c.name}</div>
                  <div className="text-[10px] text-blue-400 dark:text-blue-500 mt-0.5">{c.type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies / Services */}
        {(spec.services.length > 0 || spec.externalApis.length > 0) && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Database size={13} /> Dependencies
            </h3>
            <ul className="space-y-1">
              {spec.services.map(s => (
                <li key={s.id} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {s.name}
                </li>
              ))}
              {spec.externalApis.map(api => (
                <li key={api} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  {api}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* IPC channels */}
        {(spec.ipcChannels.handle.length > 0 || spec.ipcChannels.on.length > 0) && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              IPC Channels (~{spec.ipcChannels.handle.length + spec.ipcChannels.on.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {spec.ipcChannels.handle.map(ch => (
                <span key={ch} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono">
                  {ch}
                </span>
              ))}
              {spec.ipcChannels.on.map(ch => (
                <span key={ch} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono">
                  {ch}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {spec.settings.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Settings size={13} /> Settings
            </h3>
            <ul className="space-y-1">
              {spec.settings.map(s => (
                <li key={s.key} className="text-sm text-gray-700 dark:text-gray-300">
                  {s.label} <span className="text-gray-400">({s.type})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Permissions */}
        {spec.permissions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield size={13} /> Permissions
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {spec.permissions.map(p => (
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

      {/* Action buttons */}
      <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <button
          onClick={onGenerateTasks}
          disabled={!isComplete}
          className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Generate Tasks
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
