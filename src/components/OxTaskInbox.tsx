import { useState } from 'react';
import { Inbox, Clock, CheckCircle, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { useStore } from '../store/store';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: string;
  assignedTo: string;
  createdAt: number;
  subtasks?: { id: string; title: string; done: boolean }[];
}

export default function OxTaskInbox() {
  const { tasks } = useStore();
  const [filter, setFilter] = useState<'all' | 'todo' | 'in-progress'>('all');
  
  // Filter tasks assigned to ox/worker
  const myTasks = tasks.filter(t => 
    t.assignedTo === 'ox' || 
    t.assignedTo === 'worker' || 
    t.assignedTo === 'onchain_worker'
  );
  
  const filteredTasks = myTasks.filter(t => {
    if (filter === 'all') return t.status !== 'done';
    return t.status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo': return <Clock className="text-slate-400" size={16} />;
      case 'in-progress': return <Play className="text-amber-500" size={16} />;
      case 'review': return <AlertCircle className="text-purple-500" size={16} />;
      case 'done': return <CheckCircle className="text-green-500" size={16} />;
      default: return <Clock className="text-slate-400" size={16} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'p0': return 'bg-red-500';
      case 'p1': return 'bg-warning';
      case 'p2': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Inbox className="text-amber-500" size={24} />
            <h1 className="text-xl font-semibold text-white">Task Inbox</h1>
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-600 text-white">
              {filteredTasks.length}
            </span>
          </div>
          <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <RefreshCw size={18} />
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 mt-4">
          {['all', 'todo', 'in-progress'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All Active' : f === 'todo' ? 'To Do' : 'In Progress'}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Inbox size={48} className="mb-4 opacity-50" />
            <p>No tasks in inbox</p>
            <p className="text-sm">Tasks from Froggo will appear here</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
              className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-amber-600/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(task.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                    <h3 className="font-medium text-white truncate">{task.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2">{task.description}</p>
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <span>{task.subtasks.filter(s => s.done).length}/{task.subtasks.length} subtasks</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-600">
                  {new Date(task.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-500">
        <span>{myTasks.filter(t => t.status === 'todo').length} pending</span>
        <span>{myTasks.filter(t => t.status === 'in-progress').length} in progress</span>
        <span>{myTasks.filter(t => t.status === 'done').length} completed</span>
      </div>
    </div>
  );
}
