import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Clock } from 'lucide-react';

interface ModuleListItem {
  id: string;
  name: string;
  description: string;
  status: string;
  overall_progress: number;
  created_at: number;
  updated_at: number;
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

  const loadModules = async () => {
    try {
      const result = await window.clawdbot.moduleBuilder?.list();
      if (result?.success && result.modules) {
        setModules(result.modules);
      }
    } catch (err) {
      console.error('[ModuleList] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadModules(); }, []);

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name || 'Untitled module'}"?`)) return;
    try {
      await window.clawdbot.moduleBuilder?.delete(id);
      setModules(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('[ModuleList] Delete failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-clawd-text-dim">
        Loading modules...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-clawd-border bg-clawd-surface">
        <h1 className="text-lg font-semibold text-clawd-text">My Modules</h1>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-clawd-accent hover:opacity-90 text-white rounded-lg transition-opacity"
        >
          <Plus size={14} /> Create New
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {modules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim gap-4">
            <Package size={48} className="opacity-30" />
            <p className="text-lg">No modules yet</p>
            <p className="text-sm">Create your first module spec to get started.</p>
            <button
              onClick={onCreateNew}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-clawd-accent hover:opacity-90 text-white rounded-lg transition-opacity"
            >
              <Plus size={14} /> Create New Module
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map(mod => (
              <div
                key={mod.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectModule(mod.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectModule(mod.id);
                  }
                }}
                className="group relative bg-clawd-surface border border-clawd-border rounded-xl p-4 cursor-pointer hover:border-clawd-accent/50 transition-colors"
              >
                {/* Status badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    mod.status === 'finished'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {mod.status === 'finished' ? 'Complete' : 'In Progress'}
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
                <h3 className="text-clawd-text font-medium truncate">
                  {mod.name || 'Untitled Module'}
                </h3>

                {/* Description */}
                {mod.description && (
                  <p className="text-clawd-text-dim text-sm mt-1 line-clamp-2">
                    {mod.description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-clawd-text-dim mb-1">
                    <span>{mod.overall_progress}%</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {timeAgo(mod.updated_at)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-clawd-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-clawd-accent rounded-full transition-all"
                      style={{ width: `${mod.overall_progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
