import { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw, Play, Trash2, Plus, ChevronDown, ChevronRight, AlertCircle, Edit2 } from 'lucide-react';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { formatTimeAgo, formatTimeUntil } from '../utils/formatting';

interface TaskTemplate {
  title?: string;
  description?: string;
  planningNotes?: string;
  assignTo?: string;
  priority?: string;
  project?: string;
  tags?: string[];
  subtasks?: string[];
}

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
  taskTemplate?: TaskTemplate;
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
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [newJob, setNewJob] = useState({
    name: '', description: '', scheduleKind: 'cron', expr: '*/5 * * * *', message: '', sessionTarget: 'isolated',
    mode: 'task' as 'task' | 'message',
    taskTitle: '', taskPlanningNotes: '', taskAssignTo: '', taskPriority: 'p2', taskSubtasks: '',
  });
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cron');
      const data = await res.json();
      if (data?.jobs) setJobs(data.jobs as CronJob[]);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 30000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  // Runs are not stored server-side yet — stub empty
  const loadRuns = (_jobId: string) => {
    setRuns(prev => ({ ...prev, [_jobId]: [] }));
  };

  const toggleJob = async (job: CronJob) => {
    try {
      await fetch('/api/cron', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, enabled: !job.enabled }),
      });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, enabled: !j.enabled } : j));
      showToast('success', `${job.name} ${job.enabled ? 'disabled' : 'enabled'}`);
    } catch (e) {
      showToast('error', 'Failed to update job', String(e));
    }
  };

  const runJob = async (jobId: string) => {
    try {
      await fetch('/api/cron?action=run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId }),
      });
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
        await fetch(`/api/cron?id=${job.id}`, { method: 'DELETE' });
        setJobs(prev => prev.filter(j => j.id !== job.id));
        showToast('success', 'Job deleted');
      } catch (e) {
        showToast('error', 'Failed to delete job', String(e));
      }
    });
  };

  const openEdit = (job: CronJob) => {
    const s = job.schedule;
    const scheduleKind = s.kind;
    const expr = s.kind === 'cron' ? (s.expr ?? '') :
                 s.kind === 'every' ? String((s.everyMs ?? 0) / 60000) :
                 s.kind === 'at' && s.atMs ? new Date(s.atMs).toISOString().slice(0, 16) : '';
    const tt = job.taskTemplate;
    setNewJob({
      name: job.name,
      description: job.description ?? '',
      scheduleKind,
      expr,
      message: job.payload.message ?? job.payload.text ?? '',
      sessionTarget: job.sessionTarget,
      mode: tt ? 'task' : 'message',
      taskTitle: tt?.title ?? '',
      taskPlanningNotes: tt?.planningNotes ?? '',
      taskAssignTo: tt?.assignTo ?? job.sessionTarget ?? '',
      taskPriority: tt?.priority ?? 'p2',
      taskSubtasks: tt?.subtasks?.join('\n') ?? '',
    });
    setEditingJobId(job.id);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingJobId(null);
    setNewJob({
      name: '', description: '', scheduleKind: 'cron', expr: '*/5 * * * *', message: '', sessionTarget: 'isolated',
      mode: 'task', taskTitle: '', taskPlanningNotes: '', taskAssignTo: '', taskPriority: 'p2', taskSubtasks: '',
    });
  };

  const addJob = async () => {
    if (!newJob.name.trim()) { showToast('warning', 'Name required'); return; }
    try {
      const schedule: Record<string, unknown> = { kind: newJob.scheduleKind };
      if (newJob.scheduleKind === 'cron') schedule.expr = newJob.expr;
      else if (newJob.scheduleKind === 'every') schedule.everyMs = parseInt(newJob.expr) * 60000;
      else if (newJob.scheduleKind === 'at') schedule.atMs = new Date(newJob.expr).getTime();

      const taskTemplate = newJob.mode === 'task' ? {
        title: newJob.taskTitle.trim() || newJob.name.trim(),
        planningNotes: newJob.taskPlanningNotes.trim() || newJob.message.trim() || undefined,
        assignTo: newJob.taskAssignTo.trim() || undefined,
        priority: newJob.taskPriority,
        tags: ['scheduled', 'cron'],
        subtasks: newJob.taskSubtasks.trim()
          ? newJob.taskSubtasks.trim().split('\n').map(s => s.trim()).filter(Boolean)
          : undefined,
      } : undefined;

      const jobData = {
        name: newJob.name.trim(),
        description: newJob.description.trim() || undefined,
        schedule,
        sessionTarget: newJob.mode === 'task' ? (newJob.taskAssignTo.trim() || 'isolated') : newJob.sessionTarget,
        payload: { kind: newJob.mode === 'task' ? 'task' : 'agentTurn', message: newJob.message },
        taskTemplate,
      };

      if (editingJobId) {
        await fetch('/api/cron', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingJobId, ...jobData }),
        });
        showToast('success', 'Job updated');
      } else {
        await fetch('/api/cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jobData),
        });
        showToast('success', 'Job created');
      }
      closeModal();
      loadJobs();
    } catch (e) {
      showToast('error', editingJobId ? 'Failed to update job' : 'Failed to create job', String(e));
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


  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-mission-control-text-dim">{jobs.length} cron job{jobs.length !== 1 ? 's' : ''}</div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-sm">
            <Plus size={14} /> Add Job
          </button>
          <button onClick={loadJobs} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-border rounded-lg text-sm hover:bg-mission-control-border/80">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-mission-control-text-dim">
          <RefreshCw size={24} className="animate-spin mr-3" /> Loading...
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-mission-control-text-dim">
          <Clock size={48} className="mx-auto opacity-20 mb-4" />
          <p>No cron jobs configured</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const isExpanded = expandedJob === job.id;
            const jobRuns = runs[job.id] || [];
            return (
              <div key={job.id} className="bg-mission-control-surface border border-mission-control-border rounded-lg overflow-hidden">
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-mission-control-bg/50 transition-colors"
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
                      job.enabled ? 'bg-mission-control-accent' : 'bg-mission-control-border'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-mission-control-text shadow transition-transform ${
                      job.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {job.name}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${job.taskTemplate ? 'bg-mission-control-accent/15 text-mission-control-accent' : 'bg-mission-control-border text-mission-control-text-dim'}`}>
                        {job.taskTemplate ? 'Task' : 'Message'}
                      </span>
                    </div>
                    <div className="text-xs text-mission-control-text-dim flex items-center gap-3">
                      <span>{formatSchedule(job.schedule)}</span>
                      <span>Next: {formatTimeUntil(job.state.nextRunAtMs)}</span>
                      {job.state.lastStatus && (
                        <span className={job.state.lastStatus === 'ok' ? 'text-success' : job.state.lastStatus === 'error' ? 'text-error' : 'text-mission-control-text-dim'}>
                          Last: {job.state.lastStatus} {formatTimeAgo(job.state.lastRunAtMs)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); runJob(job.id); }} className="p-2 hover:bg-mission-control-border rounded-lg text-mission-control-text-dim hover:text-mission-control-accent" title="Run now">
                      <Play size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); openEdit(job); }} className="p-2 hover:bg-mission-control-border rounded-lg text-mission-control-text-dim hover:text-mission-control-text" title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeJob(job); }} className="p-2 hover:bg-error-subtle rounded-lg text-mission-control-text-dim hover:text-error" title="Delete">
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronDown size={16} className="text-mission-control-text-dim" /> : <ChevronRight size={16} className="text-mission-control-text-dim" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-mission-control-border pt-3">
                    {job.description && <p className="text-sm text-mission-control-text-dim mb-3">{job.description}</p>}
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div><span className="text-mission-control-text-dim">Session:</span> {job.sessionTarget}</div>
                      <div><span className="text-mission-control-text-dim">Wake:</span> {job.wakeMode || 'now'}</div>
                      <div><span className="text-mission-control-text-dim">Payload:</span> {job.payload.kind}</div>
                      {job.state.lastDurationMs && <div><span className="text-mission-control-text-dim">Duration:</span> {(job.state.lastDurationMs / 1000).toFixed(1)}s</div>}
                    </div>
                    {job.payload.message && (
                      <div className="mb-4 p-3 bg-mission-control-bg rounded-lg text-sm font-mono whitespace-pre-wrap break-words">
                        {job.payload.message}
                      </div>
                    )}
                    {job.state.lastError && (
                      <div className="mb-4 p-3 bg-error-subtle border border-error-border rounded-lg text-sm text-error flex items-start gap-2">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        {job.state.lastError}
                      </div>
                    )}
                    <div className="text-xs text-mission-control-text-dim uppercase tracking-wide mb-2">Recent Runs</div>
                    {jobRuns.length === 0 ? (
                      <div className="text-sm text-mission-control-text-dim">No runs recorded</div>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {jobRuns.map((run, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm py-1">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              run.status === 'ok' ? 'bg-success' : run.status === 'error' ? 'bg-error' : 'bg-mission-control-text-dim'
                            }`} />
                            <span className="text-mission-control-text-dim w-24 flex-shrink-0">{new Date(run.ts).toLocaleTimeString()}</span>
                            <span className={run.status === 'error' ? 'text-error' : ''}>{run.status}</span>
                            {run.durationMs && <span className="text-mission-control-text-dim">{(run.durationMs / 1000).toFixed(1)}s</span>}
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
          onClick={closeModal}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } }}
          role="button"
          tabIndex={0}
          aria-label="Close add cron modal"
        >
          <div
            className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6 max-w-lg w-full"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            role="presentation"
          >
            <h2 className="text-lg font-semibold mb-4">{editingJobId ? 'Edit Cron Job' : 'Add Cron Job'}</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="cron-name" className="block text-sm text-mission-control-text-dim mb-1">Name</label>
                <input id="cron-name" type="text" value={newJob.name} onChange={e => setNewJob(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent" placeholder="My cron job" aria-label="Cron job name" />
              </div>
              <div>
                <label htmlFor="cron-description" className="block text-sm text-mission-control-text-dim mb-1">Description</label>
                <input id="cron-description" type="text" value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent" placeholder="Optional description" aria-label="Cron job description" />
              </div>
              <div>
                <label htmlFor="cron-schedule-kind" className="block text-sm text-mission-control-text-dim mb-1">Schedule</label>
                <div className="flex gap-2">
                  <select id="cron-schedule-kind" value={newJob.scheduleKind} onChange={e => setNewJob(p => ({ ...p, scheduleKind: e.target.value }))}
                    className="bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent" aria-label="Schedule type">
                    <option value="cron">Cron</option>
                    <option value="every">Interval (min)</option>
                    <option value="at">One-time</option>
                  </select>
                  <input id="cron-schedule-expr" type="text" value={newJob.expr} onChange={e => setNewJob(p => ({ ...p, expr: e.target.value }))}
                    className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
                    placeholder={newJob.scheduleKind === 'cron' ? '*/5 * * * *' : newJob.scheduleKind === 'every' ? '5' : '2026-01-30T09:00'}
                    aria-label="Schedule expression" />
                </div>
              </div>
              {/* Mode toggle */}
              <div>
                <label className="block text-sm text-mission-control-text-dim mb-1">Execution Mode</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNewJob(p => ({ ...p, mode: 'task' }))}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${newJob.mode === 'task' ? 'bg-mission-control-accent/20 text-mission-control-accent border-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'}`}>
                    Create Task
                  </button>
                  <button type="button" onClick={() => setNewJob(p => ({ ...p, mode: 'message' }))}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${newJob.mode === 'message' ? 'bg-mission-control-accent/20 text-mission-control-accent border-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'}`}>
                    Message Agent
                  </button>
                </div>
                <p className="text-xs text-mission-control-text-dim mt-1">
                  {newJob.mode === 'task' ? 'Creates a task in the pipeline with planning notes, subtasks, and agent assignment.' : 'Sends a message directly to an agent session (bypasses task pipeline).'}
                </p>
              </div>

              {newJob.mode === 'task' ? (
                <>
                  <div>
                    <label htmlFor="cron-task-title" className="block text-sm text-mission-control-text-dim mb-1">Task Title <span className="text-xs opacity-60">({'{date}'} = current date)</span></label>
                    <input id="cron-task-title" type="text" value={newJob.taskTitle} onChange={e => setNewJob(p => ({ ...p, taskTitle: e.target.value }))}
                      className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
                      placeholder="HR Nightly Training — {date}" />
                  </div>
                  <div>
                    <label htmlFor="cron-task-planning" className="block text-sm text-mission-control-text-dim mb-1">Planning Notes / Instructions</label>
                    <textarea id="cron-task-planning" value={newJob.taskPlanningNotes} onChange={e => setNewJob(p => ({ ...p, taskPlanningNotes: e.target.value }))}
                      rows={3} className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent resize-none"
                      placeholder="Visit aitmpl.com, discover new skills, check team health..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cron-task-assign" className="block text-sm text-mission-control-text-dim mb-1">Assign To</label>
                      <select id="cron-task-assign" value={newJob.taskAssignTo} onChange={e => setNewJob(p => ({ ...p, taskAssignTo: e.target.value }))}
                        className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent">
                        <option value="">Auto (Clara assigns)</option>
                        <option value="mission-control">Mission Control</option>
                        <option value="hr">HR</option>
                        <option value="coder">Coder</option>
                        <option value="inbox">Inbox</option>
                        <option value="designer">Designer</option>
                        <option value="clara">Clara (QC)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cron-task-priority" className="block text-sm text-mission-control-text-dim mb-1">Priority</label>
                      <select id="cron-task-priority" value={newJob.taskPriority} onChange={e => setNewJob(p => ({ ...p, taskPriority: e.target.value }))}
                        className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent">
                        <option value="p0">P0 — Critical</option>
                        <option value="p1">P1 — High</option>
                        <option value="p2">P2 — Normal</option>
                        <option value="p3">P3 — Low</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="cron-task-subtasks" className="block text-sm text-mission-control-text-dim mb-1">Subtasks <span className="text-xs opacity-60">(one per line)</span></label>
                    <textarea id="cron-task-subtasks" value={newJob.taskSubtasks} onChange={e => setNewJob(p => ({ ...p, taskSubtasks: e.target.value }))}
                      rows={3} className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent resize-none font-mono"
                      placeholder={"Check team health metrics\nUpdate drifted soul files\nDocument new skills found"} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="cron-message" className="block text-sm text-mission-control-text-dim mb-1">Message (what to tell the agent)</label>
                    <textarea id="cron-message" value={newJob.message} onChange={e => setNewJob(p => ({ ...p, message: e.target.value }))}
                      rows={3} className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent resize-none"
                      placeholder="Check for new emails and summarize..." />
                  </div>
                  <div>
                    <label htmlFor="cron-session-target" className="block text-sm text-mission-control-text-dim mb-1">Session Target</label>
                    <select id="cron-session-target" value={newJob.sessionTarget} onChange={e => setNewJob(p => ({ ...p, sessionTarget: e.target.value }))}
                      className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent">
                      <option value="isolated">Isolated (new session)</option>
                      <option value="main">Main (shared session)</option>
                      <option value="mission-control">mission-control</option>
                      <option value="inbox">inbox</option>
                      <option value="chief">chief</option>
                      <option value="coder">coder</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 px-4 py-2 bg-mission-control-border rounded-lg text-sm">Cancel</button>
              <button onClick={addJob} className="flex-1 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm">{editingJobId ? 'Save' : 'Create'}</button>
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
