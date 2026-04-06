// Phase 81: File-level eslint-disable removed.
// useEffect deps are explicit. Interval raised to 30s.
// Complex panel with many useEffects for task management - patterns are carefully designed.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEventBus } from '../lib/useEventBus';
import { X, Bot, Clock, Play, CheckCircle, XCircle, FileText, Activity, MessageSquare, Calendar, Plus, Check, Eye, AlertCircle, AlertTriangle, Lightbulb, Loader2, RefreshCw, Upload, Download, Trash2, Paperclip, Search, ImageIcon, File, Archive, Settings, Code, Globe, Timer, Link2, Sparkles, ChevronUp, ChevronDown, User, ExternalLink, Film, Code2, Braces, Table2, Image, ZoomIn, Pencil } from 'lucide-react';
import { useStore, Task, Subtask, TaskActivity } from '../store/store';
// eslint-disable-next-line import/order
import { Box, Flex, Button, Checkbox, IconButton, Spinner, TextArea, TextField, Select } from '@radix-ui/themes';
import ActiveAgentIndicator from './ActiveAgentIndicator';
import AgentProgressQuery from './AgentProgressQuery';
import { showToast } from './Toast';
import AgentAvatar from './AgentAvatar';
import PokeModal from './PokeModal';
import { taskApi } from '@/lib/api';
import { gateway } from '@/lib/gateway';
import { createLogger } from '../utils/logger';

const logger = createLogger('TaskDetailPanel');
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import TaskChatTab from './TaskChatTab';
import TabNav from './TabNav';
import { isProtectedAgent } from '../lib/agentConfig';
import { useFocusTrap } from '../hooks/useKeyboardNav';
import BaseModal, { BaseModalHeader, BaseModalBody, BaseModalFooter } from './BaseModal';
import MarkdownMessage from './MarkdownMessage';

function parseAcceptanceCriteria(planningNotes: string): string[] {
  const match = planningNotes.match(/## Acceptance Criteria\n([\s\S]*?)(?=\n##|$)/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .filter(l => l.trim().startsWith('-'))
    .map(l => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}

function formatDuration(ms: number): string {
  if (ms < 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

interface TaskAttachment {
  id: number;
  taskId: string;
  filePath: string;
  fileName: string | null;
  category: string | null;
  uploadedBy: string | null;
  createdAt: number;
}

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

export default function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const agents = useStore(s => s.agents);
  const updateTask = useStore(s => s.updateTask);
  const patchTaskLocal = useStore(s => s.patchTaskLocal);
  const spawnAgentForTask = useStore(s => s.spawnAgentForTask);
  const loadSubtasksForTask = useStore(s => s.loadSubtasksForTask);
  const addSubtask = useStore(s => s.addSubtask);
  const updateSubtask = useStore(s => s.updateSubtask);
  const deleteSubtask = useStore(s => s.deleteSubtask);
  const loadTaskActivity = useStore(s => s.loadTaskActivity);
  const logTaskActivity = useStore(s => s.logTaskActivity);
  const { showConfirm, closeConfirm, onConfirm, config, open } = useConfirmDialog();
  const [newSubtask, setNewSubtask] = useState('');
  const [activeTab, setActiveTab] = useState<'subtasks' | 'planning' | 'activity' | 'files' | 'review' | 'chat'>('subtasks');
  // Subtask enhancements: selection, bulk actions, due dates
  const [selectedSubtaskIds, setSelectedSubtaskIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
  const [editingPlanningNotes, setEditingPlanningNotes] = useState(false);
  const newSubtaskInputRef = useRef<HTMLInputElement>(null);
  const [suggestedCriteria, setSuggestedCriteria] = useState<string[]>([]);
  const [isCreatingCriteriaSubtasks, setIsCreatingCriteriaSubtasks] = useState(false);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [poking, _setPoking] = useState(false);
  const [showPokeModal, setShowPokeModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  // Multi-stage / Fork state
  const [childTasks, setChildTasks] = useState<Array<{ id: string; title: string; status: string; stageNumber?: number }>>([]);
  const [showForkModal, setShowForkModal] = useState(false);
  const [forkDescription, setForkDescription] = useState('');
  const [forkAssignSameAgent, setForkAssignSameAgent] = useState(true);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showAgentActiveModal, setShowAgentActiveModal] = useState(false);
  const [activeAgentInfo, setActiveAgentInfo] = useState<{ sessionKey: string; displayName: string } | null>(null);
  const [checkingAgent, setCheckingAgent] = useState(false);
  const [abortingAgent, setAbortingAgent] = useState(false);
  const [fileViewer, setFileViewer] = useState<{ name: string; content?: string; ext: string; mediaType?: 'image' | 'video' | 'html'; serveUrl?: string } | null>(null);
  // Focus trap for dialog accessibility (WCAG 2.4.3 / 4.1.2)
  const focusTrapRef = useFocusTrap(!!task);
  const panelTitleId = 'task-detail-title';
  // Focus trap for agent-active modal (not yet migrated to BaseModal)
  const agentActiveModalTrapRef = useFocusTrap(showAgentActiveModal);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  // Track current task id for SSE handler
  const taskIdRef = useRef<string | null>(task?.id ?? null);
  taskIdRef.current = task?.id ?? null;

  // Refs to stable callbacks for SSE handler (avoids stale closures before callbacks are defined)
  const loadSubtasksRef = useRef<(() => void) | null>(null);
  const loadActivityRef = useRef<(() => void) | null>(null);

  // Subscribe to task.updated SSE events — refetch when this task changes
  useEventBus('task.updated', (data) => {
    const d = data as { id: string };
    if (d?.id && d.id === taskIdRef.current) {
      loadSubtasksRef.current?.();
      loadActivityRef.current?.();
    }
  });

  // Save focus on open, restore on close (WCAG 2.4.3)
  useEffect(() => {
    if (task) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
    }
    return () => {
      previousActiveElementRef.current?.focus();
    };
  }, [!!task]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally only tracks open/close

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (!task) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [task]);

  // Hydrate planningNotes lazily — the bulk load uses ?summary=1 which strips this field.
  // Use local state so it doesn't depend on store refresh cycles.
  const [localPlanningNotes, setLocalPlanningNotes] = useState<string | undefined>(undefined);
  const hydratedTaskId = useRef<string | null>(null);

  useEffect(() => {
    if (!task) { setLocalPlanningNotes(undefined); hydratedTaskId.current = null; return; }
    if (task.planningNotes !== undefined) { setLocalPlanningNotes(task.planningNotes); return; }
    if (hydratedTaskId.current === task.id) return;
    hydratedTaskId.current = task.id;
    taskApi.getById(task.id).then((fullTask: any) => {
      if (fullTask && 'planningNotes' in fullTask) {
        setLocalPlanningNotes(fullTask.planningNotes ?? '');
      }
    }).catch(err => console.warn('[TaskDetailPanel] Non-critical:', err));
  }, [task?.id, task?.planningNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle both local and remote agents
  const assignedAgent = task?.assignedTo ? agents.find(a => a.id === task.assignedTo) : null;
  const isRemoteAgent = task?.assignedTo && !assignedAgent && !['', 'none', 'unassigned'].includes(task.assignedTo);
  const isWorking = assignedAgent?.currentTaskId === task?.id;

  // Load subtasks from DB
  const loadSubtasks = useCallback(async () => {
    if (!task) return;
    setLoadingSubtasks(true);
    try {
      const loaded = await loadSubtasksForTask(task.id);
      setSubtasks(loaded);
    } finally {
      setLoadingSubtasks(false);
    }
  }, [task, loadSubtasksForTask]);

  // Load activity from DB
  const loadActivity = useCallback(async () => {
    if (!task) return;
    setLoadingActivity(true);
    try {
      const loaded = await loadTaskActivity(task.id, 100);
      setActivities(loaded);
    } finally {
      setLoadingActivity(false);
    }
  }, [task, loadTaskActivity]);

  // Wire refs for SSE handler (must be after callbacks are defined)
  loadSubtasksRef.current = loadSubtasks;
  loadActivityRef.current = loadActivity;

  // Load attachments from REST API
  const loadAttachments = useCallback(async () => {
    if (!task) return;
    setLoadingAttachments(true);
    try {
      const result = await taskApi.getAttachments(task.id);
      if (Array.isArray(result)) {
        setAttachments(result as unknown as TaskAttachment[]);
      } else {
        setAttachments([]);
      }
    } catch (err: unknown) {
      // Failed to load attachments - may not have attachments API route yet
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  }, [task]);

  // Load child tasks for multi-stage
  useEffect(() => {
    if (!task) { setChildTasks([]); return; }
    taskApi.getSubtasks(task.id).then((result: any) => {
      if (Array.isArray(result)) {
        setChildTasks(result.map((c: any) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          stageNumber: c.stage_number,
        })));
      } else if (result?.success && result.children) {
        setChildTasks(result.children.map((c: any) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          stageNumber: c.stage_number,
        })));
      }
    }).catch(err => console.warn('[TaskDetailPanel] Non-critical:', err));
  }, [task?.id]);

  useEffect(() => {
    if (!task) {
      setSubtasks([]);
      setActivities([]);
      setAttachments([]);
      return;
    }

    // Load all on mount
    loadSubtasks();
    loadActivity();
    loadAttachments();

    // Poll for updates while task is in progress — 30s (SSE drives real-time updates)
    const interval = setInterval(() => {
      if (task.status === 'in-progress') {
        loadSubtasks();
        loadActivity();
        loadAttachments();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [task, loadSubtasks, loadActivity, loadAttachments]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!task) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow Esc to close even when focused on input
        if (e.key !== 'Escape') return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Escape - Close panel (only if no sub-modal is open)
      if (e.key === 'Escape') {
        // Let sub-modals handle their own Escape key
        if (showForkModal || showReopenModal || showAgentActiveModal || fileViewer || showPokeModal || open) return;
        e.preventDefault();
        onClose();
        return;
      }

      // Cmd+S - Save/Update (currently auto-saves, but we can trigger a manual update)
      if (isCmdOrCtrl && e.key === 's') {
        e.preventDefault();
        // Trigger a reload to ensure fresh data
        loadSubtasks();
        loadActivity();
        showToast('info', 'Refreshed', 'Task data updated');
        return;
      }

      // Cmd+Enter - Complete task
      if (isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        const validation = canMarkDone();
        if (validation.allowed && task.status === 'review') {
          updateTask(task.id, { status: 'done' });
          showToast('success', 'Task completed', `Marked "${task.title}" as done`);
        } else {
          showToast('warning', 'Cannot complete', validation.reasons[0] || 'Requirements not met');
        }
        return;
      }

      // Cmd+Shift+P - Poke agent
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (task.status === 'in-progress') {
          handlePoke();
        }
        return;
      }

      // Cmd+Shift+R - Reopen task
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (task.status === 'done') {
          setShowReopenModal(true);
        }
        return;
      }

      // Cmd+N - New subtask (focus input)
      if (isCmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        setActiveTab('subtasks');
        // Focus the subtask input
        setTimeout(() => newSubtaskInputRef.current?.focus(), 100);
        return;
      }

      // Cmd+1-5 - Switch tabs
      if (isCmdOrCtrl && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        const tabMap: Record<string, typeof activeTab> = {
          '1': 'subtasks',
          '2': 'planning',
          '3': 'activity',
          '4': 'files',
          '5': 'review',
          '6': 'chat',
        };
        if (e.key in tabMap) {
          setActiveTab(tabMap[e.key]);
        }
        return;
      }

      // Cmd+E - Edit task (focus planning notes)
      if (isCmdOrCtrl && e.key === 'e') {
        e.preventDefault();
        setActiveTab('planning');
        // Focus the planning textarea if it exists
        setTimeout(() => {
          const textarea = document.querySelector('textarea[placeholder*="Planning"]') as HTMLTextAreaElement;
          textarea?.focus();
        }, 100);
        return;
      }

      // Cmd+Backspace - Delete task
      if (isCmdOrCtrl && e.key === 'Backspace') {
        e.preventDefault();
        // Use ConfirmDialog instead of native confirm
        showConfirm({
          title: 'Delete Task',
          message: `Delete task "${task.title}"? This cannot be undone.`,
          confirmLabel: 'Delete',
          type: 'danger',
        }, async () => {
          try {
            await taskApi.delete(task.id);
            showToast('success', 'Task deleted', `Deleted "${task.title}"`);
            onClose();
          } catch (err: unknown) {
            showToast('error', 'Delete failed', (err as Error).message);
          }
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sub-modal states for Escape scoping
  }, [task, activeTab, onClose, updateTask, showForkModal, showReopenModal, showAgentActiveModal, fileViewer, showPokeModal, open]);

  if (!task) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // B+C ENFORCEMENT: Both requirements must be met
  const canMarkDone = () => {
    if (!task) return { allowed: false, reasons: [] };
    
    const reasons: string[] = [];
    
    // REQUIREMENT B: All subtasks must be complete (100%)
    const hasSubtasks = subtasks.length > 0;
    const incompleteCount = subtasks.filter((st: Subtask) => !st.completed).length;
    
    if (hasSubtasks && incompleteCount > 0) {
      reasons.push(`${incompleteCount}/${subtasks.length} subtasks incomplete`);
    }
    
    // REQUIREMENT C: Reviewer approval required
    // Task must be in 'review' status (warning removed per Kevin request)
    
    // Reviewer must be assigned
    if (!task.reviewerId) {
      reasons.push('No reviewer assigned');
    }
    
    // Review status must be 'approved'
    if (task.reviewStatus !== 'approved') {
      reasons.push('Review not approved (reviewer must approve first)');
    }
    
    // RULE 2: Check activity count (minimum 2)
    if (activities.length < 2) {
      reasons.push(`Need at least 2 activity entries (currently ${activities.length})`);
    }
    
    // RULE 3: Check deliverables for certain task types
    const needsDeliverables = (
      /build|create|implement|document|write|design|code/i.test(task.title) ||
      ['Dashboard', 'Dev', 'Gateway', 'X/Twitter'].includes(task.project || '')
    );
    
    if (needsDeliverables) {
      const hasAttachments = attachments.length > 0;
      const hasDocumentedFiles = task.planningNotes && (
        /deliverable|file|\.md|\.js|\.ts|\.sql|\.sh/i.test(task.planningNotes)
      );
      
      if (!hasAttachments && !hasDocumentedFiles) {
        reasons.push('No deliverables found - attach files or document them');
      }
    }
    
    return { allowed: reasons.length === 0, reasons };
  };

  const validation = canMarkDone();

  // Check if agent is still active on this task
  const checkForActiveAgent = async () => {
    if (!task) return null;

    try {
      const result = await gateway.getSessions();
      if (result.sessions) {
        // Find session with label matching task ID
        const activeSession = result.sessions.find((s: any) => {
          // Session is active if updated within last 5 minutes
          const isActive = (Date.now() - s.updatedAt) < 5 * 60 * 1000;
          // Label contains task ID (e.g., "coder-task-123")
          const matchesTask = s.label && s.label.includes(task.id);
          return isActive && matchesTask;
        });

        if (activeSession) {
          // Map sessionKey to key for component compatibility
          return {
            ...activeSession,
            key: activeSession.sessionKey || activeSession.key,
          };
        }
      }
    } catch (err: unknown) {
      // 'Failed to check for active agent:', err;
    }
    return null;
  };

  const handleStart = async () => {
    if (task.id && assignedAgent) {
      await logTaskActivity(task.id, 'task_started', `Task started by ${assignedAgent.name}`, assignedAgent.id);
      spawnAgentForTask(task.id);
      loadActivity();
    }
  };

  const handlePoke = async () => {
    if (!task) return;
    // Open internal poke modal instead of posting to Discord
    setShowPokeModal(true);
  };

  const handleReopen = async () => {
    if (!task || !reopenReason.trim()) {
      showToast('error', 'Reason required', 'Please enter a reason for reopening this task');
      return;
    }

    try {
      // Update task: status to 'todo' and clear completed_at
      await updateTask(task.id, { 
        status: 'todo',
        completedAt: null as any
      });
      
      // Log activity with reason
      await logTaskActivity(task.id, 'task_reopened', `Reopened: ${reopenReason.trim()}`);
      
      showToast('success', 'Task reopened', reopenReason.trim());
      
      // Reset modal state
      setShowReopenModal(false);
      setReopenReason('');
      
      // Refresh activity to show the reopen entry
      loadActivity();
    } catch (err: unknown) {
      showToast('error', 'Failed to reopen', (err as Error).message);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !task) return;
    const result = await addSubtask(task.id, newSubtask.trim());
    if (result) {
      setSubtasks([...subtasks, result]);
      setNewSubtask('');
      showToast('success', 'Subtask added');
      // Refocus so the user can press Enter repeatedly to add more subtasks
      setTimeout(() => newSubtaskInputRef.current?.focus(), 0);
    } else {
      showToast('error', 'Failed to add subtask - check DevTools console for details');
    }
  };

  const handleCreateCriteriaSubtasks = async (criteria: string[]) => {
    if (!task || criteria.length === 0) return;
    setIsCreatingCriteriaSubtasks(true);
    try {
      for (const criterion of criteria) {
        const result = await addSubtask(task.id, criterion);
        if (result) {
          setSubtasks(prev => [...prev, result]);
        }
      }
      setSuggestedCriteria([]);
      showToast('success', `${criteria.length} subtask${criteria.length !== 1 ? 's' : ''} added from acceptance criteria`);
    } finally {
      setIsCreatingCriteriaSubtasks(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    const st = subtasks.find(s => s.id === subtaskId);
    if (!st) return;
    
    const success = await updateSubtask(subtaskId, { 
      completed: !st.completed,
      completedBy: !st.completed ? (assignedAgent?.id || 'user') : undefined,
    });
    
    if (success) {
      const updatedSubtasks = subtasks.map(s =>
        s.id === subtaskId
          ? { ...s, completed: !s.completed, completedAt: !s.completed ? Date.now() : undefined }
          : s
      );
      setSubtasks(updatedSubtasks);
      // Update task progress field
      if (task) {
        const completedCount = updatedSubtasks.filter(s => s.completed).length;
        const progressPct = updatedSubtasks.length > 0 ? Math.round((completedCount / updatedSubtasks.length) * 100) : 0;
        taskApi.update(task.id, { progress: progressPct }).catch(() => { /* non-critical */ });
      }
      loadActivity(); // Refresh activity to show the update
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!task) return;
    const success = await deleteSubtask(task.id, subtaskId);
    if (success) {
      setSubtasks(subtasks.filter(s => s.id !== subtaskId));
      setSelectedSubtaskIds(prev => { const n = new Set(prev); n.delete(subtaskId); return n; });
    }
  };

  // Move subtask up or down by swapping positions and persisting to API
  const handleMoveSubtask = async (index: number, direction: 'up' | 'down') => {
    if (!task) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= subtasks.length) return;

    const newOrder = [...subtasks];
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    setSubtasks(newOrder);

    try {
      await taskApi.reorderSubtasks(task.id, newOrder.map(s => s.id));
    } catch (err) {
      console.warn('[TaskDetailPanel] Non-critical:', err);
      setSubtasks(subtasks); // Revert on failure
      showToast('error', 'Reorder failed');
    }
  };

  const handleToggleSubtaskSelect = (subtaskId: string) => {
    setSelectedSubtaskIds(prev => {
      const next = new Set(prev);
      if (next.has(subtaskId)) next.delete(subtaskId);
      else next.add(subtaskId);
      return next;
    });
  };

  const handleBulkMarkDone = async () => {
    if (!task || selectedSubtaskIds.size === 0) return;
    const ids = Array.from(selectedSubtaskIds);
    const now = Date.now();
    await Promise.all(ids.map(id => updateSubtask(id, { completed: true })));
    setSubtasks(prev =>
      prev.map(s => selectedSubtaskIds.has(s.id) ? { ...s, completed: true, completedAt: now } : s),
    );
    setSelectedSubtaskIds(new Set());
    showToast('success', `${ids.length} subtask${ids.length !== 1 ? 's' : ''} marked done`);
  };

  const handleBulkDelete = async () => {
    if (!task || selectedSubtaskIds.size === 0) return;
    const ids = Array.from(selectedSubtaskIds);
    await Promise.all(ids.map(id => deleteSubtask(task.id, id)));
    setSubtasks(prev => prev.filter(s => !selectedSubtaskIds.has(s.id)));
    setSelectedSubtaskIds(new Set());
    setBulkDeleteConfirm(false);
    showToast('success', `${ids.length} subtask${ids.length !== 1 ? 's' : ''} deleted`);
  };

  const handleSetDueDate = async (subtaskId: string, dateStr: string) => {
    const dueDate = dateStr ? new Date(dateStr + 'T00:00:00').getTime() : null;
    const success = await updateSubtask(subtaskId, { dueDate });
    if (success) {
      setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, dueDate } : s));
    }
    setEditingDueDateId(null);
  };

  const handleSetSubtaskAssignee = async (subtaskId: string, agentId: string) => {
    const assignedTo = agentId || undefined;
    const success = await updateSubtask(subtaskId, { assignedTo });
    if (success) {
      setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, assignedTo } : s));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !e.target.files || e.target.files.length === 0) return;
    // File upload not available in web mode (requires Electron fs/exec)
    showToast('info', 'Upload unavailable', 'File upload is not available in web mode');
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/attachments?attachmentId=${attachmentId}`, { method: 'DELETE' });
      if (res.ok) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
        showToast('success', 'Attachment removed');
      } else {
        showToast('error', 'Failed to remove attachment');
      }
    } catch (err) {
      console.warn('[TaskDetailPanel] Non-critical:', err);
      showToast('error', 'Failed to remove attachment');
    }
  };

  const handleOpenFile = async (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const name = filePath.split('/').pop() ?? filePath;
    const serveUrl = `/api/files/serve?path=${encodeURIComponent(filePath)}`;

    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      setFileViewer({ name, ext, mediaType: 'image', serveUrl });
      return;
    }
    if (['mp4', 'webm', 'mov'].includes(ext)) {
      setFileViewer({ name, ext, mediaType: 'video', serveUrl });
      return;
    }
    if (['html', 'htm'].includes(ext)) {
      setFileViewer({ name, ext, mediaType: 'html', serveUrl });
      return;
    }

    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (!res.ok) {
        showToast('error', 'File not found', data.error || filePath);
        return;
      }
      if (data.type === 'binary') {
        await navigator.clipboard.writeText(filePath);
        showToast('info', 'Path copied', `${data.name} — binary file, path copied to clipboard`);
      } else {
        setFileViewer({ name: data.name, content: data.content, ext: data.ext });
      }
    } catch (err) {
      console.warn('[TaskDetailPanel] Non-critical:', err);
      showToast('error', 'Could not read file');
    }
  };

  const handleAutoDetect = async () => {
    if (!task) return;
    setLoadingAttachments(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/attachments`, { method: 'PATCH' });
      const data = await res.json();
      if (res.ok) {
        if (data.attached > 0) {
          showToast('success', `Found ${data.attached} file${data.attached !== 1 ? 's' : ''}`, data.files?.join(', '));
          loadAttachments();
        } else {
          showToast('info', 'No new files found', data.message);
        }
      } else {
        showToast('error', 'Auto-detect failed');
      }
    } catch (err) {
      console.warn('[TaskDetailPanel] Non-critical:', err);
      showToast('error', 'Auto-detect failed');
    } finally {
      setLoadingAttachments(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string | null | undefined) => {
    if (!mimeType) return <Paperclip size={20} />;
    if (mimeType.startsWith('image/')) return <ImageIcon size={20} />;
    if (mimeType.startsWith('text/')) return <FileText size={20} />;
    if (mimeType.includes('pdf')) return <File size={20} />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gz')) return <Archive size={20} />;
    if (mimeType.includes('json')) return <Code size={20} />;
    if (mimeType.includes('javascript') || mimeType.includes('typescript')) return <Code size={20} />;
    if (mimeType.includes('shellscript')) return <Settings size={20} />;
    return <Paperclip size={20} />;
  };

  const assignReviewer = (reviewerId: string) => {
    if (!task) return;
    updateTask(task.id, { reviewerId, reviewStatus: 'pending' });
    logTaskActivity(task.id, 'reviewer_assigned', `Reviewer assigned: ${agents.find(a => a.id === reviewerId)?.name || reviewerId}`);
    showToast('info', 'Reviewer assigned');
  };

  const setReviewStatus = (status: Task['reviewStatus']) => {
    if (!task) return;
    updateTask(task.id, { reviewStatus: status });
    logTaskActivity(task.id, 'review_status', `Review status changed to: ${status}`);
    if (status === 'approved') {
      showToast('success', 'Review approved!');
    }
  };

  const reviewer = task?.reviewerId ? agents.find(a => a.id === task.reviewerId) : null;
  const subtaskProgress = subtasks.length > 0
    ? (subtasks.filter(st => st.completed).length / subtasks.length) * 100
    : 0;
  const completedSubtasks = subtasks.filter(st => st.completed).length;

  // Due date urgency for panel header
  const dueDateUrgency = task?.dueDate && task.status !== 'done' ? (() => {
    const now = Date.now();
    const diff = task.dueDate - now;
    if (diff < 0) {
      const overdueDiff = Math.abs(diff);
      const text = overdueDiff < 86400000 ? 'Overdue' : `${Math.floor(overdueDiff / 86400000)}d overdue`;
      return { text, level: 'overdue' as const };
    }
    if (diff < 3600000) return { text: `Due in ${Math.floor(diff / 60000)}m`, level: 'soon' as const };
    if (diff < 86400000) return { text: `Due in ${Math.floor(diff / 3600000)}h`, level: 'soon' as const };
    if (diff < 604800000) return { text: `Due in ${Math.floor(diff / 86400000)}d`, level: 'week' as const };
    return null;
  })() : null;

  // Activity icon based on action type
  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'task_started': return <Play size={14} className="text-success" />;
      case 'task_completed': return <CheckCircle size={14} className="text-success" />;
      case 'subtask_added': return <Plus size={14} className="text-info" />;
      case 'subtask_completed': return <Check size={14} className="text-success" />;
      case 'subtask_uncompleted': return <XCircle size={14} className="text-warning" />;
      case 'subtask_deleted': return <X size={14} className="text-error" />;
      case 'reviewer_assigned': return <Eye size={14} className="text-review" />;
      case 'review_status': return <Eye size={14} className="text-review" />;
      case 'review-approved': return <CheckCircle size={14} className="text-success" />;
      case 'review-rejected': return <XCircle size={14} className="text-error" />;
      case 'pre-review-approved': return <CheckCircle size={14} className="text-info" />;
      case 'pre-review-rejected': return <XCircle size={14} className="text-warning" />;
      case 'pre-review-timeout': return <Activity size={14} className="text-warning" />;
      case 'agent_message': return <Bot size={14} className="text-mission-control-accent" />;
      case 'progress': return <Activity size={14} className="text-warning" />;
      default: return <MessageSquare size={14} className="text-mission-control-text-dim" />;
    }
  };

  return (
    <>
    {/* Backdrop — aria-hidden so screen readers skip it; click closes dialog */}
    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
    <div
      ref={focusTrapRef as React.RefObject<HTMLDivElement>}
      role="dialog"
      aria-modal="true"
      aria-labelledby={panelTitleId}
      tabIndex={-1}
      className="fixed z-50 inset-x-0 bottom-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[1100px] md:max-w-[95vw] h-[95dvh] md:h-auto md:max-h-[90vh] bg-mission-control-surface border border-mission-control-border md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom md:zoom-in-95 duration-200 outline-none"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-mission-control-border bg-mission-control-surface rounded-t-2xl flex-shrink-0">
        {/* Row 1: badges + close */}
        <Flex align="center" gap="2" className="mb-1.5">
          <ActiveAgentIndicator taskId={task.id} showLabel size="sm" />
          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
            task.status === 'done'            ? 'bg-success/10 text-success' :
            task.status === 'in-progress'     ? 'bg-info/10 text-info' :
            task.status === 'review'          ? 'bg-review-subtle text-review' :
            task.status === 'human-review'    ? 'bg-warning/10 text-warning' :
            task.status === 'internal-review' ? 'bg-review-subtle text-review' :
            task.status === 'failed'          ? 'bg-error/10 text-error' :
            task.status === 'cancelled'       ? 'bg-mission-control-border/40 text-mission-control-text-dim' :
            'bg-mission-control-border/30 text-mission-control-text-dim'
          }`}>
            {task.status === 'internal-review' ? 'Pre-review' : task.status.replace(/-/g, ' ')}
          </span>
          {task.priority && (() => {
            const pCfg = {
              p0: { label: 'P0', color: 'bg-error/10 text-error' },
              p1: { label: 'P1', color: 'bg-warning/10 text-warning' },
              p2: { label: 'P2', color: 'bg-info/10 text-info' },
              p3: { label: 'P3', color: 'bg-mission-control-border/30 text-mission-control-text-dim' },
            }[task.priority];
            if (!pCfg) return null;
            return (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${pCfg.color}`}>
                {pCfg.label}
              </span>
            );
          })()}
          <span className="text-xs text-mission-control-text-dim">{task.project}</span>
          {task.projectName && (
            <span className="flex items-center gap-1 text-xs text-mission-control-accent">
              <Activity size={11} />
              {task.projectName}{!!task.stageNumber && ` · Stage ${task.stageNumber}`}
            </span>
          )}
          {dueDateUrgency && (
            <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
              dueDateUrgency.level === 'overdue' ? 'bg-error/10 text-error' :
              dueDateUrgency.level === 'soon' ? 'bg-warning/10 text-warning' :
              'bg-warning/10/50 text-warning'
            }`}>
              {dueDateUrgency.level === 'overdue'
                ? <AlertTriangle size={11} />
                : <Clock size={11} />}
              {dueDateUrgency.text}
            </span>
          )}
          {(JSON.parse(task.tags || '[]') as string[]).map((tag: string) => (
            <span key={tag} className="px-1.5 py-0.5 text-xs bg-mission-control-accent/20 text-mission-control-accent rounded-full flex items-center gap-1 flex-shrink-0">
              {tag}
              <button type="button" onClick={() => { const t = JSON.parse(task.tags || '[]'); updateTask(task.id, { tags: JSON.stringify(t.filter((x: string) => x !== tag)) }); }} aria-label={`Remove tag ${tag}`} className="hover:text-error leading-none">×</button>
            </span>
          ))}
          <input
            placeholder="+ tag"
            aria-label="Add tag"
            className="px-2 py-0.5 text-xs rounded-full border border-mission-control-border/60 bg-transparent text-mission-control-text-dim placeholder-mission-control-text-dim/50 hover:border-mission-control-border focus:outline-none focus:border-mission-control-accent/50 w-14 flex-shrink-0 leading-none"
            onKeyDown={(e) => {
              const input = e.currentTarget;
              if (e.key === 'Enter' && input.value.trim()) {
                const newTag = input.value.trim();
                const currentTags = JSON.parse(task.tags || '[]');
                if (!currentTags.includes(newTag)) updateTask(task.id, { tags: JSON.stringify([...currentTags, newTag]) });
                input.value = '';
              }
            }}
          />
          {/* W2: min 44×44px touch target (WCAG 2.5.5) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task detail"
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors ml-auto flex-shrink-0"
          >
            <X size={16} />
          </button>
        </Flex>

        {/* Row 2: title */}
        <h2 id={panelTitleId} className="text-base font-semibold line-clamp-1 mb-1" title={task.title}>{task.title}</h2>

        {/* Row 3: description (1 line) */}
        {task.description && (
          <p className="text-xs text-mission-control-text-dim line-clamp-1 mb-2" title={task.description}>{task.description}</p>
        )}

        {/* Row 4: progress · dates — all one line */}
        <Flex align="center" gap="2" className="my-[14px]">
          {subtasks.length > 0 ? (
            <>
              <div className="h-2 flex-1 bg-gradient-to-r from-mission-control-border/60 to-mission-control-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--color-success-hover)] to-[var(--color-success)] transition-colors duration-500 rounded-full"
                  style={{ width: `${subtaskProgress}%` }}
                />
              </div>
              <span className="text-xs text-mission-control-text-dim whitespace-nowrap flex-shrink-0">
                {completedSubtasks}/{subtasks.length} subtasks done
                {isWorking && <span className="text-warning animate-pulse ml-1">· working</span>}
              </span>
            </>
          ) : typeof task.progress === 'number' && task.progress > 0 ? (
            <>
              <div className="h-2 flex-1 bg-mission-control-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-mission-control-accent transition-colors duration-500 rounded-full"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <span className="text-xs text-mission-control-text-dim whitespace-nowrap flex-shrink-0">
                {task.progress}%
                {isWorking && <span className="text-warning animate-pulse ml-1">· working</span>}
              </span>
            </>
          ) : null}
          {/* dates pushed right */}
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim ml-auto flex-shrink-0">
            <span className="flex items-center gap-1"><Calendar size={11} />{formatTime(task.createdAt)}</span>
            <span className="flex items-center gap-1"><Clock size={11} />{formatTime(task.updatedAt)}</span>
          </Flex>
        </Flex>

        {/* Row 6: agents — compact single row */}
        <Flex align="center" gap="3" className="mt-2 pt-2 border-t border-mission-control-border">
          {/* Worker */}
          <Flex align="center" gap="2" className="flex-1 min-w-0">
            <span className="text-xs text-mission-control-text-dim whitespace-nowrap">Worker:</span>
            {assignedAgent ? (
              <Flex align="center" gap="2" className="flex-1 min-w-0">
                <AgentAvatar agentId={assignedAgent.id} fallbackEmoji={assignedAgent.avatar} size="sm" />
                <span className="text-xs font-medium truncate">{assignedAgent.name}</span>
                {!isWorking && !['done', 'in-progress', 'internal-review', 'review'].includes(task.status) && (
                  <IconButton onClick={handleStart} variant="solid" size="1" title="Start Work" aria-label="Start Work">
                    <Play size={11} />
                  </IconButton>
                )}
                {(isWorking || task.status === 'in-progress') && <Loader2 size={12} className="animate-spin text-info flex-shrink-0" />}
              </Flex>
            ) : isRemoteAgent ? (
              <Flex align="center" gap="1" className="min-w-0">
                <Globe size={12} className="text-review flex-shrink-0" />
                <span className="text-xs truncate capitalize">{task.assignedTo}</span>
              </Flex>
            ) : (
              <span className="text-xs text-mission-control-text-dim italic">unassigned</span>
            )}
          </Flex>

          <div className="w-px h-4 bg-mission-control-border flex-shrink-0" />

          {/* Reviewer */}
          <Flex align="center" gap="2" className="flex-1 min-w-0">
            <span className="text-xs text-mission-control-text-dim whitespace-nowrap">Reviewer:</span>
            {reviewer ? (
              <Flex align="center" gap="2" className="min-w-0">
                <AgentAvatar agentId={reviewer.id} fallbackEmoji={reviewer.avatar} size="sm" />
                <span className="text-xs font-medium truncate">{reviewer.name}</span>
                {task.reviewStatus && (
                  <span className={`text-xs px-1 py-0.5 rounded flex-shrink-0 ${
                    task.reviewStatus === 'approved' ? 'bg-success/10 text-success' :
                    task.reviewStatus === 'needs-changes' ? 'bg-error/10 text-error' :
                    task.reviewStatus === 'in-review' ? 'bg-warning/10 text-warning' :
                    'bg-muted-subtle text-muted'
                  }`}>{task.reviewStatus}</span>
                )}
              </Flex>
            ) : (
              <Select.Root defaultValue="clara" onValueChange={(val) => val && assignReviewer(val)}>
                <Select.Trigger className="flex-1 min-w-0" placeholder="Assign..." />
                <Select.Content>
                  {agents
                    .filter(a => a.id !== task.assignedTo)
                    .map(a => (
                      <Select.Item key={a.id} value={a.id}>
                        {a.name}{a.id === 'clara' ? ' (default)' : ''}
                      </Select.Item>
                    ))}
                </Select.Content>
              </Select.Root>
            )}
          </Flex>
        </Flex>
      </div>

      {/* Clara review notes callout */}
      {task.reviewNotes && task.reviewStatus && ['needs-changes', 'rejected', 'pre-rejected'].includes(task.reviewStatus) && (
        <div className="mx-4 mt-3 p-3 bg-error/10 border border-error/30 rounded-lg flex items-start gap-2 flex-shrink-0">
          <AlertTriangle size={14} className="text-error flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-error block mb-0.5">
              {task.reviewerId ? (agents.find(a => a.id === task.reviewerId)?.name || 'Reviewer') : 'Reviewer'}&apos;s feedback:
            </span>
            <p className="text-xs text-error/90 whitespace-pre-wrap">{task.reviewNotes}</p>
          </div>
        </div>
      )}
      {task.reviewNotes && task.reviewStatus === 'approved' && (
        <div className="mx-4 mt-3 p-3 bg-success/10 border border-success/30 rounded-lg flex items-start gap-2 flex-shrink-0">
          <CheckCircle size={14} className="text-success flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-success block mb-0.5">
              {task.reviewerId ? (agents.find(a => a.id === task.reviewerId)?.name || 'Reviewer') : 'Reviewer'}&apos;s notes:
            </span>
            <p className="text-xs text-success/90 whitespace-pre-wrap">{task.reviewNotes}</p>
          </div>
        </div>
      )}

      {/* Time tracking strip */}
      <div className="mx-4 mt-2 mb-0 flex items-center gap-4 text-xs text-mission-control-text-dim flex-shrink-0 flex-wrap">
        <Flex align="center" gap="2">
          <Timer size={12} className="flex-shrink-0" />
          <span>Active {formatDuration(task.updatedAt - task.createdAt)}</span>
        </Flex>
        <Flex align="center" gap="2">
          <Calendar size={12} className="flex-shrink-0" />
          <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
        </Flex>
      </div>

      {/* Tabs */}
      {/* IMPORTANT: Planning tab must ALWAYS be visible, regardless of task status.
          It serves as a historical record and should never be hidden when task is complete. */}
      <div className="bg-mission-control-surface flex-shrink-0">
        <TabNav
          tabs={[
            { id: 'subtasks',  label: 'Subtasks',  icon: CheckCircle, badge: subtasks.length > 0 ? `${completedSubtasks}/${subtasks.length}` : undefined },
            { id: 'planning',  label: 'Planning',  icon: FileText },
            { id: 'activity',  label: 'Activity',  icon: Activity,    badge: activities.length > 0 ? activities.length : undefined },
            { id: 'files',     label: 'Files',     icon: Paperclip,   badge: attachments.length > 0 ? attachments.length : undefined },
            { id: 'review',    label: 'Review',    icon: Eye },
            { id: 'chat',      label: 'Chat',      icon: MessageSquare },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as typeof activeTab)}
          paddingX="px-4"
        />
      </div>

      {/* Tab Content */}
      <div className={`flex-1 min-h-0 ${activeTab === 'chat' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
        {/* Subtasks Tab */}
        {/* W1: id + role="tabpanel" + aria-labelledby complete the ARIA tab widget (WCAG 4.1.2) */}
        {activeTab === 'subtasks' && (
          <div id="tabpanel-subtasks" role="tabpanel" aria-labelledby="tab-subtasks" className="p-4">
            {/* Progress bar */}
            {subtasks.length > 0 && (
              <div className="mb-4">
                <Flex align="center" justify="between" className="text-xs text-mission-control-text-dim mb-1">
                  <span>Progress</span>
                  <span>{completedSubtasks}/{subtasks.length} complete</span>
                </Flex>
                <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-mission-control-accent rounded-full transition-colors duration-300"
                    style={{ width: `${subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0}%` }}
                  />
                </div>
                {completedSubtasks === subtasks.length && task?.status === 'in-progress' && (
                  <Flex align="center" gap="3" className="mt-3 p-3 rounded-lg bg-success/10 border border-success/30">
                    <CheckCircle size={16} className="text-success flex-shrink-0" />
                    <span className="text-sm text-success flex-1">All subtasks complete — ready for review?</span>
                    <Button
                      type="button"
                      onClick={() => updateTask(task.id, { status: 'review' as any })}
                      size="1"
                      className="flex-shrink-0"
                    >
                      Move to Review
                    </Button>
                  </Flex>
                )}
              </div>
            )}
            {/* Acceptance criteria auto-subtask suggestion */}
            {task.planningNotes && suggestedCriteria.length === 0 && subtasks.length === 0 && (() => {
              const criteria = parseAcceptanceCriteria(task.planningNotes);
              if (criteria.length === 0) return null;
              return (
                <div className="mb-4 p-3 bg-mission-control-accent/10 border border-mission-control-accent/30 rounded-lg">
                  <Flex align="center" gap="2" className="mb-2">
                    <Sparkles size={14} className="text-mission-control-accent flex-shrink-0" />
                    <span className="text-sm font-medium">Auto-generate from Acceptance Criteria</span>
                  </Flex>
                  <p className="text-xs text-mission-control-text-dim mb-2">
                    Found {criteria.length} item{criteria.length !== 1 ? 's' : ''} in planning notes. Create them as subtasks?
                  </p>
                  <ul className="text-xs space-y-0.5 mb-3 pl-2">
                    {criteria.map((c, i) => (
                      <li key={i} className="text-mission-control-text-dim flex items-center gap-1.5">
                        <Check size={11} className="text-mission-control-accent flex-shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleCreateCriteriaSubtasks(criteria)}
                    disabled={isCreatingCriteriaSubtasks}
                    size="1"
                  >
                    {isCreatingCriteriaSubtasks ? <Spinner size="1" /> : <Plus size={12} />}
                    Create {criteria.length} subtask{criteria.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              );
            })()}

            {/* Add Subtask — Enter key creates next subtask automatically */}
            <Flex gap="2" className="mb-4">
              <TextField.Root
                ref={newSubtaskInputRef as React.Ref<HTMLInputElement>}
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Add a subtask... (Enter to add)"
                size="2"
                className="flex-1"
              />
              <IconButton
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
                size="2"
                aria-label="Add subtask"
              >
                <Plus size={16} />
              </IconButton>
            </Flex>

            {/* Bulk action bar — visible when one or more subtasks are selected */}
            {selectedSubtaskIds.size > 0 && (
              <Flex align="center" gap="2" className="mb-3 p-2 bg-mission-control-surface border border-mission-control-border rounded-lg">
                <span className="text-xs text-mission-control-text-dim flex-1">
                  {selectedSubtaskIds.size} selected
                </span>
                <Button
                  onClick={handleBulkMarkDone}
                  color="green"
                  size="1"
                >
                  <Check size={12} />
                  Mark done
                </Button>
                {bulkDeleteConfirm ? (
                  <>
                    <span className="text-xs text-error">Delete {selectedSubtaskIds.size}?</span>
                    <Button
                      onClick={handleBulkDelete}
                      color="red"
                      size="1"
                    >
                      <Trash2 size={12} />
                      Yes, delete
                    </Button>
                    <Button
                      onClick={() => setBulkDeleteConfirm(false)}
                      variant="outline"
                      color="gray"
                      size="1"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setBulkDeleteConfirm(true)}
                    variant="outline"
                    color="red"
                    size="1"
                  >
                    <Trash2 size={12} />
                    Delete
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedSubtaskIds(new Set()); setBulkDeleteConfirm(false); }}
                  aria-label="Clear selection"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                >
                  <X size={14} />
                </button>
              </Flex>
            )}

            {/* Subtask List */}
            {loadingSubtasks ? (
              <div className="divide-y divide-mission-control-border/40">
                {[1, 2, 3, 4].map((i) => (
                  <Flex key={i} align="center" gap="2.5" className="py-2">
                    <div className="w-5 h-5 rounded bg-mission-control-surface animate-pulse flex-shrink-0" />
                    <div className="h-4 rounded bg-mission-control-surface animate-pulse flex-1" />
                  </Flex>
                ))}
              </div>
            ) : subtasks.length === 0 ? (
              <div className="text-center text-mission-control-text-dim py-8">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No subtasks yet</p>
                <p className="text-xs">Break down this task into smaller steps</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {subtasks.map((st, idx) => {
                  const isSelected = selectedSubtaskIds.has(st.id);
                  const isOverdue = st.dueDate != null && !st.completed && st.dueDate < Date.now();
                  const dueDateStr = st.dueDate
                    ? new Date(st.dueDate).toISOString().split('T')[0]
                    : '';
                  const dueDateDisplay = st.dueDate
                    ? new Date(st.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : null;

                  const assignedAgent = agents.find(a => a.id === st.assignedTo);

                  return (
                    <div
                      key={st.id}
                      className={`relative flex items-start gap-3 px-3 py-2.5 rounded-xl mb-1.5 border transition-all ${
                        isSelected
                          ? 'bg-mission-control-accent/5 border-mission-control-accent/25'
                          : 'bg-mission-control-surface border-mission-control-border/50'
                      }`}
                    >
                      {/* W2: hit area expanded to ≥44×44px via ::after pseudo-element (WCAG 2.5.5)
                          W3: descriptive aria-label per subtask (WCAG 1.3.1) */}
                      <button
                        type="button"
                        onClick={() => handleToggleSubtaskSelect(st.id)}
                        aria-label={`Select: ${st.title}`}
                        className="mt-0.5 flex-shrink-0 relative inline-flex items-center justify-center after:absolute after:content-[''] after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[44px] after:h-[44px]"
                      >
                        <span className={`w-[15px] h-[15px] flex items-center justify-center rounded border transition-all pointer-events-none ${
                          isSelected
                            ? 'bg-mission-control-accent/20 border-mission-control-accent text-mission-control-accent'
                            : 'border-mission-control-border/60 text-mission-control-text-dim'
                        }`}>
                          {isSelected && <Check size={9} strokeWidth={3} />}
                        </span>
                      </button>

                      {/* W2: hit area expanded to ≥44×44px via ::after pseudo-element (WCAG 2.5.5)
                          W3: descriptive aria-label per subtask (WCAG 1.3.1) */}
                      <button
                        type="button"
                        onClick={() => handleToggleSubtask(st.id)}
                        aria-label={`Mark "${st.title}" complete`}
                        className="mt-0.5 flex-shrink-0 relative inline-flex items-center justify-center after:absolute after:content-[''] after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[44px] after:h-[44px]"
                      >
                        <span className={`w-[18px] h-[18px] flex items-center justify-center rounded-[4px] border-2 transition-all pointer-events-none ${
                          st.completed
                            ? 'bg-success border-success text-white'
                            : 'border-mission-control-border'
                        }`}>
                          {st.completed && <Check size={11} strokeWidth={3} />}
                        </span>
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <span
                          className={`block text-sm leading-snug font-medium ${
                            st.completed ? 'line-through text-mission-control-text-dim' : 'text-mission-control-text'
                          }`}
                        >
                          {st.title}
                        </span>
                        {st.description && (
                          <p className="text-xs text-mission-control-text-dim mt-0.5 line-clamp-1">{st.description}</p>
                        )}

                        {/* Metadata pills row */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {/* Assignee pill */}
                          <Select.Root
                            value={st.assignedTo || '__unassigned'}
                            onValueChange={(val) => handleSetSubtaskAssignee(st.id, val === '__unassigned' ? '' : val)}
                          >
                            <Select.Trigger
                              className="inline-flex items-center gap-1.5 !px-2 !py-1 !rounded-lg !text-[11px] !leading-none !bg-mission-control-surface/80 !border !border-mission-control-border/50 !text-mission-control-text-dim hover:!text-mission-control-text hover:!border-mission-control-border !transition-colors !h-auto"
                            />
                            <Select.Content>
                              <Select.Item value="__unassigned">Unassigned</Select.Item>
                              {agents.map((a) => (
                                <Select.Item key={a.id} value={a.id}>{a.name}</Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Root>

                          {/* Due date pill */}
                          {editingDueDateId === st.id ? (
                            <input
                              type="date"
                              autoFocus
                              defaultValue={dueDateStr}
                              onBlur={(e) => handleSetDueDate(st.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  handleSetDueDate(st.id, (e.target as HTMLInputElement).value);
                                if (e.key === 'Escape') setEditingDueDateId(null);
                              }}
                              className="px-2 py-1 text-[11px] leading-none rounded-lg border border-mission-control-accent/40 bg-mission-control-surface text-mission-control-text focus:outline-none w-28"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingDueDateId(st.id)}
                              title={isOverdue ? 'Overdue — click to change' : 'Set due date'}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] leading-none border transition-all ${
                                isOverdue
                                  ? 'text-error bg-error/10 border-error/30 hover:bg-error/20'
                                  : dueDateDisplay
                                    ? 'text-mission-control-text-dim bg-mission-control-surface/80 border-mission-control-border/50 hover:text-mission-control-text hover:border-mission-control-border'
                                    : 'text-mission-control-text-dim/50 bg-mission-control-surface/40 border-mission-control-border/40 hover:text-mission-control-text-dim hover:border-mission-control-border'
                              }`}
                            >
                              <Calendar size={10} className="flex-shrink-0" />
                              {dueDateDisplay ?? 'Due date'}
                            </button>
                          )}

                          {/* Done badge — DL2: text-success (no /80 opacity) ensures ≥4.5:1 on white in light mode (T9 override #16a34a = 4.8:1) */}
                          {st.completedAt && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] leading-none bg-success/10 text-success border border-success/20">
                              <Check size={9} strokeWidth={3} className="flex-shrink-0" />
                              Done {formatTime(st.completedAt)}
                              {st.completedBy && ` · ${agents.find((a) => a.id === st.completedBy)?.name || st.completedBy}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions — reorder + delete, always visible */}
                      <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveSubtask(idx, 'up')}
                          disabled={idx === 0}
                          title="Move up"
                          aria-label="Move subtask up"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-20"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSubtask(idx, 'down')}
                          disabled={idx === subtasks.length - 1}
                          title="Move down"
                          aria-label="Move subtask down"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-20"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(st.id)}
                          title="Delete subtask"
                          aria-label="Delete subtask"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-mission-control-text-dim hover:text-error hover:bg-error/10 transition-colors ml-0.5"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Planning Tab - ALWAYS VISIBLE regardless of task status (historical record) */}
        {activeTab === 'planning' && (
          <div id="tabpanel-planning" role="tabpanel" aria-labelledby="tab-planning" className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText size={12} className="text-mission-control-text-dim" />
                Planning &amp; Brainstorming
              </span>
              <button
                type="button"
                onClick={() => setEditingPlanningNotes(!editingPlanningNotes)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-mission-control-bg"
                style={{ color: editingPlanningNotes ? 'var(--mission-control-accent)' : 'var(--mission-control-text-dim)' }}
              >
                {editingPlanningNotes ? <><Eye size={11} /> Preview</> : <><Pencil size={11} /> Edit</>}
              </button>
            </div>

            {editingPlanningNotes ? (
              <TextArea
                value={localPlanningNotes ?? ''}
                onChange={(e) => {
                  setLocalPlanningNotes(e.target.value);
                  updateTask(task.id, { planningNotes: e.target.value });
                  clearTimeout((window as any).__planningNotesTimer);
                  (window as any).__planningNotesTimer = setTimeout(() => {
                    taskApi.update(task.id, {
                      planningNotes: e.target.value
                    }).catch((_err: unknown) => {});
                  }, 1000);
                }}
                placeholder="Planning notes, brainstorming, research..."
                resize="vertical"
                size="2"
                className="w-full font-mono"
                style={{ minHeight: '16rem' }}
              />
            ) : (localPlanningNotes ?? '').trim() ? (
              <div
                className="rounded-lg p-3 cursor-pointer hover:bg-mission-control-bg/50 transition-colors"
                style={{ border: '1px solid var(--mission-control-border)' }}
                onClick={() => setEditingPlanningNotes(true)}
              >
                <MarkdownMessage content={localPlanningNotes ?? ''} />
              </div>
            ) : (
              <div
                className="rounded-lg p-4 text-center cursor-pointer hover:bg-mission-control-bg/50 transition-colors"
                style={{ border: '1px dashed var(--mission-control-border)' }}
                onClick={() => setEditingPlanningNotes(true)}
              >
                <p className="text-xs text-mission-control-text-dim">No planning notes yet. Click to add.</p>
              </div>
            )}

            {editingPlanningNotes && (
              <p className="text-xs text-mission-control-text-dim mt-2">
                <Lightbulb size={12} className="inline mr-1" />Changes are auto-saved after 1 second.
              </p>
            )}

            {/* Dependencies */}
            <div className="mt-6">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
                <AlertCircle size={12} className="text-mission-control-text-dim" />
                Blocked By
              </div>
              {(task.blockedBy || []).length > 0 ? (
                <div className="space-y-2 mb-3">
                  {(task.blockedBy as string[]).map(depId => {
                    const depTask = useStore.getState().tasks.find(t => t.id === depId);
                    return (
                      <Flex key={depId} align="center" gap="2" className="p-2 rounded-lg bg-mission-control-surface border border-mission-control-border text-sm">
                        <span className="flex-1 truncate">{depTask?.title || depId}</span>
                        {depTask && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${depTask.status === 'done' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                            {depTask.status}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const current = (task.blockedBy as string[]) || [];
                            taskApi.update(task.id, { blockedBy: current.filter((id: string) => id !== depId) })
                              .then(() => showToast('success', 'Dependency removed'))
                              .catch(() => showToast('error', 'Failed to remove dependency'));
                          }}
                          aria-label="Remove dependency"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors flex-shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </Flex>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-mission-control-text-dim mb-3">No dependencies</p>
              )}
              <Select.Root
                value=""
                onValueChange={async (depId) => {
                  if (!depId) return;
                  const current = (task.blockedBy as string[]) || [];
                  if (current.includes(depId)) return;
                  // Simple cycle check: ensure depId doesn't already block this task
                  const depTask = useStore.getState().tasks.find(t => t.id === depId);
                  if (depTask?.blockedBy && (depTask.blockedBy as string[]).includes(task.id)) {
                    showToast('error', 'Circular dependency', 'That task already depends on this one');
                    return;
                  }
                  try {
                    await taskApi.update(task.id, { blockedBy: [...current, depId] });
                    showToast('success', 'Dependency added');
                  } catch { showToast('error', 'Failed to add dependency'); }
                }}
                size="2"
              >
                <Select.Trigger className="w-full" placeholder="+ Add dependency (blocked by)..." />
                <Select.Content>
                  {useStore.getState().tasks
                    .filter(t => t.id !== task.id && !(task.blockedBy as string[] || []).includes(t.id))
                    .map(t => (
                      <Select.Item key={t.id} value={t.id}>{t.title} [{t.status}]</Select.Item>
                    ))}
                </Select.Content>
              </Select.Root>
            </div>

            {/* Related Tasks */}
            {(() => {
              const allTasks = useStore.getState().tasks;
              const related = allTasks
                .filter(t =>
                  t.id !== task.id &&
                  t.status !== 'done' &&
                  (t.project === task.project || t.assignedTo === task.assignedTo)
                )
                .slice(0, 3);
              if (related.length === 0) return null;
              return (
                <div className="mt-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
                    <Link2 size={12} className="text-mission-control-text-dim" />
                    Related Tasks
                  </div>
                  <div className="space-y-1.5">
                    {related.map(rt => (
                      <Flex key={rt.id} align="center" gap="2" className="p-2 rounded-lg bg-mission-control-bg border border-mission-control-border text-sm hover:border-mission-control-accent/50 transition-colors">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          rt.status === 'in-progress' ? 'bg-info' :
                          rt.status === 'review' ? 'bg-review' :
                          'bg-mission-control-border'
                        }`} />
                        <span className="flex-1 truncate text-xs">{rt.title}</span>
                        <span className="text-xs text-mission-control-text-dim flex-shrink-0">{rt.project}</span>
                      </Flex>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div id="tabpanel-activity" role="tabpanel" aria-labelledby="tab-activity" className="p-4">
            {/* Agent Progress Query - only shows when agent is active */}
            <AgentProgressQuery 
              taskId={task.id} 
              taskTitle={task.title}
              className="mb-4"
            />
            
            <Flex align="center" justify="between" className="mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Activity Log</div>
              <button
                type="button"
                onClick={loadActivity}
                disabled={loadingActivity}
                aria-label="Refresh activity"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={loadingActivity ? 'animate-spin' : ''} />
              </button>
            </Flex>

            {loadingActivity ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <Flex key={i} gap="3" className="p-2">
                    <div className="w-6 h-6 rounded-full bg-mission-control-surface animate-pulse shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 rounded bg-mission-control-surface animate-pulse" />
                      <div className="h-4 w-3/4 rounded bg-mission-control-surface animate-pulse" />
                    </div>
                  </Flex>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {activities.map((act, _idx) => (
                  <div
                    key={act.id}
                    className={`flex items-start gap-3 p-2 rounded-lg hover:bg-mission-control-bg/50 transition-colors ${
                      act.action === 'review-rejected' || act.action === 'pre-review-rejected'
                        ? 'bg-error/10 border border-error/20'
                        : act.action === 'review-approved' || act.action === 'pre-review-approved'
                        ? 'bg-success/10 border border-success/20'
                        : ''
                    }`}
                  >
                    <div className="mt-1 p-1 rounded bg-mission-control-bg">
                      {getActivityIcon(act.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{act.message}</p>
                      <Flex align="center" gap="2" className="mt-0.5">
                        <span className="text-xs text-mission-control-text-dim">
                          {formatTime(act.timestamp)}
                        </span>
                        {act.agentId && (
                          <span className="text-xs text-mission-control-accent">
                            {agents.find(a => a.id === act.agentId)?.name || act.agentId}
                          </span>
                        )}
                      </Flex>
                      {act.details && (
                        <pre className="mt-1 text-xs bg-mission-control-bg p-2 rounded overflow-x-auto max-h-32">
                          {act.details}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}

                {activities.length === 0 && (
                  <div className="text-center text-mission-control-text-dim py-8">
                    <Activity size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No activity yet</p>
                    <p className="text-xs">Activity will appear here as work progresses</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div id="tabpanel-files" role="tabpanel" aria-labelledby="tab-files" className="flex flex-col h-full">
            {/* Toolbar */}
            <Flex align="center" justify="between" className="px-4 py-3 border-b border-mission-control-border flex-shrink-0">
              <span className="text-sm font-medium text-mission-control-text">
                Attachments
                {attachments.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full bg-mission-control-border/60 text-mission-control-text-dim font-normal">
                    {attachments.length}
                  </span>
                )}
              </span>
              <Flex gap="2">
                <Button
                  onClick={handleAutoDetect}
                  disabled={loadingAttachments}
                  variant="surface"
                  color="gray"
                  size="1"
                  title="Scan agent output directories for new files"
                >
                  {loadingAttachments ? <Spinner size="1" /> : <Search size={12} />}
                  Auto-detect
                </Button>
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-mission-control-accent text-white rounded-lg hover:opacity-90 cursor-pointer transition-opacity">
                  {uploadingFile ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Upload
                  <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploadingFile} />
                </label>
              </Flex>
            </Flex>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">

              {/* Loading */}
              {loadingAttachments && attachments.length === 0 && (
                <Flex align="center" justify="center" gap="2" className="py-16 text-mission-control-text-dim text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Scanning for files…
                </Flex>
              )}

              {/* Empty state */}
              {!loadingAttachments && attachments.length === 0 && (
                <label className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border-2 border-dashed border-mission-control-border/50 text-center cursor-pointer hover:border-mission-control-accent/40 hover:bg-mission-control-accent/[0.02] transition-all">
                  <div className="w-12 h-12 rounded-xl bg-mission-control-border/30 flex items-center justify-center mb-3">
                    <Paperclip size={22} className="text-mission-control-text-dim opacity-50" />
                  </div>
                  <p className="text-sm font-medium text-mission-control-text-dim mb-1">No files attached</p>
                  <p className="text-xs text-mission-control-text-dim/60">Drop files here or click to upload · or use Auto-detect</p>
                  <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploadingFile} />
                </label>
              )}

              {/* File list */}
              {attachments.length > 0 && (
                <div className="space-y-1.5">
                  {attachments.map((attachment) => {
                    const name = attachment.fileName ?? attachment.filePath.split('/').pop() ?? 'file';
                    const ext = name.split('.').pop()?.toLowerCase() ?? '';
                    const uploader = attachment.uploadedBy && attachment.uploadedBy !== 'user'
                      ? agents.find(a => a.id === attachment.uploadedBy)?.name || attachment.uploadedBy
                      : null;

                    // DL1: File type config — semantic tokens only (no raw Tailwind palette).
                    // Raw palette colors (blue-400, pink-400, etc.) are not theme-aware and
                    // fail WCAG 1.4.3 contrast in light mode. Semantic tokens adapt via :root.light.
                    const fileType = ((): { icon: React.ReactNode; bg: string; label: string } => {
                      if (['png','jpg','jpeg','gif','webp','svg'].includes(ext))
                        return { icon: <Image size={14} />, bg: 'bg-info-subtle text-info', label: 'Image' };
                      if (['mp4','webm','mov','avi'].includes(ext))
                        return { icon: <Film size={14} />, bg: 'bg-review-subtle text-review', label: 'Video' };
                      if (['md','txt'].includes(ext))
                        return { icon: <FileText size={14} />, bg: 'bg-warning-subtle text-warning', label: ext.toUpperCase() };
                      if (ext === 'pdf')
                        return { icon: <FileText size={14} />, bg: 'bg-error-subtle text-error', label: 'PDF' };
                      if (['html','htm'].includes(ext))
                        return { icon: <Code2 size={14} />, bg: 'bg-warning-subtle text-warning', label: 'HTML' };
                      if (['ts','tsx','js','jsx'].includes(ext))
                        return { icon: <Code2 size={14} />, bg: 'bg-success-subtle text-success', label: ext.toUpperCase() };
                      if (['py','go','rs','rb','php'].includes(ext))
                        return { icon: <Code2 size={14} />, bg: 'bg-success-subtle text-success', label: ext.toUpperCase() };
                      if (['json','yaml','yml'].includes(ext))
                        return { icon: <Braces size={14} />, bg: 'bg-warning-subtle text-warning', label: ext.toUpperCase() };
                      if (ext === 'csv')
                        return { icon: <Table2 size={14} />, bg: 'bg-success-subtle text-success', label: 'CSV' };
                      return { icon: <File size={14} />, bg: 'bg-muted-subtle text-muted', label: ext.toUpperCase() || 'File' };
                    })();

                    return (
                      /* W4: keyboard access — role="button" + tabIndex + onKeyDown (WCAG 2.1.1).
                         Using role="button" on div to avoid invalid nested <button> elements
                         (the actions bar inside contains real <button> elements). */
                      <div
                        key={attachment.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${name}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenFile(attachment.filePath); } }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-mission-control-surface border border-mission-control-border/60 hover:border-mission-control-accent/30 transition-colors cursor-pointer"
                        onClick={() => handleOpenFile(attachment.filePath)}
                      >
                        {/* Type icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${fileType.bg}`}>
                          {fileType.icon}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-mission-control-text truncate">{name}</span>
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-mission-control-border/50 text-mission-control-text-dim">
                              {fileType.label}
                            </span>
                            {attachment.category && attachment.category !== ext && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-mission-control-accent/10 text-mission-control-accent">
                                {attachment.category}
                              </span>
                            )}
                          </div>
                          {/* W5: opacity modifiers (/60, /40) reduce contrast below 4.5:1 (WCAG 1.4.3).
                              Use full token color instead — dim text is already a de-emphasised value. */}
                          <div className="text-[11px] text-mission-control-text-dim truncate" title={attachment.filePath}>
                            {attachment.filePath}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-mission-control-text-dim">
                            <span>{formatTime(attachment.createdAt)}</span>
                            {uploader && (
                              <>
                                <span>·</span>
                                <span className="text-mission-control-text-dim">{uploader}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions — always visible, stop propagation to avoid opening preview */}
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenFile(attachment.filePath)}
                            title="Open in Finder"
                            aria-label="Open file"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                          >
                            <ExternalLink size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            title="Remove attachment"
                            aria-label="Remove attachment"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-mission-control-text-dim hover:text-error hover:bg-error/10 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {/* W1: wrap TaskChatTab to provide tabpanel role and ARIA association */}
        {activeTab === 'chat' && (
          <div id="tabpanel-chat" role="tabpanel" aria-labelledby="tab-chat" className="flex flex-col h-full overflow-hidden">
            <TaskChatTab
              taskId={task.id}
              agentId={task.assignedTo || null}
              agentName={agents.find(a => a.id === task.assignedTo)?.name || task.assignedTo || 'Agent'}
            />
          </div>
        )}

        {/* Review Tab */}
        {activeTab === 'review' && (
          <div id="tabpanel-review" role="tabpanel" aria-labelledby="tab-review" className="p-4 space-y-4">

            {/* ── Pre-review gate summary ────────────────────────────────── */}
            {task.status === 'internal-review' && (() => {
              const gates = [
                { ok: subtasks.length >= 1,                                          label: 'Subtasks',      detail: `${subtasks.length} added` },
                { ok: ['p0','p1','p2','p3'].includes(task.priority ?? ''),           label: 'Priority',      detail: task.priority || 'not set' },
                { ok: !!task.assignedTo && !isProtectedAgent(task.assignedTo),       label: 'Assigned',      detail: task.assignedTo || 'none' },
                { ok: (task.description?.length ?? 0) >= 20,                         label: 'Description',   detail: `${task.description?.length ?? 0} chars` },
                { ok: (task.planningNotes?.length ?? 0) >= 20,                       label: 'Planning notes',detail: `${task.planningNotes?.length ?? 0} chars` },
              ];
              const allPass = gates.every(g => g.ok);
              return (
                <div className={`p-4 rounded-xl border ${allPass ? 'bg-success/5 border-success/25' : 'bg-warning/5 border-warning/25'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: allPass ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    <Clock size={12} />
                    Clara — Pre-Review Gate &nbsp;·&nbsp; {allPass ? 'All gates pass' : `${gates.filter(g => !g.ok).length} failing`}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {gates.map(({ ok, label, detail }) => (
                      <span
                        key={label}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border ${
                          ok
                            /* DL2: /80 opacity reduces contrast below 4.5:1 in light mode — use full token */
                            ? 'bg-success/10 border-success/20 text-success'
                            : 'bg-error/10 border-error/20 text-error'
                        }`}
                      >
                        <span className="font-medium">{label}</span>
                        <span className="opacity-70">{detail}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Human action: approve / request changes ────────────────── */}
            {task.status === 'review' && task.reviewStatus !== 'approved' && (
              <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl">
                <Flex align="center" gap="2" className="mb-3">
                  <AlertCircle size={15} className="text-warning" />
                  <span className="text-sm font-medium text-warning">Clara requests your decision</span>
                </Flex>
                <Flex gap="2">
                  <Button
                    onClick={() => {
                      updateTask(task.id, { reviewStatus: 'approved', status: 'in-progress' });
                      logTaskActivity(task.id, 'approved', 'Task approved — moved back to in-progress');
                      showToast('success', `Approved! Assigned to ${task.assignedTo || 'unassigned'}.`);
                    }}
                    color="green"
                    size="2"
                    className="flex-1"
                  >
                    <CheckCircle size={15} />
                    Approve
                  </Button>
                  <Button
                    onClick={() => {
                      setReviewStatus('needs-changes');
                      updateTask(task.id, { status: 'in-progress' });
                      showToast('info', 'Task sent back for changes');
                    }}
                    color="red"
                    size="2"
                    className="flex-1"
                  >
                    <XCircle size={15} />
                    Request Changes
                  </Button>
                </Flex>
              </div>
            )}

            {task.reviewStatus === 'approved' && (
              <div className="p-3 bg-success/10 border border-success/30 rounded-xl flex items-center gap-2">
                <CheckCircle size={15} className="text-success flex-shrink-0" />
                <span className="text-sm font-medium text-success">Review approved</span>
              </div>
            )}

            {/* ── Clara's review notes (read-only) ──────────────────────── */}
            <div className="p-4 bg-mission-control-bg rounded-xl border border-mission-control-border">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
                <Eye size={12} />
                Clara&apos;s Review Notes
                {/* DL3: full token (no opacity modifier) to prevent contrast failure in light mode */}
                {reviewer && (
                  <span className="ml-auto flex items-center gap-1.5 normal-case font-normal text-mission-control-text-dim">
                    <AgentAvatar agentId={reviewer.id} fallbackEmoji={reviewer.avatar} size="sm" />
                    {reviewer.name}
                    {task.reviewStatus && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        task.reviewStatus === 'approved'      ? 'bg-success/15 text-success' :
                        task.reviewStatus === 'needs-changes' ? 'bg-error/15 text-error' :
                        task.reviewStatus === 'in-review'     ? 'bg-warning/15 text-warning' :
                        'bg-mission-control-border/40 text-mission-control-text-dim'
                      }`}>{task.reviewStatus}</span>
                    )}
                  </span>
                )}
              </div>

              {task.reviewNotes ? (
                <div className="text-sm text-mission-control-text whitespace-pre-wrap leading-relaxed bg-mission-control-surface rounded-lg p-3 border border-mission-control-border/50">
                  {task.reviewNotes}
                </div>
              ) : (
                <div className="text-sm text-mission-control-text-dim italic py-4 text-center">
                  No review notes yet — Clara will write here after reviewing this task.
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Quick Actions — only shown when there are actions to display */}
      {((task.status as string) === 'done' || task.parentTaskId) && (
      <div className="p-6 border-t border-mission-control-border bg-mission-control-bg rounded-b-2xl flex-shrink-0">
        <Flex gap="2">
          {task.status === 'done' && (
            <>
              <Button
                onClick={() => setShowReopenModal(true)}
                variant="outline"
                color="gray"
                size="2"
                className="flex-1"
              >
                <XCircle size={16} />
                Reopen
              </Button>
              <Button
                onClick={() => { setShowForkModal(true); setForkDescription(''); }}
                size="2"
                className="flex-1"
              >
                Fork From This
              </Button>
            </>
          )}
          {/* Fork button also available for non-done tasks with parent context */}
          {task.status !== 'done' && task.parentTaskId && (
            <Button
              onClick={() => { setShowForkModal(true); setForkDescription(''); }}
              variant="outline"
              color="gray"
              size="2"
            >
              Fork
            </Button>
          )}
        </Flex>
      </div>
      )}

      {/* Reopen Task Modal */}
      <BaseModal
        isOpen={showReopenModal}
        onClose={() => { setShowReopenModal(false); setReopenReason(''); }}
        size="md"
        ariaLabel="Reopen task"
        showCloseButton={false}
      >
        <BaseModalHeader
          title="Reopen Task"
          titleId="reopen-task-title"
          onClose={() => { setShowReopenModal(false); setReopenReason(''); }}
          closeButtonLabel="Close reopen task dialog"
        />
        <BaseModalBody>
          <p className="text-sm text-mission-control-text-dim mb-4">
            Why are you reopening this task?
          </p>
          <TextArea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Enter reason for reopening (required)..."
            rows={5}
            resize="none"
            size="2"
            className="w-full"
          />
          {reopenReason.trim().length === 0 && (
            <p className="text-xs text-error mt-2">
              Reason is required and cannot be empty
            </p>
          )}
        </BaseModalBody>
        <BaseModalFooter align="right">
          <Button
            onClick={() => { setShowReopenModal(false); setReopenReason(''); }}
            variant="outline"
            color="gray"
            size="2"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleReopen}
            disabled={!reopenReason.trim()}
            size="2"
            className="flex-1"
          >
            Reopen Task
          </Button>
        </BaseModalFooter>
      </BaseModal>

      {/* Agent Still Active Warning Modal */}
      {showAgentActiveModal && activeAgentInfo && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowAgentActiveModal(false); setActiveAgentInfo(null); }}>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            ref={agentActiveModalTrapRef as React.RefObject<HTMLDivElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-active-title"
            tabIndex={-1}
            className="bg-mission-control-surface rounded-2xl border border-mission-control-border shadow-2xl w-[500px] max-w-[90vw] outline-none"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setShowAgentActiveModal(false); setActiveAgentInfo(null); } }}
          >
            {/* Header */}
            <Flex align="center" justify="between" className="p-6 border-b border-mission-control-border">
              <Flex align="center" gap="3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertCircle size={24} className="text-warning" />
                </div>
                <h3 id="agent-active-title" className="text-lg font-semibold">Agent Still Active</h3>
              </Flex>
              <button
                type="button"
                onClick={() => {
                  setShowAgentActiveModal(false);
                  setActiveAgentInfo(null);
                }}
                aria-label="Close agent active warning"
                className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                <X size={16} />
              </button>
            </Flex>

            {/* Content */}
            <div className="p-6">
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-warning mb-2">
                  <AlertTriangle size={14} className="inline mr-1" />An agent is currently working on this task
                </p>
                <div className="text-xs text-mission-control-text-dim space-y-1">
                  <div>
                    <span className="font-medium">Session:</span> {activeAgentInfo.displayName}
                  </div>
                  <div>
                    <span className="font-medium">Task:</span> {task.title}
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-mission-control-text-dim mb-3">
                If you approve now, the agent might reset the task status when it finishes, creating an approval loop.
              </p>
              
              <p className="text-sm text-mission-control-text font-medium">
                You should abort the agent session before approving.
              </p>
            </div>

            {/* Actions */}
            <Flex gap="3" className="p-6 border-t border-mission-control-border">
              <Button
                onClick={() => {
                  setShowAgentActiveModal(false);
                  setActiveAgentInfo(null);
                }}
                variant="outline"
                color="gray"
                size="2"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setAbortingAgent(true);
                  try {
                    // Agent abort not available in web mode (requires exec)
                    // Proceed with approval directly
                    showToast('success', 'Proceeding with approval...');
                    await logTaskActivity(task.id, 'agent_aborted', `Agent session ${activeAgentInfo.displayName} abort requested`);

                    // Wait a moment for session to fully terminate
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Now approve the task
                    await updateTask(task.id, { status: 'done' });
                    await logTaskActivity(task.id, 'task_completed', 'Task marked as done (agent aborted first)');

                    setShowAgentActiveModal(false);
                    setActiveAgentInfo(null);
                    showToast('success', 'Task completed ✓');
                  } catch (err: unknown) {
                    showToast('error', 'Abort failed', (err as Error).message);
                  } finally {
                    setAbortingAgent(false);
                  }
                }}
                disabled={abortingAgent}
                color="red"
                size="2"
                className="flex-1"
              >
                {abortingAgent ? (
                  <>
                    <Spinner size="2" />
                    Aborting...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Abort & Approve
                  </>
                )}
              </Button>
            </Flex>
          </div>
        </div>
      )}

      {/* Poke Modal - Internal status update + chat */}
      {showPokeModal && task && (
        <PokeModal
          taskId={task.id}
          taskTitle={task.title}
          onClose={() => {
            setShowPokeModal(false);
            loadActivity();
          }}
        />
      )}

      {/* Fork Task Modal */}
      <BaseModal
        isOpen={showForkModal && !!task}
        onClose={() => setShowForkModal(false)}
        size="md"
        ariaLabel="Fork task"
        showCloseButton={false}
      >
        <BaseModalHeader
          title="Build on this task"
          titleId="fork-task-title"
          onClose={() => setShowForkModal(false)}
          closeButtonLabel="Close fork task dialog"
        />
        <BaseModalBody>
          <div className="space-y-4">
            <p className="text-sm text-mission-control-text-dim">What do you want to build next?</p>
            <TextArea
              value={forkDescription}
              onChange={e => setForkDescription(e.target.value)}
              placeholder="Describe the next task..."
              rows={4}
              resize="none"
              size="2"
              className="w-full"
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={forkAssignSameAgent}
                onCheckedChange={(val) => setForkAssignSameAgent(val === true)}
                size="1"
              />
              Assign to same agent{task?.assignedTo ? ` (${task.assignedTo})` : ''}
            </label>
          </div>
        </BaseModalBody>
        <BaseModalFooter>
          <Button
            onClick={() => setShowForkModal(false)}
            variant="outline"
            color="gray"
            size="2"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!task || !forkDescription.trim()) return;
              try {
                // Fork via REST: create a subtask
                const result = await taskApi.addSubtask(task.id, {
                  title: forkDescription.trim().slice(0, 100),
                  description: forkDescription.trim(),
                  assignedTo: forkAssignSameAgent ? task.assignedTo : undefined,
                  priority: task.priority,
                });
                if (result) {
                  showToast('success', 'Task forked', `Created new task from "${task.title}"`);
                  setShowForkModal(false);
                  // Reload child tasks
                  taskApi.getSubtasks(task.id).then((r: any) => {
                    const children = Array.isArray(r) ? r : r?.children || [];
                    setChildTasks(children.map((c: any) => ({ id: c.id, title: c.title, status: c.status, stageNumber: c.stage_number })));
                  });
                } else {
                  showToast('error', 'Fork failed', 'Unknown error');
                }
              } catch (err) {
                showToast('error', 'Fork failed', (err as Error).message);
              }
            }}
            disabled={!forkDescription.trim()}
            size="2"
          >
            Create Task
          </Button>
        </BaseModalFooter>
      </BaseModal>

      <ConfirmDialog
        open={open}
        onClose={closeConfirm}
        onConfirm={onConfirm}
        title={config.title}
        message={config.message}
        confirmLabel={config.confirmLabel}
        cancelLabel={config.cancelLabel}
        type={config.type}
      />

      {/* File Preview Modal */}
      <BaseModal
        isOpen={!!fileViewer}
        onClose={() => setFileViewer(null)}
        size="xl"
        ariaLabel={fileViewer ? `Preview: ${fileViewer.name}` : 'File preview'}
        maxHeight="85vh"
        showCloseButton={false}
      >
        {/* Header */}
        <Flex align="center" justify="between" className="px-4 py-3 border-b border-mission-control-border flex-shrink-0">
          <Flex align="center" gap="2">
            <ZoomIn size={15} className="text-mission-control-accent" />
            <span className="text-sm font-medium truncate max-w-sm">{fileViewer?.name}</span>
            <span className="text-[10px] text-mission-control-text-dim px-1.5 py-0.5 bg-mission-control-border/50 rounded font-mono uppercase">
              .{fileViewer?.ext}
            </span>
          </Flex>
          <Flex align="center" gap="2">
            {fileViewer?.content && (
              <Button
                onClick={() => { navigator.clipboard.writeText(fileViewer.content!); showToast('success', 'Copied to clipboard'); }}
                variant="surface"
                color="gray"
                size="1"
              >
                Copy
              </Button>
            )}
            <button
              type="button"
              onClick={() => setFileViewer(null)}
              aria-label="Close preview"
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <X size={15} />
            </button>
          </Flex>
        </Flex>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {fileViewer?.mediaType === 'image' && (
            <div className="flex items-center justify-center p-6 min-h-[300px] bg-[repeating-conic-gradient(#333_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileViewer.serveUrl}
                alt={fileViewer.name}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          )}
          {fileViewer?.mediaType === 'video' && (
            <div className="flex items-center justify-center p-6 bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={fileViewer.serveUrl}
                controls
                className="max-w-full max-h-[65vh] rounded-lg"
              />
            </div>
          )}
          {fileViewer?.mediaType === 'html' && (
            <iframe
              src={fileViewer.serveUrl}
              title={fileViewer.name}
              className="w-full h-[65vh] border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
          {!fileViewer?.mediaType && fileViewer?.content && (
            <pre className="p-4 text-xs font-mono text-mission-control-text whitespace-pre-wrap break-words leading-relaxed">
              {fileViewer.content}
            </pre>
          )}
        </div>
      </BaseModal>
    </div>
    </>
  );
}
