// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/components/TaskQuickEdit.tsx
// Inline quick-edit popover for task cards — title, priority, assignee

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Save, X, Loader2 } from 'lucide-react';
import type { Task, TaskPriority } from '../store/store';
import { taskApi } from '../lib/api';
import { showToast } from './Toast';

interface QuickEditAgent {
  id: string;
  name: string;
  avatar?: string;
}

interface TaskQuickEditProps {
  task: Task;
  agents: QuickEditAgent[];
  anchorRect: DOMRect;
  onClose: () => void;
  onSaved: (patch: Partial<Task>) => void;
}

const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: 'p0', label: 'Urgent' },
  { id: 'p1', label: 'High' },
  { id: 'p2', label: 'Medium' },
  { id: 'p3', label: 'Low' },
];

export default function TaskQuickEdit({ task, agents, anchorRect, onClose, onSaved }: TaskQuickEditProps) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? 'p2');
  const [assignee, setAssignee] = useState(task.assignedTo ?? '');
  const [saving, setSaving] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Focus title on open
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

  // Position popover: prefer below the anchor, flip up if not enough space
  const POPOVER_HEIGHT = 200;
  const POPOVER_WIDTH = 300;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;

  let top = anchorRect.bottom + 6;
  let left = anchorRect.left;

  if (top + POPOVER_HEIGHT > viewportH - 16) {
    top = anchorRect.top - POPOVER_HEIGHT - 6;
  }
  if (left + POPOVER_WIDTH > viewportW - 16) {
    left = viewportW - POPOVER_WIDTH - 16;
  }
  if (top < 8) top = 8;
  if (left < 8) left = 8;

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast('error', 'Title cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const patch: Partial<Task> = {
        title: trimmedTitle,
        priority,
        assignedTo: assignee || undefined,
      };
      await taskApi.update(task.id, patch);
      onSaved(patch);
      showToast('success', 'Task updated');
      onClose();
    } catch {
      showToast('error', 'Failed to update task');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[200] bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl p-3 w-[300px]"
      style={{ top, left }}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <div className="space-y-2.5">
        {/* Title */}
        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1 font-medium">Title</label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            maxLength={500}
            className="w-full px-2.5 py-1.5 rounded-lg border border-mission-control-border bg-mission-control-bg text-sm focus:outline-none focus:border-mission-control-accent transition-colors"
            placeholder="Task title"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1 font-medium">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as TaskPriority)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-mission-control-border bg-mission-control-bg text-sm focus:outline-none focus:border-mission-control-accent transition-colors"
          >
            {PRIORITIES.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1 font-medium">Assignee</label>
          <select
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-mission-control-border bg-mission-control-bg text-sm focus:outline-none focus:border-mission-control-accent transition-colors"
          >
            <option value="">Unassigned</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-mission-control-accent text-white text-sm font-medium hover:bg-mission-control-accent-dim disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin flex-shrink-0" /> : <Save size={13} className="flex-shrink-0" />}
            Save
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-mission-control-border text-sm hover:bg-mission-control-border/50 transition-colors"
          >
            <X size={13} className="flex-shrink-0" />
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
