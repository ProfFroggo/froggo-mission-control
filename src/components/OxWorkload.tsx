import { useState } from 'react';
import { Kanban, Clock, Play, CheckCircle, Eye, ChevronRight } from 'lucide-react';
import { useStore } from '../store/store';

export default function OxWorkload() {
  const { tasks } = useStore();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  
  // Filter tasks assigned to ox/worker
  const myTasks = tasks.filter(t => 
    t.assignedTo === 'ox' || 
    t.assignedTo === 'worker' || 
    t.assignedTo === 'onchain_worker'
  );
  
  const columns = [
    { id: 'todo', label: 'To Do', icon: Clock, color: 'border-slate-500' },
    { id: 'in-progress', label: 'In Progress', icon: Play, color: 'border-amber-500' },
    { id: 'review', label: 'Review', icon: Eye, color: 'border-purple-500' },
    { id: 'done', label: 'Done', icon: CheckCircle, color: 'border-green-500' },
  ];

  const getTasksByStatus = (status: string) => 
    myTasks.filter(t => t.status === status);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'p0': return 'bg-red-500';
      case 'p1': return 'bg-warning';
      case 'p2': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  const getSubtaskProgress = (task: Task) => {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    const done = task.subtasks.filter((s: SubtaskData) => s.completed).length;
    return { done, total: task.subtasks.length };
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Kanban className="text-amber-500" size={24} />
          <h1 className="text-xl font-semibold text-white">Workload</h1>
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-600 text-white">
            {myTasks.filter(t => t.status !== 'done').length} active
          </span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map(column => {
            const columnTasks = getTasksByStatus(column.id);
            const Icon = column.icon;
            
            return (
              <div
                key={column.id}
                className={`w-72 flex flex-col rounded-xl bg-slate-800/30 border-t-2 ${column.color}`}
              >
                {/* Column Header */}
                <div className="p-3 flex items-center gap-2">
                  <Icon size={16} className="text-clawd-text-dim" />
                  <span className="font-medium text-clawd-text-dim">{column.label}</span>
                  <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-slate-700 text-clawd-text-dim">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {columnTasks.length === 0 ? (
                    <div className="p-4 text-center text-clawd-text-dim text-sm">
                      No tasks
                    </div>
                  ) : (
                    columnTasks.map(task => {
                      const progress = getSubtaskProgress(task as unknown as Task);
                      
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTask(task.id); }}}
                          role="button"
                          tabIndex={0}
                          className={`p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-600/50 cursor-pointer transition-colors ${
                            selectedTask === task.id ? 'ring-2 ring-amber-500' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <span className={`w-2 h-2 rounded-full mt-1.5 ${getPriorityColor(task.priority ?? '')}`} />
                            <h3 className="text-sm font-medium text-white line-clamp-2">
                              {task.title}
                            </h3>
                          </div>
                          
                          {progress && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-clawd-text-dim mb-1">
                                <span>Subtasks</span>
                                <span>{progress.done}/{progress.total}</span>
                              </div>
                              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-warning transition-all"
                                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-clawd-text-dim">
                              {task.id.slice(-8)}
                            </span>
                            <ChevronRight size={14} className="text-clawd-text-dim" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm text-clawd-text-dim">
        <span>📥 {getTasksByStatus('todo').length} pending</span>
        <span>⚡ {getTasksByStatus('in-progress').length} active</span>
        <span>👁️ {getTasksByStatus('review').length} in review</span>
        <span>✅ {getTasksByStatus('done').length} done</span>
      </div>
    </div>
  );
}
