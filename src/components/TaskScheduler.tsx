import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatDueDate } from '../utils/formatting';
import { ListTodo, Clock, Plus, Trash2, Edit2, RefreshCw, X, Check, User, Repeat, CalendarDays, AlertTriangle } from 'lucide-react';
import { Button, Badge, Select, TextArea, TextField } from '@radix-ui/themes';
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
  'internal-review': { label: 'Pre-review', class: 'bg-review/10 text-review' },
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

  // Upcoming tasks in next 7 days (sorted by dueDate ascending)
  const upcomingTasks = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return tasks
      .filter(t => t.dueDate && t.dueDate >= now && t.dueDate <= now + sevenDaysMs && t.status !== 'done')
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
  }, [tasks]);

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
            <div className="p-2 bg-mission-control-accent/20 rounded-lg">
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
            <Button
              onClick={refresh}
              disabled={loading}
              variant="outline"
              color="gray"
              size="2"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              size="2"
            >
              <Plus size={16} />
              Schedule Task
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['active', 'done', 'all'] as const).map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              variant={filter === f ? 'solid' : 'outline'}
              color={filter === f ? 'violet' : 'gray'}
              size="2"
            >
              {f === 'active' && `Active (${activeCount})`}
              {f === 'done'   && `Done (${doneCount})`}
              {f === 'all'    && `All (${tasks.length})`}
            </Button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-6 border-b border-mission-control-border bg-mission-control-bg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{editingId ? 'Edit Task' : 'Schedule Task'}</h3>
            <Button onClick={resetForm} variant="ghost" color="gray" size="1">
              <X size={16} />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Mode toggle (new only) */}
            {!editingId && (
              <div className="flex gap-2">
                {(['new', 'existing'] as const).map((m) => (
                  <Button
                    key={m}
                    onClick={() => setMode(m)}
                    variant={mode === m ? 'soft' : 'outline'}
                    color={mode === m ? 'violet' : 'gray'}
                    size="2"
                  >
                    {m === 'new' ? 'New Task' : 'Existing Task'}
                  </Button>
                ))}
              </div>
            )}

            {mode === 'existing' && !editingId ? (
              <div>
                <label className="block text-sm text-mission-control-text-dim mb-1">Task</label>
                <Select.Root value={existingTaskId} onValueChange={setExistingTaskId}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    <Select.Item value="">Select unscheduled task…</Select.Item>
                    {unscheduledTasks.map(t => (
                      <Select.Item key={t.id} value={t.id}>{t.title}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </div>
            ) : (
              <>
                <TextField.Root
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Task title"
                  style={{ width: '100%' }}
                />
                <TextArea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  style={{ width: '100%' }}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-mission-control-text-dim mb-1">Priority</label>
                    <Select.Root value={formPriority} onValueChange={(val) => setFormPriority(val as TaskPriority)}>
                      <Select.Trigger style={{ width: '100%' }} />
                      <Select.Content>
                        {PRIORITIES.map(p => (
                          <Select.Item key={p} value={p}>{PRIORITY_CONFIG[p].label}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <div>
                    <label className="block text-sm text-mission-control-text-dim mb-1">Assign to</label>
                    <Select.Root value={formAssignee} onValueChange={setFormAssignee}>
                      <Select.Trigger style={{ width: '100%' }} />
                      <Select.Content>
                        <Select.Item value="">Unassigned</Select.Item>
                        {agents
                          .filter(a => a.status !== 'archived' && a.status !== 'disabled')
                          .map(a => (
                            <Select.Item key={a.id} value={a.id}>{a.name}</Select.Item>
                          ))}
                      </Select.Content>
                    </Select.Root>
                  </div>
                </div>
              </>
            )}

            {/* Date / Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="border border-mission-control-border rounded-lg overflow-hidden">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors rounded-t-lg ${
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
                </Button>

                {isRecurring && (
                  <div className="px-4 py-3 bg-mission-control-bg border-t border-mission-control-border space-y-2.5">
                    {/* Row 1: Every [n] [freq] */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-mission-control-text-dim shrink-0">Every</span>
                      <TextField.Root
                        type="number"
                        min="1"
                        max="99"
                        value={String(recurInterval)}
                        onChange={e => setRecurInterval(Math.max(1, parseInt(e.target.value) || 1))}
                        size="1"
                        style={{ width: 48, textAlign: 'center' }}
                      />
                      <Select.Root value={recurFrequency} onValueChange={(val) => setRecurFrequency(val as TaskRecurrence['frequency'])} size="1">
                        <Select.Trigger />
                        <Select.Content>
                          <Select.Item value="daily">{recurInterval === 1 ? 'Day' : 'Days'}</Select.Item>
                          <Select.Item value="weekly">{recurInterval === 1 ? 'Week' : 'Weeks'}</Select.Item>
                          <Select.Item value="monthly">{recurInterval === 1 ? 'Month' : 'Months'}</Select.Item>
                          <Select.Item value="yearly">{recurInterval === 1 ? 'Year' : 'Years'}</Select.Item>
                        </Select.Content>
                      </Select.Root>
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
                        <TextField.Root
                          type="number"
                          min="1"
                          max="999"
                          value={String(recurEndAfter)}
                          onChange={e => setRecurEndAfter(Math.max(1, parseInt(e.target.value) || 1))}
                          onClick={() => setRecurEndType('after')}
                          size="1"
                          style={{ width: 48, textAlign: 'center' }}
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
              <Button
                onClick={resetForm}
                variant="outline"
                color="gray"
                size="2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={mode === 'new'
                  ? (!formTitle.trim() || !formDate)
                  : (!existingTaskId || !formDate)}
                size="2"
              >
                <Check size={16} />
                {editingId ? 'Update' : 'Schedule'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content: task list + upcoming sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center">
            <ListTodo size={32} className="text-mission-control-text-dim opacity-40" />
            <p className="text-sm font-medium text-mission-control-text">No tasks</p>
            <p className="text-xs text-mission-control-text-dim">Schedule tasks with due dates to track them here</p>
            <Button onClick={() => setShowForm(true)} size="2" className="mt-1">
              <Plus size={16} />
              Schedule First Task
            </Button>
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
                  className={`p-4 bg-mission-control-surface border rounded-lg transition-colors ${
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
                        <Button
                          onClick={() => handleEdit(task)}
                          variant="ghost"
                          color="gray"
                          size="1"
                          title="Edit / set due date"
                        >
                          <Edit2 size={15} />
                        </Button>
                        {task.dueDate && (
                          <Button
                            onClick={() => handleClearDueDate(task.id)}
                            variant="ghost"
                            color="red"
                            size="1"
                            title="Clear due date"
                          >
                            <Trash2 size={15} />
                          </Button>
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

      {/* Upcoming tasks sidebar — next 7 days */}
      <div className="w-72 shrink-0 border-l border-mission-control-border bg-mission-control-surface overflow-y-auto">
        <div className="p-4 border-b border-mission-control-border">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-mission-control-text">
            <CalendarDays size={15} className="text-mission-control-accent" />
            Next 7 Days
            {upcomingTasks.length > 0 && (
              <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-mission-control-accent/20 text-mission-control-accent font-medium">
                {upcomingTasks.length}
              </span>
            )}
          </h3>
        </div>
        {upcomingTasks.length === 0 ? (
          <div className="p-4 text-center text-mission-control-text-dim">
            <CalendarDays size={32} className="mx-auto opacity-20 mb-2" />
            <p className="text-xs">No tasks due in the next 7 days</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {upcomingTasks.map(task => {
              const now = new Date();
              const due = task.dueDate ? new Date(task.dueDate) : null;
              const isDueToday = due &&
                due.getFullYear() === now.getFullYear() &&
                due.getMonth() === now.getMonth() &&
                due.getDate() === now.getDate();
              const statusColor =
                task.status === 'in-progress' ? 'text-info' :
                task.status === 'review' ? 'text-review' :
                task.status === 'done' ? 'text-success' :
                'text-mission-control-text-dim';

              return (
                <div
                  key={task.id}
                  className={`px-3 py-2 rounded-lg border transition-colors ${
                    isDueToday
                      ? 'border-warning/30 bg-warning/5'
                      : 'border-mission-control-border hover:border-mission-control-accent/30'
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    {isDueToday && (
                      <AlertTriangle size={11} className="text-warning mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" title={task.title}>
                        {task.title.length > 24 ? task.title.slice(0, 24) + '…' : task.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-xs ${statusColor}`}>
                          {STATUS_CONFIG[task.status]?.label ?? task.status}
                        </span>
                        {due && (
                          <span className={`text-xs tabular-nums ${isDueToday ? 'text-warning font-medium' : 'text-mission-control-text-dim'}`}>
                            · {isDueToday ? 'Today' : due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            {' '}
                            {due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </div>
    </div>
  );
}
