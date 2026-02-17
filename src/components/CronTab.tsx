import { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw, Play, Trash2, Plus, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';

interface CronJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  schedule: { kind: string; expr?: string; atMs?: number; everyMs?: number; tz?: string };
  sessionTarget: string;
  wakeMode?: string;
  payload: { kind: string; text?: string; message?: string; model?: string };
  state: { nextRunAtMs?: number; lastRunAtMs?: number; lastStatus?: string; lastError?: string; lastDurationMs?: number; runningAtMs?: number };
}

interface CronRun {
  ts: number;
  jobId: string;
  status?: string;
  error?: string;
  summary?: string;
  durationMs?: number;
}

export default function CronTab() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, CronRun[]>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newJob, setNewJob] = useState({ name: '', description: '', scheduleKind: 'cron', expr: '*/5 * * * *', message: '', sessionTarget: 'isolated' });
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gateway.getCronJobs();
      if (result?.jobs) setJobs(result.jobs);
    } catch (e) {
      // 'Failed to load cron jobs:', e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 30000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const loadRuns = async (jobId: string) => {
    try {
      const result = await gateway.getCronRuns(jobId, 20);
      if (result?.entries) setRuns(prev => ({ ...prev, [jobId]: result.entries }));
    } catch (e) {
      // 'Failed to load runs:', e;
    }
  };

  const toggleJob = async (job: CronJob) => {
    try {
      await gateway.updateCronJob(job.id, { enabled: !job.enabled });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, enabled: !j.enabled } : j));
      showToast('success', `${job.name} ${job.enabled ? 'disabled' : 'enabled'}`);
    } catch (e) {
      showToast('error', 'Failed to update job', String(e));
    }
  };

  const runJob = async (jobId: string) => {
    try {
      await gateway.runCronJob(jobId, 'force');
      showToast('success', 'Job triggered');
      setTimeout(loadJobs, 2000);
    } catch (e) {
      showToast('error', 'Failed to run job', String(e));
    }
  };

  const removeJob = async (job: CronJob) => {
    showConfirm({
      title: 'Delete Cron Job',
      message: `Are you sure you want to delete "${job.name}"?`,
      confirmLabel: 'Delete',
      type: 'danger',
    }, async () => {
      try {
        await gateway.removeCronJob(job.id);
        setJobs(prev => prev.filter(j => j.id !== job.id));
        showToast('success', 'Job deleted');
      } catch (e) {
        showToast('error', 'Failed to delete job', String(e));
      }
    });
  };

  const addJob = async () => {
    if (!newJob.name.trim()) { showToast('warning', 'Name required'); return; }
    try {
      const schedule: any = { kind: newJob.scheduleKind };
      if (newJob.scheduleKind === 'cron') schedule.expr = newJob.expr;
      else if (newJob.scheduleKind === 'every') schedule.everyMs = parseInt(newJob.expr) * 60000;
      else if (newJob.scheduleKind === 'at') schedule.atMs = new Date(newJob.expr).getTime();

      await gateway.addCronJob({
        name: newJob.name.trim(),
        description: newJob.description.trim() || undefined,
        enabled: true,
        schedule,
        sessionTarget: newJob.sessionTarget,
        wakeMode: 'now',
        payload: { kind: 'agentTurn', message: newJob.message },
      });
      showToast('success', 'Job created');
      setShowAddModal(false);
      setNewJob({ name: '', description: '', scheduleKind: 'cron', expr: '*/5 * * * *', message: '', sessionTarget: 'isolated' });
      loadJobs();
    } catch (e) {
      showToast('error', 'Failed to create job', String(e));
    }
  };

  const expandJob = (jobId: string) => {
    const next = expandedJob === jobId ? null : jobId;
    setExpandedJob(next);
    if (next && !runs[jobId]) loadRuns(jobId);
  };

  const formatSchedule = (s: CronJob['schedule']) => {
    if (s.kind === 'cron' && s.expr) return s.expr;
    if (s.kind === 'every' && s.everyMs) {
      const mins = s.everyMs / 60000;
      return mins >= 60 ? `Every ${(mins / 60).toFixed(0)}h` : `Every ${mins}m`;
    }
    if (s.kind === 'at' && s.atMs) return `Once at ${new Date(s.atMs).toLocaleString()}`;
    return s.kind;
  };

  const formatTimeAgo = (ms?: number) => {
    if (!ms) return 'Never';
    const diff = Date.now() - ms;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const formatTimeUntil = (ms?: number) => {
    if (!ms) return '—';
    const diff = ms - Date.now();
    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'Imminent';
    if (diff < 3600000) return `In ${Math.floor(diff / 60000)}m`;
    return `In ${Math.floor(diff / 3600000)}h`;
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-clawd-text-dim">{jobs.length} cron job{jobs.length !== 1 ? 's' : ''}</div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-clawd-accent text-white rounded-xl text-sm">
            <Plus size={14} /> Add Job
          </button>
          <button onClick={loadJobs} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 bg-clawd-border rounded-xl text-sm hover:bg-clawd-border/80">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-clawd-text-dim">
          <RefreshCw size={24} className="animate-spin mr-3" /> Loading...
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-clawd-text-dim">
          <Clock size={48} className="mx-auto opacity-20 mb-4" />
          <p>No cron jobs configured</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const isExpanded = expandedJob === job.id;
            const jobRuns = runs[job.id] || [];
            return (
              <div key={job.id} className="bg-clawd-surface border border-clawd-border rounded-xl overflow-hidden">
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-clawd-bg/50 transition-colors"
                  onClick={() => expandJob(job.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expandJob(job.id); } }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${job.name} job - ${isExpanded ? 'collapse' : 'expand'}`}
                >
                  <button
                    onClick={e => { e.stopPropagation(); toggleJob(job); }}
                    className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                      job.enabled ? 'bg-clawd-accent' : 'bg-clawd-border'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      job.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{job.name}</div>
                    <div className="text-xs text-clawd-text-dim flex items-center gap-3">
                      <span>{formatSchedule(job.schedule)}</span>
                      <span>Next: {formatTimeUntil(job.state.nextRunAtMs)}</span>
                      {job.state.lastStatus && (
                        <span className={job.state.lastStatus === 'ok' ? 'text-success' : job.state.lastStatus === 'error' ? 'text-error' : 'text-clawd-text-dim'}>
                          Last: {job.state.lastStatus} {formatTimeAgo(job.state.lastRunAtMs)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); runJob(job.id); }} className="p-2 hover:bg-clawd-border rounded-lg text-clawd-text-dim hover:text-clawd-accent" title="Run now">
                      <Play size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeJob(job); }} className="p-2 hover:bg-error-subtle rounded-lg text-clawd-text-dim hover:text-error" title="Delete">
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronDown size={16} className="text-clawd-text-dim" /> : <ChevronRight size={16} className="text-clawd-text-dim" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-clawd-border pt-3">
                    {job.description && <p className="text-sm text-clawd-text-dim mb-3">{job.description}</p>}
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div><span className="text-clawd-text-dim">Session:</span> {job.sessionTarget}</div>
                      <div><span className="text-clawd-text-dim">Wake:</span> {job.wakeMode || 'now'}</div>
                      <div><span className="text-clawd-text-dim">Payload:</span> {job.payload.kind}</div>
                      {job.state.lastDurationMs && <div><span className="text-clawd-text-dim">Duration:</span> {(job.state.lastDurationMs / 1000).toFixed(1)}s</div>}
                    </div>
                    {job.payload.message && (
                      <div className="mb-4 p-3 bg-clawd-bg rounded-lg text-sm font-mono whitespace-pre-wrap break-words">
                        {job.payload.message}
                      </div>
                    )}
                    {job.state.lastError && (
                      <div className="mb-4 p-3 bg-error-subtle border border-error-border rounded-lg text-sm text-error flex items-start gap-2">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        {job.state.lastError}
                      </div>
                    )}
                    <div className="text-xs text-clawd-text-dim uppercase tracking-wide mb-2">Recent Runs</div>
                    {jobRuns.length === 0 ? (
                      <div className="text-sm text-clawd-text-dim">No runs yet</div>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {jobRuns.map((run, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm py-1">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              run.status === 'ok' ? 'bg-success' : run.status === 'error' ? 'bg-error' : 'bg-clawd-text-dim'
                            }`} />
                            <span className="text-clawd-text-dim w-24 flex-shrink-0">{new Date(run.ts).toLocaleTimeString()}</span>
                            <span className={run.status === 'error' ? 'text-error' : ''}>{run.status}</span>
                            {run.durationMs && <span className="text-clawd-text-dim">{(run.durationMs / 1000).toFixed(1)}s</span>}
                            {run.error && <span className="text-error truncate">{run.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Job Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" 
          onClick={() => setShowAddModal(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setShowAddModal(false); } }}
          role="button"
          tabIndex={0}
          aria-label="Close add cron modal"
        >
          <div 
            className="bg-clawd-surface rounded-xl border border-clawd-border p-6 max-w-lg w-full" 
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="text-lg font-semibold mb-4">Add Cron Job</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="cron-name" className="block text-sm text-clawd-text-dim mb-1">Name</label>
                <input id="cron-name" type="text" value={newJob.name} onChange={e => setNewJob(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent" placeholder="My cron job" aria-label="Cron job name" />
              </div>
              <div>
                <label htmlFor="cron-description" className="block text-sm text-clawd-text-dim mb-1">Description</label>
                <input id="cron-description" type="text" value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent" placeholder="Optional description" aria-label="Cron job description" />
              </div>
              <div>
                <label htmlFor="cron-schedule" className="block text-sm text-clawd-text-dim mb-1">Schedule</label>
                <div className="flex gap-2">
                  <select id="cron-schedule-kind" value={newJob.scheduleKind} onChange={e => setNewJob(p => ({ ...p, scheduleKind: e.target.value }))}
                    className="bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent" aria-label="Schedule type">
                    <option value="cron">Cron</option>
                    <option value="every">Interval (min)</option>
                    <option value="at">One-time</option>
                  </select>
                  <input id="cron-schedule-expr" type="text" value={newJob.expr} onChange={e => setNewJob(p => ({ ...p, expr: e.target.value }))}
                    className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
                    placeholder={newJob.scheduleKind === 'cron' ? '*/5 * * * *' : newJob.scheduleKind === 'every' ? '5' : '2026-01-30T09:00'}
                    aria-label="Schedule expression" />
                </div>
              </div>
              <div>
                <label htmlFor="cron-message" className="block text-sm text-clawd-text-dim mb-1">Message (what to tell the agent)</label>
                <textarea id="cron-message" value={newJob.message} onChange={e => setNewJob(p => ({ ...p, message: e.target.value }))}
                  rows={3} className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent resize-none"
                  placeholder="Check for new emails and summarize..." aria-label="Cron job message" />
              </div>
              <div>
                <label htmlFor="cron-session" className="block text-sm text-clawd-text-dim mb-1">Session Target</label>
                <select id="cron-session-target" value={newJob.sessionTarget} onChange={e => setNewJob(p => ({ ...p, sessionTarget: e.target.value }))}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent" aria-label="Session target">
                  <option value="isolated">Isolated (new session)</option>
                  <option value="main">Main (shared session)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-clawd-border rounded-lg text-sm">Cancel</button>
              <button onClick={addJob} className="flex-1 px-4 py-2 bg-clawd-accent text-white rounded-lg text-sm">Create</button>
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
    </div>
  );
}
