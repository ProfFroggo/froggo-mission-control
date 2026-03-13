'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, MoreHorizontal, Trash2, Clock, Play, Zap,
  CheckSquare, AlertTriangle, ArrowUp, ArrowDown, Circle,
  Calendar, Flag, ShieldCheck, ShieldX, ShieldAlert, RefreshCw,
  FolderOpen, Ban, FileText, Search, Bot, User, CheckCircle,
} from 'lucide-react';
import { useStore, Task, TaskStatus, TaskPriority, Agent } from '../../store/store';
import { useShallow } from 'zustand/react/shallow';
import TaskDetailPanel from '../TaskDetailPanel';
import AgentAvatar from '../AgentAvatar';
import { showToast } from '../Toast';
import { Spinner } from '../LoadingStates';
import type { Project } from '../../types/projects';

// ─── Config ──────────────────────────────────────────────────────────────────

const PRIORITIES: { id: TaskPriority; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'p0', label: 'Urgent', color: 'text-error', bg: 'bg-error-subtle', icon: <AlertTriangle size={12} /> },
  { id: 'p1', label: 'High', color: 'text-warning', bg: 'bg-warning-subtle', icon: <ArrowUp size={12} /> },
  { id: 'p2', label: 'Medium', color: 'text-warning', bg: 'bg-warning-subtle', icon: <Circle size={12} /> },
  { id: 'p3', label: 'Low', color: 'text-mission-control-text-dim', bg: 'bg-mission-control-bg0/20', icon: <ArrowDown size={12} /> },
];

const COLUMNS: { id: TaskStatus; label: string; color: string; iconColor: string; borderColor: string; icon: React.ReactNode }[] = [
  { id: 'todo',            label: 'To Do',            color: 'text-info',    iconColor: 'text-info',    borderColor: 'border-t-info',    icon: <FileText size={13} /> },
  { id: 'internal-review', label: 'Pre-review',   color: 'text-review',  iconColor: 'text-review',  borderColor: 'border-t-review',  icon: <Search size={13} /> },
  { id: 'in-progress',     label: 'In Progress',      color: 'text-warning', iconColor: 'text-warning', borderColor: 'border-t-warning', icon: <Zap size={13} /> },
  { id: 'review',          label: 'Agent Review',     color: 'text-review',  iconColor: 'text-review',  borderColor: 'border-t-review',  icon: <Bot size={13} /> },
  { id: 'human-review',    label: 'Human Review',     color: 'text-warning', iconColor: 'text-warning', borderColor: 'border-t-warning', icon: <User size={13} /> },
  { id: 'done',            label: 'Done',             color: 'text-success', iconColor: 'text-success', borderColor: 'border-t-success', icon: <CheckCircle size={13} /> },
];

function formatDue(ts: number) {
  const diff = ts - Date.now();
  const days = Math.floor(diff / 86_400_000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, isOverdue: true, isDueSoon: false };
  if (days === 0) return { text: 'due today', isOverdue: false, isDueSoon: true };
  if (days <= 3) return { text: `${days}d left`, isOverdue: false, isDueSoon: true };
  return { text: `${days}d`, isOverdue: false, isDueSoon: false };
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface CardProps {
  task: Task;
  agents: Agent[];
  isDragging: boolean;
  isDeleting: boolean;
  isSpawning: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onStartAgent: () => void;
  onSetPriority: (p: TaskPriority) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function TaskCard({
  task, agents, isDragging, isDeleting, isSpawning,
  onOpen, onDelete, onStartAgent, onSetPriority,
  onDragStart, onDragEnd,
}: CardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showPriority, setShowPriority] = useState(false);
  const [priorPos, setPriorPos] = useState<{ top: number; left: number } | null>(null);

  const priorityConfig = PRIORITIES.find(p => p.id === task.priority);
  const assignedAgent = agents.find(a => a.id === task.assignedTo);
  const dueInfo = task.dueDate ? formatDue(task.dueDate) : null;
  const subtaskCount = task.subtasks?.length ?? 0;
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length ?? 0;
  const subtaskProgress = subtaskCount > 0 ? Math.round((completedSubtasks / subtaskCount) * 100) : 0;
  const canStart = assignedAgent && task.status === 'internal-review';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`group bg-mission-control-bg border rounded-xl p-3 cursor-pointer select-none transition-all duration-150 ${
        isDragging ? 'opacity-40 scale-95 rotate-1 shadow-lg' :
        dueInfo?.isOverdue ? 'border-error-border bg-error-subtle/30' :
        task.priority === 'p0' ? 'border-error-border' :
        'border-mission-control-border hover:border-mission-control-accent/50 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start gap-1.5 mb-2">
        {priorityConfig && (
          <button
            onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setPriorPos({ top: r.bottom + 4, left: r.left }); setShowPriority(true); }}
            className={`p-0.5 rounded flex-shrink-0 ${priorityConfig.bg} ${priorityConfig.color}`}
            title={priorityConfig.label}
          >
            {priorityConfig.icon}
          </button>
        )}
        <h4 className="font-medium text-sm leading-tight flex-1 min-w-0 line-clamp-2">{task.title}</h4>
        <button
          onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuPos({ top: r.bottom + 4, left: r.right - 160 }); setShowMenu(true); }}
          className="flex-shrink-0 p-0.5 text-mission-control-text-dim opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>

      {/* Clara review badge */}
      {task.reviewStatus && (
        <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded mb-2 w-fit ${
          task.reviewStatus === 'approved' ? 'bg-green-500/10 text-green-400' :
          task.reviewStatus === 'rejected' || task.reviewStatus === 'needs-changes' ? 'bg-error-subtle text-error' :
          'bg-mission-control-accent/10 text-mission-control-accent animate-pulse'
        }`}>
          {task.reviewStatus === 'approved' ? <ShieldCheck size={11} /> :
           task.reviewStatus === 'rejected' || task.reviewStatus === 'needs-changes' ? <ShieldX size={11} /> :
           <ShieldAlert size={11} />}
          <span>Clara: {task.reviewStatus === 'in-review' ? 'reviewing…' : task.reviewStatus}</span>
        </div>
      )}

      {/* Subtask progress */}
      {subtaskCount > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-xs text-mission-control-text-dim mb-1">
            <CheckSquare size={11} /> {completedSubtasks}/{subtaskCount}
          </div>
          <div className="h-1 bg-mission-control-surface rounded-full overflow-hidden">
            <div className={`h-full transition-all ${subtaskProgress === 100 ? 'bg-green-500' : 'bg-mission-control-accent'}`}
              style={{ width: `${subtaskProgress}%` }} />
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
          {dueInfo && (
            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded flex-shrink-0 ${
              dueInfo.isOverdue ? 'bg-error-subtle text-error' :
              dueInfo.isDueSoon ? 'bg-warning-subtle text-warning' :
              'bg-mission-control-surface text-mission-control-text-dim'
            }`}>
              <Calendar size={10} /> {dueInfo.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {task.status === 'in-progress' ? (
            <span className="flex items-center justify-center w-5 h-5 rounded bg-green-500/20 text-green-400 animate-pulse" title="Agent working">
              <Zap size={11} />
            </span>
          ) : canStart ? (
            <button
              onClick={e => { e.stopPropagation(); onStartAgent(); }}
              disabled={isSpawning}
              className="flex items-center justify-center w-5 h-5 rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
              title="Start agent"
            >
              {isSpawning ? <Spinner size={11} /> : <Play size={11} />}
            </button>
          ) : null}
          {assignedAgent && (
            <AgentAvatar agentId={assignedAgent.id} size="xs" />
          )}
        </div>
      </div>

      {/* Priority picker portal */}
      {showPriority && priorPos && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setShowPriority(false)} />
          <div className="fixed bg-mission-control-surface border border-mission-control-border rounded-xl shadow-xl p-2 z-[101] min-w-[150px]"
            style={{ top: priorPos.top, left: priorPos.left }}
            onClick={e => e.stopPropagation()}>
            <div className="text-xs text-mission-control-text-dim mb-2 px-2 font-medium">Set Priority</div>
            {PRIORITIES.map(p => (
              <button key={p.id} onClick={() => { onSetPriority(p.id); setShowPriority(false); }}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-mission-control-border transition-colors ${task.priority === p.id ? `${p.bg} ${p.color}` : ''}`}>
                <span className={p.color}>{p.icon}</span> {p.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* Card menu portal */}
      {showMenu && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setShowMenu(false)} />
          <div className="fixed bg-mission-control-surface border border-mission-control-border rounded-xl shadow-xl py-1 z-[101] min-w-[140px]"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowMenu(false); onOpen(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-mission-control-border">
              <FolderOpen size={14} /> Open
            </button>
            <button onClick={() => { setPriorPos(menuPos); setShowPriority(true); setShowMenu(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-mission-control-border">
              <Flag size={14} /> Set Priority
            </button>
            <hr className="my-1 border-mission-control-border" />
            <button onClick={() => { setShowMenu(false); onDelete(); }}
              disabled={isDeleting}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-mission-control-border text-error disabled:opacity-50">
              {isDeleting ? <Spinner size={14} /> : <Trash2 size={14} />} Delete
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Project Kanban ───────────────────────────────────────────────────────────

interface ProjectKanbanProps {
  project: Project;
  onNewTask: () => void;
}

export default function ProjectKanban({ project, onNewTask }: ProjectKanbanProps) {
  const { tasks, agents, moveTask, deleteTask, updateTask, spawnAgentForTask, loadTasksFromDB } = useStore(
    useShallow(s => ({
      tasks: s.tasks as Task[],
      agents: s.agents as Agent[],
      moveTask: s.moveTask,
      deleteTask: s.deleteTask,
      updateTask: s.updateTask,
      spawnAgentForTask: s.spawnAgentForTask,
      loadTasksFromDB: s.loadTasksFromDB,
    }))
  );

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [spawningIds, setSpawningIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter tasks to this project only (by project_id FK or legacy project name)
  const projectTasks = tasks.filter(t =>
    t.project_id === project.id || t.project === project.name
  );

  const getColumnTasks = useCallback((col: TaskStatus) =>
    projectTasks.filter(t => t.status === col)
      .sort((a, b) => {
        const order = { p0: 0, p1: 1, p2: 2, p3: 3 };
        return (order[(a.priority ?? 'p3') as keyof typeof order] ?? 3) - (order[(b.priority ?? 'p3') as keyof typeof order] ?? 3);
      }),
    [projectTasks]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await loadTasksFromDB(); } finally { setIsRefreshing(false); }
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (!draggedId) return;
    const task = tasks.find(t => t.id === draggedId);
    if (task && task.status !== status) {
      try { await moveTask(draggedId, status); } catch { showToast('error', 'Failed to move task'); }
    }
    setDraggedId(null);
    setDragOverCol(null);
  };

  const handleDelete = async (taskId: string) => {
    setDeletingIds(prev => new Set(prev).add(taskId));
    try {
      await deleteTask(taskId);
      showToast('success', 'Task deleted');
      if (selectedTask?.id === taskId) setSelectedTask(null);
    } catch {
      showToast('error', 'Failed to delete task');
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  };

  const handleSpawn = async (taskId: string) => {
    setSpawningIds(prev => new Set(prev).add(taskId));
    try {
      await spawnAgentForTask(taskId);
      showToast('success', 'Agent started');
    } catch {
      showToast('error', 'Failed to start agent');
    } finally {
      setSpawningIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  };

  const openCount = projectTasks.filter(t => !['done', 'archived'].includes(t.status)).length;
  const doneCount = projectTasks.filter(t => t.status === 'done').length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border bg-mission-control-surface/50 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs text-mission-control-text-dim">
          <span>{projectTasks.length} tasks</span>
          <span className="text-success">{doneCount} done</span>
          <span className="text-warning">{openCount} open</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={isRefreshing}
            className="p-1.5 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={onNewTask}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-xs font-medium hover:bg-mission-control-accent/90 transition-colors">
            <Plus size={13} /> New Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full p-4" style={{ minWidth: `${COLUMNS.length * 220}px` }}>
          {COLUMNS.map(col => {
            const colTasks = getColumnTasks(col.id);
            const isDragTarget = dragOverCol === col.id;
            return (
              <div
                key={col.id}
                className={`flex flex-col rounded-xl border transition-colors flex-shrink-0 w-52 ${
                  isDragTarget ? 'border-mission-control-accent bg-mission-control-accent/5' : 'border-mission-control-border bg-mission-control-surface/30'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => handleDrop(e, col.id)}
              >
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2.5 border-b border-mission-control-border border-t-2 ${col.borderColor} rounded-t-xl flex-shrink-0`}>
                  <div className="flex items-center gap-2">
                    <span className={col.iconColor}>{col.icon}</span>
                    <span className="text-xs font-semibold text-mission-control-text">{col.label}</span>
                    <span className="text-xs text-mission-control-text-dim bg-mission-control-surface px-1.5 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                  <button onClick={onNewTask} title="Add task"
                    className="p-0.5 text-mission-control-text-dim hover:text-mission-control-accent transition-colors opacity-0 group-hover:opacity-100">
                    <Plus size={14} />
                  </button>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agents={agents as any}
                      isDragging={draggedId === task.id}
                      isDeleting={deletingIds.has(task.id)}
                      isSpawning={spawningIds.has(task.id)}
                      onOpen={() => setSelectedTask(task)}
                      onDelete={() => handleDelete(task.id)}
                      onStartAgent={() => handleSpawn(task.id)}
                      onSetPriority={p => updateTask(task.id, { priority: p })}
                      onDragStart={e => { setDraggedId(task.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="flex items-center justify-center h-16 text-xs text-mission-control-text-dim/50 italic">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task detail modal */}
      {selectedTask && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch justify-end"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="w-full max-w-2xl bg-mission-control-bg overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200"
            onClick={e => e.stopPropagation()}
          >
            <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
