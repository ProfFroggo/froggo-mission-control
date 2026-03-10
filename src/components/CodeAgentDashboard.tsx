import { useState, useEffect, useCallback } from 'react';
import { Code, GitCommit, Terminal, Zap, RefreshCw, ChevronRight, FileCode, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';
import CronTab from './CronTab';
import DebugTab from './DebugTab';
import EmptyState from './EmptyState';
import { createLogger } from '../utils/logger';
import { sessionApi, taskApi } from '../lib/api';

const logger = createLogger('CodeAgent');

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cron' | 'debug'>('dashboard');
  const [sessions, setSessions] = useState<DevSession[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Git commits — no REST equivalent for exec.run
      console.warn('Not implemented: exec.run for git log');
      setCommits([]);

      // Load sessions list via REST API
      const sessionsResult = await sessionApi.getAll().catch((err: any) => { logger.error('Failed to list sessions:', err); return null; });
      if (sessionsResult?.sessions || Array.isArray(sessionsResult)) {
        const sessionsList = sessionsResult?.sessions || sessionsResult || [];
        const devSessions: DevSession[] = sessionsList
          .filter((s: any) => {
            const key = s.key || s.sessionKey || '';
            const label = s.label || '';
            return key.includes('main') ||
                   key.includes('subagent') ||
                   key.includes('discord') ||
                   label.includes('coder') ||
                   label.includes('mission-control') ||
                   label.includes('worker') ||
                   s.kind === 'other';
          })
          .slice(0, 10)
          .map((s: any) => ({
            id: s.sessionId || s.key,
            agent: s.label || s.channel || 'Agent',
            task: s.displayName || s.key?.split(':').pop() || 'Session',
            status: (Date.now() - (s.updatedAt || 0) < 300000 ? 'running' : 'idle') as 'running' | 'idle',
            startedAt: s.updatedAt || s.createdAt,
            model: s.model || 'unknown',
            tokens: s.totalTokens || 0,
            cost: 0,
          }));
        setSessions(devSessions);
        setTotalTokens(devSessions.reduce((sum, s) => sum + s.tokens, 0));
      }

      // Load kanban tasks via REST API
      const tasksResult = await taskApi.getAll().catch((err: any) => { logger.error('Failed to list tasks:', err); return null; });
      const tasksList = tasksResult?.tasks || (Array.isArray(tasksResult) ? tasksResult : []);
      if (tasksList.length > 0) {
        const devTasks: DevTask[] = tasksList
          .filter((t: any) => {
            const project = t.project || '';
            const assignee = t.assigned_to || t.assignedTo || '';
            return project.toLowerCase().includes('dev') ||
                   project.toLowerCase().includes('x/twitter') ||
                   assignee === 'coder' ||
                   assignee === 'chief' ||
                   assignee === 'main';
          })
          .map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assignee: t.assigned_to || t.assignedTo || 'Unassigned',
            commits: 0,
            tokens: 0,
            duration: Date.now() - (t.created_at || Date.now()),
          }));
        setTasks(devTasks);
      }

    } catch (err) {
      logger.error('Failed to load dev data:', err);
      setError('Could not load dev data. Ensure sessions are active.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [loadData]);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const statusColors = {
    running: 'bg-warning',
    idle: 'bg-success',
    completed: 'bg-success',
    failed: 'bg-error',
  };

  const taskStatusColors = {
    pending: 'bg-mission-control-bg0',
    'in-progress': 'bg-warning',
    review: 'bg-review',
    done: 'bg-success',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Read-only notice */}
      <div className="flex items-center gap-2 px-4 py-2 bg-info-subtle border-b border-mission-control-border text-info text-xs">
        <Info size={13} />
        <span>Dev module — read-only diagnostics. The Cron Jobs tab manages scheduled jobs; all other panels are display-only.</span>
      </div>
      {/* Header */}
      <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info-subtle rounded-xl">
              <Code size={24} className="text-info" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Code Agent Dashboard</h1>
              <p className="text-sm text-mission-control-text-dim">
                Development activity and execution tracking
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-2">
          {(['dashboard', 'cron', 'debug'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {tab === 'dashboard' && '💻 Dashboard'}
              {tab === 'cron' && '⏰ Cron Jobs'}
              {tab === 'debug' && '🐛 Debug'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'cron' && <CronTab />}
      {activeTab === 'debug' && <DebugTab />}

      {activeTab === 'dashboard' && loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-mission-control-text-dim" />
        </div>
      )}

      {activeTab === 'dashboard' && !loading && error && (
        <div className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            icon={AlertCircle}
            title="Unable to load dev data"
            description={error}
            action={{ label: 'Retry', onClick: loadData }}
          />
        </div>
      )}

      {activeTab === 'dashboard' && !loading && !error && <>
      {/* Stats Bar */}
      <div className="px-6 pt-4 pb-2 bg-mission-control-surface border-b border-mission-control-border">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-mission-control-bg rounded-xl p-4">
            <div className="flex items-center gap-2 text-mission-control-text-dim mb-1">
              <Terminal size={14} />
              <span className="text-xs">Active Sessions</span>
            </div>
            <div className="text-2xl font-bold">{sessions.filter(s => s.status === 'running').length}</div>
          </div>
          <div className="bg-mission-control-bg rounded-xl p-4">
            <div className="flex items-center gap-2 text-mission-control-text-dim mb-1">
              <GitCommit size={14} />
              <span className="text-xs">Commits Today</span>
            </div>
            <div className="text-2xl font-bold">
              {commits.filter(c => Date.now() - c.timestamp < 86400000).length}
            </div>
          </div>
          <div className="bg-mission-control-bg rounded-xl p-4">
            <div className="flex items-center gap-2 text-mission-control-text-dim mb-1">
              <Zap size={14} />
              <span className="text-xs">Total Tokens</span>
            </div>
            <div className="text-2xl font-bold">{(totalTokens / 1000).toFixed(1)}k</div>
          </div>
          <div className="bg-mission-control-bg rounded-xl p-4">
            <div className="flex items-center gap-2 text-mission-control-text-dim mb-1">
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
          <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border overflow-hidden">
            <div className="p-4 border-b border-mission-control-border flex items-center gap-2">
              <GitCommit size={16} className="text-mission-control-accent" />
              <h2 className="font-semibold">Recent Commits</h2>
            </div>
            <div className="divide-y divide-mission-control-border max-h-80 overflow-y-auto">
              {commits.length === 0 ? (
                <div className="p-4 text-center text-mission-control-text-dim">No commits found</div>
              ) : (
                commits.map((commit) => (
                  <div key={commit.hash} className="p-3 hover:bg-mission-control-bg/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <code className="text-xs bg-mission-control-border px-1.5 py-0.5 rounded text-mission-control-accent font-mono">
                        {commit.hash}
                      </code>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{commit.message}</div>
                        <div className="text-xs text-mission-control-text-dim mt-1">
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
          <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border overflow-hidden">
            <div className="p-4 border-b border-mission-control-border flex items-center gap-2">
              <FileCode size={16} className="text-mission-control-accent" />
              <h2 className="font-semibold">Dev Tasks</h2>
            </div>
            <div className="divide-y divide-mission-control-border max-h-80 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="p-4 text-center text-mission-control-text-dim">No dev tasks</div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="p-3 hover:bg-mission-control-bg/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${taskStatusColors[task.status]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{task.title}</div>
                        <div className="text-xs text-mission-control-text-dim mt-1">
                          {task.assignee} • {task.status}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-mission-control-text-dim" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="mt-6 bg-mission-control-surface rounded-2xl border border-mission-control-border overflow-hidden">
          <div className="p-4 border-b border-mission-control-border flex items-center gap-2">
            <Terminal size={16} className="text-mission-control-accent" />
            <h2 className="font-semibold">Agent Sessions</h2>
          </div>
          <div className="divide-y divide-mission-control-border">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-mission-control-text-dim">No active sessions</div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="p-4 hover:bg-mission-control-bg/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${statusColors[session.status]}`} />
                    <div className="flex-1">
                      <div className="font-medium">{session.agent}</div>
                      <div className="text-sm text-mission-control-text-dim truncate">{session.task}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-mission-control-text-dim">{(session.tokens / 1000).toFixed(1)}k tokens</div>
                      <div className="text-xs text-mission-control-text-dim">{session.model}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </>}
    </div>
  );
}
