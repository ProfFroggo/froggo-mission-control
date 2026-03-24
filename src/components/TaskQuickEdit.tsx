// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/components/TaskQuickEdit.tsx
// Inline quick-edit popover for task cards — title, priority, assignee

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Save, X } from 'lucide-react';
import type { Task, TaskPriority } from '../store/store';
import { taskApi } from '../lib/api';
import { showToast } from './Toast';
// eslint-disable-next-line import/order
import { Button, Spinner, Select, TextField } from '@radix-ui/themes';

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

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast('error', 'Title cannot be empty');
      return;
    }

    const patch: Partial<Task> = {
      title: trimmedTitle,
      priority,
    };
    // Only include assignedTo if changed
    if (assignee !== (task.assignedTo ?? '')) {
      patch.assignedTo = assignee || undefined;
    }
    // Let parent handle the API call via store (avoids double-patching)
    onSaved(patch);
    onClose();
  }

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[200] bg-mission-control-surface border border-mission-control-border rounded-lg shadow-2xl p-3 w-[300px]"
      style={{ top, left }}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <div className="space-y-2.5">
        {/* Title */}
        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1 font-medium">Title</label>
          <TextField.Root
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            maxLength={500}
            placeholder="Task title"
            size="2"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1 font-medium">Priority</label>
          <Select.Root value={priority} onValueChange={val => setPriority(val as TaskPriority)}>
            <Select.Trigger className="w-full" />
            <Select.Content>
              {PRIORITIES.map(p => (
                <Select.Item key={p.id} value={p.id}>{p.label}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1 font-medium">Assignee</label>
          <Select.Root value={assignee || '__unassigned'} onValueChange={val => setAssignee(val === '__unassigned' ? '' : val)}>
            <Select.Trigger className="w-full" />
            <Select.Content>
              <Select.Item value="__unassigned">Unassigned</Select.Item>
              {agents.map(a => (
                <Select.Item key={a.id} value={a.id}>{a.name}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-0.5">
          <Button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            size="2"
          >
            {saving ? <Spinner size="1" /> : <Save size={13} className="flex-shrink-0" />}
            Save
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            color="gray"
            size="2"
          >
            <X size={13} className="flex-shrink-0" />
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
