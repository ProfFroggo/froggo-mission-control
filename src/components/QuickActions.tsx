import { useState } from 'react';
import { Plus, RefreshCw, Trash2, Download, Loader2 } from 'lucide-react';
import { useStore } from '../store/store';
import { gateway } from '../lib/gateway';

export default function QuickActions() {
  const { addTask, addActivity, clearActivities, fetchSessions, connected } = useStore();
  const [loading, setLoading] = useState<string | null>(null);

  const actions = [
    { 
      id: 'new-task',
      icon: Plus, 
      label: 'New Task', 
      color: 'bg-clawd-accent',
      action: () => {
        const title = prompt('Task title:');
        if (title?.trim()) {
          addTask({ title: title.trim(), status: 'todo', project: 'Quick' });
          addActivity({ type: 'task', message: `Created task: ${title}`, timestamp: Date.now() });
        }
      }
    },
    { 
      id: 'refresh',
      icon: Download, 
      label: 'Refresh Sessions', 
      color: 'bg-blue-500',
      action: async () => {
        if (!connected) return;
        setLoading('refresh');
        await fetchSessions();
        addActivity({ type: 'system', message: 'Refreshed sessions', timestamp: Date.now() });
        setLoading(null);
      }
    },
    { 
      id: 'clear',
      icon: Trash2, 
      label: 'Clear Activity', 
      color: 'bg-red-500',
      action: () => {
        if (confirm('Clear activity feed?')) clearActivities();
      }
    },
    { 
      id: 'reload',
      icon: RefreshCw, 
      label: 'Reload App', 
      color: 'bg-gray-500',
      action: () => window.location.reload()
    },
  ];

  return (
    <div className="space-y-2">
      {actions.map(({ id, icon: Icon, label, color, action }) => (
        <button
          key={id}
          onClick={action}
          disabled={loading === id}
          className="w-full flex items-center gap-3 p-3 rounded-lg bg-clawd-border/50 hover:bg-clawd-border transition-colors disabled:opacity-50"
        >
          <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
            {loading === id ? <Loader2 size={16} className="text-white animate-spin" /> : <Icon size={16} className="text-white" />}
          </div>
          <span className="text-sm">{label}</span>
        </button>
      ))}
    </div>
  );
}
