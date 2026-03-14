import { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { useEventBus } from '../lib/useEventBus';
import { createPortal } from 'react-dom';
import {
  Plus, MoreHorizontal, Bot, Trash2, FolderOpen, Clock, User, Play, Zap,
  CheckSquare, Filter, Search, AlertTriangle, Calendar, ArrowUp, ArrowDown, RefreshCw, Keyboard, X, Flag, Circle, Hand, Stethoscope, Archive, ShieldCheck, ShieldX, ShieldAlert,
  CheckCircle, CheckCircle2, Ban, FileText, Pencil, ChevronDown, ChevronRight, Hash,
  ClipboardList, Eye, Inbox, SortAsc, Save, Tag, CalendarClock,
  Square, UserCheck,
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
function formatDueDate(timestamp: number): { text: string; isOverdue: boolean; isDueSoon: boolean; isDueThisWeek: boolean } {
  const now = Date.now();
  const diff = timestamp - now;
  const isOverdue = diff < 0;

  if (isOverdue) {
    const overdueDiff = Math.abs(diff);
    if (overdueDiff < 86400000) return { text: 'Overdue', isOverdue: true, isDueSoon: false, isDueThisWeek: false };
    return { text: `${Math.floor(overdueDiff / 86400000)}d overdue`, isOverdue: true, isDueSoon: false, isDueThisWeek: false };
  }

  if (diff < 3600000) return { text: `${Math.floor(diff / 60000)}m`, isOverdue: false, isDueSoon: true, isDueThisWeek: false };
  if (diff < 86400000) return { text: `${Math.floor(diff / 3600000)}h`, isOverdue: false, isDueSoon: true, isDueThisWeek: false };
  if (diff < 604800000) return { text: `${Math.floor(diff / 86400000)}d`, isOverdue: false, isDueSoon: false, isDueThisWeek: true };
  return { text: new Date(timestamp).toLocaleDateString(), isOverdue: false, isDueSoon: false, isDueThisWeek: false };
}

const columns: { id: TaskStatus; title: string; color: string; iconColor: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'todo',            title: 'To Do',            color: 'border-t-info',    iconColor: 'text-info',    bg: 'bg-info-subtle',    icon: <FileText size={14} /> },
  { id: 'internal-review', title: 'Pre-review',  color: 'border-t-review',  iconColor: 'text-review',  bg: 'bg-review-subtle',  icon: <Search size={14} /> },
  { id: 'in-progress',     title: 'In Progress',      color: 'border-t-warning', iconColor: 'text-warning', bg: 'bg-warning-subtle', icon: <Zap size={14} /> },
  { id: 'review',          title: 'Agent Review',     color: 'border-t-review',  iconColor: 'text-review',  bg: 'bg-review-subtle',  icon: <Bot size={14} /> },
  { id: 'human-review',    title: 'Human Review',     color: 'border-t-warning', iconColor: 'text-warning', bg: 'bg-warning-subtle', icon: <User size={14} /> },
  { id: 'done',            title: 'Done',             color: 'border-t-success', iconColor: 'text-success', bg: 'bg-success-subtle', icon: <CheckCircle size={14} /> },
];

type DueFilter = 'all' | 'overdue' | 'today' | 'this-week' | 'no-due-date';
type GlobalSortOption = 'newest' | 'due-asc' | 'priority' | 'title-az' | 'updated';

interface Filters {
  search: string;
  project: string;
  priority: TaskPriority | 'all';
  assignee: string;
  hasDueDate: boolean | null;
  dueFilter: DueFilter;
  labels: string[]; // label IDs selected
  showCompleted: boolean;
}

interface SavedView {
  name: string;
  filters: Filters;
  globalSort: GlobalSortOption;
  savedAt: number;
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
  const addTask = useStore(s => s.addTask);
  
  // Local loading states for operations
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());
  const [spawningTasks, setSpawningTasks] = useState<Set<string>>(new Set());
  const [movingTasks, setMovingTasks] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);

  // Multi-select / bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  
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
  const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskStatus>>(new Set());
  const [jumpToTaskInput, setJumpToTaskInput] = useState('');
  const [showJumpToTask, setShowJumpToTask] = useState(false);
  const [inlineAddActive, setInlineAddActive] = useState(false);
  const [inlineAddTitle, setInlineAddTitle] = useState('');
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    project: 'all',
    priority: 'all',
    assignee: 'all',
    hasDueDate: null,
    dueFilter: 'all',
    labels: [],
    showCompleted: true,
  });

  // Global sort — persisted to localStorage
  const [globalSort, setGlobalSort] = useState<GlobalSortOption>(() => {
    try {
      const saved = localStorage.getItem('kanban.sort');
      if (saved) return saved as GlobalSortOption;
    } catch { /* ignore */ }
    return 'newest';
  });
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const raw = localStorage.getItem('kanban.saved-views');
      if (raw) return JSON.parse(raw) as SavedView[];
    } catch { /* ignore */ }
    return [];
  });
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [newViewName, setNewViewName] = useState('');

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

  // Persist global sort to localStorage
  useEffect(() => {
    try { localStorage.setItem('kanban.sort', globalSort); } catch { /* ignore */ }
  }, [globalSort]);

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
        setShowSortMenu(false);
        setShowSaveViewDialog(false);
        setSelectedIds(new Set());
        setLastSelectedId(null);
        setShowBulkAssign(false);
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

  // Unique labels across all tasks
  const uniqueLabels = useMemo(() => {
    const labelSet = new Set<string>();
    tasks.forEach(t => {
      if (Array.isArray(t.labels)) t.labels.forEach(l => labelSet.add(l));
    });
    return Array.from(labelSet).sort();
  }, [tasks]);

  // Unique assignees across all tasks
  const uniqueAssignees = useMemo(() => {
    const assigneeSet = new Set<string>();
    tasks.forEach(t => { if (t.assignedTo) assigneeSet.add(t.assignedTo); });
    return Array.from(assigneeSet);
  }, [tasks]);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(startOfToday); endOfWeek.setDate(endOfWeek.getDate() + 7);

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

    // Due date (legacy hasDueDate — kept for backward compat)
    if (filters.hasDueDate !== null) {
      result = result.filter(t => filters.hasDueDate ? t.dueDate : !t.dueDate);
    }

    // Due date filter (new)
    if (filters.dueFilter !== 'all') {
      switch (filters.dueFilter) {
        case 'overdue':
          result = result.filter(t => t.dueDate && t.dueDate < now && t.status !== 'done');
          break;
        case 'today':
          result = result.filter(t => t.dueDate && t.dueDate >= startOfToday.getTime() && t.dueDate <= endOfToday.getTime());
          break;
        case 'this-week':
          result = result.filter(t => t.dueDate && t.dueDate >= startOfToday.getTime() && t.dueDate <= endOfWeek.getTime());
          break;
        case 'no-due-date':
          result = result.filter(t => !t.dueDate);
          break;
      }
    }

    // Labels filter (AND: task must have ALL selected labels)
    if (filters.labels.length > 0) {
      result = result.filter(t =>
        filters.labels.every(l => Array.isArray(t.labels) && t.labels.includes(l))
      );
    }

    // Hide completed
    if (!filters.showCompleted) {
      result = result.filter(t => t.status !== 'done' && t.status !== 'failed');
    }

    // Apply global sort
    return result.sort((a, b) => {
      const priorityOrder: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3, undefined: 4 };
      switch (globalSort) {
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'due-asc': {
          if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return b.createdAt - a.createdAt;
        }
        case 'priority': {
          const ap = priorityOrder[a.priority || 'undefined'];
          const bp = priorityOrder[b.priority || 'undefined'];
          if (ap !== bp) return ap - bp;
          return b.createdAt - a.createdAt;
        }
        case 'title-az':
          return a.title.localeCompare(b.title);
        case 'updated':
          return b.updatedAt - a.updatedAt;
        default:
          return b.createdAt - a.createdAt;
      }
    });
  }, [tasks, filters, globalSort]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.project !== 'all') count++;
    if (filters.priority !== 'all') count++;
    if (filters.assignee !== 'all') count++;
    if (filters.hasDueDate !== null) count++;
    if (filters.dueFilter !== 'all') count++;
    if (filters.labels.length > 0) count++;
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
      dueFilter: 'all',
      labels: [],
      showCompleted: true,
    });
  };

  // Save current filter+sort combination as a named view
  const saveCurrentView = () => {
    const name = newViewName.trim();
    if (!name) return;
    const view: SavedView = { name, filters, globalSort, savedAt: Date.now() };
    const updated = [...savedViews.filter(v => v.name !== name), view];
    setSavedViews(updated);
    try { localStorage.setItem('kanban.saved-views', JSON.stringify(updated)); } catch { /* ignore */ }
    setNewViewName('');
    setShowSaveViewDialog(false);
  };

  const deleteSavedView = (name: string) => {
    const updated = savedViews.filter(v => v.name !== name);
    setSavedViews(updated);
    try { localStorage.setItem('kanban.saved-views', JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const applySavedView = (view: SavedView) => {
    setFilters(view.filters);
    setGlobalSort(view.globalSort);
  };

  const GLOBAL_SORT_LABELS: Record<GlobalSortOption, string> = {
    'newest': 'Created (newest first)',
    'due-asc': 'Due date (soonest first)',
    'priority': 'Priority (P0 first)',
    'title-az': 'Title (A–Z)',
    'updated': 'Last updated',
  };

  // Pre-compute per-column filtered+sorted task arrays — avoids re-running filter/sort on every render
  const columnTaskMap = useMemo(() => {
    const priorityOrder: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3, undefined: 4 };
    const result: Partial<Record<TaskStatus, Task[]>> = {};
    for (const column of columns) {
      const columnId = column.id;
      const settings = columnSettings[columnId];
      let col = filteredTasks.filter(t => t.status === columnId);

      // Apply column filters
      if (settings.filterAgent !== 'all') {
        if (settings.filterAgent === 'unassigned') {
          col = col.filter(t => !t.assignedTo);
        } else {
          col = col.filter(t => t.assignedTo === settings.filterAgent);
        }
      }
      if (settings.filterPriority !== 'all') {
        col = col.filter(t => t.priority === settings.filterPriority);
      }

      // Apply column sorting
      col = col.slice().sort((a, b) => {
        switch (settings.sortBy) {
          case 'newest':
            return b.createdAt - a.createdAt;
          case 'oldest':
            return a.createdAt - b.createdAt;
          case 'priority-asc':
            return (priorityOrder[a.priority || 'undefined'] - priorityOrder[b.priority || 'undefined']);
          case 'priority-desc':
            return (priorityOrder[b.priority || 'undefined'] - priorityOrder[a.priority || 'undefined']);
          case 'progress-asc':
            return (a.progress || 0) - (b.progress || 0);
          case 'progress-desc':
            return (b.progress || 0) - (a.progress || 0);
          default:
            return 0;
        }
      });
      result[columnId] = col;
    }
    return result;
  }, [filteredTasks, columnSettings]);

  const getColumnTasks = useCallback((columnId: TaskStatus): Task[] => {
    return columnTaskMap[columnId] ?? [];
  }, [columnTaskMap]);

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

  const toggleColumnCollapse = useCallback((columnId: TaskStatus) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }, []);

  const handleJumpToTask = useCallback((input: string) => {
    const searchTerm = input.trim().toLowerCase();
    if (!searchTerm) return;
    const found = tasks.find(t =>
      t.id === searchTerm ||
      t.id.includes(searchTerm) ||
      t.title.toLowerCase().includes(searchTerm)
    );
    if (found) {
      setSelectedTask(found);
      setJumpToTaskInput('');
      setShowJumpToTask(false);
    } else {
      showToast('info', 'Task not found', `No task matching "${input}"`);
    }
  }, [tasks]);

  const handleAddTask = (status: TaskStatus) => {
    if (onNewTask) { onNewTask(); return; }
    setModalStatus(status);
    setModalOpen(true);
  };

  const handleInlineAddSubmit = useCallback(() => {
    const title = inlineAddTitle.trim();
    if (!title) {
      setInlineAddActive(false);
      setInlineAddTitle('');
      return;
    }
    addTask({ title, status: 'todo', project: projectName || 'General', project_id: projectId });
    setInlineAddTitle('');
    setInlineAddActive(false);
    showToast('success', 'Task created', title);
  }, [inlineAddTitle, addTask, projectName, projectId]);

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

  const handleDeleteTask = useCallback((taskId: string) => {
    setPendingDeleteTaskId(taskId);
  }, []);

  const confirmDeleteTask = useCallback(async () => {
    if (!pendingDeleteTaskId) return;
    const taskId = pendingDeleteTaskId;
    setPendingDeleteTaskId(null);
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
  }, [deleteTask, pendingDeleteTaskId]);

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

  const handleTitleEdit = useCallback(async (taskId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      await taskApi.update(taskId, { title: newTitle.trim() });
      updateTask(taskId, { title: newTitle.trim() });
    } catch {
      showToast('error', 'Failed to update title');
    }
  }, [updateTask]);

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

  // Toggle a task's selection, with shift-click range support
  const handleToggleSelect = useCallback((taskId: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedId) {
        // Build an ordered flat list of all visible task IDs across columns (in column order)
        const allVisibleIds: string[] = [];
        for (const col of columns) {
          const colTasks = columnTaskMap[col.id] ?? [];
          for (const t of colTasks) allVisibleIds.push(t.id);
        }
        const fromIdx = allVisibleIds.indexOf(lastSelectedId);
        const toIdx = allVisibleIds.indexOf(taskId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const lo = Math.min(fromIdx, toIdx);
          const hi = Math.max(fromIdx, toIdx);
          for (let i = lo; i <= hi; i++) next.add(allVisibleIds[i]);
        } else {
          next.has(taskId) ? next.delete(taskId) : next.add(taskId);
        }
      } else {
        next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      }
      return next;
    });
    setLastSelectedId(taskId);
  }, [lastSelectedId, columnTaskMap]);

  const handleBulkMarkDone = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const result = await taskApi.bulk(Array.from(selectedIds), 'status', 'done');
      await loadTasksFromDB();
      setSelectedIds(new Set());
      setLastSelectedId(null);
      showToast('success', `Marked ${result.updated} task${result.updated !== 1 ? 's' : ''} as done`);
    } catch {
      showToast('error', 'Bulk update failed');
    } finally {
      setIsBulkUpdating(false);
    }
  }, [selectedIds, loadTasksFromDB]);

  const handleBulkAssign = useCallback(async (agentId: string) => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    setShowBulkAssign(false);
    try {
      const result = await taskApi.bulk(Array.from(selectedIds), 'assign', agentId);
      await loadTasksFromDB();
      setSelectedIds(new Set());
      setLastSelectedId(null);
      showToast('success', `Assigned ${result.updated} task${result.updated !== 1 ? 's' : ''}`);
    } catch {
      showToast('error', 'Bulk assign failed');
    } finally {
      setIsBulkUpdating(false);
    }
  }, [selectedIds, loadTasksFromDB]);

  const confirmBulkDelete = useCallback(async () => {
    setShowBulkDeleteConfirm(false);
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const result = await taskApi.bulk(Array.from(selectedIds), 'delete');
      await loadTasksFromDB();
      setSelectedIds(new Set());
      setLastSelectedId(null);
      showToast('success', `Deleted ${result.updated} task${result.updated !== 1 ? 's' : ''}`);
    } catch {
      showToast('error', 'Bulk delete failed');
    } finally {
      setIsBulkDeleting(false);
    }
  }, [selectedIds, loadTasksFromDB]);

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

            {/* Global sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(v => !v)}
                className={`icon-text px-3 py-2 rounded-xl border transition-all ${
                  globalSort !== 'newest'
                    ? 'bg-mission-control-accent/20 border-mission-control-accent text-mission-control-accent'
                    : 'bg-mission-control-bg border-mission-control-border hover:border-mission-control-accent/50'
                }`}
                title="Sort tasks"
              >
                <SortAsc size={16} className="flex-shrink-0" />
                Sort
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-lg z-50 min-w-[220px] py-1">
                  {(Object.keys(GLOBAL_SORT_LABELS) as GlobalSortOption[]).map(opt => (
                    <button
                      key={opt}
                      onClick={() => { setGlobalSort(opt); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-mission-control-border/40 ${globalSort === opt ? 'text-mission-control-accent font-medium' : ''}`}
                    >
                      {GLOBAL_SORT_LABELS[opt]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Save view button */}
            <div className="relative">
              <button
                onClick={() => setShowSaveViewDialog(v => !v)}
                className="icon-text px-3 py-2 rounded-xl border border-mission-control-border bg-mission-control-bg hover:border-mission-control-accent/50 transition-all"
                title="Save current view"
              >
                <Save size={16} className="flex-shrink-0" />
                Save view
              </button>
              {showSaveViewDialog && (
                <div className="absolute right-0 top-full mt-1 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-lg z-50 w-64 p-3">
                  <p className="text-xs font-semibold text-mission-control-text-dim mb-2">Save current filters &amp; sort</p>
                  <input
                    autoFocus
                    type="text"
                    value={newViewName}
                    onChange={e => setNewViewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCurrentView();
                      if (e.key === 'Escape') setShowSaveViewDialog(false);
                    }}
                    placeholder="View name..."
                    className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent mb-2"
                  />
                  <button
                    onClick={saveCurrentView}
                    disabled={!newViewName.trim()}
                    className="w-full px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-sm hover:bg-mission-control-accent-dim transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

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
            
            {/* Jump to task */}
            <div className="relative">
              <button
                onClick={() => setShowJumpToTask(v => !v)}
                className="icon-text px-3 py-2 border border-mission-control-border rounded-xl hover:border-mission-control-accent/50 transition-all"
                title="Jump to task by ID or title"
              >
                <Hash size={16} className="flex-shrink-0" />
                Jump
              </button>
              {showJumpToTask && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-lg p-2 w-64">
                  <input
                    autoFocus
                    type="text"
                    value={jumpToTaskInput}
                    onChange={e => setJumpToTaskInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleJumpToTask(jumpToTaskInput);
                      if (e.key === 'Escape') setShowJumpToTask(false);
                    }}
                    placeholder="Task ID or title..."
                    className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
                  />
                  <p className="text-xs text-mission-control-text-dim mt-1.5 px-1">Press Enter to jump</p>
                </div>
              )}
            </div>

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
          <div className="p-4 bg-mission-control-bg rounded-xl border border-mission-control-border animate-in slide-in-from-top-2 space-y-3">
            {/* Row 1: dropdowns */}
            <div className="flex items-center gap-4 flex-wrap">
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

              {/* Assignee dropdown */}
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
                  {/* Also include assignees from tasks that may not be in agents list */}
                  {uniqueAssignees
                    .filter(id => !agents.find(a => a.id === id))
                    .map(id => (
                      <option key={id} value={id}>{id}</option>
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
                  className="icon-text-tight text-sm text-mission-control-accent hover:underline ml-auto"
                >
                  <X size={16} className="flex-shrink-0" /> Clear all
                </button>
              )}
            </div>

            {/* Row 2: Priority pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <Flag size={14} className="text-mission-control-text-dim flex-shrink-0" />
              <span className="text-xs text-mission-control-text-dim font-medium mr-1">Priority:</span>
              {(['all', 'p0', 'p1', 'p2', 'p3'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setFilters(f => ({ ...f, priority: p }))}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    filters.priority === p
                      ? p === 'all'
                        ? 'bg-mission-control-accent text-white border-mission-control-accent'
                        : p === 'p0'
                        ? 'bg-error-subtle text-error border-error-border'
                        : p === 'p1'
                        ? 'bg-warning-subtle text-warning border-warning-border'
                        : p === 'p2'
                        ? 'bg-info-subtle text-info border-info-border'
                        : 'bg-mission-control-bg text-mission-control-text border-mission-control-border'
                      : 'border-mission-control-border hover:border-mission-control-accent/50'
                  }`}
                >
                  {p === 'all' ? 'All' : p.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Row 3: Due date pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarClock size={14} className="text-mission-control-text-dim flex-shrink-0" />
              <span className="text-xs text-mission-control-text-dim font-medium mr-1">Due:</span>
              {([
                { id: 'all', label: 'All' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'today', label: 'Due today' },
                { id: 'this-week', label: 'Due this week' },
                { id: 'no-due-date', label: 'No due date' },
              ] as { id: DueFilter; label: string }[]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFilters(f => ({ ...f, dueFilter: opt.id }))}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    filters.dueFilter === opt.id
                      ? opt.id === 'overdue'
                        ? 'bg-error-subtle text-error border-error-border'
                        : 'bg-mission-control-accent text-white border-mission-control-accent'
                      : 'border-mission-control-border hover:border-mission-control-accent/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Row 4: Labels multi-select pills (only shown if any labels exist) */}
            {uniqueLabels.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag size={14} className="text-mission-control-text-dim flex-shrink-0" />
                <span className="text-xs text-mission-control-text-dim font-medium mr-1">Labels:</span>
                {uniqueLabels.map(label => {
                  const isActive = filters.labels.includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() => setFilters(f => ({
                        ...f,
                        labels: isActive
                          ? f.labels.filter(l => l !== label)
                          : [...f.labels, label],
                      }))}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        isActive
                          ? 'bg-mission-control-accent text-white border-mission-control-accent'
                          : 'border-mission-control-border hover:border-mission-control-accent/50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {filters.labels.length > 0 && (
                  <button
                    onClick={() => setFilters(f => ({ ...f, labels: [] }))}
                    className="text-xs text-mission-control-text-dim hover:text-mission-control-text icon-text-tight"
                  >
                    <X size={11} />
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Saved views pills */}
        {savedViews.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <span className="text-xs text-mission-control-text-dim font-medium">Saved views:</span>
            {savedViews.map(view => (
              <div key={view.name} className="flex items-center gap-0.5">
                <button
                  onClick={() => applySavedView(view)}
                  className="text-xs px-2.5 py-1 rounded-l-lg border border-mission-control-border hover:border-mission-control-accent/50 hover:text-mission-control-accent transition-all"
                >
                  {view.name}
                </button>
                <button
                  onClick={() => deleteSavedView(view.name)}
                  className="text-xs px-1.5 py-1 rounded-r-lg border border-l-0 border-mission-control-border hover:border-error-border hover:text-error transition-all"
                  title="Delete saved view"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick filter bar */}
      <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilters(f => ({ ...f, priority: 'all' }))}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${filters.priority === 'all' ? 'bg-mission-control-accent text-white border-mission-control-accent' : 'border-mission-control-border hover:border-mission-control-accent/50'}`}
        >All</button>
        <button
          onClick={() => setFilters(f => ({ ...f, priority: f.priority === 'p0' ? 'all' : 'p0' }))}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${filters.priority === 'p0' ? 'bg-error-subtle text-error border-error-border' : 'border-mission-control-border hover:border-error-border hover:text-error'}`}
        ><AlertTriangle size={11} /> P0 Critical</button>
        <button
          onClick={() => setFilters(f => ({ ...f, priority: f.priority === 'p1' ? 'all' : 'p1' }))}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${filters.priority === 'p1' ? 'bg-warning-subtle text-warning border-warning-border' : 'border-mission-control-border hover:border-warning-border hover:text-warning'}`}
        ><ArrowUp size={11} /> P1 High</button>
        <button
          onClick={() => setFilters(f => ({ ...f, priority: f.priority === 'p2' ? 'all' : 'p2' }))}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${filters.priority === 'p2' ? 'bg-info-subtle text-info border-info-border' : 'border-mission-control-border hover:border-info-border hover:text-info'}`}
        ><Circle size={11} /> P2 Normal</button>
        {agents.filter(a => !isProtectedAgent(a.id)).length > 0 && (
          <div className="w-px h-4 bg-mission-control-border mx-1" />
        )}
        {agents.filter(a => !isProtectedAgent(a.id)).map(a => (
          <button
            key={a.id}
            onClick={() => setFilters(f => ({ ...f, assignee: f.assignee === a.id ? 'all' : a.id }))}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${filters.assignee === a.id ? 'bg-mission-control-accent/20 text-mission-control-accent border-mission-control-accent' : 'border-mission-control-border hover:border-mission-control-accent/50'}`}
          >{a.name}</button>
        ))}
      </div>

      {/* Kanban Board */}
      {!loading.tasks && filteredTasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={activeFiltersCount > 0 ? Search : Inbox}
            title={activeFiltersCount > 0 ? 'No tasks match your filters' : 'No tasks yet'}
            description={activeFiltersCount > 0
              ? 'No tasks match your current filters. Try adjusting your search or filters.'
              : 'Create your first task to get the team working'}
            action={activeFiltersCount > 0
              ? undefined
              : { label: 'Create task', onClick: () => handleAddTask('todo') }}
            size="md"
          />
        </div>
      )}
      <div className={`flex-1 min-w-0 flex flex-nowrap gap-4 p-4 overflow-x-auto [overflow-scrolling:touch] [-webkit-overflow-scrolling:touch] ${!loading.tasks && filteredTasks.length === 0 ? 'hidden' : ''}`}>
        {columns.map((column) => {
          const columnTasks = getColumnTasks(column.id);
          const settings = columnSettings[column.id];
          const dropdowns = columnDropdowns[column.id];
          const isDragOver = dragOverColumn === column.id;
          
          const isCollapsed = collapsedColumns.has(column.id);

        return (
            <div
              key={column.id}
              data-column={column.id}
              className={`flex-shrink-0 flex flex-col rounded-2xl border transition-all ${
                isCollapsed ? 'w-12 min-w-[48px]' : 'w-96 min-w-[320px]'
              } ${
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
                <div className={`flex items-center justify-between ${isCollapsed ? '' : 'mb-2'}`}>
                  <div className={`icon-text ${isCollapsed ? 'flex-col gap-2' : ''}`}>
                    <button
                      onClick={() => toggleColumnCollapse(column.id)}
                      className="icon-btn-sm text-mission-control-text-dim hover:text-mission-control-text flex-shrink-0"
                      title={isCollapsed ? 'Expand column' : 'Collapse column'}
                    >
                      {isCollapsed ? <ChevronRight size={14} className="flex-shrink-0" /> : <ChevronDown size={14} className="flex-shrink-0" />}
                    </button>
                    <span className={column.iconColor}>{column.icon}</span>
                    {!isCollapsed && <h3 className="font-semibold text-sm">{column.title}</h3>}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${column.bg} ${column.iconColor}`} title={column.id === 'done' && taskCounts.totalArchived > 0 ? `${taskCounts.totalArchived} archived` : undefined}>
                      {column.id === 'done' && taskCounts.totalDone > columnTasks.length
                        ? `${columnTasks.length}/${taskCounts.totalDone}`
                        : columnTasks.length}
                    </span>
                  </div>
                  {!isCollapsed && (column.id === 'done' ? (
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
                  ))}
                </div>

                {/* Filter and Sort Controls */}
                {!isCollapsed && <div className="flex items-center gap-1">
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
                </div>}
              </div>

              {/* Tasks */}
              {!isCollapsed && <div className="flex-1 min-w-0 p-2 space-y-2 overflow-y-auto min-h-0">
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
                      onTitleEdit={handleTitleEdit}
                      isDragging={draggedTask === task.id}
                      isDeleting={deletingTasks.has(task.id)}
                      isSpawning={spawningTasks.has(task.id)}
                      isMoving={movingTasks.has(task.id)}
                      isSelected={selectedIds.has(task.id)}
                      isAnySelected={selectedIds.size > 0}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))
                )}
                
                {columnTasks.length === 0 && !loading.tasks && (() => {
                  const columnEmptyStates: Partial<Record<TaskStatus, { icon: typeof ClipboardList; title: string; description: string; showAdd?: boolean }>> = {
                    'todo':            { icon: ClipboardList, title: 'No open tasks',       description: 'Create a task to get started',          showAdd: true },
                    'internal-review': { icon: Search,        title: 'Nothing in pre-review', description: 'Tasks awaiting review will appear here' },
                    'in-progress':     { icon: Zap,           title: 'Nothing in progress', description: 'Assign a task to an agent'              },
                    'review':          { icon: Eye,           title: 'Nothing to review',   description: 'Completed tasks will appear here'       },
                    'human-review':    { icon: User,          title: 'No items need review', description: 'Tasks requiring your input appear here' },
                    'done':            { icon: CheckCircle2,  title: 'No completed tasks yet', description: ''                                    },
                  };
                  const cfg = columnEmptyStates[column.id];
                  if (!cfg) return null;
                  return (
                    <EmptyState
                      icon={cfg.icon}
                      title={cfg.title}
                      description={cfg.description}
                      action={cfg.showAdd ? { label: 'Add task', onClick: () => handleAddTask(column.id) } : undefined}
                      size="sm"
                    />
                  );
                })()}

                {/* Inline quick-add for Todo column */}
                {column.id === 'todo' && (
                  inlineAddActive ? (
                    <div className="mt-1 p-2 rounded-xl border border-mission-control-accent/50 bg-mission-control-surface">
                      <input
                        autoFocus
                        type="text"
                        value={inlineAddTitle}
                        onChange={e => setInlineAddTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); handleInlineAddSubmit(); }
                          if (e.key === 'Escape') { setInlineAddActive(false); setInlineAddTitle(''); }
                        }}
                        onBlur={handleInlineAddSubmit}
                        placeholder="Task title..."
                        className="w-full bg-transparent text-sm text-mission-control-text placeholder:text-mission-control-text-dim/60 outline-none"
                      />
                      <p className="text-[10px] text-mission-control-text-dim/60 mt-1">Enter to save, Esc to cancel</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setInlineAddActive(true)}
                      className="mt-1 flex items-center gap-2 w-full px-2 py-2 rounded-xl text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors text-xs"
                    >
                      <Plus size={13} className="flex-shrink-0" />
                      Add task
                    </button>
                  )
                )}
              </div>}
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

      {/* Delete Task Confirmation Dialog */}
      <ConfirmDialog
        open={pendingDeleteTaskId !== null}
        onClose={() => setPendingDeleteTaskId(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message="Delete this task? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        type="danger"
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Tasks"
        message={`Delete ${selectedIds.size} selected task${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        type="danger"
        loading={isBulkDeleting}
      />

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
          {/* Count badge */}
          <span className="text-sm font-semibold text-mission-control-text whitespace-nowrap">
            {selectedIds.size} task{selectedIds.size !== 1 ? 's' : ''} selected
          </span>

          <div className="w-px h-5 bg-mission-control-border flex-shrink-0" />

          {/* Mark Done */}
          <button
            onClick={handleBulkMarkDone}
            disabled={isBulkUpdating || isBulkDeleting}
            className="icon-text px-3 py-1.5 bg-success-subtle text-success border border-success-border rounded-xl text-sm hover:bg-success hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle size={15} className="flex-shrink-0" />
            Mark Done
          </button>

          {/* Assign Agent */}
          <div className="relative">
            <button
              onClick={() => setShowBulkAssign(v => !v)}
              disabled={isBulkUpdating || isBulkDeleting}
              className="icon-text px-3 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-xl text-sm hover:border-mission-control-accent/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserCheck size={15} className="flex-shrink-0" />
              Assign Agent
              <ChevronDown size={13} className="flex-shrink-0" />
            </button>
            {showBulkAssign && (
              <>
                <div
                  className="fixed inset-0 z-[60]"
                  onClick={() => setShowBulkAssign(false)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setShowBulkAssign(false); }}
                  role="button"
                  tabIndex={0}
                  aria-label="Close assign dropdown"
                />
                <div className="absolute bottom-full mb-2 left-0 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-xl py-1 z-[61] min-w-[180px] max-h-60 overflow-y-auto">
                  {agents.filter(a => !isProtectedAgent(a.id)).length === 0 ? (
                    <div className="px-4 py-3 text-sm text-mission-control-text-dim">No agents available</div>
                  ) : agents.filter(a => !isProtectedAgent(a.id)).map(a => (
                    <button
                      key={a.id}
                      onClick={() => handleBulkAssign(a.id)}
                      className="icon-text-tight w-full px-3 py-2 text-left text-sm hover:bg-mission-control-border transition-colors"
                    >
                      <span className="flex-shrink-0">{a.avatar || '🤖'}</span>
                      {a.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={isBulkUpdating || isBulkDeleting}
            className="icon-text px-3 py-1.5 bg-error-subtle text-error border border-error-border rounded-xl text-sm hover:bg-error hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={15} className="flex-shrink-0" />
            Delete
          </button>

          <div className="w-px h-5 bg-mission-control-border flex-shrink-0" />

          {/* Clear selection */}
          <button
            onClick={() => { setSelectedIds(new Set()); setLastSelectedId(null); setShowBulkAssign(false); }}
            className="icon-btn text-mission-control-text-dim hover:text-mission-control-text"
            title="Clear selection (Esc)"
          >
            <X size={16} className="flex-shrink-0" />
          </button>
        </div>
      )}
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
  onTitleEdit: (taskId: string, newTitle: string) => void;
  isDragging: boolean;
  isDeleting?: boolean;
  isSpawning?: boolean;
  isMoving?: boolean;
  isSelected?: boolean;
  isAnySelected?: boolean;
  onToggleSelect?: (taskId: string, shiftKey: boolean) => void;
}

const TaskCard = memo(function TaskCard({ task, agents, activeSessions: _activeSessions, onDragStart, onDragEnd, onDelete, onAssign, onStartAgent, onClick, onSetPriority, onPoke, onTitleEdit, isDragging, isDeleting, isSpawning, isMoving, isSelected, isAnySelected, onToggleSelect }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [priorityBtnPos, setPriorityBtnPos] = useState<{top: number, left: number} | null>(null);
  const [assignBtnPos, setAssignBtnPos] = useState<{top: number, left: number} | null>(null);
  const [menuBtnPos, setMenuBtnPos] = useState<{top: number, left: number} | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const editInputRef = useRef<HTMLInputElement>(null);
  
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const assignBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditingTitle]);

  const startEditTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(task.title);
    setIsEditingTitle(true);
  };

  const commitEditTitle = () => {
    setIsEditingTitle(false);
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      onTitleEdit(task.id, editTitle.trim());
    }
  };

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
        isSelected
          ? 'border-mission-control-accent bg-mission-control-accent/5 shadow-[0_0_0_1px_var(--mc-accent)]'
          : task.status === 'in-progress'
          ? 'border-success/60 bg-success-subtle shadow-[0_0_0_1px_rgba(34,197,94,0.2)]'
          /* TODO: move to CSS token when design system tokens include status colors */
          : activityIndicator ? activityIndicator.color
          : dueInfo?.isOverdue ? 'border-error-border bg-error-subtle'
          : task.priority === 'p0' ? 'border-l-4 border-error-border'
          : task.priority === 'p1' ? 'border-l-4 border-warning-border'
          : 'border-mission-control-border hover:border-mission-control-accent/50'
      } hover:shadow-md hover:-translate-y-0.5`}
      title={activityIndicator?.description}
    >
      {/* Top row: Checkbox + Priority + Title + Menu */}
      <div className="flex items-start gap-1.5 mb-2">
        {/* Selection checkbox — visible on hover or when any task is selected */}
        {onToggleSelect && (
          <button
            className={`flex-shrink-0 mt-0.5 transition-opacity ${isAnySelected || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}`}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(task.id, e.shiftKey); }}
            title={isSelected ? 'Deselect task' : 'Select task (Shift+click for range)'}
            aria-label={isSelected ? 'Deselect task' : 'Select task'}
          >
            {isSelected
              ? <CheckSquare size={15} className="text-mission-control-accent flex-shrink-0" />
              : <Square size={15} className="text-mission-control-text-dim flex-shrink-0" />
            }
          </button>
        )}
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
        <div className="flex flex-col flex-1 min-w-0 group/title">
          {isEditingTitle ? (
            <input
              ref={editInputRef}
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitEditTitle(); }
                if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitle(task.title); }
              }}
              onBlur={commitEditTitle}
              onClick={e => e.stopPropagation()}
              className="font-medium text-sm leading-tight w-full bg-mission-control-bg border border-mission-control-accent rounded px-1.5 py-0.5 focus:outline-none"
            />
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <h4
                className="font-medium text-sm leading-tight flex-1 min-w-0 truncate"
                onDoubleClick={startEditTitle}
                title="Double-click to edit"
              >{task.title}</h4>
              <button
                onClick={startEditTitle}
                className="opacity-0 group-hover/title:opacity-60 hover:!opacity-100 flex-shrink-0 p-0.5 rounded hover:bg-mission-control-border transition-opacity"
                title="Edit title"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}
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

      {/* Due date urgency badges — only show for incomplete tasks */}
      {task.dueDate && task.status !== 'done' && dueInfo && (() => {
        if (dueInfo.isOverdue) {
          return (
            <div className="flex items-center gap-1 mb-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border text-error bg-error-subtle border-error-border">
                <AlertTriangle size={10} />
                {dueInfo.text}
              </span>
            </div>
          );
        }
        if (dueInfo.isDueSoon) {
          return (
            <div className="flex items-center gap-1 mb-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border text-warning bg-warning-subtle border-warning-border">
                <Clock size={10} />
                Due in {dueInfo.text}
              </span>
            </div>
          );
        }
        if (dueInfo.isDueThisWeek) {
          return (
            <div className="flex items-center gap-1 mb-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border text-warning bg-warning-subtle/50 border-warning-border/50">
                <Calendar size={10} />
                Due in {dueInfo.text}
              </span>
            </div>
          );
        }
        return null;
      })()}

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

      {/* Awaiting Clara badge — shown on Pre-review column cards */}
      {task.status === 'internal-review' && (
        <div className="icon-text-tight text-xs px-2 py-1 rounded mb-2 bg-review-subtle text-review">
          <Clock size={12} className="no-shrink animate-pulse" />
          <span>Awaiting Clara</span>
          {task.reviewStatus === 'pre-review' && (
            <span className="ml-1 opacity-70">— reviewing…</span>
          )}
        </div>
      )}

      {/* Clara review status badge */}
      {task.reviewStatus && task.status !== 'internal-review' && (
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
              dueInfo.isDueThisWeek ? 'bg-warning-subtle/50 text-warning' :
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
