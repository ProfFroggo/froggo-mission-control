import { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, MoreHorizontal, Bot, Trash2, FolderOpen, Clock, User, Play, Zap, 
  CheckSquare, Filter, Search, AlertTriangle, Calendar, ArrowUp, ArrowDown, RefreshCw, Keyboard, X, Flag, Circle, Hand
} from 'lucide-react';
import { useStore, Task, TaskStatus, TaskPriority } from '../store/store';
import TaskModal from './TaskModal';
import TaskDetailPanel from './TaskDetailPanel';
import PokeModal from './PokeModal';
import TaskStatusIndicator from './TaskStatusIndicator';
import AgentAvatar from './AgentAvatar';
import { showToast } from './Toast';
import { Spinner, TaskCardSkeleton } from './LoadingStates';

// Priority config - STANDARDIZED ICON SIZE: xs (12px)
const PRIORITIES: { id: TaskPriority; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'p0', label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/20', icon: <AlertTriangle size={14} className="flex-shrink-0" /> },
  { id: 'p1', label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/20', icon: <ArrowUp size={14} className="flex-shrink-0" /> },
  { id: 'p2', label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: <Circle size={14} className="flex-shrink-0" /> },
  { id: 'p3', label: 'Low', color: 'text-clawd-text-dim', bg: 'bg-clawd-bg0/20', icon: <ArrowDown size={14} className="flex-shrink-0" /> },
];

// function formatRelativeTime(timestamp: number): string {
//   const now = Date.now();
//   const diff = now - timestamp;
//   if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
//   if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
//   if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
//   if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
//   return `${Math.floor(diff / 604800000)}w`;
// }

// Format due date
function formatDueDate(timestamp: number): { text: string; isOverdue: boolean; isDueSoon: boolean } {
  const now = Date.now();
  const diff = timestamp - now;
  const isOverdue = diff < 0;
  // const isDueSoon = diff > 0 && diff < 86400000; // Due within 24h
  
  if (isOverdue) {
    const overdueDiff = Math.abs(diff);
    if (overdueDiff < 86400000) return { text: 'Overdue', isOverdue: true, isDueSoon: false };
    return { text: `${Math.floor(overdueDiff / 86400000)}d overdue`, isOverdue: true, isDueSoon: false };
  }
  
  if (diff < 3600000) return { text: `${Math.floor(diff / 60000)}m`, isOverdue: false, isDueSoon: true };
  if (diff < 86400000) return { text: `${Math.floor(diff / 3600000)}h`, isOverdue: false, isDueSoon: true };
  if (diff < 604800000) return { text: `${Math.floor(diff / 86400000)}d`, isOverdue: false, isDueSoon: false };
  return { text: new Date(timestamp).toLocaleDateString(), isOverdue: false, isDueSoon: false };
}

const columns: { id: TaskStatus; title: string; color: string; bg: string; emoji?: string }[] = [
  { id: 'backlog', title: 'Backlog', color: 'border-l-gray-500', bg: 'bg-clawd-bg0/10', emoji: '📋' },
  { id: 'todo', title: 'To Do', color: 'border-l-blue-500', bg: 'bg-blue-500/10', emoji: '📝' },
  { id: 'internal-review', title: 'Internal Review', color: 'border-l-cyan-500', bg: 'bg-cyan-500/10', emoji: '🔍' },
  { id: 'in-progress', title: 'In Progress', color: 'border-l-yellow-500', bg: 'bg-yellow-500/10', emoji: '⚡' },
  { id: 'review', title: 'Agent Review', color: 'border-l-purple-500', bg: 'bg-purple-500/10', emoji: '🤖' },
  { id: 'human-review', title: 'Human Review', color: 'border-l-orange-500', bg: 'bg-orange-500/10', emoji: '👤' },
  { id: 'done', title: 'Done', color: 'border-l-green-500', bg: 'bg-green-500/10', emoji: '✅' },
  { id: 'failed', title: 'Failed', color: 'border-l-red-500', bg: 'bg-red-500/10', emoji: '❌' },
];

interface Filters {
  search: string;
  project: string;
  priority: TaskPriority | 'all';
  assignee: string;
  hasDueDate: boolean | null;
  showCompleted: boolean;
}

export default function Kanban() {
  const { tasks, agents, moveTask, deleteTask, assignTask, spawnAgentForTask, loadTasksFromDB, updateTask, loading } = useStore();
  
  // Local loading states for operations
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());
  const [spawningTasks, setSpawningTasks] = useState<Set<string>>(new Set());
  const [movingTasks, setMovingTasks] = useState<Set<string>>(new Set());
  
  // Load tasks from froggo-db on mount and poll (only when visible)
  useEffect(() => {
    loadTasksFromDB();
    
    // Polling with visibility detection - stop polling when tab hidden
    // Increased to 30s for better performance
    let interval: NodeJS.Timeout;
    
    const startPolling = () => {
      interval = setInterval(loadTasksFromDB, 30000); // 30s (was 10s)
    };
    
    const stopPolling = () => {
      if (interval) clearInterval(interval);
    };
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        loadTasksFromDB(); // Refresh on return
        startPolling();
      }
    };
    
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadTasksFromDB]);
  
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<TaskStatus>('todo');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [pokeTask, setPokeTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    project: 'all',
    priority: 'all',
    assignee: 'all',
    hasDueDate: null,
    showCompleted: true,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setModalStatus('todo');
        setModalOpen(true);
      }
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowKeyboardHelp(true);
      }
      if (e.key === 'Escape') {
        setSelectedTask(null);
        setShowFilters(false);
        setShowKeyboardHelp(false);
      }
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowFilters(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const projects = useMemo(() => {
    const projectSet = new Set(tasks.map(t => t.project));
    return ['all', ...Array.from(projectSet)];
  }, [tasks]);

  // const assignees = useMemo(() => {
  //   const ids = new Set(tasks.map(t => t.assignedTo).filter(Boolean));
  //   return ['all', 'unassigned', ...Array.from(ids)];
  // }, [tasks]);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;
    
    // Search
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search) ||
        t.project.toLowerCase().includes(search)
      );
    }
    
    // Project
    if (filters.project !== 'all') {
      result = result.filter(t => t.project === filters.project);
    }
    
    // Priority
    if (filters.priority !== 'all') {
      result = result.filter(t => t.priority === filters.priority);
    }
    
    // Assignee
    if (filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned') {
        result = result.filter(t => !t.assignedTo);
      } else {
        result = result.filter(t => t.assignedTo === filters.assignee);
      }
    }
    
    // Due date
    if (filters.hasDueDate !== null) {
      result = result.filter(t => filters.hasDueDate ? t.dueDate : !t.dueDate);
    }
    
    // Hide completed
    if (!filters.showCompleted) {
      result = result.filter(t => t.status !== 'done' && t.status !== 'failed');
    }
    
    // Sort by priority, then due date, then created
    return result.sort((a, b) => {
      // Priority first (p0 > p1 > p2 > p3 > undefined)
      const priorityOrder = { p0: 0, p1: 1, p2: 2, p3: 3, undefined: 4 };
      const aPriority = priorityOrder[a.priority || 'undefined'];
      const bPriority = priorityOrder[b.priority || 'undefined'];
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Then due date (earliest first)
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      
      // Then created (newest first)
      return b.createdAt - a.createdAt;
    });
  }, [tasks, filters]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.project !== 'all') count++;
    if (filters.priority !== 'all') count++;
    if (filters.assignee !== 'all') count++;
    if (filters.hasDueDate !== null) count++;
    if (!filters.showCompleted) count++;
    return count;
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      search: '',
      project: 'all',
      priority: 'all',
      assignee: 'all',
      hasDueDate: null,
      showCompleted: true,
    });
  };

  // Stats
  const stats = useMemo(() => {
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < Date.now() && t.status !== 'done').length;
    const urgent = tasks.filter(t => t.priority === 'p0' && t.status !== 'done').length;
    const unassigned = tasks.filter(t => !t.assignedTo && t.status !== 'done' && t.status !== 'failed').length;
    return { inProgress, overdue, urgent, unassigned };
  }, [tasks]);

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

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (!draggedTask) {
      setDragOverColumn(null);
      return;
    }

    const task = tasks.find(t => t.id === draggedTask);
    if (!task) {
      setDragOverColumn(null);
      return;
    }

    // PLANNING PHASE VALIDATION: backlog → todo requires planning
    if (task.status === 'backlog' && status === 'todo') {
      const errors: string[] = [];
      
      // Check 1: Subtasks
      const subtaskCount = (task.subtasks || []).length;
      if (subtaskCount === 0) {
        errors.push('❌ No subtasks - break down the work first');
      }
      
      // Check 2: Worker assigned
      if (!task.assignedTo || task.assignedTo === '') {
        errors.push('❌ No worker assigned');
      } else if (['main', 'froggo'].includes(task.assignedTo)) {
        errors.push('❌ Assigned to main/froggo - use coder/researcher/writer/chief');
      }
      
      // Check 3: Planning notes (detailed)
      if (!task.planningNotes || task.planningNotes.trim().length < 50) {
        errors.push('❌ No planning notes (min 50 chars)');
      }
      
      // Check 4: Effort estimate in planning notes
      if (task.planningNotes) {
        const hasEffort = /effort|estimate|complexity|hours|days|easy|medium|hard|simple|complex/i.test(task.planningNotes);
        if (!hasEffort) {
          errors.push('❌ No effort estimate in planning notes');
        }
      } else {
        errors.push('❌ Document effort/complexity');
      }
      
      if (errors.length > 0) {
        showToast('error', 'Planning incomplete', errors.join('\n'));
        setDraggedTask(null);
        setDragOverColumn(null);
        return;
      }
    }

    // All validations passed - move the task
    handleMoveTask(draggedTask, status);
    setDraggedTask(null);
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

  const handleQuickPriority = useCallback((taskId: string, priority: TaskPriority) => {
    updateTask(taskId, { priority });
    showToast('success', `Priority set to ${priority.toUpperCase()}`);
  }, [updateTask]);

  // Async operation wrappers with loading states
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadTasksFromDB();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setDeletingTasks(prev => new Set(prev).add(taskId));
    try {
      await deleteTask(taskId);
      showToast('success', 'Task deleted');
    } catch (error) {
      showToast('error', 'Failed to delete task');
    } finally {
      setDeletingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleSpawnAgent = async (taskId: string) => {
    setSpawningTasks(prev => new Set(prev).add(taskId));
    try {
      await spawnAgentForTask(taskId);
      showToast('success', 'Agent spawned successfully');
    } catch (error) {
      showToast('error', 'Failed to spawn agent');
    } finally {
      setSpawningTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleMoveTask = async (taskId: string, status: TaskStatus) => {
    setMovingTasks(prev => new Set(prev).add(taskId));
    try {
      await moveTask(taskId, status);
    } finally {
      setMovingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold icon-text">
              Task Board
              <span className="text-sm font-normal text-clawd-text-dim">
                Press <kbd className="px-1.5 py-0.5 bg-clawd-bg rounded text-xs">?</kbd> for shortcuts
              </span>
            </h1>
            <div className="flex items-center gap-4 text-sm text-clawd-text-dim mt-1">
              <span>{tasks.length} tasks</span>
              {stats.inProgress > 0 && (
                <span className="icon-text-tight text-yellow-400">
                  <Zap size={14} className="flex-shrink-0" /> {stats.inProgress} in progress
                </span>
              )}
              {stats.urgent > 0 && (
                <span className="icon-text-tight text-red-400">
                  <AlertTriangle size={14} className="flex-shrink-0" /> {stats.urgent} urgent
                </span>
              )}
              {stats.overdue > 0 && (
                <span className="icon-text-tight text-red-400">
                  <Clock size={14} className="flex-shrink-0" /> {stats.overdue} overdue
                </span>
              )}
              {stats.unassigned > 0 && (
                <span className="icon-text-tight text-clawd-text-dim">
                  <User size={14} className="flex-shrink-0" /> {stats.unassigned} unassigned
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim flex-shrink-0" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="pl-9 pr-4 py-2 bg-clawd-bg rounded-xl border border-clawd-border text-sm w-48 focus:outline-none focus:border-clawd-accent"
              />
            </div>

            {/* Filter button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`icon-text px-3 py-2 rounded-xl border transition-all ${
                activeFiltersCount > 0
                  ? 'bg-clawd-accent/20 border-clawd-accent text-clawd-accent'
                  : 'bg-clawd-bg border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <Filter size={16} className="flex-shrink-0" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 bg-clawd-accent text-white text-xs rounded-full flex-shrink-0 whitespace-nowrap">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="icon-btn border border-clawd-border hover:border-clawd-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh tasks"
            >
              <RefreshCw size={16} className={`flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            {/* New Task */}
            <button 
              onClick={() => handleAddTask('todo')}
              className="icon-text px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-all hover:scale-105"
            >
              <Plus size={16} className="flex-shrink-0" />
              New Task
              <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-xs">N</kbd>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="flex items-center gap-4 p-4 bg-clawd-bg rounded-xl border border-clawd-border animate-in slide-in-from-top-2">
            {/* Project */}
            <div className="icon-text-tight">
              <FolderOpen size={16} className="text-clawd-text-dim flex-shrink-0" />
              <select
                value={filters.project}
                onChange={(e) => setFilters(f => ({ ...f, project: e.target.value }))}
                className="bg-clawd-surface border border-clawd-border rounded-lg px-2 py-1 text-sm"
              >
                {projects.map(p => (
                  <option key={p} value={p}>{p === 'all' ? 'All Projects' : p}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="icon-text-tight">
              <Flag size={16} className="text-clawd-text-dim flex-shrink-0" />
              <select
                value={filters.priority}
                onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value as TaskPriority | 'all' }))}
                className="bg-clawd-surface border border-clawd-border rounded-lg px-2 py-1 text-sm"
              >
                <option value="all">All Priorities</option>
                {PRIORITIES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="icon-text-tight">
              <Bot size={16} className="text-clawd-text-dim flex-shrink-0" />
              <select
                value={filters.assignee}
                onChange={(e) => setFilters(f => ({ ...f, assignee: e.target.value }))}
                className="bg-clawd-surface border border-clawd-border rounded-lg px-2 py-1 text-sm"
              >
                <option value="all">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {agents
                  .filter(a => !['main', 'froggo'].includes(a.id))
                  .map(a => (
                    <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>
                  ))}
              </select>
            </div>

            {/* Show completed */}
            <label className="icon-text-tight text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showCompleted}
                onChange={(e) => setFilters(f => ({ ...f, showCompleted: e.target.checked }))}
                className="rounded"
              />
              Show completed
            </label>

            {/* Clear filters */}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="icon-text-tight text-sm text-clawd-accent hover:underline"
              >
                <X size={16} className="flex-shrink-0" /> Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-w-0 flex gap-4 p-4 overflow-x-auto">
        {columns.map((column) => {
          const columnTasks = filteredTasks.filter(t => t.status === column.id);
          const isDragOver = dragOverColumn === column.id;
          
          return (
            <div
              key={column.id}
              className={`flex-shrink-0 w-96 min-w-[320px] flex flex-col rounded-2xl border transition-all ${
                isDragOver 
                  ? 'border-clawd-accent border-dashed bg-clawd-accent/10 scale-[1.01] shadow-lg shadow-clawd-accent/20' 
                  : draggedTask 
                  ? 'border-clawd-border bg-clawd-surface/50' 
                  : 'border-clawd-border bg-clawd-surface'
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className={`p-3 border-b border-clawd-border border-l-4 ${column.color} rounded-t-2xl`}>
                <div className="flex items-center justify-between">
                  <div className="icon-text">
                    <span>{column.emoji}</span>
                    <h3 className="font-semibold text-sm">{column.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${column.bg}`}>
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddTask(column.id)}
                    className="icon-btn-sm text-clawd-text-dim hover:text-clawd-text"
                  >
                    <Plus size={16} className="flex-shrink-0" />
                  </button>
                </div>
              </div>

              {/* Tasks */}
              <div className="flex-1 min-w-0 p-2 space-y-2 overflow-y-auto min-h-0">
                {loading.tasks && columnTasks.length === 0 ? (
                  // Show skeleton while loading
                  <>
                    <TaskCardSkeleton />
                    <TaskCardSkeleton />
                    <TaskCardSkeleton />
                  </>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agents={agents}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDelete={() => handleDeleteTask(task.id)}
                      onAssign={(agentId) => assignTask(task.id, agentId)}
                      onStartAgent={() => handleSpawnAgent(task.id)}
                      onClick={() => setSelectedTask(task)}
                      onSetPriority={(priority) => handleQuickPriority(task.id, priority)}
                      onPoke={() => setPokeTask(task)}
                      isDragging={draggedTask === task.id}
                      isDeleting={deletingTasks.has(task.id)}
                      isSpawning={spawningTasks.has(task.id)}
                      isMoving={movingTasks.has(task.id)}
                    />
                  ))
                )}
                
                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-clawd-text-dim">
                    <div className="icon-badge-lg mx-auto mb-2 bg-clawd-border/50">
                      <Plus size={16} className="flex-shrink-0" />
                    </div>
                    <p className="text-xs">Drop here or click +</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-clawd-surface rounded-2xl p-6 max-w-md w-full mx-4 border border-clawd-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="icon-text text-lg font-semibold">
                <Keyboard size={20} className="flex-shrink-0" /> Keyboard Shortcuts
              </h2>
              <button onClick={() => setShowKeyboardHelp(false)} className="icon-btn-sm">
                <X size={16} className="flex-shrink-0" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span>New task</span><kbd className="px-2 py-1 bg-clawd-bg rounded">N</kbd></div>
              <div className="flex justify-between"><span>Search</span><kbd className="px-2 py-1 bg-clawd-bg rounded">⌘F</kbd></div>
              <div className="flex justify-between"><span>Close panel</span><kbd className="px-2 py-1 bg-clawd-bg rounded">Esc</kbd></div>
              <div className="flex justify-between"><span>This help</span><kbd className="px-2 py-1 bg-clawd-bg rounded">?</kbd></div>
            </div>
          </div>
        </div>
      )}

      <TaskModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        initialStatus={modalStatus}
      />
      
      <TaskDetailPanel 
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      {pokeTask && (
        <PokeModal
          taskId={pokeTask.id}
          taskTitle={pokeTask.title}
          onClose={() => setPokeTask(null)}
        />
      )}
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
  onStartAgent: () => void;
  onClick: () => void;
  onSetPriority: (priority: TaskPriority) => void;
  onPoke: () => void;
  isDragging: boolean;
  isDeleting?: boolean;
  isSpawning?: boolean;
  isMoving?: boolean;
}

const TaskCard = memo(function TaskCard({ task, agents, onDragStart, onDragEnd, onDelete, onAssign, onStartAgent, onClick, onSetPriority, onPoke, isDragging, isDeleting, isSpawning, isMoving }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [priorityBtnPos, setPriorityBtnPos] = useState<{top: number, left: number} | null>(null);
  const [assignBtnPos, setAssignBtnPos] = useState<{top: number, left: number} | null>(null);
  const [menuBtnPos, setMenuBtnPos] = useState<{top: number, left: number} | null>(null);
  
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const assignBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  
  const assignedAgent = task.assignedTo ? agents.find(a => a.id === task.assignedTo) : null;
  const isAgentWorking = assignedAgent?.currentTaskId === task.id;
  const canStart = assignedAgent && !isAgentWorking && task.status !== 'done' && task.status !== 'in-progress';
  
  // Subtask progress
  const subtaskCount = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0;
  const subtaskProgress = subtaskCount > 0 ? (completedSubtasks / subtaskCount) * 100 : 0;

  // Due date info
  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;
  
  // Priority info
  const priorityConfig = task.priority ? PRIORITIES.find(p => p.id === task.priority) : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-clawd-bg rounded-xl p-3 border transition-all cursor-pointer group relative ${
        isDragging ? 'opacity-50 scale-105 rotate-2 shadow-lg' : ''
      } ${
        isDeleting || isMoving ? 'opacity-60 pointer-events-none' : ''
      } ${
        dueInfo?.isOverdue ? 'border-red-500/50 bg-red-500/5' :
        task.priority === 'p0' ? 'border-red-500/30' :
        'border-clawd-border hover:border-clawd-accent/50'
      } hover:shadow-md hover:-translate-y-0.5`}
    >
      {/* Top row: Priority + Title + Menu */}
      <div className="flex items-start gap-2 mb-2">
        {/* Priority indicator */}
        {priorityConfig && (
          <div className="relative flex-shrink-0">
            <button
              ref={priorityBtnRef}
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!showPriority && priorityBtnRef.current) {
                  const rect = priorityBtnRef.current.getBoundingClientRect();
                  setPriorityBtnPos({ top: rect.bottom + 4, left: rect.left });
                }
                setShowPriority(!showPriority); 
              }}
              className={`p-1 rounded ${priorityConfig.bg} ${priorityConfig.color}`}
              title={priorityConfig.label}
            >
              {priorityConfig.icon}
            </button>
            
            {/* Priority Picker Modal */}
            {showPriority && priorityBtnPos && createPortal(
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setShowPriority(false)} />
                <div 
                  className="fixed bg-clawd-surface border border-clawd-border rounded-xl shadow-xl p-2 z-[101] min-w-[160px]"
                  style={{ top: `${priorityBtnPos.top}px`, left: `${priorityBtnPos.left}px` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs text-clawd-text-dim mb-2 font-medium px-2">Set Priority</div>
                  <div className="space-y-1">
                    {PRIORITIES.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { onSetPriority(p.id); setShowPriority(false); }}
                        className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 hover:bg-clawd-border transition-colors ${
                          task.priority === p.id ? `${p.bg} ${p.color}` : ''
                        }`}
                      >
                        <span className={p.color}>{p.icon}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>,
              document.body
            )}
          </div>
        )}
        
        {/* Active agent indicator + Title */}
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <TaskStatusIndicator taskId={task.id} taskStatus={task.status} assignedTo={task.assignedTo} size="sm" />
          <h4 className="font-medium text-sm leading-tight flex-1 min-w-0 line-clamp-2">{task.title}</h4>
        </div>
        
        <div className="relative flex-shrink-0">
          <button 
            ref={menuBtnRef}
            className="icon-btn-sm text-clawd-text-dim opacity-0 group-hover:opacity-100"
            onClick={(e) => { 
              e.stopPropagation(); 
              if (!showMenu && menuBtnRef.current) {
                const rect = menuBtnRef.current.getBoundingClientRect();
                setMenuBtnPos({ top: rect.bottom + 4, left: rect.right - 160 });
              }
              setShowMenu(!showMenu); 
            }}
          >
            <MoreHorizontal size={16} className="flex-shrink-0" />
          </button>
          
          {showMenu && menuBtnPos && createPortal(
            <>
              <div className="fixed inset-0 z-[100]" onClick={() => setShowMenu(false)} />
              <div className="fixed bg-clawd-surface border border-clawd-border rounded-xl shadow-xl py-1 z-[101] min-w-40"
                style={{ top: `${menuBtnPos.top}px`, left: `${menuBtnPos.left}px` }}>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (menuBtnPos) {
                      setPriorityBtnPos({ top: menuBtnPos.top, left: menuBtnPos.left });
                    }
                    setShowPriority(true); 
                    setShowMenu(false); 
                  }}
                  className="icon-text-tight w-full px-3 py-2 text-left text-sm hover:bg-clawd-border"
                >
                  <Flag size={16} className="flex-shrink-0" /> Set Priority
                </button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (menuBtnPos) {
                      setAssignBtnPos({ top: menuBtnPos.top, left: menuBtnPos.left });
                    }
                    setShowAssign(true); 
                    setShowMenu(false); 
                  }}
                  className="icon-text-tight w-full px-3 py-2 text-left text-sm hover:bg-clawd-border"
                >
                  <Bot size={16} className="flex-shrink-0" /> Assign Agent
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onPoke(); setShowMenu(false); }}
                  className="icon-text-tight w-full px-3 py-2 text-left text-sm hover:bg-clawd-border"
                >
                  <Hand size={16} className="flex-shrink-0" /> Poke
                </button>
                <hr className="my-1 border-clawd-border" />
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                  disabled={isDeleting}
                  className="icon-text-tight w-full px-3 py-2 text-left text-sm hover:bg-clawd-border text-red-400 disabled:opacity-50"
                >
                  {isDeleting ? <Spinner size={14} className="flex-shrink-0" /> : <Trash2 size={16} className="flex-shrink-0" />} 
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </>,
            document.body
          )}
        </div>
      </div>
      
      {/* Agent status / Last update */}
      {task.lastAgentUpdate && (
        <div className="text-xs text-clawd-text-dim mb-2 italic line-clamp-1 bg-clawd-surface px-2 py-1 rounded">
          💬 {task.lastAgentUpdate}
        </div>
      )}
      
      {/* Subtask Progress */}
      {subtaskCount > 0 && (
        <div className="mb-2">
          <div className="icon-text-tight text-xs text-clawd-text-dim mb-1">
            <CheckSquare size={14} className="flex-shrink-0" />
            <span>{completedSubtasks}/{subtaskCount}</span>
          </div>
          <div className="h-1 bg-clawd-surface rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                subtaskProgress === 100 ? 'bg-green-500' : 'bg-clawd-accent'
              }`}
              style={{ width: `${subtaskProgress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Bottom row: Project, Due date, Agent */}
      <div className="flex items-center justify-between gap-2 text-xs min-w-0">
        <div className="icon-text flex-1 min-w-0 min-w-0 overflow-hidden">
          <span className="icon-text-tight px-2 py-0.5 bg-clawd-surface rounded text-clawd-text-dim no-shrink no-wrap">
            <FolderOpen size={14} className="no-shrink" />
            {task.project}
          </span>
          
          {dueInfo && (
            <span className={`icon-text-tight px-2 py-0.5 rounded no-shrink no-wrap ${
              dueInfo.isOverdue ? 'bg-red-500/20 text-red-400' :
              dueInfo.isDueSoon ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-clawd-surface text-clawd-text-dim'
            }`}>
              <Calendar size={14} className="no-shrink" />
              {dueInfo.text}
            </span>
          )}
        </div>
        
        <div className="relative flex-shrink-0">
          {assignedAgent ? (
            <div className="flex items-center gap-1.5 no-shrink">
              {isAgentWorking ? (
                <span className="icon-badge-sm bg-yellow-500/20 text-yellow-400 animate-pulse">
                  <Zap size={14} className="no-shrink" />
                </span>
              ) : canStart ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onStartAgent(); }}
                  disabled={isSpawning}
                  className="icon-badge-sm bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSpawning ? <Spinner size={14} className="no-shrink" /> : <Play size={14} className="no-shrink" />}
                </button>
              ) : null}
              <button 
                ref={assignBtnRef}
                className="icon-text-tight px-2 py-0.5 bg-clawd-accent/10 text-clawd-accent rounded hover:bg-clawd-accent/20 no-shrink"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (!showAssign && assignBtnRef.current) {
                    const rect = assignBtnRef.current.getBoundingClientRect();
                    setAssignBtnPos({ top: rect.bottom + 4, left: rect.right - 160 });
                  }
                  setShowAssign(true); 
                }}
              >
                <AgentAvatar agentId={assignedAgent.id} fallbackEmoji={assignedAgent.avatar} size="xs" />
              </button>
            </div>
          ) : (
            <button 
              ref={assignBtnRef}
              className="icon-btn-sm text-clawd-text-dim hover:text-clawd-accent no-shrink"
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!showAssign && assignBtnRef.current) {
                  const rect = assignBtnRef.current.getBoundingClientRect();
                  setAssignBtnPos({ top: rect.bottom + 4, left: rect.right - 160 });
                }
                setShowAssign(true); 
              }}
            >
              <User size={14} className="no-shrink" />
            </button>
          )}
          
          {/* Assign Agent Modal */}
          {showAssign && assignBtnPos && createPortal(
            <>
              <div className="fixed inset-0 z-[100]" onClick={() => setShowAssign(false)} />
              <div 
                className="fixed bg-clawd-surface border border-clawd-border rounded-xl shadow-xl p-2 z-[101] min-w-[160px]"
                style={{ top: `${assignBtnPos.top}px`, left: `${assignBtnPos.left}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs text-clawd-text-dim mb-2 font-medium px-2">Assign to agent</div>
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
                      <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="sm" />
                      {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            </>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.assignedTo === nextProps.task.assignedTo &&
    prevProps.task.lastAgentUpdate === nextProps.task.lastAgentUpdate &&
    prevProps.task.updatedAt === nextProps.task.updatedAt &&
    prevProps.task.dueDate === nextProps.task.dueDate &&
    (prevProps.task.subtasks?.length || 0) === (nextProps.task.subtasks?.length || 0) &&
    prevProps.isDragging === nextProps.isDragging
  );
});
