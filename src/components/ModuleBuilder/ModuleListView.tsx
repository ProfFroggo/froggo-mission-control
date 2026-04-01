import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Clock, CheckCircle2 } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
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
        <Button
          size="1"
          variant="solid"
          onClick={(e) => { e.stopPropagation(); onBuild(); }}
        >
          Build
        </Button>
      </div>
    );
  }

  if (pct === null) return null;

  const allDone = pct === 100;
  return (
    <div className="mt-3">
      <Flex align="center" justify="between" className="text-[10px] text-mission-control-text-dim mb-1">
        {allDone ? (
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 size={10} /> Complete
          </span>
        ) : (
          <span>{completed}/{total} tasks</span>
        )}
        <span>{pct}%</span>
      </Flex>
      <div className="w-full h-1.5 bg-mission-control-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-colors"
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
      <Flex align="center" justify="between" className="px-5 py-3 border-b border-mission-control-border bg-mission-control-surface">
        <h1 className="text-lg font-semibold text-mission-control-text">My Modules</h1>
        <Button
          size="2"
          variant="solid"
          onClick={onCreateNew}
        >
          <Plus size={14} /> Create New
        </Button>
      </Flex>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {modules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim gap-4">
            <Package size={48} className="opacity-30" />
            <p className="text-lg">No modules yet</p>
            <p className="text-sm">Create your first module spec to get started.</p>
            <Button
              size="2"
              variant="solid"
              onClick={onCreateNew}
            >
              <Plus size={14} /> Create New Module
            </Button>
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
                <Flex align="center" justify="between" className="mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    mod.status === 'built' || mod.status === 'finished'
                      ? 'bg-success/20 text-success'
                      : 'bg-warning/20 text-warning'
                  }`}>
                    {mod.status === 'built' || mod.status === 'finished' ? 'Built' : 'In Progress'}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete module"
                    onClick={(e) => handleDelete(e, mod.id, mod.name)}
                  >
                    <Trash2 size={14} />
                  </button>
                </Flex>

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
                <Flex align="center" gap="1" className="text-[10px] text-mission-control-text-dim mt-2">
                  <Clock size={10} /> {timeAgo(mod.updatedAt || mod.updated_at || 0)}
                </Flex>

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
