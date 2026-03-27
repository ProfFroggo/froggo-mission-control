import { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { Button, Checkbox, Flex, IconButton, Select, TextField } from '@radix-ui/themes';
import { useEventBus } from '../lib/useEventBus';
import { createPortal } from 'react-dom';
import {
  Plus, MoreHorizontal, Bot, Trash2, FolderOpen, Clock, User, Play, Zap,
  CheckSquare, Filter, Search, AlertTriangle, Calendar, ArrowUp, ArrowDown, RefreshCw, Keyboard, X, Flag, Circle, Hand, Stethoscope, Archive, ShieldCheck, ShieldX, ShieldAlert,
  CheckCircle, CheckCircle2, Ban, FileText, Pencil, ChevronDown, ChevronRight, ChevronLeft, Hash,
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
import TaskQuickEdit from './TaskQuickEdit';
import ErrorDisplay from './ErrorDisplay';
import EmptyState from './EmptyState';
import HealthCheckModal from './HealthCheckModal';
import { safeStorage } from '../utils/safeStorage';
import ConfirmDialog from './ConfirmDialog';
import BaseModal, { BaseModalHeader, BaseModalBody } from './BaseModal';
import { useBreakpoint } from '../hooks/useBreakpoint';
import SearchInput from './SearchInput';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

// Priority config - STANDARDIZED ICON SIZE: xs (12px)
const PRIORITIES: { id: TaskPriority; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'p0', label: 'Urgent', color: 'text-[var(--color-error)]', bg: 'bg-[var(--color-error)]/10', icon: <AlertTriangle size={14} className="flex-shrink-0" /> },
  { id: 'p1', label: 'High', color: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning)]/10', icon: <ArrowUp size={14} className="flex-shrink-0" /> },
  { id: 'p2', label: 'Medium', color: 'text-[var(--color-info)]', bg: 'bg-[var(--color-info)]/10', icon: <Circle size={14} className="flex-shrink-0" /> },
  { id: 'p3', label: 'Low', color: 'text-mission-control-text-dim', bg: 'bg-mission-control-surface/20', icon: <ArrowDown size={14} className="flex-shrink-0" /> },
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
  { id: 'todo',            title: 'To Do',            color: 'border-t-mission-control-text-dim', iconColor: 'text-mission-control-text-dim', bg: 'bg-mission-control-border/30', icon: <FileText size={14} /> },
  { id: 'internal-review', title: 'Pre-review',  color: 'border-t-review',  iconColor: 'text-[var(--color-review)]',  bg: 'bg-[var(--color-review)]-subtle',  icon: <Search size={14} /> },
  { id: 'in-progress',     title: 'In Progress',      color: 'border-t-info', iconColor: 'text-[var(--color-info)]', bg: 'bg-[var(--color-info)]/10', icon: <Zap size={14} /> },
  { id: 'review',          title: 'Agent Review',     color: 'border-t-review',  iconColor: 'text-[var(--color-review)]',  bg: 'bg-[var(--color-review)]-subtle',  icon: <Bot size={14} /> },
  { id: 'human-review',    title: 'Human Review',     color: 'border-t-warning', iconColor: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning)]/10', icon: <User size={14} /> },
  { id: 'done',            title: 'Done',             color: 'border-t-success', iconColor: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/10', icon: <CheckCircle size={14} /> },
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
      interval = setInterval(() => { if (document.hidden) return; loadTasksFromDB(); }, 60000); // 60s with visibility guard
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

  // Mobile: breakpoint detection and single-column carousel state
  const { isMobile } = useBreakpoint();
  const [mobileColumnIndex, setMobileColumnIndex] = useState(0);
  const mobileTouchStartX = useRef(0);
  const mobileTouchStartY = useRef(0);
  
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
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

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

  // Focus the currently selected (or first) menu item when the sort menu opens
  useEffect(() => {
    if (showSortMenu && sortMenuRef.current) {
      const items = Array.from(sortMenuRef.current.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
      const selected = sortMenuRef.current.querySelector<HTMLElement>('[aria-checked="true"]');
      (selected ?? items[0])?.focus();
    }
  }, [showSortMenu]);

  const updateColumnSetting = useCallback((columnId: TaskStatus, key: keyof ColumnSettings, value: any) => {
    setColumnSettings(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        [key]: value,
      },
    }));
  }, []);

  const toggleColumnDropdown = useCallback((columnId: TaskStatus, dropdown: 'sort' | 'filter') => {
    setColumnDropdowns(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        [dropdown]: !prev[columnId][dropdown],
      },
    }));
  }, []);

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
    const inProgress = filteredTasks.filter(t => t.status === 'in-progress').length;
    const overdue = filteredTasks.filter(t => t.dueDate && t.dueDate < Date.now() && t.status !== 'done').length;
    const urgent = filteredTasks.filter(t => t.priority === 'p0' && t.status !== 'done').length;
    const unassigned = filteredTasks.filter(t => !t.assignedTo && t.status !== 'done' && t.status !== 'failed').length;
    return { inProgress, overdue, urgent, unassigned };
  }, [filteredTasks]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

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

  const handleAddTask = useCallback((status: TaskStatus) => {
    if (onNewTask) { onNewTask(); return; }
    setModalStatus(status);
    setModalOpen(true);
  }, [onNewTask]);

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
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadTasksFromDB();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadTasksFromDB]);

  const handleHealthCheck = useCallback(() => {
    setShowHealthCheck(true);
  }, []);

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

  const handleMoveTask = useCallback(async (taskId: string, status: TaskStatus) => {
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
  }, [moveTask]);

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

  // Mobile: swipe-to-navigate columns
  const handleMobileTouchStart = useCallback((e: React.TouchEvent) => {
    mobileTouchStartX.current = e.changedTouches[0].clientX;
    mobileTouchStartY.current = e.changedTouches[0].clientY;
  }, []);

  const handleMobileTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - mobileTouchStartX.current;
    const deltaY = e.changedTouches[0].clientY - mobileTouchStartY.current;
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        setMobileColumnIndex(prev => Math.min(prev + 1, columns.length - 1));
      } else {
        setMobileColumnIndex(prev => Math.max(prev - 1, 0));
      }
    }
  }, []);

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
        <Flex align="center" justify="between">
          <div>
            <h1 className="text-heading-2 icon-text">
              Task Board
              <span className="text-secondary font-normal">
                Press <kbd className="px-1.5 py-0.5 bg-mission-control-bg rounded text-xs">?</kbd> for shortcuts
              </span>
            </h1>
            <Flex align="center" gap="4" className="text-secondary mt-1">
              <span>{filteredTasks.length} tasks</span>
              {stats.inProgress > 0 && (
                <span className="icon-text-tight text-[var(--color-warning)]">
                  <Zap size={14} className="flex-shrink-0" /> {stats.inProgress} in progress
                </span>
              )}
              {stats.urgent > 0 && (
                <span className="icon-text-tight text-[var(--color-error)]">
                  <AlertTriangle size={14} className="flex-shrink-0" /> {stats.urgent} urgent
                </span>
              )}
              {stats.overdue > 0 && (
                <span className="icon-text-tight text-[var(--color-error)]">
                  <Clock size={14} className="flex-shrink-0" /> {stats.overdue} overdue
                </span>
              )}
              {stats.unassigned > 0 && (
                <span className="icon-text-tight text-mission-control-text-dim">
                  <User size={14} className="flex-shrink-0" /> {stats.unassigned} unassigned
                </span>
              )}
            </Flex>
          </div>

          <Flex align="center" gap="2">
            {/* Group 1: Search + Filters + Sort */}
            <SearchInput
              value={filters.search}
              onChange={v => setFilters(f => ({ ...f, search: v }))}
              placeholder="Search tasks..."
              aria-label="Search tasks"
              className="w-48"
            />

            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Filter tasks"
              aria-expanded={showFilters}
              aria-controls="kanban-filters-panel"
              aria-haspopup="true"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                activeFiltersCount > 0
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
              }`}
            >
              <Filter size={16} className="flex-shrink-0" aria-hidden="true" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 bg-mission-control-accent/20 text-mission-control-accent text-xs rounded-full flex-shrink-0 whitespace-nowrap">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                ref={sortTriggerRef}
                onClick={() => setShowSortMenu(v => !v)}
                aria-label="Sort tasks"
                aria-expanded={showSortMenu}
                aria-haspopup="menu"
                aria-controls="kanban-sort-menu"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  globalSort !== 'newest'
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
                }`}
              >
                <SortAsc size={16} className="flex-shrink-0" aria-hidden="true" />
                Sort
                <ChevronDown size={14} className="flex-shrink-0" aria-hidden="true" />
              </button>
              {showSortMenu && (
                <div
                  id="kanban-sort-menu"
                  ref={sortMenuRef}
                  role="menu"
                  aria-label="Sort options"
                  className="absolute right-0 top-full mt-1 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg z-50 min-w-[220px] py-1"
                  onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                    const items = Array.from(
                      sortMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []
                    );
                    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
                    switch (e.key) {
                      case 'ArrowDown':
                        e.preventDefault();
                        items[(currentIndex + 1) % items.length]?.focus();
                        break;
                      case 'ArrowUp':
                        e.preventDefault();
                        items[(currentIndex - 1 + items.length) % items.length]?.focus();
                        break;
                      case 'Home':
                        e.preventDefault();
                        items[0]?.focus();
                        break;
                      case 'End':
                        e.preventDefault();
                        items[items.length - 1]?.focus();
                        break;
                      case 'Escape':
                        e.preventDefault();
                        setShowSortMenu(false);
                        sortTriggerRef.current?.focus();
                        break;
                    }
                  }}
                >
                  {(Object.keys(GLOBAL_SORT_LABELS) as GlobalSortOption[]).map(opt => (
                    <button
                      key={opt}
                      role="menuitemradio"
                      aria-checked={globalSort === opt}
                      onClick={() => { setGlobalSort(opt); setShowSortMenu(false); sortTriggerRef.current?.focus(); }}
                      className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-left transition-colors ${
                        globalSort === opt
                          ? 'bg-mission-control-surface text-mission-control-accent shadow-sm'
                          : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface/50'
                      }`}
                    >
                      {GLOBAL_SORT_LABELS[opt]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-mission-control-border flex-shrink-0" />

            {/* Group 2: Utility actions */}
            <div className="relative">
              <button
                onClick={() => setShowSaveViewDialog(v => !v)}
                aria-label="Save current view"
                aria-expanded={showSaveViewDialog}
                aria-controls="kanban-save-view-panel"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <Save size={16} aria-hidden="true" />
              </button>
              {showSaveViewDialog && (
                <div id="kanban-save-view-panel" className="absolute right-0 top-full mt-1 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg z-50 w-64 p-3">
                  <p className="text-xs font-semibold text-mission-control-text-dim mb-2">Save current filters &amp; sort</p>
                  <TextField.Root
                    autoFocus
                    size="1"
                    value={newViewName}
                    onChange={e => setNewViewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCurrentView();
                      if (e.key === 'Escape') setShowSaveViewDialog(false);
                    }}
                    placeholder="View name..."
                    className="w-full mb-2"
                  />
                  <Button variant="solid" size="1" onClick={saveCurrentView} disabled={!newViewName.trim()} className="w-full justify-center">
                    Save
                  </Button>
                </div>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh tasks"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={16} className={`flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>

            <button
              onClick={handleHealthCheck}
              aria-label="Board health check"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <Stethoscope size={16} className="flex-shrink-0" aria-hidden="true" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowJumpToTask(v => !v)}
                aria-label="Jump to task"
                aria-expanded={showJumpToTask}
                aria-controls="kanban-jump-to-panel"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <Hash size={16} aria-hidden="true" />
              </button>
              {showJumpToTask && (
                <div id="kanban-jump-to-panel" className="absolute right-0 top-full mt-1 z-50 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg p-2 w-64">
                  <TextField.Root
                    autoFocus
                    size="1"
                    value={jumpToTaskInput}
                    onChange={e => setJumpToTaskInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleJumpToTask(jumpToTaskInput);
                      if (e.key === 'Escape') setShowJumpToTask(false);
                    }}
                    placeholder="Task ID or title..."
                    className="w-full"
                  />
                  <p className="text-xs text-mission-control-text-dim mt-1.5 px-1">Press Enter to jump</p>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-mission-control-border flex-shrink-0" />

            {/* Group 3: Primary action */}
            <Button variant="solid" size="1" onClick={() => handleAddTask('todo')} title="New task (N)">
              <Plus size={16} className="flex-shrink-0" />
              New Task
              <kbd className="px-1.5 py-0.5 bg-mission-control-text/20 rounded text-xs">N</kbd>
            </Button>
          </Flex>
        </Flex>

        {/* Filter Panel */}
        {showFilters && (
          <div id="kanban-filters-panel" className="p-4 bg-mission-control-bg rounded-lg border border-mission-control-border animate-in slide-in-from-top-2 space-y-3">
            {/* Row 1: dropdowns */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Project — hidden when already scoped to a project */}
              {!projectId && (
                <div className="icon-text-tight">
                  <FolderOpen size={16} className="text-mission-control-text-dim flex-shrink-0" aria-hidden="true" />
                  <label className="sr-only" htmlFor="filter-project">Project</label>
                  <Select.Root size="1" value={filters.project} onValueChange={(val) => setFilters(f => ({ ...f, project: val }))}>
                    <Select.Trigger id="filter-project" />
                    <Select.Content>
                      {projects.map(p => (
                        <Select.Item key={p} value={p}>{p === 'all' ? 'All Projects' : p}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </div>
              )}

              {/* Assignee dropdown */}
              <div className="icon-text-tight">
                <Bot size={16} className="text-mission-control-text-dim flex-shrink-0" aria-hidden="true" />
                <label className="sr-only" htmlFor="filter-assignee">Assignee</label>
                <Select.Root size="1" value={filters.assignee} onValueChange={(val) => setFilters(f => ({ ...f, assignee: val }))}>
                  <Select.Trigger id="filter-assignee" />
                  <Select.Content>
                    <Select.Item value="all">All Assignees</Select.Item>
                    <Select.Item value="unassigned">Unassigned</Select.Item>
                    {agents
                      .filter(a => !isProtectedAgent(a.id))
                      .map(a => (
                        <Select.Item key={a.id} value={a.id}>{a.avatar} {a.name}</Select.Item>
                      ))}
                    {/* Also include assignees from tasks that may not be in agents list */}
                    {uniqueAssignees
                      .filter(id => !agents.find(a => a.id === id))
                      .map(id => (
                        <Select.Item key={id} value={id}>{id}</Select.Item>
                      ))}
                  </Select.Content>
                </Select.Root>
              </div>

              {/* Show completed */}
              <label className="icon-text-tight text-sm cursor-pointer">
                <Checkbox
                  checked={filters.showCompleted}
                  onCheckedChange={(val) => setFilters(f => ({ ...f, showCompleted: val === true }))}
                />
                Show completed
              </label>

              {/* Clear filters */}
              {activeFiltersCount > 0 && (
                <button onClick={clearFilters} className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                  <X size={14} className="flex-shrink-0" /> Clear all
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
                  type="button"
                  onClick={() => setFilters(f => ({ ...f, priority: p }))}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    filters.priority === p ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
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
                  type="button"
                  onClick={() => setFilters(f => ({ ...f, dueFilter: opt.id }))}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    filters.dueFilter === opt.id ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
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
                      type="button"
                      onClick={() => setFilters(f => ({
                        ...f,
                        labels: isActive
                          ? f.labels.filter(l => l !== label)
                          : [...f.labels, label],
                      }))}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                        isActive ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {filters.labels.length > 0 && (
                  <button type="button" onClick={() => setFilters(f => ({ ...f, labels: [] }))} className="px-2 py-0.5 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text border border-transparent hover:border-mission-control-border transition-colors flex items-center gap-1">
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
              <Flex key={view.name} align="center" gap="1">
                <button onClick={() => applySavedView(view)} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                  {view.name}
                </button>
                <button onClick={() => deleteSavedView(view.name)} title="Delete saved view" className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                  <X size={10} />
                </button>
              </Flex>
            ))}
          </div>
        )}
      </div>

      {/* Kanban Board */}
      {!loading.tasks && filteredTasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <EmptyState
            icon={activeFiltersCount > 0 ? Search : Inbox}
            title={activeFiltersCount > 0 ? 'No tasks match your filters' : 'No tasks yet'}
            description={activeFiltersCount > 0
              ? 'No tasks match your current filters. Try adjusting your search or filters.'
              : 'Create your first task to get the team working'}
            action={activeFiltersCount > 0
              ? undefined
              : { label: 'Create task', onClick: () => handleAddTask('todo') }}
            variant={activeFiltersCount > 0 ? 'default' : 'global'}
            size="md"
          />
        </div>
      )}
      {/* Mobile column navigator */}
      {isMobile && !(!loading.tasks && filteredTasks.length === 0) && (
        <Flex align="center" justify="between" className="px-4 py-2 border-b border-mission-control-border bg-mission-control-surface">
          <button
            onClick={() => setMobileColumnIndex(prev => Math.max(prev - 1, 0))}
            disabled={mobileColumnIndex === 0}
            aria-label="Previous column"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium text-mission-control-text">
              {columns[mobileColumnIndex]?.title ?? ''}
            </span>
            <Flex align="center" gap="1">
              {columns.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setMobileColumnIndex(i)}
                  aria-label={`Go to column ${columns[i].title}`}
                  className={`flex items-center justify-center w-5 h-5 rounded transition-colors ${
                    i === mobileColumnIndex
                      ? 'text-mission-control-accent'
                      : 'text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  <span className={`block rounded-full bg-current ${i === mobileColumnIndex ? 'w-4 h-2' : 'w-2 h-2'}`} />
                </button>
              ))}
            </Flex>
          </div>
          <button
            onClick={() => setMobileColumnIndex(prev => Math.min(prev + 1, columns.length - 1))}
            disabled={mobileColumnIndex === columns.length - 1}
            aria-label="Next column"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </Flex>
      )}

      <div
        className={`flex-1 min-w-0 min-h-0 flex flex-nowrap gap-4 p-4 overflow-x-auto [overflow-scrolling:touch] [-webkit-overflow-scrolling:touch] ${!loading.tasks && filteredTasks.length === 0 ? 'hidden' : ''}`}
        onTouchStart={isMobile ? handleMobileTouchStart : undefined}
        onTouchEnd={isMobile ? handleMobileTouchEnd : undefined}
      >
        {columns.map((column, columnIdx) => {
          if (isMobile && columnIdx !== mobileColumnIndex) return null;
          const columnTasks = getColumnTasks(column.id);
          const settings = columnSettings[column.id];
          const dropdowns = columnDropdowns[column.id];
          const isDragOver = dragOverColumn === column.id;
          
          const isCollapsed = collapsedColumns.has(column.id);

        return (
            <div
              key={column.id}
              data-column={column.id}
              className={`flex-shrink-0 h-full flex flex-col rounded-xl border transition-colors ${
                isCollapsed ? 'w-12 min-w-[48px]' : 'w-96 min-w-[320px]'
              } ${
                isDragOver
                  ? 'border-mission-control-border/50 bg-mission-control-accent/10 scale-[1.01] shadow-lg shadow-mission-control-accent/20'
                  : draggedTask
                  ? 'border-mission-control-border/50 bg-mission-control-bg/50'
                  : 'border-mission-control-border/50 bg-mission-control-bg/50'
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              role="region"
              aria-label={`${column.title} column`}
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between px-3 py-2.5 border-b border-mission-control-border/50 border-t-2 ${column.color} rounded-t-xl flex-shrink-0`}>
                <div className={`icon-text ${isCollapsed ? 'flex-col gap-2' : ''}`}>
                    <button onClick={() => toggleColumnCollapse(column.id)} title={isCollapsed ? 'Expand column' : 'Collapse column'} className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
                      {isCollapsed ? <ChevronRight size={14} className="flex-shrink-0" /> : <ChevronDown size={14} className="flex-shrink-0" />}
                    </button>
                    <span className={column.iconColor}>{column.icon}</span>
                    {!isCollapsed && <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">{column.title}</h3>}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-mission-control-border/50 text-mission-control-text-dim tabular-nums" title={column.id === 'done' && taskCounts.totalArchived > 0 ? `${taskCounts.totalArchived} archived` : undefined}>
                      {column.id === 'done' && taskCounts.totalDone > columnTasks.length
                        ? `${columnTasks.length}/${taskCounts.totalDone}`
                        : columnTasks.length}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="flex items-center gap-1">
                      {/* Sort Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => toggleColumnDropdown(column.id, 'sort')}
                          title="Sort"
                          className={`inline-flex items-center justify-center w-6 h-6 rounded border text-xs transition-colors ${
                            settings.sortBy !== 'newest'
                              ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                              : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                          }`}
                        >
                          <ArrowDown size={14} className="flex-shrink-0" />
                        </button>
                        {dropdowns.sort && (
                          <div className="absolute top-full right-0 mt-1 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg z-50 min-w-[180px]">
                            <div className="p-1">
                              {(['newest', 'oldest', 'priority-asc', 'priority-desc', 'progress-asc', 'progress-desc'] as const).map((opt) => {
                                const labels: Record<string, string> = {
                                  'newest': 'Newest First',
                                  'oldest': 'Oldest First',
                                  'priority-asc': 'Priority: Low → High',
                                  'priority-desc': 'Priority: High → Low',
                                  'progress-asc': 'Progress: 0% → 100%',
                                  'progress-desc': 'Progress: 100% → 0%',
                                };
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => { updateColumnSetting(column.id, 'sortBy', opt); toggleColumnDropdown(column.id, 'sort'); }}
                                    className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-left transition-colors ${
                                      settings.sortBy === opt
                                        ? 'bg-mission-control-surface text-mission-control-accent shadow-sm'
                                        : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface/50'
                                    }`}
                                  >
                                    {labels[opt]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Filter Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => toggleColumnDropdown(column.id, 'filter')}
                          title="Filter"
                          className={`inline-flex items-center justify-center w-6 h-6 rounded border text-xs transition-colors ${
                            settings.filterAgent !== 'all' || settings.filterPriority !== 'all'
                              ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                              : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                          }`}
                        >
                          <Filter size={14} className="flex-shrink-0" />
                        </button>
                        {dropdowns.filter && (
                          <div className="absolute top-full right-0 mt-1 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg z-50 min-w-[180px]">
                            <div className="p-2 border-b border-mission-control-border">
                              <div className="text-xs font-semibold text-mission-control-text-dim mb-1">Agent</div>
                              <Select.Root size="1" value={settings.filterAgent} onValueChange={(val) => updateColumnSetting(column.id, 'filterAgent', val)}>
                                <Select.Trigger className="w-full" />
                                <Select.Content>
                                  <Select.Item value="all">All Agents</Select.Item>
                                  <Select.Item value="unassigned">Unassigned</Select.Item>
                                  {agents.map(a => (
                                    <Select.Item key={a.id} value={a.id}>{a.name}</Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Root>
                            </div>
                            <div className="p-2">
                              <div className="text-xs font-semibold text-mission-control-text-dim mb-1">Priority</div>
                              <Select.Root size="1" value={settings.filterPriority} onValueChange={(val) => updateColumnSetting(column.id, 'filterPriority', val as TaskPriority | 'all')}>
                                <Select.Trigger className="w-full" />
                                <Select.Content>
                                  <Select.Item value="all">All Priorities</Select.Item>
                                  {PRIORITIES.map(p => (
                                    <Select.Item key={p.id} value={p.id}>{p.label}</Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Root>
                            </div>
                            {(settings.filterAgent !== 'all' || settings.filterPriority !== 'all') && (
                              <div className="p-2 border-t border-mission-control-border">
                                <button onClick={() => { updateColumnSetting(column.id, 'filterAgent', 'all'); updateColumnSetting(column.id, 'filterPriority', 'all'); }} className="w-full inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors">
                                  Clear Filters
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Add / Archive action */}
                      {column.id === 'done' ? (
                        <button onClick={() => setShowArchiveConfirm(true)} disabled={isArchiving || columnTasks.length === 0} title="Archive all done tasks" className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          <Archive size={14} className="flex-shrink-0" />
                        </button>
                      ) : (
                        <button onClick={() => handleAddTask(column.id)} title="Add task" className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
                          <Plus size={14} className="flex-shrink-0" />
                        </button>
                      )}
                    </div>
                  )}
              </div>

              {/* Tasks */}
              {!isCollapsed && <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
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

              </div>}
            </div>
          );
        })}
      </div>

      {/* Keyboard Shortcuts Modal */}
      <BaseModal
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        size="sm"
        ariaLabelledby="keyboard-shortcuts-title"
      >
        <BaseModalHeader
          title="Keyboard Shortcuts"
          titleId="keyboard-shortcuts-title"
          icon={<Keyboard size={20} className="flex-shrink-0" />}
          onClose={() => setShowKeyboardHelp(false)}
          closeButtonLabel="Close keyboard shortcuts"
        />
        <BaseModalBody>
          <div className="space-y-3 text-sm">
            <Flex justify="between"><span>New task</span><kbd className="px-2 py-1 bg-mission-control-bg rounded">N</kbd></Flex>
            <Flex justify="between"><span>Search</span><kbd className="px-2 py-1 bg-mission-control-bg rounded">Cmd+F</kbd></Flex>
            <Flex justify="between"><span>Close panel</span><kbd className="px-2 py-1 bg-mission-control-bg rounded">Esc</kbd></Flex>
            <Flex justify="between"><span>This help</span><kbd className="px-2 py-1 bg-mission-control-bg rounded">?</kbd></Flex>
          </div>
        </BaseModalBody>
      </BaseModal>

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
          <Button variant="soft" size="1" onClick={handleBulkMarkDone} disabled={isBulkUpdating || isBulkDeleting}>
            <CheckCircle size={15} className="flex-shrink-0" />
            Mark Done
          </Button>

          {/* Assign Agent */}
          <div className="relative">
            <button onClick={() => setShowBulkAssign(v => !v)} disabled={isBulkUpdating || isBulkDeleting} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
                <div className="absolute bottom-full mb-2 left-0 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-xl py-1 z-[61] min-w-[180px] max-h-60 overflow-y-auto">
                  {agents.filter(a => !isProtectedAgent(a.id)).length === 0 ? (
                    <div className="px-4 py-3 text-sm text-mission-control-text-dim">No agents available</div>
                  ) : agents.filter(a => !isProtectedAgent(a.id)).map(a => (
                    <button key={a.id} onClick={() => handleBulkAssign(a.id)} className="w-full inline-flex items-center gap-2 px-3 py-1.5 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors">
                      <AgentAvatar agentId={a.id} fallbackEmoji={a.avatar} size="xs" />
                      {a.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Delete */}
          <Button variant="soft" color="red" size="1" onClick={() => setShowBulkDeleteConfirm(true)} disabled={isBulkUpdating || isBulkDeleting}>
            <Trash2 size={15} className="flex-shrink-0" />
            Delete
          </Button>

          <div className="w-px h-5 bg-mission-control-border flex-shrink-0" />

          {/* Clear selection */}
          <button onClick={() => { setSelectedIds(new Set()); setLastSelectedId(null); setShowBulkAssign(false); }} title="Clear selection (Esc)" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const editInputRef = useRef<HTMLInputElement>(null);
  // Quick-edit inline popover
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [quickEditAnchor, setQuickEditAnchor] = useState<DOMRect | null>(null);
  const quickEditBtnRef = useRef<HTMLButtonElement>(null);


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
      return { color: 'border-[var(--color-warning)]/30', description: 'Silent agent (no activity logged)' };
    }
    
    const now = Date.now();
    const minutesSinceActivity = (now - lastActivity) / (1000 * 60);
    
    // 🟢 Green: Active work in last 15 minutes
    if (minutesSinceActivity < 15) {
      return { color: 'border-[var(--color-success)]/30', description: `Active (${Math.floor(minutesSinceActivity)}m ago)` };
    }
    
    // 🟡 Yellow: Stale, no activity in 15-30 minutes
    if (minutesSinceActivity < 30) {
      return { color: 'border-[var(--color-warning)]/30', description: `Stale (${Math.floor(minutesSinceActivity)}m ago)` };
    }
    
    // 🔴 Red: Stuck/abandoned, no activity in 30+ minutes
    return { color: 'border-[var(--color-error)]/30', description: `Stuck (${Math.floor(minutesSinceActivity)}m ago)` };
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
      className={`bg-mission-control-bg rounded-lg p-3 border-2 transition-colors duration-150 cursor-pointer group relative ${
        isDragging ? 'opacity-50 scale-105 rotate-2 shadow-lg' : ''
      } ${
        isDeleting || isMoving ? 'opacity-60 pointer-events-none' : ''
      } ${
        isSelected
          ? 'border-mission-control-accent bg-mission-control-accent/5 shadow-[0_0_0_1px_var(--mc-accent)]'
          : task.status === 'in-progress'
          ? 'border-[var(--color-success)]/60 bg-[var(--color-success)]/10 shadow-[0_0_0_1px_var(--color-success-border)]'
          : activityIndicator ? activityIndicator.color
          : dueInfo?.isOverdue ? 'border-[var(--color-error)]/30 bg-[var(--color-error)]/10'
          : task.priority === 'p0' ? 'border-[var(--color-error)]/30'
          : task.priority === 'p1' ? 'border-[var(--color-warning)]/30'
          : 'border-mission-control-border hover:border-mission-control-accent/50'
      } hover:shadow-lg hover:-translate-y-0.5`}
      title={activityIndicator?.description}
    >
      {/* Top row: Checkbox + Priority + Title + Menu */}
      <Flex align="start" gap="2" mb="2">
        {/* Selection checkbox — always rendered, visible on hover or when selected */}
        {onToggleSelect && (
          <button
            style={{ flexShrink: 0, marginTop: '2px' }}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(task.id, e.shiftKey); }}
            title={isSelected ? 'Deselect task' : 'Select task (Shift+click for range)'}
            aria-label={isSelected ? 'Deselect task' : 'Select task'}
            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors ${isSelected || isAnySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          >
            {isSelected
              ? <CheckSquare size={15} className="text-mission-control-accent flex-shrink-0" />
              : <Square size={15} className="text-mission-control-text-dim flex-shrink-0" />
            }
          </button>
        )}
        {/* Priority badge */}
        {priorityConfig && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                title={`Priority: ${priorityConfig.label}`}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${priorityConfig.color} ${priorityConfig.bg} hover:opacity-80`}
              >
                {task.priority?.toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Set Priority</DropdownMenuLabel>
              {PRIORITIES.map(p => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={(e) => { e.stopPropagation(); onSetPriority(p.id); }}
                  className={task.priority === p.id ? 'text-mission-control-accent' : ''}
                >
                  <span className={p.color}>{p.icon}</span>
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* Title */}
        <div className="flex flex-col flex-1 min-w-0 group/title">
          {isEditingTitle ? (
            <TextField.Root
              ref={editInputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitEditTitle(); }
                if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitle(task.title); }
              }}
              onBlur={commitEditTitle}
              onClick={e => e.stopPropagation()}
              size="1"
              className="w-full"
            />
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <h4
                className="font-medium text-sm leading-tight flex-1 min-w-0 truncate"
                onDoubleClick={startEditTitle}
                title="Double-click to edit"
              >{task.title}</h4>
              <button onClick={startEditTitle} title="Edit title" style={{ opacity: 0 }} className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                <Pencil size={11} />
              </button>
            </div>
          )}
          {task.updatedAt && (
            <span className="text-[10px] text-mission-control-text-dim mt-0.5 tabular-nums">
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
        
        {/* Quick-edit pencil button — visible on hover */}
        <button
          ref={quickEditBtnRef}
          style={{ flexShrink: 0, opacity: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            if (quickEditBtnRef.current) {
              setQuickEditAnchor(quickEditBtnRef.current.getBoundingClientRect());
            }
            setShowQuickEdit(true);
          }}
          title="Quick edit"
          aria-label="Quick edit task"
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <Pencil size={14} className="flex-shrink-0" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <MoreHorizontal size={16} className="flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Flag size={14} className="flex-shrink-0" /> Set Priority
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {PRIORITIES.map(p => (
                  <DropdownMenuItem key={p.id} onClick={(e) => { e.stopPropagation(); onSetPriority(p.id); }}>
                    <span className={p.color}>{p.icon}</span> {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Bot size={14} className="flex-shrink-0" /> Assign Agent
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAssign(''); }}>
                  <User size={14} className="flex-shrink-0 text-mission-control-text-dim" /> Unassigned
                </DropdownMenuItem>
                {agents.map(agent => (
                  <DropdownMenuItem key={agent.id} onClick={(e) => { e.stopPropagation(); onAssign(agent.id); }}>
                    <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="xs" /> {agent.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPoke(); }}>
              <Hand size={14} className="flex-shrink-0" /> Poke
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={(e) => { e.stopPropagation(); onDelete(); }} disabled={isDeleting}>
              {isDeleting ? <Spinner size={14} className="flex-shrink-0" /> : <Trash2 size={14} className="flex-shrink-0" />}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Flex>

      {/* Definition of Ready Indicators — below title row to prevent layout squish */}
      {isTodoTask && !isReady && (
        <div className="flex flex-wrap gap-1 mb-2" title={`Missing: ${missingCriteria.join(', ')}`}>
          {!hasMinSubtasks && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-warning)]/10 text-[var(--color-warning)] rounded-full inline-flex items-center gap-0.5">
              <AlertTriangle size={10} className="inline" /> {task.subtasks?.length || 0}/2 subtasks
            </span>
          )}
          {!hasPriority && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded-full inline-flex items-center gap-0.5">
              <AlertTriangle size={10} className="inline" /> No priority
            </span>
          )}
          {!hasValidAssignment && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded-full inline-flex items-center gap-0.5">
              <AlertTriangle size={10} className="inline" /> No valid assignee
            </span>
          )}
          {!hasDescription && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-warning)]/10 text-[var(--color-warning)] rounded-full inline-flex items-center gap-0.5">
              <AlertTriangle size={10} className="inline" /> Needs description
            </span>
          )}
        </div>
      )}
      {isTodoTask && isReady && (
        <div className="mb-2">
          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-full inline-flex items-center gap-0.5">
            <CheckCircle size={10} className="inline" /> Ready for Review
          </span>
        </div>
      )}

      {/* Due date urgency badges — only show for incomplete tasks */}
      {task.dueDate && task.status !== 'done' && dueInfo && (() => {
        if (dueInfo.isOverdue) {
          return (
            <Flex align="center" gap="1" mb="2">
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border text-[var(--color-error)] bg-[var(--color-error)]/10 border-[var(--color-error)]/30">
                <AlertTriangle size={10} />
                {dueInfo.text}
              </span>
            </Flex>
          );
        }
        if (dueInfo.isDueSoon) {
          return (
            <Flex align="center" gap="1" mb="2">
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border text-[var(--color-warning)] bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30">
                <Clock size={10} />
                Due in {dueInfo.text}
              </span>
            </Flex>
          );
        }
        if (dueInfo.isDueThisWeek) {
          return (
            <Flex align="center" gap="1" mb="2">
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border text-[var(--color-warning)] bg-[var(--color-warning)]/10/50 border-[var(--color-warning)]/30/50">
                <Calendar size={10} />
                Due in {dueInfo.text}
              </span>
            </Flex>
          );
        }
        return null;
      })()}

      {/* Task description */}
      {task.description && (
        <p className="text-xs text-mission-control-text-dim line-clamp-2 leading-relaxed mt-1 mb-1">{task.description}</p>
      )}

      {/* Task progress bar */}
      {typeof task.progress === 'number' && task.progress > 0 && (
        <div className="mt-2 w-full bg-mission-control-border rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-mission-control-accent transition-colors duration-500 rounded-full" style={{ width: `${task.progress}%` }} />
        </div>
      )}

      {/* Awaiting Clara badge — shown on Pre-review column cards */}
      {task.status === 'internal-review' && (
        <div className="icon-text-tight text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-2 bg-[var(--color-review)]-subtle text-[var(--color-review)]">
          <Clock size={10} className="no-shrink animate-pulse" />
          <span>Awaiting Clara</span>
          {task.reviewStatus === 'pre-review' && (
            <span className="ml-1 opacity-70">— reviewing…</span>
          )}
        </div>
      )}

      {/* Clara review status badge */}
      {task.reviewStatus && task.status !== 'internal-review' && (
        <div className={`icon-text-tight text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-2 ${
          task.reviewStatus === 'approved' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' :
          task.reviewStatus === 'rejected' || task.reviewStatus === 'needs-changes' ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]' :
          'bg-mission-control-accent/10 text-mission-control-accent animate-pulse'
        }`}>
          {task.reviewStatus === 'approved' ? <ShieldCheck size={10} className="no-shrink" /> :
           task.reviewStatus === 'rejected' || task.reviewStatus === 'needs-changes' ? <ShieldX size={10} className="no-shrink" /> :
           <ShieldAlert size={10} className="no-shrink" />}
          <span>Clara: {task.reviewStatus === 'in-review' ? 'reviewing…' : task.reviewStatus}</span>
          {task.reviewNotes && (
            <span className="ml-1 opacity-70 truncate max-w-[120px]">— {task.reviewNotes}</span>
          )}
        </div>
      )}
      
      {/* Subtask Progress */}
      {subtaskCount > 0 && (
        <div className="mb-2">
          <div className="icon-text-tight text-[10px] text-mission-control-text-dim mb-1">
            <CheckSquare size={12} className="flex-shrink-0" />
            <span className="tabular-nums">{completedSubtasks}/{subtaskCount}</span>
          </div>
          <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className={`h-full transition-colors duration-300 ${
                subtaskProgress === 100 ? 'bg-[var(--color-success)]' : 'bg-mission-control-accent'
              }`}
              style={{ width: `${subtaskProgress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Bottom row: Project, Due date, Agent */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-border/30 text-mission-control-text-dim flex-shrink-0 whitespace-nowrap">
            <FolderOpen size={11} className="flex-shrink-0" />
            {task.project}
          </span>

          {dueInfo && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${
              dueInfo.isOverdue ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]' :
              dueInfo.isDueSoon ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' :
              dueInfo.isDueThisWeek ? 'bg-[var(--color-warning)]/10/50 text-[var(--color-warning)]' :
              'bg-mission-control-border/30 text-mission-control-text-dim'
            }`}>
              <Calendar size={11} className="flex-shrink-0" />
              {dueInfo.text}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {assignedAgent ? (
            <>
              {task.status === 'in-progress' ? (
                <span className="icon-badge-sm bg-[var(--color-success)]/10 text-[var(--color-success)] animate-pulse" title="Agent working">
                  <Zap size={14} className="no-shrink" />
                </span>
              ) : canStart ? (
                <IconButton variant="solid" size="1" onClick={(e) => { e.stopPropagation(); onStartAgent(); }} disabled={isSpawning} title="Start agent">
                  {isSpawning ? <Spinner size={14} className="no-shrink" /> : <Play size={14} className="no-shrink" />}
                </IconButton>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title={assignedAgent?.name || task.assignedTo}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center rounded transition-opacity hover:opacity-80"
                  >
                    <AgentAvatar agentId={assignedAgent.id} fallbackEmoji={assignedAgent.avatar} size="xs" status={getAgentStatus()} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Assign to agent</DropdownMenuLabel>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAssign(''); }}>
                    <User size={14} className="flex-shrink-0 text-mission-control-text-dim" /> Unassigned
                  </DropdownMenuItem>
                  {agents.map(agent => (
                    <DropdownMenuItem key={agent.id} onClick={(e) => { e.stopPropagation(); onAssign(agent.id); }}
                      className={task.assignedTo === agent.id ? 'text-mission-control-accent' : ''}>
                      <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="xs" /> {agent.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                >
                  <User size={14} className="no-shrink" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Assign to agent</DropdownMenuLabel>
                {agents.map(agent => (
                  <DropdownMenuItem key={agent.id} onClick={(e) => { e.stopPropagation(); onAssign(agent.id); }}>
                    <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="xs" /> {agent.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Quick-edit popover */}
      {showQuickEdit && quickEditAnchor && (
        <TaskQuickEdit
          task={task}
          agents={agents}
          anchorRect={quickEditAnchor}
          onClose={() => { setShowQuickEdit(false); setQuickEditAnchor(null); }}
          onSaved={(patch) => {
            // Always propagate all fields through store for proper UI update + API persistence
            if (patch.title) onTitleEdit(task.id, patch.title);
            if (patch.priority) onSetPriority(patch.priority);
            if ('assignedTo' in patch) onAssign(patch.assignedTo ?? '');
          }}
        />
      )}
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
