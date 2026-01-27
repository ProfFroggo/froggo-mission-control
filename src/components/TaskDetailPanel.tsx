import { useState, useEffect, useCallback } from 'react';
import { X, Bot, Clock, User, Play, Pause, CheckCircle, XCircle, FileText, Activity, MessageSquare, Calendar, Plus, Check, Eye, AlertCircle, Loader2, RefreshCw, GripVertical, ChevronRight } from 'lucide-react';
import { useStore, Task, Subtask, TaskActivity } from '../store/store';
import { showToast } from './Toast';

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

export default function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { agents, updateTask, spawnAgentForTask, loadSubtasksForTask, addSubtask, updateSubtask, deleteSubtask, loadTaskActivity, logTaskActivity } = useStore();
  const [loading, setLoading] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [activeTab, setActiveTab] = useState<'subtasks' | 'activity' | 'review'>('subtasks');
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const assignedAgent = task?.assignedTo ? agents.find(a => a.id === task.assignedTo) : null;
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

  useEffect(() => {
    if (!task) {
      setSubtasks([]);
      setActivities([]);
      return;
    }

    // Load both on mount
    loadSubtasks();
    loadActivity();

    // Poll for updates while task is in progress
    const interval = setInterval(() => {
      if (task.status === 'in-progress') {
        loadSubtasks();
        loadActivity();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [task, loadSubtasks, loadActivity]);

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

  const handleStart = async () => {
    if (task.id && assignedAgent) {
      await logTaskActivity(task.id, 'task_started', `Task started by ${assignedAgent.name}`, assignedAgent.id);
      spawnAgentForTask(task.id);
      loadActivity();
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
                {agents.filter(a => a.id !== task.assignedTo).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-clawd-border">
        {(['subtasks', 'activity', 'review'] as const).map((tab) => (
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

        {/* Review Tab */}
        {activeTab === 'review' && (
          <div className="p-4">
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
          {task.status !== 'done' && (
            <button
              onClick={() => {
                updateTask(task.id, { status: 'done' });
                logTaskActivity(task.id, 'task_completed', 'Task marked as done');
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
            >
              <CheckCircle size={16} />
              Mark Done
            </button>
          )}
          {task.status === 'done' && (
            <button
              onClick={() => {
                updateTask(task.id, { status: 'todo' });
                logTaskActivity(task.id, 'task_reopened', 'Task reopened');
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-clawd-border text-clawd-text rounded-xl hover:bg-clawd-border/70 transition-colors"
            >
              <XCircle size={16} />
              Reopen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
