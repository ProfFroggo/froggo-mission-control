import { useState, useEffect, useCallback } from 'react';
import { Button, Select, TextArea, TextField, Flex } from '@radix-ui/themes';
import { Clock, RefreshCw, Play, Trash2, Plus, ChevronDown, ChevronRight, AlertCircle, Edit2 } from 'lucide-react';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { formatTimeAgo, formatTimeUntil } from '../utils/formatting';

function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, , dow] = parts;
  const fmt12 = (h: string, m: string) => {
    const hNum = parseInt(h), mNum = parseInt(m) || 0;
    const suffix = hNum < 12 ? 'AM' : 'PM';
    const h12 = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum;
    return mNum > 0 ? `${h12}:${String(mNum).padStart(2, '0')} ${suffix}` : `${h12}:00 ${suffix}`;
  };
  const DAY_NAMES: Record<string, string> = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' };
  // Every N minutes
  if (min.startsWith('*/') && hour === '*') return `Every ${min.slice(2)} minutes`;
  // Every N hours
  if (min === '0' && hour.startsWith('*/') && dom === '*') return `Every ${hour.slice(2)} hours`;
  // Daily at time
  if (dom === '*' && dow === '*' && !hour.includes('*') && !min.includes('*'))
    return `Daily at ${fmt12(hour, min)}`;
  // Weekdays
  if (dom === '*' && dow === '1-5' && !hour.includes('*') && !min.includes('*'))
    return `Weekdays at ${fmt12(hour, min)}`;
  // Weekends
  if (dom === '*' && (dow === '0,6' || dow === '6,0') && !hour.includes('*') && !min.includes('*'))
    return `Weekends at ${fmt12(hour, min)}`;
  // Specific weekday
  if (dom === '*' && DAY_NAMES[dow] && !hour.includes('*') && !min.includes('*'))
    return `${DAY_NAMES[dow]}s at ${fmt12(hour, min)}`;
  // Monthly on Nth
  if (dow === '*' && !dom.includes('*') && !hour.includes('*') && !min.includes('*'))
    return `Monthly on ${dom} at ${fmt12(hour, min)}`;
  return expr;
}

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
    if (s.kind === 'cron' && s.expr) return cronToHuman(s.expr);
    if (s.kind === 'every' && s.everyMs) {
      const mins = s.everyMs / 60000;
      return mins >= 60 ? `Every ${(mins / 60).toFixed(0)}h` : `Every ${mins}m`;
    }
    if (s.kind === 'at' && s.atMs) return `Once at ${new Date(s.atMs).toLocaleString()}`;
    return s.kind;
  };


  return (
    <div className="flex-1 overflow-auto p-6">
      <Flex align="center" justify="between" className="mb-4">
        <div className="text-sm text-mission-control-text-dim">{jobs.length} cron job{jobs.length !== 1 ? 's' : ''}</div>
        <Flex gap="2">
          <Button variant="solid" size="2" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Add Job
          </Button>
          <Button variant="surface" color="gray" size="2" onClick={loadJobs} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </Flex>
      </Flex>

      {loading && jobs.length === 0 ? (
        <Flex align="center" justify="center" className="py-12 text-mission-control-text-dim">
          <RefreshCw size={24} className="animate-spin mr-3" /> Loading...
        </Flex>
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
              <div key={job.id} className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden hover:border-mission-control-accent/30 transition-colors">
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
                    type="button"
                    role="switch"
                    aria-checked={job.enabled}
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
                    <div className="text-sm font-semibold text-mission-control-text truncate flex items-center gap-2">
                      {job.name}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${job.taskTemplate ? 'bg-mission-control-accent/15 text-mission-control-accent' : 'bg-mission-control-border text-mission-control-text-dim'}`}>
                        {job.taskTemplate ? 'Task' : 'Message'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="font-mono text-xs text-mission-control-text-dim bg-mission-control-bg px-2 py-0.5 rounded">{formatSchedule(job.schedule)}</span>
                      <span className="text-[10px] text-mission-control-text-dim tabular-nums">Next: {formatTimeUntil(job.state.nextRunAtMs)}</span>
                      {job.state.lastStatus && (
                        <span className={`text-[10px] tabular-nums ${job.state.lastStatus === 'ok' ? 'text-[var(--color-success)]' : job.state.lastStatus === 'error' ? 'text-[var(--color-error)]' : 'text-mission-control-text-dim'}`}>
                          Last: {job.state.lastStatus} {formatTimeAgo(job.state.lastRunAtMs)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Flex align="center" gap="1">
                    <button onClick={e => { e.stopPropagation(); runJob(job.id); }} aria-label="Run job now" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                      <Play size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); openEdit(job); }} aria-label="Edit job" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeJob(job); }} aria-label="Delete job" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-error)]/70 hover:text-[var(--color-error)] hover:bg-mission-control-surface transition-colors">
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronDown size={16} className="text-mission-control-text-dim" /> : <ChevronRight size={16} className="text-mission-control-text-dim" />}
                  </Flex>
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
                      <Flex align="start" gap="2" className="mb-4 p-3 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg text-sm text-[var(--color-error)]">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        {job.state.lastError}
                      </Flex>
                    )}
                    <div className="text-xs text-mission-control-text-dim uppercase tracking-wide mb-2">Recent Runs</div>
                    {jobRuns.length === 0 ? (
                      <div className="text-sm text-mission-control-text-dim">No runs recorded</div>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {jobRuns.map((run, i) => (
                          <Flex key={i} align="center" gap="3" className="text-sm py-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              run.status === 'ok' ? 'bg-[var(--color-success)]' : run.status === 'error' ? 'bg-[var(--color-error)]' : 'bg-mission-control-text-dim'
                            }`} />
                            <span className="text-mission-control-text-dim w-24 flex-shrink-0">{new Date(run.ts).toLocaleTimeString()}</span>
                            <span className={run.status === 'error' ? 'text-[var(--color-error)]' : ''}>{run.status}</span>
                            {run.durationMs && <span className="text-mission-control-text-dim">{(run.durationMs / 1000).toFixed(1)}s</span>}
                            {run.error && <span className="text-[var(--color-error)] truncate">{run.error}</span>}
                          </Flex>
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
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeModal}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } }}
          role="button"
          tabIndex={0}
          aria-label="Close add cron modal"
        >
          <div
            className="bg-mission-control-surface rounded-2xl border border-mission-control-border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
              <h2 className="text-base font-semibold">{editingJobId ? 'Edit Cron Job' : 'Add Cron Job'}</h2>
            </div>
            <div className="px-6 py-4 flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label htmlFor="cron-name" className="block text-sm text-mission-control-text-dim mb-1">Name</label>
                <TextField.Root id="cron-name" type="text" value={newJob.name} onChange={e => setNewJob(p => ({ ...p, name: e.target.value }))}
                  placeholder="My cron job" aria-label="Cron job name" className="w-full" />
              </div>
              <div>
                <label htmlFor="cron-description" className="block text-sm text-mission-control-text-dim mb-1">Description</label>
                <TextField.Root id="cron-description" type="text" value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description" aria-label="Cron job description" className="w-full" />
              </div>
              <div>
                <label htmlFor="cron-schedule-kind" className="block text-sm text-mission-control-text-dim mb-1">Schedule</label>
                <Flex gap="2">
                  <Select.Root value={newJob.scheduleKind || 'cron'} onValueChange={(val) => setNewJob(p => ({ ...p, scheduleKind: val }))}>
                    <Select.Trigger id="cron-schedule-kind" aria-label="Schedule type" />
                    <Select.Content>
                      <Select.Item value="cron">Cron</Select.Item>
                      <Select.Item value="every">Interval (min)</Select.Item>
                      <Select.Item value="at">One-time</Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <TextField.Root id="cron-schedule-expr" type="text" value={newJob.expr} onChange={e => setNewJob(p => ({ ...p, expr: e.target.value }))}
                    placeholder={newJob.scheduleKind === 'cron' ? '*/5 * * * *' : newJob.scheduleKind === 'every' ? '5' : '2026-01-30T09:00'}
                    aria-label="Schedule expression" className="flex-1" />
                </Flex>
              </div>
              {/* Mode toggle */}
              <div>
                <label className="block text-sm text-mission-control-text-dim mb-1">Execution Mode</label>
                <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
                  <button
                    type="button"
                    onClick={() => setNewJob(p => ({ ...p, mode: 'task' }))}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium text-center transition-colors ${newJob.mode === 'task' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
                  >
                    Create Task
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewJob(p => ({ ...p, mode: 'message' }))}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium text-center transition-colors ${newJob.mode === 'message' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
                  >
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
                    <TextField.Root id="cron-task-title" type="text" value={newJob.taskTitle} onChange={e => setNewJob(p => ({ ...p, taskTitle: e.target.value }))}
                      placeholder="HR Nightly Training — {date}" className="w-full" />
                  </div>
                  <div>
                    <label htmlFor="cron-task-planning" className="block text-sm text-mission-control-text-dim mb-1">Planning Notes / Instructions</label>
                    <TextArea id="cron-task-planning" value={newJob.taskPlanningNotes} onChange={e => setNewJob(p => ({ ...p, taskPlanningNotes: e.target.value }))}
                      rows={3} placeholder="Visit aitmpl.com, discover new skills, check team health..." className="w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cron-task-assign" className="block text-sm text-mission-control-text-dim mb-1">Assign To</label>
                      <Select.Root value={newJob.taskAssignTo || '__auto__'} onValueChange={(val) => setNewJob(p => ({ ...p, taskAssignTo: val === '__auto__' ? '' : val }))}>
                        <Select.Trigger id="cron-task-assign" className="w-full" />
                        <Select.Content>
                          <Select.Item value="__auto__">Auto (Clara assigns)</Select.Item>
                          <Select.Item value="mission-control">Mission Control</Select.Item>
                          <Select.Item value="hr">HR</Select.Item>
                          <Select.Item value="coder">Coder</Select.Item>
                          <Select.Item value="inbox">Inbox</Select.Item>
                          <Select.Item value="designer">Designer</Select.Item>
                          <Select.Item value="clara">Clara (QC)</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    </div>
                    <div>
                      <label htmlFor="cron-task-priority" className="block text-sm text-mission-control-text-dim mb-1">Priority</label>
                      <Select.Root value={newJob.taskPriority || 'p2'} onValueChange={(val) => setNewJob(p => ({ ...p, taskPriority: val }))}>
                        <Select.Trigger id="cron-task-priority" className="w-full" />
                        <Select.Content>
                          <Select.Item value="p0">P0 — Critical</Select.Item>
                          <Select.Item value="p1">P1 — High</Select.Item>
                          <Select.Item value="p2">P2 — Normal</Select.Item>
                          <Select.Item value="p3">P3 — Low</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="cron-task-subtasks" className="block text-sm text-mission-control-text-dim mb-1">Subtasks <span className="text-xs opacity-60">(one per line)</span></label>
                    <TextArea id="cron-task-subtasks" value={newJob.taskSubtasks} onChange={e => setNewJob(p => ({ ...p, taskSubtasks: e.target.value }))}
                      rows={3} className="font-mono w-full" placeholder={"Check team health metrics\nUpdate drifted soul files\nDocument new skills found"} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="cron-message" className="block text-sm text-mission-control-text-dim mb-1">Message (what to tell the agent)</label>
                    <TextArea id="cron-message" value={newJob.message} onChange={e => setNewJob(p => ({ ...p, message: e.target.value }))}
                      rows={3} placeholder="Check for new emails and summarize..." className="w-full" />
                  </div>
                  <div>
                    <label htmlFor="cron-session-target" className="block text-sm text-mission-control-text-dim mb-1">Session Target</label>
                    <Select.Root value={newJob.sessionTarget || 'isolated'} onValueChange={(val) => setNewJob(p => ({ ...p, sessionTarget: val }))}>
                      <Select.Trigger id="cron-session-target" className="w-full" />
                      <Select.Content>
                        <Select.Item value="isolated">Isolated (new session)</Select.Item>
                        <Select.Item value="main">Main (shared session)</Select.Item>
                        <Select.Item value="mission-control">mission-control</Select.Item>
                        <Select.Item value="inbox">inbox</Select.Item>
                        <Select.Item value="chief">chief</Select.Item>
                        <Select.Item value="coder">coder</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </div>
                </>
              )}
            </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
              <Button variant="surface" color="gray" size="2" onClick={closeModal}>Cancel</Button>
              <Button variant="solid" size="2" onClick={addJob}>{editingJobId ? 'Save' : 'Create'}</Button>
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
