import { useState, useEffect, useCallback } from 'react';
import { X, Bot, Clock, User, Play, Pause, CheckCircle, XCircle, FileText, Activity, MessageSquare, Calendar, Plus, Check, Eye, AlertCircle, Loader2, RefreshCw, GripVertical, ChevronRight, HandMetal, Upload, Download, Trash2, Paperclip, Search } from 'lucide-react';
import { useStore, Task, Subtask, TaskActivity } from '../store/store';
import { showToast } from './Toast';

interface TaskAttachment {
  id: number;
  task_id: string;
  file_path: string;
  filename: string;
  file_size: number;
  mime_type: string;
  category: string;
  uploaded_by: string;
  uploaded_at: number;
}

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

export default function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { agents, updateTask, spawnAgentForTask, loadSubtasksForTask, addSubtask, updateSubtask, deleteSubtask, loadTaskActivity, logTaskActivity } = useStore();
  const [loading, setLoading] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [activeTab, setActiveTab] = useState<'subtasks' | 'planning' | 'activity' | 'files' | 'review'>('subtasks');
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [poking, setPoking] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

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

  // Load attachments from DB
  const loadAttachments = useCallback(async () => {
    if (!task) return;
    setLoadingAttachments(true);
    try {
      const result = await (window as any).clawdbot.tasks.attachments.list(task.id);
      if (result.success) {
        setAttachments(result.attachments);
      }
    } catch (err) {
      console.error('Failed to load attachments:', err);
    } finally {
      setLoadingAttachments(false);
    }
  }, [task]);

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

    // Poll for updates while task is in progress
    const interval = setInterval(() => {
      if (task.status === 'in-progress') {
        loadSubtasks();
        loadActivity();
        loadAttachments();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [task, loadSubtasks, loadActivity, loadAttachments]);

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
    // Task must be in 'review' status
    if (task.status !== 'review') {
      reasons.push('Task must be reviewed first (move to review status)');
    }
    
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

  const handleStart = async () => {
    if (task.id && assignedAgent) {
      await logTaskActivity(task.id, 'task_started', `Task started by ${assignedAgent.name}`, assignedAgent.id);
      spawnAgentForTask(task.id);
      loadActivity();
    }
  };

  const handlePoke = async () => {
    if (!task) return;
    setPoking(true);
    try {
      const result = await (window as any).clawdbot.tasks.poke(task.id, task.title);
      if (result.success) {
        showToast('info', '🫵 Poked!', 'Brain will respond with status update');
        await logTaskActivity(task.id, 'poked', 'Task poked for status update');
        loadActivity();
      } else {
        showToast('error', 'Poke failed', result.error || 'Could not reach Gateway');
      }
    } catch (err: any) {
      showToast('error', 'Poke failed', err.message);
    } finally {
      setPoking(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !task) return;
    console.log('[TaskDetail] Adding subtask:', { taskId: task.id, title: newSubtask.trim() });
    const result = await addSubtask(task.id, newSubtask.trim());
    console.log('[TaskDetail] addSubtask result:', result);
    if (result) {
      setSubtasks([...subtasks, result]);
      setNewSubtask('');
      showToast('success', 'Subtask added');
    } else {
      showToast('error', 'Failed to add subtask - check DevTools console for details');
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
      setSubtasks(subtasks.map(s => 
        s.id === subtaskId 
          ? { ...s, completed: !s.completed, completedAt: !s.completed ? Date.now() : undefined }
          : s
      ));
      loadActivity(); // Refresh activity to show the update
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!task) return;
    const success = await deleteSubtask(task.id, subtaskId);
    if (success) {
      setSubtasks(subtasks.filter(s => s.id !== subtaskId));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setUploadingFile(true);
    
    try {
      // For now, we'll copy file to deliverables directory
      const deliverablePath = `${(window as any).require('os').homedir()}/clawd/deliverables/${task.id}`;
      const filePath = `${deliverablePath}/${file.name}`;
      
      // Create directory if needed via electron
      await (window as any).clawdbot.exec.run(`mkdir -p "${deliverablePath}"`);
      
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        
        // Write file
        await (window as any).clawdbot.fs.writeBase64(filePath, base64);
        
        // Add attachment record
        const result = await (window as any).clawdbot.tasks.attachments.add(
          task.id,
          filePath,
          'deliverable',
          'user'
        );
        
        if (result.success) {
          setAttachments([result.attachment, ...attachments]);
          showToast('success', 'File attached', file.name);
        } else {
          showToast('error', 'Failed to attach file', result.error);
        }
        setUploadingFile(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showToast('error', 'Upload failed', err.message);
      setUploadingFile(false);
    }
    
    // Reset input
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!task) return;
    
    const result = await (window as any).clawdbot.tasks.attachments.delete(attachmentId);
    if (result.success) {
      setAttachments(attachments.filter(a => a.id !== attachmentId));
      showToast('success', 'Attachment deleted');
      loadActivity(); // Refresh to show deletion
    } else {
      showToast('error', 'Failed to delete', result.error);
    }
  };

  const handleOpenFile = async (filePath: string) => {
    const result = await (window as any).clawdbot.tasks.attachments.open(filePath);
    if (!result.success) {
      showToast('error', 'Failed to open file', result.error);
    }
  };

  const handleAutoDetect = async () => {
    if (!task) return;
    setLoadingAttachments(true);
    
    const result = await (window as any).clawdbot.tasks.attachments.autoDetect(task.id);
    if (result.success) {
      showToast('success', 'Auto-detection complete');
      loadAttachments();
      loadActivity();
    } else {
      showToast('error', 'Auto-detection failed', result.error);
    }
    setLoadingAttachments(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('text/')) return '📄';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gz')) return '📦';
    if (mimeType.includes('json')) return '{}';
    if (mimeType.includes('javascript') || mimeType.includes('typescript')) return '📜';
    if (mimeType.includes('shellscript')) return '⚙️';
    return '📎';
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

  // Activity icon based on action type
  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'task_started': return <Play size={12} className="text-green-400" />;
      case 'task_completed': return <CheckCircle size={12} className="text-green-400" />;
      case 'subtask_added': return <Plus size={12} className="text-blue-400" />;
      case 'subtask_completed': return <Check size={12} className="text-green-400" />;
      case 'subtask_uncompleted': return <XCircle size={12} className="text-yellow-400" />;
      case 'subtask_deleted': return <X size={12} className="text-red-400" />;
      case 'reviewer_assigned': return <Eye size={12} className="text-purple-400" />;
      case 'review_status': return <Eye size={12} className="text-purple-400" />;
      case 'agent_message': return <Bot size={12} className="text-clawd-accent" />;
      case 'progress': return <Activity size={12} className="text-yellow-400" />;
      default: return <MessageSquare size={12} className="text-clawd-text-dim" />;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-clawd-surface border-l border-clawd-border shadow-2xl z-50 flex flex-col animate-slide-in">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-bg">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 text-xs rounded-lg ${
                task.status === 'done' ? 'bg-green-500/20 text-green-400' :
                task.status === 'in-progress' ? 'bg-yellow-500/20 text-yellow-400' :
                task.status === 'review' ? 'bg-purple-500/20 text-purple-400' :
                task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {task.status.replace('-', ' ')}
              </span>
              <span className="text-xs text-clawd-text-dim">{task.project}</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">{task.title}</h2>
            {task.description && (
              <p className="text-sm text-clawd-text-dim">{task.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Overview */}
        {subtasks.length > 0 && (
          <div className="mb-4 p-3 bg-clawd-bg/50 rounded-xl border border-clawd-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-clawd-text-dim">
                {completedSubtasks} / {subtasks.length} subtasks
              </span>
            </div>
            <div className="h-3 bg-clawd-border rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-clawd-accent to-green-500 transition-all duration-500 ease-out"
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-clawd-text-dim">
              <span>{Math.round(subtaskProgress)}% complete</span>
              {isWorking && <span className="text-yellow-400 animate-pulse">Agent working...</span>}
            </div>
          </div>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-xs text-clawd-text-dim">
          <div className="flex items-center gap-1">
            <Calendar size={14} />
            Created {formatTime(task.createdAt)}
          </div>
          <div className="flex items-center gap-1">
            <Clock size={14} />
            Updated {formatTime(task.updatedAt)}
          </div>
        </div>
      </div>

      {/* Agent Assignment */}
      <div className="p-6 border-b border-clawd-border">
        <div className="grid grid-cols-2 gap-4">
          {/* Worker */}
          <div>
            <h3 className="text-xs font-medium text-clawd-text-dim mb-2">Worker Agent</h3>
            {assignedAgent ? (
              <div className="flex items-center gap-2 p-2 bg-clawd-bg rounded-lg border border-clawd-border">
                <div className="text-lg">{assignedAgent.avatar || '🤖'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{assignedAgent.name}</div>
                </div>
                {!isWorking && task.status !== 'done' && (
                  <button
                    onClick={handleStart}
                    className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    title="Start Work"
                  >
                    <Play size={12} />
                  </button>
                )}
                {isWorking && (
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                )}
              </div>
            ) : isRemoteAgent ? (
              <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <div className="text-lg">🌐</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate capitalize">{task.assignedTo}</div>
                  <div className="text-xs text-purple-400">Remote Agent</div>
                </div>
              </div>
            ) : (
              <div className="p-2 bg-clawd-bg rounded-lg border border-dashed border-clawd-border text-center text-clawd-text-dim text-xs">
                Not assigned
              </div>
            )}
          </div>

          {/* Reviewer */}
          <div>
            <h3 className="text-xs font-medium text-clawd-text-dim mb-2">Review Agent</h3>
            {reviewer ? (
              <div className="flex items-center gap-2 p-2 bg-clawd-bg rounded-lg border border-clawd-border">
                <div className="text-lg">{reviewer.avatar || '👀'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{reviewer.name}</div>
                </div>
                {task.reviewStatus && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    task.reviewStatus === 'approved' ? 'bg-green-500/20 text-green-400' :
                    task.reviewStatus === 'needs-changes' ? 'bg-red-500/20 text-red-400' :
                    task.reviewStatus === 'in-review' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {task.reviewStatus}
                  </span>
                )}
              </div>
            ) : (
              <select
                onChange={(e) => e.target.value && assignReviewer(e.target.value)}
                className="w-full p-2 bg-clawd-bg rounded-lg border border-dashed border-clawd-border text-xs"
              >
                <option value="">Assign reviewer...</option>
                {agents
                  .filter(a => a.id !== task.assignedTo && !['main', 'froggo'].includes(a.id))
                  .map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      {/* IMPORTANT: Planning tab must ALWAYS be visible, regardless of task status.
          It serves as a historical record and should never be hidden when task is complete. */}
      <div className="flex border-b border-clawd-border">
        {(['subtasks', 'planning', 'activity', 'files', 'review'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-clawd-accent border-b-2 border-clawd-accent'
                : 'text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            {tab === 'subtasks' && (
              <span className="flex items-center justify-center gap-2">
                Subtasks
                {subtasks.length > 0 && (
                  <span className="bg-clawd-border px-1.5 py-0.5 rounded text-xs">
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
                  <span className="bg-clawd-border px-1.5 py-0.5 rounded text-xs">
                    {activities.length}
                  </span>
                )}
              </span>
            )}
            {tab === 'files' && (
              <span className="flex items-center justify-center gap-2">
                Files
                {attachments.length > 0 && (
                  <span className="bg-clawd-border px-1.5 py-0.5 rounded text-xs">
                    {attachments.length}
                  </span>
                )}
              </span>
            )}
            {tab === 'review' && 'Review'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Subtasks Tab */}
        {activeTab === 'subtasks' && (
          <div className="p-4">
            {/* Add Subtask */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                placeholder="Add a subtask..."
                className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
              />
              <button
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
                className="p-2 bg-clawd-accent text-white rounded-lg disabled:opacity-50 hover:bg-clawd-accent-dim transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Loading State */}
            {loadingSubtasks && subtasks.length === 0 && (
              <div className="flex items-center justify-center py-8 text-clawd-text-dim">
                <Loader2 size={24} className="animate-spin mr-2" />
                Loading subtasks...
              </div>
            )}

            {/* Subtask List */}
            <div className="space-y-2">
              {subtasks.map((st, idx) => (
                <div
                  key={st.id}
                  className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    st.completed 
                      ? 'bg-green-500/5 border-green-500/20' 
                      : 'bg-clawd-bg border-clawd-border hover:border-clawd-accent/50'
                  }`}
                >
                  <button
                    onClick={() => handleToggleSubtask(st.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${
                      st.completed 
                        ? 'bg-green-500 text-white' 
                        : 'border-2 border-clawd-border hover:border-clawd-accent'
                    }`}
                  >
                    {st.completed && <Check size={12} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${st.completed ? 'line-through text-clawd-text-dim' : ''}`}>
                      {st.title}
                    </span>
                    {st.description && (
                      <p className="text-xs text-clawd-text-dim mt-0.5">{st.description}</p>
                    )}
                    {st.completedAt && (
                      <p className="text-xs text-green-400/60 mt-0.5">
                        Completed {formatTime(st.completedAt)}
                        {st.completedBy && ` by ${agents.find(a => a.id === st.completedBy)?.name || st.completedBy}`}
                      </p>
                    )}
                  </div>
                  {st.assignedTo && (
                    <span className="text-xs bg-clawd-border px-2 py-0.5 rounded flex-shrink-0">
                      {agents.find(a => a.id === st.assignedTo)?.name || st.assignedTo}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteSubtask(st.id)}
                    className="p-1 text-clawd-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              {!loadingSubtasks && subtasks.length === 0 && (
                <div className="text-center text-clawd-text-dim py-8">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No subtasks yet</p>
                  <p className="text-xs">Break down this task into smaller steps</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Planning Tab - ALWAYS VISIBLE regardless of task status (historical record) */}
        {activeTab === 'planning' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText size={16} className="text-clawd-accent" />
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
                  (window as any).clawdbot?.tasks?.update(task.id, { 
                    planningNotes: e.target.value 
                  }).catch(() => {});
                }, 1000);
              }}
              placeholder="Planning notes, brainstorming, research..."
              className="w-full h-64 bg-clawd-bg border border-clawd-border rounded-xl p-4 text-sm resize-none focus:outline-none focus:border-clawd-accent font-mono"
              style={{ minHeight: '16rem' }}
            />
            
            <p className="text-xs text-clawd-text-dim mt-2">
              💡 Use this space for planning, brainstorming, research notes, or any thoughts about this task.
              Changes are auto-saved after 1 second.
            </p>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Activity Log</h3>
              <button
                onClick={loadActivity}
                disabled={loadingActivity}
                className="p-1.5 text-clawd-text-dim hover:text-clawd-text rounded-lg hover:bg-clawd-border transition-colors"
              >
                <RefreshCw size={14} className={loadingActivity ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingActivity && activities.length === 0 && (
              <div className="flex items-center justify-center py-8 text-clawd-text-dim">
                <Loader2 size={24} className="animate-spin mr-2" />
                Loading activity...
              </div>
            )}

            <div className="space-y-1">
              {activities.map((act, idx) => (
                <div
                  key={act.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-clawd-bg/50 transition-colors"
                >
                  <div className="mt-1 p-1 rounded bg-clawd-bg">
                    {getActivityIcon(act.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{act.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-clawd-text-dim">
                        {formatTime(act.timestamp)}
                      </span>
                      {act.agentId && (
                        <span className="text-xs text-clawd-accent">
                          {agents.find(a => a.id === act.agentId)?.name || act.agentId}
                        </span>
                      )}
                    </div>
                    {act.details && (
                      <pre className="mt-1 text-xs bg-clawd-bg p-2 rounded overflow-x-auto max-h-32">
                        {act.details}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
              
              {!loadingActivity && activities.length === 0 && (
                <div className="text-center text-clawd-text-dim py-8">
                  <Activity size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No activity yet</p>
                  <p className="text-xs">Activity will appear here as work progresses</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Paperclip size={16} className="text-clawd-accent" />
                Task Attachments
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleAutoDetect}
                  disabled={loadingAttachments}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-clawd-border hover:bg-clawd-accent/20 rounded-lg transition-colors"
                  title="Auto-detect agent output files"
                >
                  {loadingAttachments ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  Auto-detect
                </button>
                <label className="flex items-center gap-2 px-3 py-1.5 text-xs bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim cursor-pointer transition-colors">
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
              <div className="mb-4 p-4 bg-clawd-bg/50 rounded-xl border border-dashed border-clawd-border text-center">
                <Paperclip size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm text-clawd-text-dim">
                  No attachments yet. Upload deliverables, screenshots, or reference files.
                </p>
                <p className="text-xs text-clawd-text-dim mt-1">
                  Click Upload or use Auto-detect to find agent output files
                </p>
              </div>
            )}

            {/* Loading State */}
            {loadingAttachments && attachments.length === 0 && (
              <div className="flex items-center justify-center py-8 text-clawd-text-dim">
                <Loader2 size={24} className="animate-spin mr-2" />
                Loading attachments...
              </div>
            )}

            {/* Attachments List */}
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group flex items-center gap-3 p-3 bg-clawd-bg rounded-xl border border-clawd-border hover:border-clawd-accent/50 transition-all"
                >
                  <div className="text-2xl flex-shrink-0">
                    {getFileIcon(attachment.mime_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{attachment.filename}</div>
                    <div className="flex items-center gap-2 text-xs text-clawd-text-dim mt-0.5">
                      <span>{formatFileSize(attachment.file_size)}</span>
                      <span>•</span>
                      <span className="px-1.5 py-0.5 bg-clawd-border rounded text-xs">
                        {attachment.category}
                      </span>
                      <span>•</span>
                      <span>{formatTime(attachment.uploaded_at)}</span>
                      {attachment.uploaded_by && attachment.uploaded_by !== 'user' && (
                        <>
                          <span>•</span>
                          <span className="text-clawd-accent">
                            {agents.find(a => a.id === attachment.uploaded_by)?.name || attachment.uploaded_by}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-clawd-text-dim/50 mt-0.5 truncate" title={attachment.file_path}>
                      {attachment.file_path}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenFile(attachment.file_path)}
                      className="p-2 hover:bg-clawd-accent/20 rounded-lg transition-colors"
                      title="Open file"
                    >
                      <Download size={16} className="text-clawd-accent" />
                    </button>
                    <button
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete attachment"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats Summary */}
            {attachments.length > 0 && (
              <div className="mt-4 p-3 bg-clawd-bg/50 rounded-xl border border-clawd-border">
                <div className="flex items-center justify-between text-xs text-clawd-text-dim">
                  <span>
                    {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
                  </span>
                  <span>
                    Total: {formatFileSize(attachments.reduce((sum, a) => sum + (a.file_size || 0), 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review Tab */}
        {activeTab === 'review' && (
          <div className="p-4">
            {/* Quick Approve/Reject Actions (when in review status) */}
            {task.status === 'review' && task.reviewStatus !== 'approved' && (
              <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-yellow-400" />
                  <span className="font-medium text-yellow-400">Awaiting Review</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setReviewStatus('approved');
                      showToast('success', 'Task approved! You can now mark it as done.');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
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
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <XCircle size={16} />
                    Request Changes
                  </button>
                </div>
              </div>
            )}

            {/* Approved Notice */}
            {task.reviewStatus === 'approved' && (
              <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="font-medium text-green-400">Review Approved</span>
                </div>
                <p className="mt-2 text-sm text-clawd-text-dim">
                  This task has been approved and can now be marked as done.
                </p>
              </div>
            )}

            {reviewer ? (
              <div className="space-y-4">
                {/* Review Status */}
                <div className="p-4 bg-clawd-bg rounded-xl border border-clawd-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={16} className="text-clawd-accent" />
                    <span className="font-medium">Review Status</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['pending', 'in-review', 'needs-changes', 'approved'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setReviewStatus(status)}
                        className={`p-2 rounded-lg text-sm transition-colors ${
                          task.reviewStatus === status
                            ? status === 'approved' ? 'bg-green-500 text-white' :
                              status === 'needs-changes' ? 'bg-red-500 text-white' :
                              status === 'in-review' ? 'bg-yellow-500 text-white' :
                              'bg-clawd-accent text-white'
                            : 'bg-clawd-border hover:bg-clawd-border/80'
                        }`}
                      >
                        {status.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Review Notes */}
                <div className="p-4 bg-clawd-bg rounded-xl border border-clawd-border">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-clawd-accent" />
                    <span className="font-medium">Review Notes</span>
                  </div>
                  <textarea
                    value={task.reviewNotes || ''}
                    onChange={(e) => updateTask(task.id, { reviewNotes: e.target.value })}
                    placeholder="Add notes from review..."
                    className="w-full h-24 bg-clawd-surface border border-clawd-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-clawd-accent"
                  />
                </div>

                {/* Pre-approval Checklist */}
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-yellow-400" />
                    <span className="font-medium text-yellow-400">Pre-Approval Checklist</span>
                  </div>
                  <div className="text-sm text-clawd-text-dim space-y-1">
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
              <div className="text-center text-clawd-text-dim py-12">
                <Eye size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No reviewer assigned</p>
                <p className="text-xs">Assign a review agent to enable pre-approval checks</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-6 border-t border-clawd-border bg-clawd-bg">
        <div className="flex gap-2">
          {/* Poke Button - Ask Brain for status update */}
          {task.status !== 'done' && (
            <button
              onClick={handlePoke}
              disabled={poking}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-clawd-border text-clawd-text rounded-xl hover:bg-clawd-accent/20 hover:text-clawd-accent transition-colors disabled:opacity-50"
              title="Poke Brain for status update"
            >
              {poking ? <Loader2 size={16} className="animate-spin" /> : <span className="text-lg">🫵</span>}
              Poke
            </button>
          )}
          {task.status !== 'done' && (
            <div className="flex-1 flex flex-col gap-1">
              <button
                onClick={() => {
                  if (validation.allowed) {
                    updateTask(task.id, { status: 'done' });
                    logTaskActivity(task.id, 'task_completed', 'Task marked as done');
                  } else {
                    showToast('error', 'Cannot mark as done', validation.reasons.join('; '));
                  }
                }}
                disabled={!validation.allowed}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                  validation.allowed
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-500/50 text-gray-400 cursor-not-allowed'
                }`}
                title={validation.allowed ? 'Mark task as done' : validation.reasons.join('\n')}
              >
                {!validation.allowed && <AlertCircle size={16} />}
                <CheckCircle size={16} />
                Mark Done
              </button>
              {!validation.allowed && (
                <div className="text-xs text-red-400 px-2">
                  {validation.reasons[0]}
                </div>
              )}
            </div>
          )}
          {task.status === 'done' && (
            <button
              onClick={() => setShowReopenModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-clawd-border text-clawd-text rounded-xl hover:bg-clawd-border/70 transition-colors"
            >
              <XCircle size={16} />
              Reopen
            </button>
          )}
          
          {/* Reopen Reason Modal */}
          {showReopenModal && (
            <>
              <div className="fixed inset-0 bg-black/50 z-[200]" onClick={() => setShowReopenModal(false)} />
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-clawd-surface border border-clawd-border rounded-xl p-6 shadow-2xl z-[210] w-96">
                <h3 className="text-lg font-semibold mb-4">Reopen Task</h3>
                <p className="text-sm text-clawd-text-dim mb-4">Why are you reopening this task?</p>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g., Found a bug, Requirements changed, Needs more work..."
                  className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg text-sm mb-4 resize-none h-24"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowReopenModal(false);
                      setReopenReason('');
                    }}
                    className="flex-1 px-4 py-2 bg-clawd-border text-clawd-text rounded-lg hover:bg-clawd-border/70"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const reason = reopenReason.trim() || 'No reason provided';
                      updateTask(task.id, { status: 'todo' });
                      logTaskActivity(task.id, 'task_reopened', `Task reopened: ${reason}`);
                      showToast('info', 'Task reopened');
                      setShowReopenModal(false);
                      setReopenReason('');
                    }}
                    className="flex-1 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim"
                  >
                    Reopen Task
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
