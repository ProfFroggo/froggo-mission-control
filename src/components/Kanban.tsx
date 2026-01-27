import { useState, useMemo, useEffect } from 'react';
import { Plus, MoreHorizontal, Bot, Trash2, FolderOpen, GripVertical, Clock, User, Play, Zap } from 'lucide-react';
import { useStore, Task, TaskStatus } from '../store/store';
import TaskModal from './TaskModal';
import TaskDetailPanel from './TaskDetailPanel';

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return `${Math.floor(diff / 604800000)}w`;
}

const columns: { id: TaskStatus; title: string; color: string; bg: string }[] = [
  { id: 'backlog', title: 'Backlog', color: 'border-l-gray-500', bg: 'bg-gray-500/10' },
  { id: 'todo', title: 'To Do', color: 'border-l-blue-500', bg: 'bg-blue-500/10' },
  { id: 'in-progress', title: 'In Progress', color: 'border-l-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'review', title: '👀 Needs Approval', color: 'border-l-purple-500', bg: 'bg-purple-500/10' },
  { id: 'done', title: 'Done', color: 'border-l-green-500', bg: 'bg-green-500/10' },
  { id: 'failed', title: '❌ Failed', color: 'border-l-red-500', bg: 'bg-red-500/10' },
];

export default function Kanban() {
  const { tasks, agents, moveTask, deleteTask, assignTask, spawnAgentForTask, loadTasksFromDB } = useStore();
  
  // Load tasks from froggo-db on mount and poll
  useEffect(() => {
    loadTasksFromDB();
    const interval = setInterval(loadTasksFromDB, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [loadTasksFromDB]);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<TaskStatus>('todo');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const projects = useMemo(() => {
    const projectSet = new Set(tasks.map(t => t.project));
    return ['all', ...Array.from(projectSet)];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (projectFilter === 'all') return tasks;
    return tasks.filter(t => t.project === projectFilter);
  }, [tasks, projectFilter]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (draggedTask) {
      moveTask(draggedTask, status);
      setDraggedTask(null);
    }
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleAddTask = (status: TaskStatus) => {
    setModalStatus(status);
    setModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Task Board</h1>
            <p className="text-clawd-text-dim text-sm">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} • {tasks.filter(t => t.status === 'done').length} completed
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-clawd-bg rounded-xl border border-clawd-border px-3 py-2">
              <FolderOpen size={16} className="text-clawd-text-dim" />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="bg-transparent text-sm focus:outline-none cursor-pointer"
              >
                {projects.map(p => (
                  <option key={p} value={p}>{p === 'all' ? 'All Projects' : p}</option>
                ))}
              </select>
            </div>
            
            <button 
              onClick={() => handleAddTask('todo')}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-all hover:scale-105"
            >
              <Plus size={18} />
              New Task
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-5 p-6 overflow-x-auto">
        {columns.map((column) => {
          const columnTasks = filteredTasks.filter(t => t.status === column.id);
          const isDragOver = dragOverColumn === column.id;
          
          return (
            <div
              key={column.id}
              className={`flex-shrink-0 w-80 flex flex-col rounded-2xl border transition-all ${
                isDragOver 
                  ? 'border-clawd-accent border-dashed bg-clawd-accent/10 scale-[1.02] shadow-lg shadow-clawd-accent/20' 
                  : draggedTask 
                  ? 'border-clawd-border bg-clawd-surface/50' 
                  : 'border-clawd-border bg-clawd-surface'
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className={`p-4 border-b border-clawd-border border-l-4 ${column.color} rounded-t-2xl`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{column.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${column.bg}`}>
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddTask(column.id)}
                    className="p-1 rounded-lg hover:bg-clawd-border transition-colors text-clawd-text-dim hover:text-clawd-text"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Tasks */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-0">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    agents={agents}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onDelete={() => deleteTask(task.id)}
                    onAssign={(agentId) => assignTask(task.id, agentId)}
                    onStartAgent={(taskId) => spawnAgentForTask(taskId)}
                    onClick={() => setSelectedTask(task)}
                    isDragging={draggedTask === task.id}
                  />
                ))}
                
                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-clawd-text-dim">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-clawd-border/50 flex items-center justify-center">
                      <Plus size={20} />
                    </div>
                    <p className="text-sm">No tasks</p>
                    <p className="text-xs">Drag here or click +</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        initialStatus={modalStatus}
      />
      
      <TaskDetailPanel 
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  agents: { id: string; name: string; avatar?: string; status?: string; currentTaskId?: string }[];
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onAssign: (agentId: string) => void;
  onStartAgent: (taskId: string) => void;
  onClick: () => void;
  isDragging: boolean;
}

function TaskCard({ task, agents, onDragStart, onDragEnd, onDelete, onAssign, onStartAgent, onClick, isDragging }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  
  const assignedAgent = task.assignedTo ? agents.find(a => a.id === task.assignedTo) : null;
  const isAgentWorking = assignedAgent?.currentTaskId === task.id;
  const canStart = assignedAgent && !isAgentWorking && task.status !== 'done' && task.status !== 'in-progress';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-clawd-bg rounded-xl p-4 border border-clawd-border shadow-card hover:shadow-card-hover hover:border-clawd-accent/50 hover:-translate-y-0.5 transition-all cursor-pointer group relative ${
        isDragging ? 'opacity-50 scale-105 rotate-3 shadow-card-hover' : ''
      }`}
    >
      {/* Drag Handle */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 text-clawd-text-dim">
        <GripVertical size={14} />
      </div>

      <div className="pl-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
          <div className="relative flex-shrink-0">
            <button 
              className="p-1 rounded-lg text-clawd-text-dim hover:bg-clawd-border opacity-0 group-hover:opacity-100 transition-all"
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            >
              <MoreHorizontal size={14} />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-8 bg-clawd-surface border border-clawd-border rounded-xl shadow-xl py-1 z-20 min-w-36">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAssign(true); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-clawd-border flex items-center gap-2"
                >
                  <Bot size={14} /> Assign Agent
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-clawd-border text-red-400 flex items-center gap-2"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
        
        {task.description && (
          <p className="text-xs text-clawd-text-dim mb-3 line-clamp-2">{task.description}</p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-clawd-surface rounded-lg text-clawd-text-dim flex items-center gap-1">
              <FolderOpen size={10} />
              {task.project}
            </span>
            <span className="text-xs text-clawd-text-dim flex items-center gap-1" title={new Date(task.createdAt).toLocaleString()}>
              <Clock size={10} />
              {formatRelativeTime(task.createdAt)}
            </span>
          </div>
          
          {assignedAgent ? (
            <div className="flex items-center gap-2">
              {isAgentWorking ? (
                <span className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg animate-pulse">
                  <Zap size={12} /> Working...
                </span>
              ) : canStart ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onStartAgent(task.id); }}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  <Play size={10} /> Start
                </button>
              ) : null}
              <button 
                className="flex items-center gap-1.5 text-xs px-2 py-1 bg-clawd-accent/10 text-clawd-accent rounded-lg hover:bg-clawd-accent/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowAssign(true); }}
              >
                <span>{assignedAgent.avatar || '🤖'}</span>
                {assignedAgent.name}
              </button>
            </div>
          ) : (
            <button 
              className="text-xs text-clawd-text-dim hover:text-clawd-accent flex items-center gap-1"
              onClick={(e) => { e.stopPropagation(); setShowAssign(true); }}
            >
              <User size={12} /> Assign
            </button>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssign && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowAssign(false)} />
          <div 
            className="absolute left-0 right-0 top-full mt-2 bg-clawd-surface border border-clawd-border rounded-xl shadow-xl p-3 z-40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-clawd-text-dim mb-2 font-medium">Assign to agent</div>
            <div className="space-y-1">
              <button
                onClick={() => { onAssign(''); setShowAssign(false); }}
                className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 hover:bg-clawd-border transition-colors ${
                  !task.assignedTo ? 'bg-clawd-border' : ''
                }`}
              >
                <User size={16} className="text-clawd-text-dim" />
                Unassigned
              </button>
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => { onAssign(agent.id); setShowAssign(false); }}
                  className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 hover:bg-clawd-border transition-colors ${
                    task.assignedTo === agent.id ? 'bg-clawd-accent/20 text-clawd-accent' : ''
                  }`}
                >
                  <span className="text-base">{agent.avatar || '🤖'}</span>
                  {agent.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
