import { useState, useEffect } from 'react';
import { X, Bot, Clock, User, Play, Pause, CheckCircle, XCircle, FileText, Activity, MessageSquare, Calendar, Plus, Check, Eye, AlertCircle } from 'lucide-react';
import { useStore, Task, Subtask } from '../store/store';
import { showToast } from './Toast';

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

interface SessionMessage {
  role: string;
  content: string;
  timestamp?: number;
}

interface WorkerProgress {
  sessionKey?: string;
  messages: SessionMessage[];
  status: 'idle' | 'working' | 'completed' | 'error';
  startedAt?: number;
  completedAt?: number;
}

export default function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { agents, updateTask, spawnAgentForTask } = useStore();
  const [progress, setProgress] = useState<WorkerProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [activeTab, setActiveTab] = useState<'progress' | 'subtasks' | 'review'>('subtasks');

  const assignedAgent = task?.assignedTo ? agents.find(a => a.id === task.assignedTo) : null;
  const isWorking = assignedAgent?.currentTaskId === task?.id;

  useEffect(() => {
    if (!task) {
      setProgress(null);
      return;
    }

    // Load task progress from froggo-db
    const loadProgress = async () => {
      setLoading(true);
      try {
        // Get task with progress field
        const result = await window.clawdbot.tasks.list();
        if (result.success && result.tasks) {
          const fullTask = result.tasks.find((t: any) => t.id === task.id);
          if (fullTask && fullTask.progress) {
            const progressData = typeof fullTask.progress === 'string' 
              ? JSON.parse(fullTask.progress) 
              : fullTask.progress;
            
            const messages = progressData.map((p: any) => ({
              role: 'system',
              content: p.step ? `[${p.step}] ${p.message}` : p.message,
              timestamp: new Date(p.timestamp).getTime(),
            }));
            
            setProgress({
              sessionKey: assignedAgent?.sessionKey,
              messages,
              status: task.status === 'in-progress' ? 'working' : task.status === 'done' ? 'completed' : 'idle',
              startedAt: task.createdAt,
              completedAt: task.status === 'done' ? task.updatedAt : undefined,
            });
          } else {
            setProgress({
              sessionKey: assignedAgent?.sessionKey,
              messages: [],
              status: task.status === 'in-progress' ? 'working' : task.status === 'done' ? 'completed' : 'idle',
            });
          }
        }
      } catch (error) {
        console.error('Failed to load task progress:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
    const interval = setInterval(loadProgress, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [task, assignedAgent, isWorking]);

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

  const handleStart = () => {
    if (task.id && assignedAgent) {
      spawnAgentForTask(task.id);
    }
  };

  const addSubtask = () => {
    if (!newSubtask.trim() || !task) return;
    const subtask: Subtask = {
      id: `st-${Date.now()}`,
      title: newSubtask.trim(),
      completed: false,
    };
    const updatedSubtasks = [...(task.subtasks || []), subtask];
    updateTask(task.id, { subtasks: updatedSubtasks });
    setNewSubtask('');
    showToast('success', 'Subtask added');
  };

  const toggleSubtask = (subtaskId: string) => {
    if (!task) return;
    const updatedSubtasks = (task.subtasks || []).map(st => 
      st.id === subtaskId 
        ? { ...st, completed: !st.completed, completedAt: !st.completed ? Date.now() : undefined }
        : st
    );
    updateTask(task.id, { subtasks: updatedSubtasks });
  };

  const deleteSubtask = (subtaskId: string) => {
    if (!task) return;
    const updatedSubtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
    updateTask(task.id, { subtasks: updatedSubtasks });
  };

  const assignReviewer = (reviewerId: string) => {
    if (!task) return;
    updateTask(task.id, { reviewerId, reviewStatus: 'pending' });
    showToast('info', 'Reviewer assigned');
  };

  const setReviewStatus = (status: Task['reviewStatus']) => {
    if (!task) return;
    updateTask(task.id, { reviewStatus: status });
    if (status === 'approved') {
      showToast('success', 'Review approved!');
    }
  };

  const reviewer = task?.reviewerId ? agents.find(a => a.id === task.reviewerId) : null;
  const subtaskProgress = task?.subtasks 
    ? (task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100 
    : 0;

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
                  <Activity size={14} className="text-yellow-400 animate-spin" />
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
        {(['subtasks', 'progress', 'review'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-clawd-accent border-b-2 border-clawd-accent'
                : 'text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            {tab === 'subtasks' && `Subtasks (${task.subtasks?.length || 0})`}
            {tab === 'progress' && 'Progress'}
            {tab === 'review' && 'Review'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Subtasks Tab */}
        {activeTab === 'subtasks' && (
          <div className="p-4">
            {/* Subtask Progress Bar */}
            {(task.subtasks?.length || 0) > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-clawd-text-dim mb-1">
                  <span>Progress</span>
                  <span>{Math.round(subtaskProgress)}%</span>
                </div>
                <div className="h-2 bg-clawd-bg rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-clawd-accent transition-all duration-300"
                    style={{ width: `${subtaskProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Add Subtask */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                placeholder="Add a subtask..."
                className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
              />
              <button
                onClick={addSubtask}
                disabled={!newSubtask.trim()}
                className="p-2 bg-clawd-accent text-white rounded-lg disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Subtask List */}
            <div className="space-y-2">
              {(task.subtasks || []).map((st) => (
                <div
                  key={st.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    st.completed 
                      ? 'bg-green-500/5 border-green-500/20 opacity-70' 
                      : 'bg-clawd-bg border-clawd-border'
                  }`}
                >
                  <button
                    onClick={() => toggleSubtask(st.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                      st.completed 
                        ? 'bg-green-500 text-white' 
                        : 'border-2 border-clawd-border hover:border-clawd-accent'
                    }`}
                  >
                    {st.completed && <Check size={12} />}
                  </button>
                  <span className={`flex-1 text-sm ${st.completed ? 'line-through text-clawd-text-dim' : ''}`}>
                    {st.title}
                  </span>
                  {st.assignedTo && (
                    <span className="text-xs bg-clawd-border px-2 py-0.5 rounded">
                      {agents.find(a => a.id === st.assignedTo)?.name || st.assignedTo}
                    </span>
                  )}
                  <button
                    onClick={() => deleteSubtask(st.id)}
                    className="p-1 text-clawd-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {(task.subtasks?.length || 0) === 0 && (
                <div className="text-center text-clawd-text-dim py-8">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No subtasks yet</p>
                  <p className="text-xs">Break down this task into smaller steps</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === 'progress' && assignedAgent && (
          <div className="p-4">
            {progress && progress.messages.length > 0 ? (
              <div className="space-y-3">
                {progress.messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const isSystem = msg.role === 'system';
                  
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl ${
                        isSystem 
                          ? 'bg-clawd-accent/10 border border-clawd-accent/30' 
                          : isUser 
                          ? 'bg-blue-500/10 border border-blue-500/30' 
                          : 'bg-clawd-bg border border-clawd-border'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {isSystem ? (
                          <Bot size={14} className="text-clawd-accent" />
                        ) : isUser ? (
                          <User size={14} className="text-blue-400" />
                        ) : (
                          <MessageSquare size={14} className="text-clawd-text-dim" />
                        )}
                        <span className="text-xs font-medium capitalize">{msg.role}</span>
                        {msg.timestamp && (
                          <span className="text-xs text-clawd-text-dim ml-auto">
                            {formatTime(msg.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-clawd-text whitespace-pre-wrap font-mono text-xs">
                        {msg.content.length > 500 
                          ? msg.content.substring(0, 500) + '...' 
                          : msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-clawd-text-dim py-12">
                <Activity size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No activity yet</p>
                {!isWorking && assignedAgent && (
                  <p className="text-xs mt-1">Click "Start Work" to begin</p>
                )}
              </div>
            )}
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
              onClick={() => updateTask(task.id, { status: 'done' })}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
            >
              <CheckCircle size={16} />
              Mark Done
            </button>
          )}
          {task.status === 'done' && (
            <button
              onClick={() => updateTask(task.id, { status: 'todo' })}
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
