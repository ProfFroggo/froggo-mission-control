import { useState, useEffect } from 'react';
import { X, Bot, Clock, User, Play, Pause, CheckCircle, XCircle, FileText, Activity, MessageSquare, Calendar } from 'lucide-react';
import { useStore, Task } from '../store/store';

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
        <h3 className="text-sm font-medium mb-3">Assignment</h3>
        {assignedAgent ? (
          <div className="flex items-center justify-between p-3 bg-clawd-bg rounded-xl border border-clawd-border">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{assignedAgent.avatar || '🤖'}</div>
              <div>
                <div className="font-medium">{assignedAgent.name}</div>
                <div className="text-xs text-clawd-text-dim capitalize">{assignedAgent.status}</div>
              </div>
            </div>
            
            {!isWorking && task.status !== 'done' && (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Play size={14} />
                Start Work
              </button>
            )}
            
            {isWorking && (
              <div className="flex items-center gap-2 text-yellow-400 animate-pulse">
                <Activity size={16} className="animate-spin" />
                <span className="text-sm font-medium">Working...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-clawd-bg rounded-xl border border-dashed border-clawd-border text-center text-clawd-text-dim text-sm">
            No agent assigned
          </div>
        )}
      </div>

      {/* Worker Progress */}
      {assignedAgent && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 pb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Activity size={16} />
              Worker Progress
              {loading && <span className="text-xs text-clawd-text-dim">(loading...)</span>}
            </h3>
          </div>

          {progress && progress.messages.length > 0 ? (
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
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
            <div className="flex-1 flex items-center justify-center text-clawd-text-dim">
              <div className="text-center">
                <Activity size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No activity yet</p>
                {!isWorking && assignedAgent && (
                  <p className="text-xs mt-1">Click "Start Work" to begin</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
