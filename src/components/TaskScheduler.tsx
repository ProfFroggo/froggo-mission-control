import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatDueDate } from '../utils/formatting';
import { ListTodo, Clock, Plus, Trash2, Edit2, RefreshCw, X, Check, User, Repeat } from 'lucide-react';
import { useStore, type Task, type TaskStatus, type TaskPriority, type TaskRecurrence } from '../store/store';
import { taskApi } from '../lib/api';
import { showToast } from './Toast';
import IconBadge from './IconBadge';

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badgeClass: string; iconColor: string }> = {
  p0: { label: 'P0 — Urgent', badgeClass: 'bg-error/10 text-error',     iconColor: 'text-error bg-error/10' },
  p1: { label: 'P1 — High',   badgeClass: 'bg-warning/10 text-warning',  iconColor: 'text-warning bg-warning/10' },
  p2: { label: 'P2 — Medium', badgeClass: 'bg-info/10 text-info',        iconColor: 'text-info bg-info/10' },
  p3: { label: 'P3 — Low',    badgeClass: 'bg-mission-control-border/50 text-mission-control-text-dim', iconColor: 'text-mission-control-text-dim bg-mission-control-border/50' },
};

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  'todo':            { label: 'Todo',            class: 'bg-mission-control-border/50 text-mission-control-text-dim' },
  'in-progress':     { label: 'In Progress',     class: 'bg-info/10 text-info' },
  'review':          { label: 'Review',          class: 'bg-warning/10 text-warning' },
  'human-review':    { label: 'Needs Review',    class: 'bg-warning/10 text-warning' },
  'internal-review': { label: 'Internal Review', class: 'bg-review/10 text-review' },
  'done':            { label: 'Done',            class: 'bg-success/10 text-success' },
};

const PRIORITIES: TaskPriority[] = ['p0', 'p1', 'p2', 'p3'];

const FREQ_PLURAL: Record<string, string> = {
  daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years',
};

function recurLabel(r: TaskRecurrence): string {
  if (r.interval === 1) return r.frequency;
  return `every ${r.interval} ${FREQ_PLURAL[r.frequency] ?? r.frequency}`;
}

type FilterType = 'active' | 'done' | 'all';

export default function TaskScheduler() {
  const tasks = useStore(s => s.tasks);
  const agents = useStore(s => s.agents);
  const loadTasksFromDB = useStore(s => s.loadTasksFromDB);

  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('active');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('p2');
  const [formAssignee, setFormAssignee] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [existingTaskId, setExistingTaskId] = useState('');
  const [mode, setMode] = useState<'new' | 'existing'>('new');

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState<TaskRecurrence['frequency']>('weekly');
  const [recurInterval, setRecurInterval] = useState(1);
  const [recurEndType, setRecurEndType] = useState<TaskRecurrence['endType']>('never');
  const [recurEndAfter, setRecurEndAfter] = useState(10);
  const [recurEndDate, setRecurEndDate] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try { await loadTasksFromDB(); } finally { setLoading(false); }
  }, [loadTasksFromDB]);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredTasks = useMemo(() => {
    let base = tasks;
    if (filter === 'active') base = tasks.filter(t => t.status !== 'done');
    if (filter === 'done')   base = tasks.filter(t => t.status === 'done');
    return [...base].sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [tasks, filter]);

  const activeCount    = useMemo(() => tasks.filter(t => t.status !== 'done').length, [tasks]);
  const doneCount      = useMemo(() => tasks.filter(t => t.status === 'done').length, [tasks]);
  const scheduledCount = useMemo(() => tasks.filter(t => t.dueDate && t.status !== 'done').length, [tasks]);

  const unscheduledTasks = useMemo(() =>
    tasks.filter(t => !t.dueDate && t.status !== 'done'), [tasks]);

  const handleSubmit = async () => {
    if (mode === 'existing') {
      if (!existingTaskId || !formDate) {
        showToast('error', 'Missing fields', 'Select a task and a due date');
        return;
      }
      const dueDate = new Date(`${formDate}T${formTime}`).getTime();
      try {
        await taskApi.update(existingTaskId, { dueDate });
        await refresh();
        showToast('success', 'Scheduled', `Task scheduled for ${new Date(dueDate).toLocaleString()}`);
        resetForm();
      } catch { showToast('error', 'Failed', 'Could not update task'); }
      return;
    }

    if (!formTitle.trim() || !formDate) {
      showToast('error', 'Missing fields', 'Title and due date are required');
      return;
    }
    const dueDate = new Date(`${formDate}T${formTime}`).getTime();

    const recurrence: TaskRecurrence | null = isRecurring ? {
      frequency: recurFrequency,
      interval: recurInterval,
      endType: recurEndType,
      ...(recurEndType === 'after' ? { endAfter: recurEndAfter } : {}),
      ...(recurEndType === 'on' && recurEndDate ? { endDate: new Date(recurEndDate).getTime() } : {}),
    } : null;

    try {
      if (editingId) {
        await taskApi.update(editingId, {
          title: formTitle,
          description: formDescription,
          priority: formPriority,
          assignedTo: formAssignee || undefined,
          dueDate,
          recurrence,
        });
        showToast('success', 'Updated', 'Task updated');
      } else {
        await taskApi.create({
          title: formTitle,
          description: formDescription,
          priority: formPriority,
          assignedTo: formAssignee || undefined,
          dueDate,
          status: 'todo' as TaskStatus,
          project: 'general',
          recurrence,
        });
        showToast('success', 'Scheduled', `Task scheduled for ${new Date(dueDate).toLocaleString()}`);
      }
      await refresh();
      resetForm();
    } catch { showToast('error', 'Failed', 'Could not save task'); }
  };

  const handleEdit = (task: Task) => {
    setEditingId(task.id);
    setMode('new');
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority || 'p2');
    setFormAssignee(task.assignedTo || '');
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      setFormDate(d.toISOString().split('T')[0]);
      setFormTime(d.toTimeString().slice(0, 5));
    } else {
      setFormDate('');
      setFormTime('09:00');
    }
    // Restore recurrence
    if (task.recurrence) {
      setIsRecurring(true);
      setRecurFrequency(task.recurrence.frequency);
      setRecurInterval(task.recurrence.interval);
      setRecurEndType(task.recurrence.endType);
      setRecurEndAfter(task.recurrence.endAfter ?? 10);
      setRecurEndDate(task.recurrence.endDate
        ? new Date(task.recurrence.endDate).toISOString().split('T')[0]
        : '');
    } else {
      setIsRecurring(false);
    }
    setShowForm(true);
  };

  const handleClearDueDate = async (id: string) => {
    try {
      await taskApi.update(id, { dueDate: null });
      await refresh();
      showToast('success', 'Cleared', 'Due date removed');
    } catch { showToast('error', 'Failed', 'Could not clear due date'); }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setMode('new');
    setFormTitle('');
    setFormDescription('');
    setFormPriority('p2');
    setFormAssignee('');
    setFormDate('');
    setFormTime('09:00');
    setExistingTaskId('');
    setIsRecurring(false);
    setRecurFrequency('weekly');
    setRecurInterval(1);
    setRecurEndType('never');
    setRecurEndAfter(10);
    setRecurEndDate('');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-xl">
              <ListTodo size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-mission-control-text">Task Schedule</h1>
              <p className="text-sm text-mission-control-text-dim">
                {scheduledCount} scheduled • {activeCount} active
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors"
            >
              <Plus size={16} />
              Schedule Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['active', 'done', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {f === 'active' && `Active (${activeCount})`}
              {f === 'done'   && `Done (${doneCount})`}
              {f === 'all'    && `All (${tasks.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-6 border-b border-mission-control-border bg-mission-control-bg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{editingId ? 'Edit Task' : 'Schedule Task'}</h3>
            <button onClick={resetForm} className="p-1 hover:bg-mission-control-border rounded">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Mode toggle (new only) */}
            {!editingId && (
              <div className="flex gap-2">
                {(['new', 'existing'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                      mode === m
                        ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                        : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >
                    {m === 'new' ? 'New Task' : 'Existing Task'}
                  </button>
                ))}
              </div>
            )}

            {mode === 'existing' && !editingId ? (
              <div>
                <label className="block text-sm text-mission-control-text-dim mb-1">Task</label>
                <select
                  value={existingTaskId}
                  onChange={e => setExistingTaskId(e.target.value)}
                  className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent text-sm"
                >
                  <option value="">Select unscheduled task…</option>
                  {unscheduledTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
                />
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent resize-none"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-mission-control-text-dim mb-1">Priority</label>
                    <select
                      value={formPriority}
                      onChange={e => setFormPriority(e.target.value as TaskPriority)}
                      className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent text-sm"
                    >
                      {PRIORITIES.map(p => (
                        <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-mission-control-text-dim mb-1">Assign to</label>
                    <select
                      value={formAssignee}
                      onChange={e => setFormAssignee(e.target.value)}
                      className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent text-sm"
                    >
                      <option value="">Unassigned</option>
                      {agents
                        .filter(a => a.status !== 'archived' && a.status !== 'disabled')
                        .map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Date / Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-mission-control-text-dim mb-1">Due Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-mission-control-text-dim mb-1">Time</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={e => setFormTime(e.target.value)}
                  className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
                />
              </div>
            </div>

            {/* Recurrence */}
            {mode !== 'existing' && (
              <div className="border border-mission-control-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                    isRecurring
                      ? 'bg-mission-control-accent/10 text-mission-control-accent'
                      : 'bg-mission-control-surface text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Repeat size={15} />
                    <span className="text-sm font-medium">Recurring task</span>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${isRecurring ? 'bg-mission-control-accent' : 'bg-mission-control-border'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isRecurring ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </button>

                {isRecurring && (
                  <div className="px-4 py-3 bg-mission-control-bg border-t border-mission-control-border space-y-2.5">
                    {/* Row 1: Every [n] [freq] */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-mission-control-text-dim shrink-0">Every</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={recurInterval}
                        onChange={e => setRecurInterval(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-12 px-2 py-1 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm focus:outline-none focus:border-mission-control-accent text-center"
                      />
                      <select
                        value={recurFrequency}
                        onChange={e => setRecurFrequency(e.target.value as TaskRecurrence['frequency'])}
                        className="px-2 py-1 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm focus:outline-none focus:border-mission-control-accent"
                      >
                        <option value="daily">{recurInterval === 1 ? 'Day' : 'Days'}</option>
                        <option value="weekly">{recurInterval === 1 ? 'Week' : 'Weeks'}</option>
                        <option value="monthly">{recurInterval === 1 ? 'Month' : 'Months'}</option>
                        <option value="yearly">{recurInterval === 1 ? 'Year' : 'Years'}</option>
                      </select>
                    </div>

                    {/* Row 2: Ends — all inline */}
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-mission-control-text-dim shrink-0">Ends</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="recurEnd" checked={recurEndType === 'never'} onChange={() => setRecurEndType('never')} className="accent-mission-control-accent" />
                        <span>Never</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="recurEnd" checked={recurEndType === 'after'} onChange={() => setRecurEndType('after')} className="accent-mission-control-accent" />
                        <span>After</span>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={recurEndAfter}
                          onChange={e => setRecurEndAfter(Math.max(1, parseInt(e.target.value) || 1))}
                          onClick={() => setRecurEndType('after')}
                          className="w-12 px-2 py-0.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm focus:outline-none focus:border-mission-control-accent text-center"
                        />
                        <span className="text-mission-control-text-dim">times</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="recurEnd" checked={recurEndType === 'on'} onChange={() => setRecurEndType('on')} className="accent-mission-control-accent" />
                        <span>On</span>
                        <input
                          type="date"
                          value={recurEndDate}
                          onChange={e => setRecurEndDate(e.target.value)}
                          onClick={() => setRecurEndType('on')}
                          className="px-2 py-0.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm focus:outline-none focus:border-mission-control-accent"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={mode === 'new'
                  ? (!formTitle.trim() || !formDate)
                  : (!existingTaskId || !formDate)}
                className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors disabled:opacity-50"
              >
                <Check size={16} />
                {editingId ? 'Update' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
            <ListTodo size={64} className="opacity-20 mb-4" />
            <p className="text-lg">No tasks</p>
            <p className="text-sm">Schedule tasks with due dates to track them here</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors"
            >
              <Plus size={16} />
              Schedule First Task
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
              const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG['todo'];
              const isOverdue = task.dueDate && task.dueDate < Date.now() && task.status !== 'done';

              return (
                <div
                  key={task.id}
                  className={`p-4 bg-mission-control-surface border rounded-xl transition-colors ${
                    isOverdue
                      ? 'border-error/40 hover:border-error/60'
                      : task.status === 'done'
                      ? 'border-mission-control-border opacity-70'
                      : 'border-mission-control-border hover:border-mission-control-accent/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <IconBadge
                      icon={ListTodo}
                      size={16}
                      color={priority?.iconColor ?? 'text-mission-control-text-dim bg-mission-control-border/50'}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded ${statusCfg.class}`}>
                          {statusCfg.label}
                        </span>
                        {priority && (
                          <span className={`text-xs px-2 py-0.5 rounded ${priority.badgeClass}`}>
                            {task.priority?.toUpperCase()}
                          </span>
                        )}
                        {task.dueDate ? (
                          <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-error' : 'text-mission-control-text-dim'}`}>
                            <Clock size={12} />
                            {formatDueDate(task.dueDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-mission-control-text-dim italic">Unscheduled</span>
                        )}
                        {task.recurrence && (
                          <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded bg-mission-control-accent/10 text-mission-control-accent">
                            <Repeat size={11} />
                            {recurLabel(task.recurrence)}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-medium mb-1">{task.title}</p>

                      {task.description && (
                        <p className="text-xs text-mission-control-text-dim line-clamp-1">{task.description}</p>
                      )}

                      {task.assignedTo && (
                        <p className="text-xs text-mission-control-text-dim flex items-center gap-1 mt-1">
                          <User size={11} />
                          {task.assignedTo}
                        </p>
                      )}
                    </div>

                    {task.status !== 'done' && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleEdit(task)}
                          className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
                          title="Edit / set due date"
                        >
                          <Edit2 size={15} className="text-mission-control-text-dim" />
                        </button>
                        {task.dueDate && (
                          <button
                            onClick={() => handleClearDueDate(task.id)}
                            className="p-2 hover:bg-error/10 rounded-lg transition-colors"
                            title="Clear due date"
                          >
                            <Trash2 size={15} className="text-error" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
