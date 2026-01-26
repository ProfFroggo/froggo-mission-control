import { useState } from 'react';
import { X, Bot } from 'lucide-react';
import { useStore, TaskStatus } from '../store/store';

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
  const [assignedTo, setAssignedTo] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      project,
      status,
      assignedTo: assignedTo || undefined,
    });
    
    // Reset form
    setTitle('');
    setDescription('');
    setProject('Default');
    setAssignedTo('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-clawd-surface rounded-xl border border-clawd-border w-full max-w-lg p-6"
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
              placeholder="Add more details..."
              rows={3}
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none"
            />
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
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Assign to Agent */}
          <div>
            <label className="block text-sm text-clawd-text-dim mb-1">Assign to Agent</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAssignedTo('')}
                className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                  !assignedTo 
                    ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent' 
                    : 'border-clawd-border hover:border-clawd-accent/50'
                }`}
              >
                <span className="text-lg">👤</span>
                Unassigned
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
                  <span className="text-lg">{agent.avatar || '🤖'}</span>
                  {agent.name}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4">
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
              className="px-4 py-2 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
