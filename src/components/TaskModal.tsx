import { useState, useEffect } from 'react';
import { X, Bot, Flag, Calendar, AlertTriangle, ArrowUp, Circle, ArrowDown } from 'lucide-react';
import { useStore, TaskStatus, TaskPriority } from '../store/store';

const PRIORITIES: { id: TaskPriority; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'p0', label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/20', icon: <AlertTriangle size={14} /> },
  { id: 'p1', label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/20', icon: <ArrowUp size={14} /> },
  { id: 'p2', label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: <Circle size={14} /> },
  { id: 'p3', label: 'Low', color: 'text-gray-400', bg: 'bg-gray-500/20', icon: <ArrowDown size={14} /> },
];

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStatus?: TaskStatus;
}

export default function TaskModal({ isOpen, onClose, initialStatus = 'todo' }: TaskModalProps) {
  const { addTask, agents } = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState('Default');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');

  // Reset initial status when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus(initialStatus);
    }
  }, [isOpen, initialStatus]);

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      project,
      status,
      priority: priority || undefined,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      assignedTo: assignedTo || undefined,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setProject('Default');
    setPriority('');
    setDueDate('');
    setAssignedTo('');
    onClose();
  };

  // Quick presets for due date
  const setQuickDue = (hours: number) => {
    const date = new Date(Date.now() + hours * 60 * 60 * 1000);
    setDueDate(date.toISOString().slice(0, 16));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="glass-modal rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">New Task</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-clawd-border rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-clawd-text-dim mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-clawd-text-dim mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add more details, context, or instructions for the agent..."
              rows={3}
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
              <Flag size={14} /> Priority
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPriority('')}
                className={`flex-1 p-2 rounded-lg border text-sm transition-colors ${
                  !priority
                    ? 'border-clawd-accent bg-clawd-accent/10'
                    : 'border-clawd-border hover:border-clawd-accent/50'
                }`}
              >
                None
              </button>
              {PRIORITIES.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  className={`flex-1 p-2 rounded-lg border text-sm flex items-center justify-center gap-1 transition-colors ${
                    priority === p.id
                      ? `border-clawd-accent ${p.bg} ${p.color}`
                      : 'border-clawd-border hover:border-clawd-accent/50'
                  }`}
                  title={p.label}
                >
                  {p.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
              <Calendar size={14} /> Due Date
            </label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent text-sm"
              />
              <button
                type="button"
                onClick={() => setQuickDue(1)}
                className="px-2 py-1 text-xs bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent/50"
              >
                1h
              </button>
              <button
                type="button"
                onClick={() => setQuickDue(4)}
                className="px-2 py-1 text-xs bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent/50"
              >
                4h
              </button>
              <button
                type="button"
                onClick={() => setQuickDue(24)}
                className="px-2 py-1 text-xs bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent/50"
              >
                1d
              </button>
              <button
                type="button"
                onClick={() => setQuickDue(168)}
                className="px-2 py-1 text-xs bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent/50"
              >
                1w
              </button>
            </div>
          </div>

          {/* Project & Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-clawd-text-dim mb-1">Project</label>
              <input
                type="text"
                value={project}
                onChange={e => setProject(e.target.value)}
                placeholder="Project name"
                className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-clawd-text-dim mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
              >
                <option value="backlog">📋 Backlog</option>
                <option value="todo">📝 To Do</option>
                <option value="in-progress">⚡ In Progress</option>
                <option value="review">👀 Review</option>
                <option value="done">✅ Done</option>
              </select>
            </div>
          </div>

          {/* Assign to Agent */}
          <div>
            <label className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
              <Bot size={14} /> Assign to Agent
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssignedTo('')}
                className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                  !assignedTo
                    ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                    : 'border-clawd-border hover:border-clawd-accent/50'
                }`}
              >
                <span className="text-base">👤</span>
                <span className="truncate">None</span>
              </button>
              {agents.map(agent => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setAssignedTo(agent.id)}
                  className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                    assignedTo === agent.id
                      ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                      : 'border-clawd-border hover:border-clawd-accent/50'
                  }`}
                >
                  <span className="text-base">{agent.avatar || '🤖'}</span>
                  <span className="truncate">{agent.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-clawd-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-clawd-border hover:bg-clawd-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Create Task
              {assignedTo && <span className="text-xs opacity-75">& Assign</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
