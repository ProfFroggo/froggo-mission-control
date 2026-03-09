import { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { useEventBus } from '../lib/useEventBus';
import { createPortal } from 'react-dom';
import {
  Plus, MoreHorizontal, Bot, Trash2, FolderOpen, Clock, User, Play, Zap,
  CheckSquare, Filter, Search, AlertTriangle, Calendar, ArrowUp, ArrowDown, RefreshCw, Keyboard, X, Flag, Circle, Hand, Stethoscope, Archive, ShieldCheck, ShieldX, ShieldAlert,
  CheckCircle, Ban, FileText
} from 'lucide-react';
import { useStore, Task, TaskStatus, TaskPriority } from '../store/store';
import { useShallow } from 'zustand/react/shallow';
import TaskModal from './TaskModal';
import TaskDetailPanel from './TaskDetailPanel';
import PokeModal from './PokeModal';
import AgentAvatar from './AgentAvatar';
import { showToast } from './Toast';
import { taskApi, sessionApi } from '../lib/api';
import { isProtectedAgent } from '../lib/agentConfig';
import { Spinner, TaskCardSkeleton } from './LoadingStates';
import ErrorDisplay from './ErrorDisplay';
import EmptyState from './EmptyState';
import HealthCheckModal from './HealthCheckModal';
import { safeStorage } from '../utils/safeStorage';
import ConfirmDialog from './ConfirmDialog';

// Priority config - STANDARDIZED ICON SIZE: xs (12px)
const PRIORITIES: { id: TaskPriority; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'p0', label: 'Urgent', color: 'text-error', bg: 'bg-error-subtle', icon: <AlertTriangle size={14} className="flex-shrink-0" /> },
  { id: 'p1', label: 'High', color: 'text-warning', bg: 'bg-warning-subtle', icon: <ArrowUp size={14} className="flex-shrink-0" /> },
  { id: 'p2', label: 'Medium', color: 'text-info', bg: 'bg-info-subtle', icon: <Circle size={14} className="flex-shrink-0" /> },
  { id: 'p3', label: 'Low', color: 'text-mission-control-text-dim', bg: 'bg-mission-control-bg0/20', icon: <ArrowDown size={14} className="flex-shrink-0" /> },
];

// Format due date
function formatDueDate(timestamp: number): { text: string; isOverdue: boolean; isDueSoon: boolean } {
  const now = Date.now();
  const diff = timestamp - now;
  const isOverdue = diff < 0;

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

const columns: { id: TaskStatus; title: string; color: string; iconColor: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'todo',            title: 'To Do',            color: 'border-t-info',    iconColor: 'text-info',    bg: 'bg-info-subtle',    icon: <FileText size={14} /> },
  { id: 'internal-review', title: 'Ready to Start',  color: 'border-t-review',  iconColor: 'text-review',  bg: 'bg-review-subtle',  icon: <Search size={14} /> },
  { id: 'in-progress',     title: 'In Progress',      color: 'border-t-warning', iconColor: 'text-warning', bg: 'bg-warning-subtle', icon: <Zap size={14} /> },
  { id: 'review',          title: 'Agent Review',     color: 'border-t-review',  iconColor: 'text-review',  bg: 'bg-review-subtle',  icon: <Bot size={14} /> },
  { id: 'human-review',    title: 'Human Review',     color: 'border-t-warning', iconColor: 'text-warning', bg: 'bg-warning-subtle', icon: <User size={14} /> },
  { id: 'done',            title: 'Done',             color: 'border-t-success', iconColor: 'text-success', bg: 'bg-success-subtle', icon: <CheckCircle size={14} /> },
];

interface Filters {
  search: string;
  project: string;
  priority: TaskPriority | 'all';
  assignee: string;
  hasDueDate: boolean | null;
  showCompleted: boolean;
}

interface KanbanProps {
  /** When set, only tasks belonging to this project are shown */
  projectId?: string;
  projectName?: string;
  /** Override the "New Task" action (e.g. open a project dispatch modal) */
  onNewTask?: () => void;
}

export default function Kanban({ projectId, projectName, onNewTask }: KanbanProps = {}) {
  const { tasks, agents, loading, taskCounts } = useStore(
    useShallow(s => ({
      tasks: s.tasks,
      agents: s.agents,
      loading: s.loading,
      taskCounts: s.taskCounts,
    }))
  );
  const moveTask = useStore(s => s.moveTask);
  const deleteTask = useStore(s => s.deleteTask);
  const assignTask = useStore(s => s.assignTask);
  const spawnAgentForTask = useStore(s => s.spawnAgentForTask);
  const loadTasksFromDB = useStore(s => s.loadTasksFromDB);
  const updateTask = useStore(s => s.updateTask);
  
  // Local loading states for operations
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());
  const [spawningTasks, setSpawningTasks] = useState<Set<string>>(new Set());
  const [movingTasks, setMovingTasks] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  
  // Active agent sessions (for real-time activity indicators)
  const [activeSessions, setActiveSessions] = useState<Record<string, boolean>>({});
  
  // Load tasks from mission-control-db on mount and poll (only when visible)
  useEffect(() => {
    loadTasksFromDB().catch(err => setTaskLoadError(err instanceof Error ? err.message : 'Failed to load tasks'));
    
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
  
  // Phase 82: SSE-driven real-time task updates (fallback: 30s polling above)
  useEventBus('task.created', () => {
    loadTasksFromDB().catch(() => {});
  });
  useEventBus('task.updated', () => {
    loadTasksFromDB().catch(() => {});
  });

  // Poll active agent sessions for activity indicators
  useEffect(() => {
    const pollActiveSessions = async () => {
      try {
        const result = await sessionApi.getAll();
        if (Array.isArray(result)) {
          const activeMap: Record<string, boolean> = {};
          result.forEach((s: any) => {
            if (s.agentId) activeMap[s.agentId] = true;
          });
          setActiveSessions(activeMap);
        }
      } catch (err) {
        // 'Failed to poll active sessions:', err;
      }
    };
    
    pollActiveSessions(); // Initial poll
    const interval = setInterval(pollActiveSessions, 30000); // Poll every 30s
    
    return () => clearInterval(interval);
  }, []);
  
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<TaskStatus>('todo');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [pokeTask, setPokeTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    project: 'all',
    priority: 'all',
    assignee: 'all',
    hasDueDate: null,
    showCompleted: true,
  });

  // Per-column filter and sort settings
  type SortOption = 'newest' | 'oldest' | 'priority-asc' | 'priority-desc' | 'progress-asc' | 'progress-desc';

  interface ColumnSettings {
    sortBy: SortOption;
    filterAgent: string; // 'all' or agent ID
    filterPriority: TaskPriority | 'all';
  }

  const [columnSettings, setColumnSettings] = useState<Record<TaskStatus, ColumnSettings>>(() => {
    const saved = safeStorage.getItem('kanban-column-settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // 'Failed to parse column settings:', e;
      }
    }

    // Default settings for each column
    return columns.reduce((acc, col) => {
      acc[col.id] = {
        sortBy: 'newest',
        filterAgent: 'all',
        filterPriority: 'all',
      };
      return acc;
    }, {} as Record<TaskStatus, ColumnSettings>);
  });

  // Column control dropdowns state
  const [columnDropdowns, setColumnDropdowns] = useState<Record<TaskStatus, { sort: boolean; filter: boolean }>>(() => 
    columns.reduce((acc, col) => {
      acc[col.id] = { sort: false, filter: false };
      return acc;
    }, {} as Record<TaskStatus, { sort: boolean; filter: boolean }>)
  );

  // Persist column settings to localStorage
  useEffect(() => {
    safeStorage.setItem('kanban-column-settings', JSON.stringify(columnSettings));
  }, [columnSettings]);

  const updateColumnSetting = (columnId: TaskStatus, key: keyof ColumnSettings, value: any) => {
    setColumnSettings(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        [key]: value,
      },
    }));
  };

  const toggleColumnDropdown = (columnId: TaskStatus, dropdown: 'sort' | 'filter') => {
    setColumnDropdowns(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        [dropdown]: !prev[columnId][dropdown],
      },
    }));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleAddTask('todo');
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

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    // When scoped to a project, pre-filter before user filters
    let result = projectId
      ? tasks.filter(t => t.project_id === projectId || t.project === projectName)
      : tasks;

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

  // Apply per-column filtering and sorting
  const getColumnTasks = useCallback((columnId: TaskStatus) => {
    const settings = columnSettings[columnId];
    let columnTasks = filteredTasks.filter(t => t.status === columnId);
    
    // Apply column filters
    if (settings.filterAgent !== 'all') {
      if (settings.filterAgent === 'unassigned') {
        columnTasks = columnTasks.filter(t => !t.assignedTo);
      } else {
        columnTasks = columnTasks.filter(t => t.assignedTo === settings.filterAgent);
      }
    }
    
    if (settings.filterPriority !== 'all') {
      columnTasks = columnTasks.filter(t => t.priority === settings.filterPriority);
    }
    
    // Apply column sorting
    return columnTasks.sort((a, b) => {
      switch (settings.sortBy) {
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'priority-asc': {
          const priorityOrder = { p0: 0, p1: 1, p2: 2, p3: 3, undefined: 4 };
          return (priorityOrder[a.priority || 'undefined'] - priorityOrder[b.priority || 'undefined']);
        }
        case 'priority-desc': {
          const priorityOrder = { p0: 0, p1: 1, p2: 2, p3: 3, undefined: 4 };
          return (priorityOrder[b.priority || 'undefined'] - priorityOrder[a.priority || 'undefined']);
        }
        case 'progress-asc':
          return (a.progress || 0) - (b.progress || 0);
        case 'progress-desc':
          return (b.progress || 0) - (a.progress || 0);
        default:
          return 0;
      }
    });
  }, [filteredTasks, columnSettings]);

  // Stats
  const stats = useMemo(() => {
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < Date.now() && t.status !== 'done').length;
    const urgent = tasks.filter(t => t.priority === 'p0' && t.status !== 'done').length;
    const unassigned = tasks.filter(t => !t.assignedTo && t.status !== 'done' && t.status !== 'failed').length;
    return { inProgress, overdue, urgent, unassigned };
  }, [tasks]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

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

    // All validations passed - move the task
    handleMoveTask(draggedTask, status);
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverColumn(null);
  }, []);

  const handleAddTask = (status: TaskStatus) => {
    if (onNewTask) { onNewTask(); return; }
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

  const handleHealthCheck = () => {
    setShowHealthCheck(true);
  };

  const handleDeleteTask = useCallback(async (taskId: string) => {
    setDeletingTasks(prev => new Set(prev).add(taskId));
    try {
      await deleteTask(taskId);
      showToast('success', 'Task deleted');
    } catch (_error) {
      showToast('error', 'Failed to delete task');
    } finally {
      setDeletingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [deleteTask]);

  const handleArchiveDone = async () => {
    setShowArchiveConfirm(false);
    setIsArchiving(true);
    try {
      // Archive done tasks via REST API
      const doneTasks = tasks.filter(t => t.status === 'done');
      let archivedCount = 0;
      for (const t of doneTasks) {
        try {
          await taskApi.update(t.id, { status: 'archived' });
          archivedCount++;
        } catch { /* skip failed */ }
      }
      showToast('success', `Archived ${archivedCount} done tasks`);
      await loadTasksFromDB();
    } catch (_error) {
      showToast('error', 'Failed to archive tasks');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleSpawnAgent = useCallback(async (taskId: string) => {
    setSpawningTasks(prev => new Set(prev).add(taskId));
    try {
      await spawnAgentForTask(taskId);
      showToast('success', 'Agent spawned successfully');
    } catch (_error) {
      showToast('error', 'Failed to spawn agent');
    } finally {
      setSpawningTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [spawnAgentForTask]);

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

  if (taskLoadError) {
    return (
      <ErrorDisplay
        error={taskLoadError}
        context={{ action: 'load tasks', resource: 'task board' }}
        onRetry={() => { setTaskLoadError(null); loadTasksFromDB().catch(err => setTaskLoadError(err instanceof Error ? err.message : 'Failed to load tasks')); }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-heading-2 icon-text">
              Task Board
              <span className="text-secondary font-normal">
                Press <kbd className="px-1.5 py-0.5 bg-mission-control-bg rounded text-xs">?</kbd> for shortcuts
              </span>
            </h1>
            <div className="flex items-center gap-4 text-secondary mt-1">
              <span>{tasks.length} tasks</span>
              {stats.inProgress > 0 && (
                <span className="icon-text-tight text-warning">
                  <Zap size={14} className="flex-shrink-0" /> {stats.inProgress} in progress
                </span>
              )}
              {stats.urgent > 0 && (
                <span className="icon-text-tight text-error">
                  <AlertTriangle size={14} className="flex-shrink-0" /> {stats.urgent} urgent
                </span>
              )}
              {stats.overdue > 0 && (
                <span className="icon-text-tight text-error">
                  <Clock size={14} className="flex-shrink-0" /> {stats.overdue} overdue
                </span>
              )}
              {stats.unassigned > 0 && (
                <span className="icon-text-tight text-mission-control-text-dim">
                  <User size={14} className="flex-shrink-0" /> {stats.unassigned} unassigned
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim flex-shrink-0" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="pl-9 pr-4 py-2 bg-mission-control-bg rounded-xl border border-mission-control-border text-sm w-48 focus:outline-none focus:border-mission-control-accent"
              />
            </div>

            {/* Filter button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`icon-text px-3 py-2 rounded-xl border transition-all ${
                activeFiltersCount > 0
                  ? 'bg-mission-control-accent/20 border-mission-control-accent text-mission-control-accent'
                  : 'bg-mission-control-bg border-mission-control-border hover:border-mission-control-accent/50'
              }`}
            >
              <Filter size={16} className="flex-shrink-0" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 bg-mission-control-accent text-white text-xs rounded-full flex-shrink-0 whitespace-nowrap">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="icon-btn border border-mission-control-border hover:border-mission-control-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh tasks"
            >
              <RefreshCw size={16} className={`flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Health Check */}
            <button
              onClick={handleHealthCheck}
              className="icon-text px-3 py-2 border border-success-border text-success rounded-xl hover:bg-success-subtle transition-all"
              title="Request Mission Control to review board health, merge redundant tasks, and verify workflow"
            >
              <Stethoscope size={16} className="flex-shrink-0" />
              Health Check
            </button>
            
            {/* New Task */}
            <button
              onClick={() => handleAddTask('todo')}
              title="New task (N)"
              className="icon-text px-4 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-all hover:scale-105"
            >
              <Plus size={16} className="flex-shrink-0" />
              New Task
              <kbd className="px-1.5 py-0.5 bg-mission-control-text/20 rounded text-xs">N</kbd>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="flex items-center gap-4 p-4 bg-mission-control-bg rounded-xl border border-mission-control-border animate-in slide-in-from-top-2">
            {/* Project — hidden when already scoped to a project */}
            {!projectId && (
              <div className="icon-text-tight">
                <FolderOpen size={16} className="text-mission-control-text-dim flex-shrink-0" />
                <select
                  value={filters.project}
                  onChange={(e) => setFilters(f => ({ ...f, project: e.target.value }))}
                  className="bg-mission-control-surface border border-mission-control-border rounded-lg px-2 py-1 text-sm"
                >
                  {projects.map(p => (
                    <option key={p} value={p}>{p === 'all' ? 'All Projects' : p}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Priority */}
            <div className="icon-text-tight">
              <Flag size={16} className="text-mission-control-text-dim flex-shrink-0" />
              <select
                value={filters.priority}
                onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value as TaskPriority | 'all' }))}
                className="bg-mission-control-surface border border-mission-control-border rounded-lg px-2 py-1 text-sm"
              >
                <option value="all">All Priorities</option>
                {PRIORITIES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="icon-text-tight">
              <Bot size={16} className="text-mission-control-text-dim flex-shrink-0" />
              <select
                value={filters.assignee}
                onChange={(e) => setFilters(f => ({ ...f, assignee: e.target.value }))}
                className="bg-mission-control-surface border border-mission-control-border rounded-lg px-2 py-1 text-sm"
              >
                <option value="all">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {agents
                  .filter(a => !isProtectedAgent(a.id))
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
                className="icon-text-tight text-sm text-mission-control-accent hover:underline"
              >
                <X size={16} className="flex-shrink-0" /> Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Kanban Board */}
      {!loading.tasks && filteredTasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            type="tasks"
            description={filters.search || filters.project !== 'all' || filters.priority !== 'all' || filters.assignee !== 'all'
              ? 'No tasks match your current filters. Try adjusting your search or filters.'
              : 'No tasks yet. Create a task to get started.'}
            action={{ label: 'New Task', onClick: () => handleAddTask('todo') }}
          />
        </div>
      )}
      <div className={`flex-1 min-w-0 flex gap-4 p-4 overflow-x-auto ${!loading.tasks && filteredTasks.length === 0 ? 'hidden' : ''}`}>
        {columns.map((column) => {
          const columnTasks = getColumnTasks(column.id);
          const settings = columnSettings[column.id];
          const dropdowns = columnDropdowns[column.id];
          const isDragOver = dragOverColumn === column.id;
          
          return (
            <div
              key={column.id}
              data-column={column.id}
              className={`flex-shrink-0 w-96 min-w-[320px] flex flex-col rounded-2xl border transition-all ${
                isDragOver 
                  ? 'border-mission-control-accent border-dashed bg-mission-control-accent/10 scale-[1.01] shadow-lg shadow-mission-control-accent/20' 
                  : draggedTask 
                  ? 'border-mission-control-border bg-mission-control-surface/50' 
                  : 'border-mission-control-border bg-mission-control-surface'
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  // Could open column actions
                }
              }}
              aria-label={`Kanban column: ${column.title}`}
            >
              {/* Column Header */}
              <div className={`p-3 border-b border-mission-control-border border-t-2 ${column.color} rounded-t-2xl`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="icon-text">
                    <span className={column.iconColor}>{column.icon}</span>
                    <h3 className="font-semibold text-sm">{column.title}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${column.bg} ${column.iconColor}`} title={column.id === 'done' && taskCounts.totalArchived > 0 ? `${taskCounts.totalArchived} archived` : undefined}>
                      {column.id === 'done' && taskCounts.totalDone > columnTasks.length 
                        ? `${columnTasks.length}/${taskCounts.totalDone}`
                        : columnTasks.length}
                    </span>
                  </div>
                  {column.id === 'done' ? (
                    <button
                      onClick={() => setShowArchiveConfirm(true)}
                      disabled={isArchiving || columnTasks.length === 0}
                      className="icon-btn-sm text-mission-control-text-dim hover:text-mission-control-text disabled:opacity-50"
                      title="Archive all done tasks"
                    >
                      <Archive size={16} className="flex-shrink-0" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddTask(column.id)}
                      className="icon-btn-sm text-mission-control-text-dim hover:text-mission-control-text"
                    >
                      <Plus size={16} className="flex-shrink-0" />
                    </button>
                  )}
                </div>
                
                {/* Filter and Sort Controls */}
                <div className="flex items-center gap-1">
                  {/* Sort Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => toggleColumnDropdown(column.id, 'sort')}
                      className={`icon-btn-sm text-mission-control-text-dim hover:text-mission-control-text ${settings.sortBy !== 'newest' ? 'text-mission-control-accent' : ''}`}
                      title="Sort"
                    >
                      <ArrowDown size={14} className="flex-shrink-0" />
                    </button>
                    {dropdowns.sort && (
                      <div className="absolute top-full left-0 mt-1 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg z-50 min-w-[180px]">
                        <div className="p-1">
                          <button type="button" onClick={() => { updateColumnSetting(column.id, 'sortBy', 'newest'); toggleColumnDropdown(column.id, 'sort'); }} className={`w-full text-left px-3 py-2 rounded hover:bg-mission-control-border text-sm ${settings.sortBy === 'newest' ? 'text-mission-control-accent' : ''}`}>Newest First</button>
                          <button type="button" onClick={() => { updateColumnSetting(column.id, 'sortBy', 'oldest'); toggleColumnDropdown(column.id, 'sort'); }} className={`w-full text-left px-3 py-2 rounded hover:bg-mission-control-border text-sm ${settings.sortBy === 'oldest' ? 'text-mission-control-accent' : ''}`}>Oldest First</button>
                          <button type="button" onClick={() => { updateColumnSetting(column.id, 'sortBy', 'priority-asc'); toggleColumnDropdown(column.id, 'sort'); }} className={`w-full text-left px-3 py-2 rounded hover:bg-mission-control-border text-sm ${settings.sortBy === 'priority-asc' ? 'text-mission-control-accent' : ''}`}>Priority: Low → High</button>
                          <button type="button" onClick={() => { updateColumnSetting(column.id, 'sortBy', 'priority-desc'); toggleColumnDropdown(column.id, 'sort'); }} className={`w-full text-left px-3 py-2 rounded hover:bg-mission-control-border text-sm ${settings.sortBy === 'priority-desc' ? 'text-mission-control-accent' : ''}`}>Priority: High → Low</button>
                          <button type="button" onClick={() => { updateColumnSetting(column.id, 'sortBy', 'progress-asc'); toggleColumnDropdown(column.id, 'sort'); }} className={`w-full text-left px-3 py-2 rounded hover:bg-mission-control-border text-sm ${settings.sortBy === 'progress-asc' ? 'text-mission-control-accent' : ''}`}>Progress: 0% → 100%</button>
                          <button type="button" onClick={() => { updateColumnSetting(column.id, 'sortBy', 'progress-desc'); toggleColumnDropdown(column.id, 'sort'); }} className={`w-full text-left px-3 py-2 rounded hover:bg-mission-control-border text-sm ${settings.sortBy === 'progress-desc' ? 'text-mission-control-accent' : ''}`}>Progress: 100% → 0%</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Filter Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => toggleColumnDropdown(column.id, 'filter')}
                      className={`icon-btn-sm text-mission-control-text-dim hover:text-mission-control-text ${settings.filterAgent !== 'all' || settings.filterPriority !== 'all' ? 'text-mission-control-accent' : ''}`}
                      title="Filter"
                    >
                      <Filter size={14} className="flex-shrink-0" />
                    </button>
                    {dropdowns.filter && (
                      <div className="absolute top-full left-0 mt-1 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg z-50 min-w-[180px]">
                        <div className="p-2 border-b border-mission-control-border">
                          <div className="text-xs font-semibold text-mission-control-text-dim mb-1">Agent</div>
                          <select
                            value={settings.filterAgent}
                            onChange={(e) => updateColumnSetting(column.id, 'filterAgent', e.target.value)}
                            className="w-full bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-sm"
                          >
                            <option value="all">All Agents</option>
                            <option value="unassigned">Unassigned</option>
                            {agents.map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-semibold text-mission-control-text-dim mb-1">Priority</div>
                          <select
                            value={settings.filterPriority}
                            onChange={(e) => updateColumnSetting(column.id, 'filterPriority', e.target.value as TaskPriority | 'all')}
                            className="w-full bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-sm"
                          >
                            <option value="all">All Priorities</option>
                            {PRIORITIES.map(p => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                        {(settings.filterAgent !== 'all' || settings.filterPriority !== 'all') && (
                          <div className="p-2 border-t border-mission-control-border">
                            <button
                              onClick={() => {
                                updateColumnSetting(column.id, 'filterAgent', 'all');
                                updateColumnSetting(column.id, 'filterPriority', 'all');
                              }}
                              className="w-full text-sm text-mission-control-accent hover:underline"
                            >
                              Clear Filters
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="flex-1 min-w-0 p-2 space-y-2 overflow-y-auto min-h-0">
                {isDragOver && (
                  <div className="w-full h-0.5 bg-mission-control-accent rounded-full mb-2 animate-pulse" />
                )}
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
                      activeSessions={activeSessions}
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
                
                {columnTasks.length === 0 && !loading.tasks && (
                  column.id !== 'done' ? (
                    <button
                      onClick={() => handleAddTask(column.id)}
                      className="flex flex-col items-center justify-center py-8 w-full text-mission-control-text-dim hover:text-mission-control-text opacity-50 hover:opacity-80 transition-all group"
                      title={`Add task to ${column.title}`}
                    >
                      <Plus size={20} className="mb-1 group-hover:scale-110 transition-transform" />
                      <p className="text-xs">Add task</p>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-mission-control-text-dim opacity-40">
                      <p className="text-xs">No done tasks</p>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHelp && (
        <div 
          className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" 
          onClick={() => setShowKeyboardHelp(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setShowKeyboardHelp(false); } }}
          role="button"
          tabIndex={0}
          aria-label="Close keyboard shortcuts"
        >
          <div 
            className="bg-mission-control-surface rounded-2xl p-6 max-w-md w-full mx-4 border border-mission-control-border" 
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="icon-text text-heading-3">
                <Keyboard size={20} className="flex-shrink-0" /> Keyboard Shortcuts
              </h2>
              <button type="button" onClick={() => setShowKeyboardHelp(false)} className="icon-btn-sm">
                <X size={16} className="flex-shrink-0" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span>New task</span><kbd className="px-2 py-1 bg-mission-control-bg rounded">N</kbd></div>
              <div className="flex justify-between"><span>Search</span><kbd className="px-2 py-1 bg-mission-control-bg rounded">Cmd+F</kbd></div>
              <div className="flex justify-between"><span>Close panel</span><kbd className="px-2 py-1 bg-mission-control-bg rounded">Esc</kbd></div>
              <div className="flex justify-between"><span>This help</span><kbd className="px-2 py-1 bg-mission-control-bg rounded">?</kbd></div>
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

      {showHealthCheck && (
        <HealthCheckModal
          onClose={() => setShowHealthCheck(false)}
          stats={{
            totalTasks: tasks.length,
            inProgress: stats.inProgress,
            urgent: stats.urgent,
            overdue: stats.overdue,
            unassigned: stats.unassigned,
          }}
        />
      )}

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={async () => {
          setIsArchiving(true);
          try {
            const doneTasks = tasks.filter(t => t.status === 'done');
            let archivedCount = 0;
            for (const t of doneTasks) {
              try {
                await taskApi.update(t.id, { status: 'archived' });
                archivedCount++;
              } catch { /* skip failed */ }
            }
            showToast('success', `Archived ${archivedCount} done tasks`);
            await loadTasksFromDB();
          } catch (_error) {
            showToast('error', 'Failed to archive tasks');
          } finally {
            setIsArchiving(false);
          }
        }}
        title="Archive Done Tasks"
        message={`Are you sure you want to archive all ${tasks.filter(t => t.status === 'done').length} done tasks? They will be removed from the board but can still be accessed in the archive.`}
        confirmLabel="Archive"
        cancelLabel="Cancel"
        type="warning"
        loading={isArchiving}
      />
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  agents: { id: string; name: string; avatar?: string; status?: string; currentTaskId?: string }[];
  activeSessions: Record<string, boolean>;
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

const TaskCard = memo(function TaskCard({ task, agents, activeSessions: _activeSessions, onDragStart, onDragEnd, onDelete, onAssign, onStartAgent, onClick, onSetPriority, onPoke, isDragging, isDeleting, isSpawning, isMoving }: TaskCardProps) {
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
  
  // Agent status indicator - based on actual task activity, not just session
  const getAgentStatus = (): 'active' | 'paused' | 'blocked' | 'idle' | undefined => {
    if (!task.assignedTo) return undefined;
    
    // Blocked: task status is review or internal-review (waiting on someone else)
    if (task.status === 'review' || task.status === 'internal-review') return 'blocked';
    
    // Idle: task assigned but not started (todo status)
    if (task.status === 'todo') return 'idle';
    
    // For in-progress tasks, check ACTUAL task activity (not just session status)
    if (task.status === 'in-progress' && (task as any).last_activity_at) {
      const now = Date.now();
      const lastActivity = (task as any).last_activity_at;
      const minutesSinceActivity = (now - lastActivity) / (1000 * 60);
      
      // Active: activity in last 15 minutes
      if (minutesSinceActivity < 15) return 'active';
      
      // Paused: no activity in 15+ minutes (yellow/red indicators will show in UI)
      return 'paused';
    }
    
    // Fallback: in-progress with no activity tracking
    if (task.status === 'in-progress') return 'paused';
    
    return undefined;
  };

  // Activity indicator color - shows real-time task activity
  const getActivityIndicator = (): { color: string; description: string } | null => {
    // Only show for in-progress tasks with assigned agents
    if (task.status !== 'in-progress' || !task.assignedTo) return null;
    
    const lastActivity = (task as any).last_activity_at;
    
    // 🟠 Orange: Silent agent - assigned but no activity logged
    if (!lastActivity) {
      return { color: 'border-warning-border', description: 'Silent agent (no activity logged)' };
    }
    
    const now = Date.now();
    const minutesSinceActivity = (now - lastActivity) / (1000 * 60);
    
    // 🟢 Green: Active work in last 15 minutes
    if (minutesSinceActivity < 15) {
      return { color: 'border-success-border', description: `Active (${Math.floor(minutesSinceActivity)}m ago)` };
    }
    
    // 🟡 Yellow: Stale, no activity in 15-30 minutes
    if (minutesSinceActivity < 30) {
      return { color: 'border-warning-border', description: `Stale (${Math.floor(minutesSinceActivity)}m ago)` };
    }
    
    // 🔴 Red: Stuck/abandoned, no activity in 30+ minutes
    return { color: 'border-error-border', description: `Stuck (${Math.floor(minutesSinceActivity)}m ago)` };
  };
  
  // Subtask progress
  const subtaskCount = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0;
  const subtaskProgress = subtaskCount > 0 ? (completedSubtasks / subtaskCount) * 100 : 0;

  // Due date info
  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;
  
  // Priority info
  const priorityConfig = task.priority ? PRIORITIES.find(p => p.id === task.priority) : null;

  // Activity indicator (takes precedence for in-progress tasks)
  const activityIndicator = getActivityIndicator();

  // Definition of Ready check for todo/backlog tasks
  const isTodoTask = task.status === 'todo' || (task.status as string) === 'backlog';
  const hasMinSubtasks = (task.subtasks?.length || 0) >= 2;
  const hasPriority = task.priority && ['p0', 'p1', 'p2', 'p3'].includes(task.priority);
  const hasValidAssignment = task.assignedTo && !isProtectedAgent(task.assignedTo);
  const hasDescription = (task.description?.length || 0) >= 20;
  const isReady = hasMinSubtasks && hasPriority && hasValidAssignment && hasDescription;

  // Missing criteria for badge display
  const missingCriteria: string[] = [];
  if (!hasMinSubtasks) missingCriteria.push('subtasks');
  if (!hasPriority) missingCriteria.push('priority');
  if (!hasValidAssignment) missingCriteria.push('assignee');
  if (!hasDescription) missingCriteria.push('description');

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      aria-label={`Task: ${task.title}, status: ${task.status}`}
      className={`bg-mission-control-bg rounded-xl p-3 border-2 transition-all cursor-pointer group relative ${
        isDragging ? 'opacity-50 scale-105 rotate-2 shadow-lg' : ''
      } ${
        isDeleting || isMoving ? 'opacity-60 pointer-events-none' : ''
      } ${
        task.status === 'in-progress'
          ? 'border-success/60 bg-success-subtle shadow-[0_0_0_1px_rgba(34,197,94,0.2)]'
          /* TODO: move to CSS token when design system tokens include status colors */
          : activityIndicator ? activityIndicator.color
          : dueInfo?.isOverdue ? 'border-error-border bg-error-subtle'
          : task.priority === 'p0' ? 'border-error-border'
          : 'border-mission-control-border hover:border-mission-control-accent/50'
      } hover:shadow-md hover:-translate-y-0.5`}
      title={activityIndicator?.description}
    >
      {/* Top row: Priority + Title + Menu */}
      <div className="flex items-start gap-1.5 mb-2">
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
              className={`p-0.5 rounded ${priorityConfig.bg} ${priorityConfig.color}`}
              title={priorityConfig.label}
            >
              {priorityConfig.icon}
            </button>
            
            {/* Priority Picker Modal */}
            {showPriority && priorityBtnPos && createPortal(
              <>
                <div 
                  className="fixed inset-0 z-[100]" 
                  onClick={() => setShowPriority(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setShowPriority(false); } }}
                  role="button"
                  tabIndex={0}
                  aria-label="Close priority dropdown"
                />
                <div 
                  className="fixed bg-mission-control-surface border border-mission-control-border rounded-xl shadow-xl p-2 z-[101] min-w-[160px]"
                  style={{ top: `${priorityBtnPos.top}px`, left: `${priorityBtnPos.left}px` }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  <div className="text-xs text-mission-control-text-dim mb-2 font-medium px-2">Set Priority</div>
                  <div className="space-y-1">
                    {PRIORITIES.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { onSetPriority(p.id); setShowPriority(false); }}
                        className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 hover:bg-mission-control-border transition-colors ${
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
        
        {/* Title */}
        <div className="flex flex-col flex-1 min-w-0">
          <h4 className="font-medium text-sm leading-tight flex-1 min-w-0 truncate">{task.title}</h4>
          {task.updatedAt && (
            <span className="text-[10px] text-mission-control-text-dim mt-0.5">
              {(() => {
                const diff = Date.now() - task.updatedAt;
                if (diff < 60000) return 'just now';
                if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                return `${Math.floor(diff / 86400000)}d ago`;
              })()}
            </span>
          )}
        </div>
        
        {/* Definition of Ready Indicators - show for todo/backlog tasks */}
        {isTodoTask && !isReady && (
          <div className="flex flex-wrap gap-1 mt-1" title={`Missing: ${missingCriteria.join(', ')}`}>
            {!hasMinSubtasks && (
              <span className="text-[10px] px-1.5 py-0.5 bg-warning-subtle text-warning rounded inline-flex items-center gap-0.5">
                <AlertTriangle size={10} className="inline" /> {task.subtasks?.length || 0}/2 subtasks
              </span>
            )}
            {!hasPriority && (
              <span className="text-[10px] px-1.5 py-0.5 bg-error-subtle text-error rounded inline-flex items-center gap-0.5">
                <AlertTriangle size={10} className="inline" /> No priority
              </span>
            )}
            {!hasValidAssignment && (
              <span className="text-[10px] px-1.5 py-0.5 bg-error-subtle text-error rounded inline-flex items-center gap-0.5">
                <AlertTriangle size={10} className="inline" /> No valid assignee
              </span>
            )}
            {!hasDescription && (
              <span className="text-[10px] px-1.5 py-0.5 bg-warning-subtle text-warning rounded inline-flex items-center gap-0.5">
                <AlertTriangle size={10} className="inline" /> Needs description
              </span>
            )}
          </div>
        )}
        
        {/* Ready badge for todo tasks that ARE ready */}
        {isTodoTask && isReady && (
          <div className="mt-1" title="Definition of Ready met">
            <span className="text-[10px] px-1.5 py-0.5 bg-success-subtle text-success rounded inline-flex items-center gap-0.5">
              <CheckCircle size={10} className="inline" /> Ready for Review
            </span>
          </div>
        )}
        
        <div className="relative flex-shrink-0">
          <button 
            ref={menuBtnRef}
            className="icon-btn-sm text-mission-control-text-dim opacity-60 hover:opacity-100"
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
              <div className="fixed inset-0 z-[100]" onClick={() => setShowMenu(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowMenu(false); } }} role="button" tabIndex={0} aria-label="Close menu" />
              <div className="fixed bg-mission-control-surface border border-mission-control-border rounded-xl shadow-xl py-1 z-[101] min-w-40"
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
                  className="icon-text-tight w-full px-3 py-2 text-left text-sm hover:bg-mission-control-border"
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
                  className="icon-text-tight w-full px-3 py-2 text-left text-sm hover:bg-mission-control-border"
                >
                  <Bot size={16} className="flex-shrink-0" /> Assign Agent
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onPoke(); setShowMenu(false); }}
                  className="icon-text-tight w-full px-3 py-2 text-left text-sm hover:bg-mission-control-border"
                >
                  <Hand size={16} className="flex-shrink-0" /> Poke
                </button>
                <hr className="my-1 border-mission-control-border" />
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                  disabled={isDeleting}
                  className="icon-text-tight w-full px-3 py-2 text-left text-sm hover:bg-mission-control-border text-error disabled:opacity-50"
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
      
      {/* Agent status updates are shown in the Activities tab of the task detail panel, not here */}

      {/* Task description */}
      {task.description && (
        <p className="text-xs text-mission-control-text-muted line-clamp-2 mt-1 mb-1">{task.description}</p>
      )}

      {/* Task progress bar */}
      {typeof task.progress === 'number' && task.progress > 0 && (
        <div className="mt-2 w-full bg-mission-control-bg rounded-full h-1 overflow-hidden">
          <div className="h-full bg-mission-control-accent transition-all duration-500" style={{ width: `${task.progress}%` }} />
        </div>
      )}

      {/* Clara review status badge */}
      {task.reviewStatus && (
        <div className={`icon-text-tight text-xs px-2 py-1 rounded mb-2 ${
          task.reviewStatus === 'approved' ? 'bg-success-subtle text-success' :
          task.reviewStatus === 'rejected' || task.reviewStatus === 'needs-changes' ? 'bg-error-subtle text-error' :
          'bg-mission-control-accent/10 text-mission-control-accent animate-pulse'
        }`}>
          {task.reviewStatus === 'approved' ? <ShieldCheck size={12} className="no-shrink" /> :
           task.reviewStatus === 'rejected' || task.reviewStatus === 'needs-changes' ? <ShieldX size={12} className="no-shrink" /> :
           <ShieldAlert size={12} className="no-shrink" />}
          <span>Clara: {task.reviewStatus === 'in-review' ? 'reviewing…' : task.reviewStatus}</span>
          {task.reviewNotes && (
            <span className="ml-1 opacity-70 truncate max-w-[120px]">— {task.reviewNotes}</span>
          )}
        </div>
      )}
      
      {/* Subtask Progress */}
      {subtaskCount > 0 && (
        <div className="mb-2">
          <div className="icon-text-tight text-xs text-mission-control-text-dim mb-1">
            <CheckSquare size={14} className="flex-shrink-0" />
            <span>{completedSubtasks}/{subtaskCount}</span>
          </div>
          <div className="h-1 bg-mission-control-surface rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                subtaskProgress === 100 ? 'bg-success' : 'bg-mission-control-accent'
              }`}
              style={{ width: `${subtaskProgress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Bottom row: Project, Due date, Agent */}
      <div className="flex items-center justify-between gap-2 text-xs min-w-0">
        <div className="icon-text flex-1 min-w-0 min-w-0 overflow-hidden">
          <span className="icon-text-tight px-2 py-0.5 bg-mission-control-surface rounded text-mission-control-text-dim no-shrink no-wrap">
            <FolderOpen size={14} className="no-shrink" />
            {task.project}
          </span>
          
          {dueInfo && (
            <span className={`icon-text-tight px-2 py-0.5 rounded no-shrink no-wrap ${
              dueInfo.isOverdue ? 'bg-error-subtle text-error' :
              dueInfo.isDueSoon ? 'bg-warning-subtle text-warning' :
              'bg-mission-control-surface text-mission-control-text-dim'
            }`}>
              <Calendar size={14} className="no-shrink" />
              {dueInfo.text}
            </span>
          )}
        </div>
        
        <div className="relative flex-shrink-0">
          {assignedAgent ? (
            <div className="flex items-center gap-1.5 no-shrink">
              {task.status === 'in-progress' ? (
                <span className="icon-badge-sm bg-success-subtle text-success animate-pulse" title="Agent working">
                  <Zap size={14} className="no-shrink" />
                </span>
              ) : canStart ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onStartAgent(); }}
                  disabled={isSpawning}
                  className="icon-badge-sm bg-success text-white hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Start agent"
                >
                  {isSpawning ? <Spinner size={14} className="no-shrink" /> : <Play size={14} className="no-shrink" />}
                </button>
              ) : null}
              <button
                ref={assignBtnRef}
                className="icon-text-tight px-2 py-0.5 bg-mission-control-accent/10 text-mission-control-accent rounded hover:bg-mission-control-accent/20 no-shrink"
                title={assignedAgent?.name || task.assignedTo}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showAssign && assignBtnRef.current) {
                    const rect = assignBtnRef.current.getBoundingClientRect();
                    setAssignBtnPos({ top: rect.bottom + 4, left: rect.right - 160 });
                  }
                  setShowAssign(true);
                }}
              >
                <AgentAvatar
                  agentId={assignedAgent.id}
                  fallbackEmoji={assignedAgent.avatar}
                  size="xs"
                  status={getAgentStatus()}
                />
              </button>
            </div>
          ) : (
            <button 
              ref={assignBtnRef}
              className="icon-btn-sm text-mission-control-text-dim hover:text-mission-control-accent no-shrink"
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
              <div className="fixed inset-0 z-[100]" onClick={() => setShowAssign(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAssign(false); } }} role="button" tabIndex={0} aria-label="Close assign dropdown" />
              <div 
                className="fixed bg-mission-control-surface border border-mission-control-border rounded-xl shadow-xl p-2 z-[101] min-w-[160px]"
                style={{ top: `${assignBtnPos.top}px`, left: `${assignBtnPos.left}px` }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
              >
                <div className="text-xs text-mission-control-text-dim mb-2 font-medium px-2">Assign to agent</div>
                <div className="space-y-1">
                  <button
                    onClick={() => { onAssign(''); setShowAssign(false); }}
                    className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 hover:bg-mission-control-border transition-colors ${
                      !task.assignedTo ? 'bg-mission-control-border' : ''
                    }`}
                  >
                    <User size={16} className="text-mission-control-text-dim" />
                    Unassigned
                  </button>
                  {agents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => { onAssign(agent.id); setShowAssign(false); }}
                      className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 hover:bg-mission-control-border transition-colors ${
                        task.assignedTo === agent.id ? 'bg-mission-control-accent/20 text-mission-control-accent' : ''
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
}, (prev, next) => {
  // Return true if props are equal (skip re-render)
  // Intentionally skip callback comparison -- they are recreated each render but do not affect visual output
  return (
    prev.task === next.task &&
    prev.isDragging === next.isDragging &&
    prev.isDeleting === next.isDeleting &&
    prev.isSpawning === next.isSpawning &&
    prev.isMoving === next.isMoving &&
    prev.agents === next.agents &&
    // activeSessions is a new object each render -- deep compare for small Record<string, boolean>
    JSON.stringify(prev.activeSessions) === JSON.stringify(next.activeSessions)
  );
});
