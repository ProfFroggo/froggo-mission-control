import { useState, useEffect, useCallback } from 'react';
import { Code, GitCommit, GitBranch, Terminal, Zap, Clock, DollarSign, RefreshCw, Play, Pause, ChevronRight, FileCode, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { showToast } from './Toast';

interface DevSession {
  id: string;
  agent: string;
  task: string;
  status: 'running' | 'idle' | 'completed' | 'failed';
  startedAt: number;
  model: string;
  tokens: number;
  cost: number;
}

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
  files: number;
}

interface DevTask {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'review' | 'done';
  assignee: string;
  commits: number;
  tokens: number;
  duration: number;
}

export default function CodeAgentDashboard() {
  const [sessions, setSessions] = useState<DevSession[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load recent git commits
      const gitResult = await (window as any).clawdbot?.exec?.run(
        'git log --oneline -20 --pretty=format:"%h|%s|%an|%at" 2>/dev/null || echo ""'
      ).catch(() => ({ stdout: '' }));
      
      if (gitResult?.stdout) {
        const lines = gitResult.stdout.trim().split('\n').filter(Boolean);
        const parsedCommits: GitCommit[] = lines.map((line: string) => {
          const [hash, message, author, timestamp] = line.split('|');
          return {
            hash,
            message,
            author,
            timestamp: parseInt(timestamp) * 1000,
            files: 0, // Would need additional git command to get this
          };
        });
        setCommits(parsedCommits.slice(0, 10));
      }

      // Load sessions list
      const sessionsResult = await (window as any).clawdbot?.sessions?.list().catch(() => null);
      if (sessionsResult?.sessions) {
        const devSessions: DevSession[] = sessionsResult.sessions
          .filter((s: any) => s.kind === 'other' || s.label?.includes('coder'))
          .slice(0, 5)
          .map((s: any) => ({
            id: s.sessionId,
            agent: s.label || 'Agent',
            task: s.displayName || 'Unknown task',
            status: 'idle' as const,
            startedAt: s.updatedAt,
            model: s.model || 'unknown',
            tokens: s.totalTokens || 0,
            cost: 0,
          }));
        setSessions(devSessions);
        setTotalTokens(devSessions.reduce((sum, s) => sum + s.tokens, 0));
      }

      // Load kanban tasks that are dev-related
      const tasksResult = await (window as any).clawdbot?.tasks?.list().catch(() => null);
      if (tasksResult?.tasks) {
        const devTasks: DevTask[] = tasksResult.tasks
          .filter((t: any) => t.project?.includes('Dev') || t.assignedTo === 'coder' || t.assignedTo === 'chief')
          .map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assignee: t.assignedTo || 'Unassigned',
            commits: 0,
            tokens: 0,
            duration: Date.now() - new Date(t.createdAt).getTime(),
          }));
        setTasks(devTasks);
      }

    } catch (error) {
      console.error('Failed to load dev data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [loadData]);

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const statusColors = {
    running: 'bg-green-500',
    idle: 'bg-yellow-500',
    completed: 'bg-blue-500',
    failed: 'bg-red-500',
  };

  const taskStatusColors = {
    pending: 'bg-gray-500',
    'in-progress': 'bg-yellow-500',
    review: 'bg-purple-500',
    done: 'bg-green-500',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Code size={24} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Code Agent Dashboard</h1>
              <p className="text-sm text-clawd-text-dim">
                Development activity and execution tracking
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-clawd-bg rounded-xl p-4">
            <div className="flex items-center gap-2 text-clawd-text-dim mb-1">
              <Terminal size={14} />
              <span className="text-xs">Active Sessions</span>
            </div>
            <div className="text-2xl font-bold">{sessions.filter(s => s.status === 'running').length}</div>
          </div>
          <div className="bg-clawd-bg rounded-xl p-4">
            <div className="flex items-center gap-2 text-clawd-text-dim mb-1">
              <GitCommit size={14} />
              <span className="text-xs">Commits Today</span>
            </div>
            <div className="text-2xl font-bold">
              {commits.filter(c => Date.now() - c.timestamp < 86400000).length}
            </div>
          </div>
          <div className="bg-clawd-bg rounded-xl p-4">
            <div className="flex items-center gap-2 text-clawd-text-dim mb-1">
              <Zap size={14} />
              <span className="text-xs">Total Tokens</span>
            </div>
            <div className="text-2xl font-bold">{(totalTokens / 1000).toFixed(1)}k</div>
          </div>
          <div className="bg-clawd-bg rounded-xl p-4">
            <div className="flex items-center gap-2 text-clawd-text-dim mb-1">
              <CheckCircle size={14} />
              <span className="text-xs">Tasks Done</span>
            </div>
            <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'done').length}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Recent Commits */}
          <div className="bg-clawd-surface rounded-2xl border border-clawd-border overflow-hidden">
            <div className="p-4 border-b border-clawd-border flex items-center gap-2">
              <GitCommit size={18} className="text-clawd-accent" />
              <h2 className="font-semibold">Recent Commits</h2>
            </div>
            <div className="divide-y divide-clawd-border max-h-80 overflow-y-auto">
              {commits.length === 0 ? (
                <div className="p-4 text-center text-clawd-text-dim">No commits found</div>
              ) : (
                commits.map((commit) => (
                  <div key={commit.hash} className="p-3 hover:bg-clawd-bg/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <code className="text-xs bg-clawd-border px-1.5 py-0.5 rounded text-clawd-accent font-mono">
                        {commit.hash}
                      </code>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{commit.message}</div>
                        <div className="text-xs text-clawd-text-dim mt-1">
                          {commit.author} • {formatTimeAgo(commit.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dev Tasks */}
          <div className="bg-clawd-surface rounded-2xl border border-clawd-border overflow-hidden">
            <div className="p-4 border-b border-clawd-border flex items-center gap-2">
              <FileCode size={18} className="text-clawd-accent" />
              <h2 className="font-semibold">Dev Tasks</h2>
            </div>
            <div className="divide-y divide-clawd-border max-h-80 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="p-4 text-center text-clawd-text-dim">No dev tasks</div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="p-3 hover:bg-clawd-bg/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${taskStatusColors[task.status]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{task.title}</div>
                        <div className="text-xs text-clawd-text-dim mt-1">
                          {task.assignee} • {task.status}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-clawd-text-dim" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="mt-6 bg-clawd-surface rounded-2xl border border-clawd-border overflow-hidden">
          <div className="p-4 border-b border-clawd-border flex items-center gap-2">
            <Terminal size={18} className="text-clawd-accent" />
            <h2 className="font-semibold">Agent Sessions</h2>
          </div>
          <div className="divide-y divide-clawd-border">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-clawd-text-dim">No active sessions</div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="p-4 hover:bg-clawd-bg/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${statusColors[session.status]}`} />
                    <div className="flex-1">
                      <div className="font-medium">{session.agent}</div>
                      <div className="text-sm text-clawd-text-dim truncate">{session.task}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-clawd-text-dim">{(session.tokens / 1000).toFixed(1)}k tokens</div>
                      <div className="text-xs text-clawd-text-dim">{session.model}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
