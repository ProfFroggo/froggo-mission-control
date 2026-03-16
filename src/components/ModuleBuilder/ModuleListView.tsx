import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Clock, CheckCircle2 } from 'lucide-react';
import ErrorDisplay from '../ErrorDisplay';
import { showToast } from '../Toast';

interface ModuleListItem {
  id: string;
  name: string;
  description: string;
  status: string;
  overallProgress: number;
  overall_progress: number;
  taskIds: string[];
  createdAt: number;
  updatedAt: number;
  created_at: number;
  updated_at: number;
}

interface MiniProgressProps {
  moduleId: string;
  taskIds: string[];
  onBuild: () => void;
}

function MiniProgress({ moduleId, taskIds, onBuild }: MiniProgressProps) {
  const [pct, setPct] = useState<number | null>(null);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!taskIds || taskIds.length === 0) return;
    fetch(`/api/modules/${moduleId}/tasks`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setPct(data.progressPct);
          setCompleted(data.completed);
          setTotal(data.total);
        }
      })
      .catch(() => {});
  }, [moduleId, taskIds]);

  if (!taskIds || taskIds.length === 0) {
    return (
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-mission-control-text-dim">Not started</span>
        <button
          onClick={(e) => { e.stopPropagation(); onBuild(); }}
          className="text-xs px-2.5 py-1 bg-mission-control-accent hover:opacity-90 text-white rounded transition-opacity"
        >
          Build
        </button>
      </div>
    );
  }

  if (pct === null) return null;

  const allDone = pct === 100;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[10px] text-mission-control-text-dim mb-1">
        {allDone ? (
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle2 size={10} /> Complete
          </span>
        ) : (
          <span>{completed}/{total} tasks</span>
        )}
        <span>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-mission-control-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: allDone ? 'var(--color-success)' : 'var(--color-accent)',
          }}
        />
      </div>
    </div>
  );
}

interface ModuleListViewProps {
  onSelectModule: (id: string) => void;
  onCreateNew: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ModuleListView({ onSelectModule, onCreateNew }: ModuleListViewProps) {
  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const loadModules = async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/modules');
      if (res.ok) {
        const result = await res.json();
        setModules(result?.modules || []);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadModules(); }, []);

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name || 'Untitled module'}"?`)) return;
    try {
      await fetch(`/api/modules/${id}`, { method: 'DELETE' });
      setModules(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      showToast('error', 'Failed to delete module', String(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-mission-control-text-dim">
        Loading modules...
      </div>
    );
  }

  if (loadError) {
    return <ErrorDisplay error={loadError} onRetry={loadModules} context={{ action: 'load modules' }} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-mission-control-border bg-mission-control-surface">
        <h1 className="text-lg font-semibold text-mission-control-text">My Modules</h1>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-mission-control-accent hover:opacity-90 text-white rounded-lg transition-opacity"
        >
          <Plus size={14} /> Create New
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {modules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim gap-4">
            <Package size={48} className="opacity-30" />
            <p className="text-lg">No modules yet</p>
            <p className="text-sm">Create your first module spec to get started.</p>
            <button
              onClick={onCreateNew}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-mission-control-accent hover:opacity-90 text-white rounded-lg transition-opacity"
            >
              <Plus size={14} /> Create New Module
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map(mod => (
              <div
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className="group relative bg-mission-control-surface border border-mission-control-border rounded-lg p-4 cursor-pointer hover:border-mission-control-accent/50 transition-colors"
              >
                {/* Status badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    mod.status === 'built' || mod.status === 'finished'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {mod.status === 'built' || mod.status === 'finished' ? 'Built' : 'In Progress'}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, mod.id, mod.name)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                    title="Delete module"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>

                {/* Name */}
                <h3 className="text-mission-control-text font-medium truncate">
                  {mod.name || 'Untitled Module'}
                </h3>

                {/* Description */}
                {mod.description && (
                  <p className="text-mission-control-text-dim text-sm mt-1 line-clamp-2">
                    {mod.description}
                  </p>
                )}

                {/* Timestamp */}
                <div className="flex items-center gap-1 text-[10px] text-mission-control-text-dim mt-2">
                  <Clock size={10} /> {timeAgo(mod.updatedAt || mod.updated_at || 0)}
                </div>

                {/* Progress */}
                <MiniProgress
                  moduleId={mod.id}
                  taskIds={mod.taskIds || []}
                  onBuild={() => onSelectModule(mod.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
