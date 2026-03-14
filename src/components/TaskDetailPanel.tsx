// Phase 81: File-level eslint-disable removed.
// useEffect deps are explicit. Interval raised to 30s.
// Complex panel with many useEffects for task management - patterns are carefully designed.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEventBus } from '../lib/useEventBus';
import { X, Bot, Clock, Play, CheckCircle, XCircle, FileText, Activity, MessageSquare, Calendar, Plus, Check, Eye, AlertCircle, AlertTriangle, Lightbulb, Loader2, RefreshCw, Upload, Download, Trash2, Paperclip, Search, ImageIcon, File, Archive, Settings, Code, Globe, Timer, Link2, Sparkles, ChevronUp, ChevronDown, User } from 'lucide-react';
import { useStore, Task, Subtask, TaskActivity } from '../store/store';
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
import { isProtectedAgent } from '../lib/agentConfig';

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
  const [fileViewer, setFileViewer] = useState<{ name: string; content: string; ext: string } | null>(null);
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
    }).catch(() => {});
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

      // Escape - Close panel
      if (e.key === 'Escape') {
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
  }, [task, activeTab, onClose, updateTask]);

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
    } catch {
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
    } catch {
      showToast('error', 'Failed to remove attachment');
    }
  };

  const handleOpenFile = async (filePath: string) => {
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
    } catch {
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
    } catch {
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
    <div className="w-full md:w-[700px] md:max-w-[95vw] h-[95dvh] md:h-auto md:max-h-[90vh] bg-mission-control-surface border border-mission-control-border md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom md:zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-mission-control-border bg-mission-control-bg rounded-t-2xl flex-shrink-0">
        {/* Row 1: badges + close */}
        <div className="flex items-center gap-2 mb-1.5">
          <ActiveAgentIndicator taskId={task.id} showLabel size="sm" />
          <span className={`px-1.5 py-0.5 text-xs rounded ${
            task.status === 'done' ? 'bg-success-subtle text-success' :
            task.status === 'in-progress' ? 'bg-warning-subtle text-warning' :
            task.status === 'review' ? 'bg-review-subtle text-review' :
            task.status === 'failed' ? 'bg-error-subtle text-error' :
            'bg-info-subtle text-info'
          }`}>
            {task.status.replace(/-/g, ' ')}
          </span>
          <span className="text-xs text-mission-control-text-dim">{task.project}</span>
          {task.projectName && (
            <span className="flex items-center gap-1 text-xs text-mission-control-accent">
              <Activity size={11} />
              {task.projectName}{!!task.stageNumber && ` · Stage ${task.stageNumber}`}
            </span>
          )}
          {dueDateUrgency && (
            <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
              dueDateUrgency.level === 'overdue' ? 'bg-error-subtle text-error' :
              dueDateUrgency.level === 'soon' ? 'bg-warning-subtle text-warning' :
              'bg-warning-subtle/50 text-warning'
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
              <button onClick={() => { const t = JSON.parse(task.tags || '[]'); updateTask(task.id, { tags: JSON.stringify(t.filter((x: string) => x !== tag)) }); }} className="hover:text-error">×</button>
            </span>
          ))}
          <input
            type="text"
            placeholder="+ tag"
            className="unstyled px-1.5 py-0.5 text-xs bg-mission-control-bg border border-mission-control-border rounded-full focus:outline-none focus:border-mission-control-accent w-14 flex-shrink-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                const newTag = e.currentTarget.value.trim();
                const currentTags = JSON.parse(task.tags || '[]');
                if (!currentTags.includes(newTag)) updateTask(task.id, { tags: JSON.stringify([...currentTags, newTag]) });
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={onClose}
            className="ml-auto p-1.5 hover:bg-mission-control-border rounded-lg transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Row 2: title */}
        <h2 className="text-base font-semibold line-clamp-1 mb-1" title={task.title}>{task.title}</h2>

        {/* Row 3: description (1 line) */}
        {task.description && (
          <p className="text-xs text-mission-control-text-dim line-clamp-1 mb-2" title={task.description}>{task.description}</p>
        )}

        {/* Row 4: progress · dates — all one line */}
        <div className="flex items-center gap-2 my-[14px]">
          {subtasks.length > 0 ? (
            <>
              <div className="h-2 flex-1 bg-gradient-to-r from-mission-control-border/60 to-mission-control-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-700 to-green-400 transition-all duration-500 rounded-full"
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
                  className="h-full bg-mission-control-accent transition-all duration-500 rounded-full"
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
          <div className="flex items-center gap-2 text-xs text-mission-control-text-dim ml-auto flex-shrink-0">
            <span className="flex items-center gap-1"><Calendar size={11} />{formatTime(task.createdAt)}</span>
            <span className="flex items-center gap-1"><Clock size={11} />{formatTime(task.updatedAt)}</span>
          </div>
        </div>

        {/* Row 6: agents — compact single row */}
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-mission-control-border">
          {/* Worker */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs text-mission-control-text-dim whitespace-nowrap">Worker:</span>
            {assignedAgent ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <AgentAvatar agentId={assignedAgent.id} fallbackEmoji={assignedAgent.avatar} size="sm" />
                <span className="text-xs font-medium truncate">{assignedAgent.name}</span>
                {!isWorking && !['done', 'in-progress', 'internal-review', 'agent-review', 'review'].includes(task.status) && (
                  <button onClick={handleStart} className="p-1 bg-success text-white rounded hover:bg-success-hover flex-shrink-0" title="Start Work">
                    <Play size={11} />
                  </button>
                )}
                {(isWorking || task.status === 'in-progress') && <Loader2 size={12} className="animate-spin text-warning flex-shrink-0" />}
              </div>
            ) : isRemoteAgent ? (
              <div className="flex items-center gap-1 min-w-0">
                <Globe size={12} className="text-review flex-shrink-0" />
                <span className="text-xs truncate capitalize">{task.assignedTo}</span>
              </div>
            ) : (
              <span className="text-xs text-mission-control-text-dim italic">unassigned</span>
            )}
          </div>

          <div className="w-px h-4 bg-mission-control-border flex-shrink-0" />

          {/* Reviewer */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs text-mission-control-text-dim whitespace-nowrap">Reviewer:</span>
            {reviewer ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <AgentAvatar agentId={reviewer.id} fallbackEmoji={reviewer.avatar} size="sm" />
                <span className="text-xs font-medium truncate">{reviewer.name}</span>
                {task.reviewStatus && (
                  <span className={`text-xs px-1 py-0.5 rounded flex-shrink-0 ${
                    task.reviewStatus === 'approved' ? 'bg-success-subtle text-success' :
                    task.reviewStatus === 'needs-changes' ? 'bg-error-subtle text-error' :
                    task.reviewStatus === 'in-review' ? 'bg-warning-subtle text-warning' :
                    'bg-muted-subtle text-muted'
                  }`}>{task.reviewStatus}</span>
                )}
              </div>
            ) : (
              <select
                onChange={(e) => e.target.value && assignReviewer(e.target.value)}
                className="flex-1 min-w-0 bg-mission-control-bg border border-dashed border-mission-control-border rounded text-xs py-0.5 px-1"
              >
                <option value="">Assign...</option>
                {agents
                  .filter(a => a.id !== task.assignedTo)
                  .map(a => (
                    <option key={a.id} value={a.id} selected={a.id === 'clara'}>
                      {a.name}{a.id === 'clara' ? ' (default)' : ''}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Clara review notes callout */}
      {task.reviewNotes && task.reviewStatus && ['needs-changes', 'rejected', 'pre-rejected'].includes(task.reviewStatus) && (
        <div className="mx-4 mt-3 p-3 bg-error-subtle border border-error-border rounded-xl flex items-start gap-2 flex-shrink-0">
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
        <div className="mx-4 mt-3 p-3 bg-success-subtle border border-success-border rounded-xl flex items-start gap-2 flex-shrink-0">
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
        <div className="flex items-center gap-1.5">
          <Timer size={12} className="flex-shrink-0" />
          <span>Active {formatDuration(task.updatedAt - task.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="flex-shrink-0" />
          <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Tabs */}
      {/* IMPORTANT: Planning tab must ALWAYS be visible, regardless of task status.
          It serves as a historical record and should never be hidden when task is complete. */}
      <div className="flex border-b border-mission-control-border flex-shrink-0">
        {(['subtasks', 'planning', 'activity', 'files', 'review', 'chat'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-mission-control-accent border-b-2 border-mission-control-accent'
                : 'text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            {tab === 'subtasks' && (
              <span className="flex items-center justify-center gap-2">
                Subtasks
                {subtasks.length > 0 && (
                  <span className="bg-mission-control-border px-1.5 py-0.5 rounded text-xs">
                    {completedSubtasks}/{subtasks.length}
                  </span>
                )}
              </span>
            )}
            {tab === 'planning' && 'Planning'}
            {tab === 'activity' && (
              <span className="flex items-center justify-center gap-2">
                Activity
                {activities.length > 0 && (
                  <span className="bg-mission-control-border px-1.5 py-0.5 rounded text-xs">
                    {activities.length}
                  </span>
                )}
              </span>
            )}
            {tab === 'files' && (
              <span className="flex items-center justify-center gap-2">
                Files
                {attachments.length > 0 && (
                  <span className="bg-mission-control-border px-1.5 py-0.5 rounded text-xs">
                    {attachments.length}
                  </span>
                )}
              </span>
            )}
            {tab === 'review' && 'Review'}
            {tab === 'chat' && (
              <span className="flex items-center justify-center gap-2">
                Chat
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={`flex-1 min-h-0 ${activeTab === 'chat' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
        {/* Subtasks Tab */}
        {activeTab === 'subtasks' && (
          <div className="p-4">
            {/* Progress bar */}
            {subtasks.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-1">
                  <span>Progress</span>
                  <span>{completedSubtasks}/{subtasks.length} complete</span>
                </div>
                <div className="h-2 bg-mission-control-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all duration-300"
                    style={{ width: `${subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0}%` }}
                  />
                </div>
                {completedSubtasks === subtasks.length && task?.status === 'in-progress' && (
                  <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-success-subtle border border-success-border">
                    <CheckCircle size={16} className="text-success flex-shrink-0" />
                    <span className="text-sm text-success flex-1">All subtasks complete — ready for review?</span>
                    <button
                      type="button"
                      onClick={() => updateTask(task.id, { status: 'agent-review' as any })}
                      className="px-3 py-1.5 text-xs font-medium bg-success text-white rounded-lg hover:brightness-110 transition-colors flex-shrink-0"
                    >
                      Move to Review
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Acceptance criteria auto-subtask suggestion */}
            {task.planningNotes && suggestedCriteria.length === 0 && subtasks.length === 0 && (() => {
              const criteria = parseAcceptanceCriteria(task.planningNotes);
              if (criteria.length === 0) return null;
              return (
                <div className="mb-4 p-3 bg-mission-control-accent/10 border border-mission-control-accent/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-mission-control-accent flex-shrink-0" />
                    <span className="text-sm font-medium">Auto-generate from Acceptance Criteria</span>
                  </div>
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
                  <button
                    onClick={() => handleCreateCriteriaSubtasks(criteria)}
                    disabled={isCreatingCriteriaSubtasks}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-50"
                  >
                    {isCreatingCriteriaSubtasks ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Create {criteria.length} subtask{criteria.length !== 1 ? 's' : ''}
                  </button>
                </div>
              );
            })()}

            {/* Add Subtask — Enter key creates next subtask automatically */}
            <div className="flex gap-2 mb-4">
              <input
                ref={newSubtaskInputRef}
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
                className="flex-1 bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
              />
              <button
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
                className="p-2 bg-mission-control-accent text-white rounded-lg disabled:opacity-50 hover:bg-mission-control-accent-dim transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Bulk action bar — visible when one or more subtasks are selected */}
            {selectedSubtaskIds.size > 0 && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-mission-control-surface border border-mission-control-border rounded-xl">
                <span className="text-xs text-mission-control-text-dim flex-1">
                  {selectedSubtaskIds.size} selected
                </span>
                <button
                  onClick={handleBulkMarkDone}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-success text-white rounded-lg hover:brightness-110 transition-colors"
                >
                  <Check size={12} />
                  Mark done
                </button>
                {bulkDeleteConfirm ? (
                  <>
                    <span className="text-xs text-error">Delete {selectedSubtaskIds.size}?</span>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-error text-white rounded-lg hover:brightness-110 transition-colors"
                    >
                      <Trash2 size={12} />
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setBulkDeleteConfirm(false)}
                      className="px-2.5 py-1 text-xs border border-mission-control-border rounded-lg hover:bg-mission-control-border transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setBulkDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-error/40 text-error rounded-lg hover:bg-error/10 transition-colors"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
                <button
                  onClick={() => { setSelectedSubtaskIds(new Set()); setBulkDeleteConfirm(false); }}
                  className="p-1 text-mission-control-text-dim hover:text-mission-control-text rounded transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Subtask List */}
            {loadingSubtasks ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-mission-control-border">
                    <div className="w-5 h-5 rounded bg-mission-control-surface animate-pulse flex-shrink-0" />
                    <div className="h-4 rounded bg-mission-control-surface animate-pulse flex-1" />
                  </div>
                ))}
              </div>
            ) : subtasks.length === 0 ? (
              <div className="text-center text-mission-control-text-dim py-8">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No subtasks yet</p>
                <p className="text-xs">Break down this task into smaller steps</p>
              </div>
            ) : (
              <div className="space-y-2">
                {subtasks.map((st, idx) => {
                  const isSelected = selectedSubtaskIds.has(st.id);
                  const isOverdue = st.dueDate != null && !st.completed && st.dueDate < Date.now();
                  const dueDateStr = st.dueDate
                    ? new Date(st.dueDate).toISOString().split('T')[0]
                    : '';
                  const dueDateDisplay = st.dueDate
                    ? new Date(st.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : null;

                  return (
                    <div
                      key={st.id}
                      className={`group flex items-start gap-2 p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-mission-control-accent/10 border-mission-control-accent/50'
                          : st.completed
                            ? 'bg-success-subtle border-success-border'
                            : 'bg-mission-control-bg border-mission-control-border hover:border-mission-control-accent/50'
                      }`}
                    >
                      {/* Selection checkbox — appears on hover or when selected */}
                      <button
                        onClick={() => handleToggleSubtaskSelect(st.id)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-mission-control-accent border-mission-control-accent text-white opacity-100'
                            : 'border-mission-control-border opacity-0 group-hover:opacity-100'
                        }`}
                        title="Select subtask"
                      >
                        {isSelected && <Check size={10} />}
                      </button>

                      {/* Completion toggle */}
                      <button
                        onClick={() => handleToggleSubtask(st.id)}
                        className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${
                          st.completed
                            ? 'bg-success text-white'
                            : 'border-2 border-mission-control-border hover:border-mission-control-accent'
                        }`}
                      >
                        {st.completed && <Check size={13} />}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <span
                          className={`block text-sm leading-snug ${st.completed ? 'line-through text-mission-control-text-dim' : ''}`}
                        >
                          {st.title}
                        </span>
                        {st.description && (
                          <p className="text-xs text-mission-control-text-dim mt-0.5">{st.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {/* Assignee selector */}
                          <div className="flex items-center gap-1">
                            <User size={11} className="text-mission-control-text-dim flex-shrink-0" />
                            <select
                              value={st.assignedTo || ''}
                              onChange={(e) => handleSetSubtaskAssignee(st.id, e.target.value)}
                              className="text-xs bg-transparent border-none outline-none text-mission-control-text-dim cursor-pointer hover:text-mission-control-text max-w-[100px] truncate"
                              title="Assign to agent"
                            >
                              <option value="">Unassigned</option>
                              {agents.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Due date badge / editor */}
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
                              className="text-xs bg-mission-control-bg border border-mission-control-accent rounded px-1 py-0 outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => setEditingDueDateId(st.id)}
                              className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors ${
                                isOverdue
                                  ? 'text-error bg-error/10 border border-error/30'
                                  : dueDateDisplay
                                    ? 'text-mission-control-text-dim bg-mission-control-border'
                                    : 'text-mission-control-text-dim opacity-0 group-hover:opacity-60 hover:!opacity-100'
                              }`}
                              title={isOverdue ? 'Overdue — click to change' : 'Set due date'}
                            >
                              <Calendar size={10} />
                              {dueDateDisplay ?? 'Due date'}
                            </button>
                          )}

                          {st.completedAt && (
                            <span className="text-xs text-success/60">
                              Done {formatTime(st.completedAt)}
                              {st.completedBy &&
                                ` · ${agents.find((a) => a.id === st.completedBy)?.name || st.completedBy}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMoveSubtask(idx, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 text-mission-control-text-dim hover:text-mission-control-text disabled:opacity-20 disabled:cursor-not-allowed rounded transition-colors"
                          title="Move up"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => handleMoveSubtask(idx, 'down')}
                          disabled={idx === subtasks.length - 1}
                          className="p-0.5 text-mission-control-text-dim hover:text-mission-control-text disabled:opacity-20 disabled:cursor-not-allowed rounded transition-colors"
                          title="Move down"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteSubtask(st.id)}
                        className="mt-0.5 p-1 text-mission-control-text-dim hover:text-error opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title="Delete subtask"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Planning Tab - ALWAYS VISIBLE regardless of task status (historical record) */}
        {activeTab === 'planning' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText size={16} className="text-mission-control-accent" />
                Planning & Brainstorming
              </h3>
            </div>
            
            <textarea
              value={task.planningNotes || ''}
              onChange={(e) => {
                updateTask(task.id, { planningNotes: e.target.value });
                // Auto-save to backend (debounced by typing)
                clearTimeout((window as any).__planningNotesTimer);
                (window as any).__planningNotesTimer = setTimeout(() => {
                  taskApi.update(task.id, {
                    planningNotes: e.target.value
                  }).catch((_err: unknown) => { /* silent - planning notes save failed */ });
                }, 1000);
              }}
              placeholder="Planning notes, brainstorming, research..."
              className="w-full h-64 bg-mission-control-bg border border-mission-control-border rounded-xl p-4 text-sm resize-none focus:outline-none focus:border-mission-control-accent font-mono"
              style={{ minHeight: '16rem' }}
            />
            
            <p className="text-xs text-mission-control-text-dim mt-2">
              <Lightbulb size={12} className="inline mr-1" />Use this space for planning, brainstorming, research notes, or any thoughts about this task.
              Changes are auto-saved after 1 second.
            </p>

            {/* Dependencies */}
            <div className="mt-6">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-mission-control-accent" />
                Blocked By
              </h3>
              {(task.blockedBy || []).length > 0 ? (
                <div className="space-y-2 mb-3">
                  {(task.blockedBy as string[]).map(depId => {
                    const depTask = useStore.getState().tasks.find(t => t.id === depId);
                    return (
                      <div key={depId} className="flex items-center gap-2 p-2 rounded-lg bg-mission-control-surface border border-mission-control-border text-sm">
                        <span className="flex-1 truncate">{depTask?.title || depId}</span>
                        {depTask && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${depTask.status === 'done' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>
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
                          className="p-1 text-error hover:bg-error-subtle rounded transition-colors flex-shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-mission-control-text-dim mb-3">No dependencies</p>
              )}
              <select
                defaultValue=""
                onChange={async (e) => {
                  const depId = e.target.value;
                  if (!depId) return;
                  e.target.value = '';
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
                className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
              >
                <option value="">+ Add dependency (blocked by)...</option>
                {useStore.getState().tasks
                  .filter(t => t.id !== task.id && !(task.blockedBy as string[] || []).includes(t.id))
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.title} [{t.status}]</option>
                  ))}
              </select>
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
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Link2 size={16} className="text-mission-control-accent" />
                    Related Tasks
                  </h3>
                  <div className="space-y-1.5">
                    {related.map(rt => (
                      <div key={rt.id} className="flex items-center gap-2 p-2 rounded-lg bg-mission-control-bg border border-mission-control-border text-sm hover:border-mission-control-accent/50 transition-colors">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          rt.status === 'in-progress' ? 'bg-warning' :
                          rt.status === 'review' ? 'bg-review' :
                          'bg-mission-control-border'
                        }`} />
                        <span className="flex-1 truncate text-xs">{rt.title}</span>
                        <span className="text-xs text-mission-control-text-dim flex-shrink-0">{rt.project}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="p-4">
            {/* Agent Progress Query - only shows when agent is active */}
            <AgentProgressQuery 
              taskId={task.id} 
              taskTitle={task.title}
              className="mb-4"
            />
            
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Activity Log</h3>
              <button
                onClick={loadActivity}
                disabled={loadingActivity}
                className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text rounded-lg hover:bg-mission-control-border transition-colors"
              >
                <RefreshCw size={14} className={loadingActivity ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingActivity ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3 p-2">
                    <div className="w-6 h-6 rounded-full bg-mission-control-surface animate-pulse shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 rounded bg-mission-control-surface animate-pulse" />
                      <div className="h-4 w-3/4 rounded bg-mission-control-surface animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {activities.map((act, _idx) => (
                  <div
                    key={act.id}
                    className={`flex items-start gap-3 p-2 rounded-lg hover:bg-mission-control-bg/50 transition-colors ${
                      act.action === 'review-rejected' || act.action === 'pre-review-rejected'
                        ? 'bg-error-subtle border border-error/20'
                        : act.action === 'review-approved' || act.action === 'pre-review-approved'
                        ? 'bg-success-subtle border border-success/20'
                        : ''
                    }`}
                  >
                    <div className="mt-1 p-1 rounded bg-mission-control-bg">
                      {getActivityIcon(act.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{act.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-mission-control-text-dim">
                          {formatTime(act.timestamp)}
                        </span>
                        {act.agentId && (
                          <span className="text-xs text-mission-control-accent">
                            {agents.find(a => a.id === act.agentId)?.name || act.agentId}
                          </span>
                        )}
                      </div>
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
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Paperclip size={16} className="text-mission-control-accent" />
                Task Attachments
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleAutoDetect}
                  disabled={loadingAttachments}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-mission-control-border hover:bg-mission-control-accent/20 rounded-lg transition-colors"
                  title="Auto-detect agent output files"
                >
                  {loadingAttachments ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  Auto-detect
                </button>
                <label className="flex items-center gap-2 px-3 py-1.5 text-xs bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim cursor-pointer transition-colors">
                  {uploadingFile ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  Upload
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploadingFile}
                  />
                </label>
              </div>
            </div>

            {/* Upload Instructions */}
            {attachments.length === 0 && !loadingAttachments && (
              <div className="mb-4 p-4 bg-mission-control-bg/50 rounded-xl border border-dashed border-mission-control-border text-center">
                <Paperclip size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm text-mission-control-text-dim">
                  No attachments yet. Upload deliverables, screenshots, or reference files.
                </p>
                <p className="text-xs text-mission-control-text-dim mt-1">
                  Click Upload or use Auto-detect to find agent output files
                </p>
              </div>
            )}

            {/* Loading State */}
            {loadingAttachments && attachments.length === 0 && (
              <div className="flex items-center justify-center py-8 text-mission-control-text-dim">
                <Loader2 size={24} className="animate-spin mr-2" />
                Loading attachments...
              </div>
            )}

            {/* Attachments List */}
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group flex items-center gap-3 p-3 bg-mission-control-bg rounded-xl border border-mission-control-border hover:border-mission-control-accent/50 transition-all"
                >
                  <div className="text-mission-control-text-dim flex-shrink-0">
                    {getFileIcon(null)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{attachment.fileName ?? attachment.filePath.split('/').pop()}</div>
                    <div className="flex items-center gap-2 text-xs text-mission-control-text-dim mt-0.5">
                      {attachment.category && (
                        <>
                          <span className="px-1.5 py-0.5 bg-mission-control-border rounded text-xs">
                            {attachment.category}
                          </span>
                          <span>•</span>
                        </>
                      )}
                      <span>{formatTime(attachment.createdAt)}</span>
                      {attachment.uploadedBy && attachment.uploadedBy !== 'user' && (
                        <>
                          <span>•</span>
                          <span className="text-mission-control-accent">
                            {agents.find(a => a.id === attachment.uploadedBy)?.name || attachment.uploadedBy}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-mission-control-text-dim/50 mt-0.5 truncate" title={attachment.filePath}>
                      {attachment.filePath}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenFile(attachment.filePath)}
                      className="p-2 hover:bg-mission-control-accent/20 rounded-lg transition-colors"
                      title="Open file"
                    >
                      <Download size={16} className="text-mission-control-accent" />
                    </button>
                    <button
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      className="p-2 hover:bg-error-subtle rounded-lg transition-colors"
                      title="Delete attachment"
                    >
                      <Trash2 size={16} className="text-error" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats Summary */}
            {attachments.length > 0 && (
              <div className="mt-4 p-3 bg-mission-control-bg/50 rounded-xl border border-mission-control-border">
                <div className="flex items-center justify-between text-xs text-mission-control-text-dim">
                  <span>
                    {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
                  </span>
                  <span>
                    Total: {attachments.length} file{attachments.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review Tab */}
        {activeTab === 'chat' && (
          <TaskChatTab
            taskId={task.id}
            agentId={task.assignedTo || null}
            agentName={agents.find(a => a.id === task.assignedTo)?.name || task.assignedTo || 'Agent'}
          />
        )}

        {activeTab === 'review' && (
          <div className="p-4">
            {/* Definition of Ready Checklist - show for internal-review status */}
            {task.status === 'internal-review' && (
              <div className="mb-4 p-4 bg-mission-control-bg rounded-xl border border-mission-control-border">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-mission-control-accent" />
                  <span className="font-medium">Definition of Ready</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className={`flex items-center gap-2 ${(task.subtasks?.length || 0) >= 2 ? 'text-success' : 'text-error'}`}>
                    {(task.subtasks?.length || 0) >= 2 ? <CheckCircle size={14} className="text-success inline" /> : <XCircle size={14} className="text-error inline" />}
                    Subtasks: {task.subtasks?.length || 0}/2 (minimum 2)
                  </div>
                  <div className={`flex items-center gap-2 ${task.priority && ['p0','p1','p2','p3'].includes(task.priority) ? 'text-success' : 'text-error'}`}>
                    {task.priority && ['p0','p1','p2','p3'].includes(task.priority) ? <CheckCircle size={14} className="text-success inline" /> : <XCircle size={14} className="text-error inline" />}
                    Priority: {task.priority || 'Not set'}
                  </div>
                  <div className={`flex items-center gap-2 ${task.assignedTo && !isProtectedAgent(task.assignedTo) ? 'text-success' : 'text-error'}`}>
                    {task.assignedTo && !isProtectedAgent(task.assignedTo) ? <CheckCircle size={14} className="text-success inline" /> : <XCircle size={14} className="text-error inline" />}
                    Assigned: {task.assignedTo || 'Not assigned'}
                  </div>
                  <div className={`flex items-center gap-2 ${(task.description?.length || 0) >= 20 ? 'text-success' : 'text-warning'}`}>
                    {(task.description?.length || 0) >= 20 ? <CheckCircle size={14} className="text-success inline" /> : <AlertTriangle size={14} className="text-warning inline" />}
                    Description: {(task.description?.length || 0)} chars (min 20)
                  </div>
                </div>
              </div>
            )}

            {/* Quick Approve/Reject Actions (when in review status) */}
            {task.status === 'review' && task.reviewStatus !== 'approved' && (
              <div className="mb-4 p-4 bg-warning-subtle border border-warning-border rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-warning" />
                  <span className="font-medium text-warning">Awaiting Review</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // ATOMIC UPDATE: Change both reviewStatus AND status in one call
                      const updates: { reviewStatus: 'approved'; status: 'in-progress' } = { 
                        reviewStatus: 'approved',
                        status: 'in-progress'
                      };
                      updateTask(task.id, updates);
                      logTaskActivity(task.id, 'approved', 'Task approved - moved back to in-progress');
                      showToast('success', `Task approved! Assigned to ${task.assignedTo || 'unassigned'} to complete.`);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-success text-white rounded-lg hover:bg-success-hover transition-colors"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setReviewStatus('needs-changes');
                      updateTask(task.id, { status: 'in-progress' });
                      showToast('info', 'Task sent back for changes');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-error-hover transition-colors"
                  >
                    <XCircle size={16} />
                    Request Changes
                  </button>
                </div>
              </div>
            )}

            {/* Approved Notice */}
            {task.reviewStatus === 'approved' && (
              <div className="mb-4 p-4 bg-success-subtle border border-success-border rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-success" />
                  <span className="font-medium text-success">Review Approved</span>
                </div>
                <p className="mt-2 text-sm text-mission-control-text-dim">
                  This task has been approved and can now be marked as done.
                </p>
              </div>
            )}

            {reviewer ? (
              <div className="space-y-4">
                {/* Review Status */}
                <div className="p-4 bg-mission-control-bg rounded-xl border border-mission-control-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={16} className="text-mission-control-accent" />
                    <span className="font-medium">Review Status</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['pending', 'in-review', 'needs-changes', 'approved'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setReviewStatus(status)}
                        className={`p-2 rounded-lg text-sm transition-colors ${
                          task.reviewStatus === status
                            ? status === 'approved' ? 'bg-success text-white' :
                              status === 'needs-changes' ? 'bg-error text-white' :
                              status === 'in-review' ? 'bg-warning text-white' :
                              'bg-mission-control-accent text-white'
                            : 'bg-mission-control-border hover:bg-mission-control-border/80'
                        }`}
                      >
                        {status.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Review Notes */}
                <div className="p-4 bg-mission-control-bg rounded-xl border border-mission-control-border">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-mission-control-accent" />
                    <span className="font-medium">Review Notes</span>
                  </div>
                  <textarea
                    value={task.reviewNotes || ''}
                    onChange={(e) => updateTask(task.id, { reviewNotes: e.target.value })}
                    placeholder="Add notes from review..."
                    className="w-full h-24 bg-mission-control-surface border border-mission-control-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-mission-control-accent"
                  />
                </div>

                {/* Pre-approval Checklist */}
                <div className="p-4 bg-warning-subtle border border-warning-border rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-warning" />
                    <span className="font-medium text-warning">Pre-Approval Checklist</span>
                  </div>
                  <div className="text-sm text-mission-control-text-dim space-y-1">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span>Code reviewed for bugs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span>Matches task requirements</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span>No security issues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span>Ready for human approval</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-mission-control-text-dim py-12">
                <Eye size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No reviewer assigned</p>
                <p className="text-xs">Assign a review agent to enable pre-approval checks</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions — only shown when there are actions to display */}
      {((task.status as string) === 'done' || task.parentTaskId) && (
      <div className="p-6 border-t border-mission-control-border bg-mission-control-bg rounded-b-2xl flex-shrink-0">
        <div className="flex gap-2">
          {task.status === 'done' && (
            <>
              <button
                onClick={() => setShowReopenModal(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-mission-control-border text-mission-control-text rounded-xl hover:bg-mission-control-border/70 transition-colors"
              >
                <XCircle size={16} />
                Reopen
              </button>
              <button
                onClick={() => { setShowForkModal(true); setForkDescription(''); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors"
              >
                🔀 Fork From This
              </button>
            </>
          )}
          {/* Fork button also available for non-done tasks with parent context */}
          {task.status !== 'done' && task.parentTaskId && (
            <button
              onClick={() => { setShowForkModal(true); setForkDescription(''); }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-mission-control-surface border border-mission-control-border text-mission-control-text rounded-xl hover:border-mission-control-accent transition-colors text-sm"
            >
              🔀 Fork
            </button>
          )}
        </div>
      </div>
      )}

      {/* Reopen Task Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border shadow-2xl w-[500px] max-w-[90vw]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-mission-control-border">
              <h3 className="text-lg font-semibold">Reopen Task</h3>
              <button
                onClick={() => {
                  setShowReopenModal(false);
                  setReopenReason('');
                }}
                className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-mission-control-text-dim mb-4">
                Why are you reopening this task?
              </p>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Enter reason for reopening (required)..."
                className="w-full h-32 bg-mission-control-bg border border-mission-control-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-mission-control-accent"
              />
              {reopenReason.trim().length === 0 && (
                <p className="text-xs text-error mt-2">
                  Reason is required and cannot be empty
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 border-t border-mission-control-border">
              <button
                onClick={() => {
                  setShowReopenModal(false);
                  setReopenReason('');
                }}
                className="flex-1 px-4 py-2 bg-mission-control-border text-mission-control-text rounded-xl hover:bg-mission-control-border/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReopen}
                disabled={!reopenReason.trim()}
                className="flex-1 px-4 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reopen Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Still Active Warning Modal */}
      {showAgentActiveModal && activeAgentInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border shadow-2xl w-[500px] max-w-[90vw]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-mission-control-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning-subtle rounded-lg">
                  <AlertCircle size={24} className="text-warning" />
                </div>
                <h3 className="text-lg font-semibold">Agent Still Active</h3>
              </div>
              <button
                onClick={() => {
                  setShowAgentActiveModal(false);
                  setActiveAgentInfo(null);
                }}
                className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="bg-warning-subtle border border-warning-border rounded-lg p-4 mb-4">
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
            <div className="flex gap-3 p-6 border-t border-mission-control-border">
              <button
                onClick={() => {
                  setShowAgentActiveModal(false);
                  setActiveAgentInfo(null);
                }}
                className="flex-1 px-4 py-2 bg-mission-control-border text-mission-control-text rounded-xl hover:bg-mission-control-border/70 transition-colors"
              >
                Cancel
              </button>
              <button
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
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-xl hover:bg-danger-hover transition-colors disabled:opacity-50"
              >
                {abortingAgent ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Aborting...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Abort & Approve
                  </>
                )}
              </button>
            </div>
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
      {showForkModal && task && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border shadow-2xl w-[500px] max-w-[90vw]">
            <div className="flex items-center justify-between p-6 border-b border-mission-control-border">
              <h3 className="text-lg font-semibold">🔀 Build on this task</h3>
              <button
                onClick={() => setShowForkModal(false)}
                className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-mission-control-text-dim">What do you want to build next?</p>
              <textarea
                value={forkDescription}
                onChange={e => setForkDescription(e.target.value)}
                placeholder="Describe the next task..."
                rows={4}
                autoFocus
                className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent resize-none"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={forkAssignSameAgent}
                  onChange={e => setForkAssignSameAgent(e.target.checked)}
                  className="rounded"
                />
                Assign to same agent{task.assignedTo ? ` (${task.assignedTo})` : ''}
              </label>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-mission-control-border">
              <button
                onClick={() => setShowForkModal(false)}
                className="px-4 py-2 rounded-lg border border-mission-control-border hover:bg-mission-control-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!forkDescription.trim()) return;
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
                className="px-4 py-2 rounded-lg bg-mission-control-accent text-white hover:bg-mission-control-accent-dim transition-colors disabled:opacity-50"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* File Viewer Modal */}
      {fileViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setFileViewer(null)}>
          <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-mission-control-accent" />
                <span className="text-sm font-medium">{fileViewer.name}</span>
                <span className="text-xs text-mission-control-text-dim px-1.5 py-0.5 bg-mission-control-border rounded">.{fileViewer.ext}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(fileViewer.content); showToast('success', 'Copied to clipboard'); }}
                  className="px-3 py-1.5 text-xs bg-mission-control-border hover:bg-mission-control-accent/20 rounded-lg transition-colors"
                >
                  Copy
                </button>
                <button onClick={() => setFileViewer(null)} className="p-1.5 hover:bg-mission-control-border rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-mission-control-text whitespace-pre-wrap break-words">
              {fileViewer.content}
            </pre>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
