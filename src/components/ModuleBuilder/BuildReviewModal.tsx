// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState } from 'react';
import { X, ChevronDown, ChevronRight, User, LayoutGrid, CheckCircle2 } from 'lucide-react';
import { Button, Select, Flex } from '@radix-ui/themes';
import type { ModuleSpec } from './types';
import { generateTasksForModule, type GeneratedTask } from './TaskGenerator';

interface Props {
  spec: ModuleSpec;
  moduleId: string;
  wireframe: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const agentColors: Record<string, string> = {
  coder: 'bg-[var(--color-info)]/20 text-[var(--color-info)]',
  'senior-coder': 'bg-[var(--color-review)]/20 text-[var(--color-review)]',
  designer: 'bg-pink-500/20 text-pink-400',
  writer: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  clara: 'bg-[var(--color-review)]-subtle text-[var(--color-review)]',
};

export default function BuildReviewModal({ spec, moduleId, wireframe, onConfirm, onCancel }: Props) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [agentOverrides, setAgentOverrides] = useState<Record<number, string>>({});

  const baseTasks = generateTasksForModule(spec, moduleId, wireframe);
  const tasks: GeneratedTask[] = baseTasks.map((t, i) => ({
    ...t,
    assignedTo: agentOverrides[i] ?? t.assignedTo,
  }));

  const toggleExpand = (i: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const agentOptions = ['coder', 'senior-coder', 'designer', 'writer', 'clara', 'researcher'];

  return (
    <Flex
      align="center"
      justify="center"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative flex flex-col bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl w-[680px] max-w-[95vw] max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-mission-control-text">Build Plan Review</h2>
            <p className="text-xs text-mission-control-text-dim mt-0.5">{spec.name}</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {/* Wireframe thumbnail */}
          {wireframe && (
            <div className="mb-4">
              <Flex align="center" gap="2" className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">
                <LayoutGrid size={12} /> Wireframe Preview
              </Flex>
              <div className="bg-mission-control-bg border border-mission-control-border rounded-xl p-4 max-h-[140px] overflow-hidden relative">
                <div
                  style={{ transform: 'scale(0.55)', transformOrigin: 'top left', width: '181%', pointerEvents: 'none' }}
                  dangerouslySetInnerHTML={{ __html: wireframe }}
                />
              </div>
            </div>
          )}

          {/* Task list */}
          <p className="text-xs text-mission-control-text-dim">
            All {tasks.length} tasks will be created and added to Kanban.
          </p>
          {tasks.map((task, i) => (
            <div key={i} className="border border-mission-control-border rounded-lg overflow-hidden">
              <div
                className="flex items-start gap-3 px-4 py-3 bg-mission-control-bg cursor-pointer hover:bg-mission-control-bg/80 transition-colors"
                onClick={() => toggleExpand(i)}
              >
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors mt-0.5 flex-shrink-0"
                  aria-label={expandedTasks.has(i) ? 'Collapse' : 'Expand'}
                >
                  {expandedTasks.has(i) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-mission-control-text leading-snug">{task.title}</p>
                  <p className="text-xs text-mission-control-text-dim mt-0.5">{task.subtasks.length} subtasks</p>
                </div>
                {/* Agent selector */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <User size={12} className="text-mission-control-text-dim" />
                  <Select.Root
                    size="1"
                    value={agentOverrides[i] ?? task.assignedTo}
                    onValueChange={(val) => setAgentOverrides(prev => ({ ...prev, [i]: val }))}
                  >
                    <Select.Trigger onClick={(e) => e.stopPropagation()} />
                    <Select.Content>
                      {agentOptions.map(a => (
                        <Select.Item key={a} value={a}>{a}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>
              {expandedTasks.has(i) && task.subtasks.length > 0 && (
                <div className="px-4 py-2 border-t border-mission-control-border/50 bg-mission-control-surface">
                  <ul className="space-y-1">
                    {task.subtasks.map((sub, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-mission-control-text-dim">
                        <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0 text-mission-control-border" />
                        {sub.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <Button size="2" variant="ghost" onClick={onCancel}>
            Edit Spec
          </Button>
          <Button size="2" variant="solid" onClick={onConfirm}>
            Confirm & Build ({tasks.length} tasks)
          </Button>
        </div>
      </div>
    </Flex>
  );
}
