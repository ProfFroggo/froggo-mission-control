'use client';

import { useState } from 'react';
import { X, Bot, Send, Target, AlertTriangle } from 'lucide-react';
import { Button, IconButton, TextField, TextArea, Flex } from '@radix-ui/themes';
import { getProjectIcon } from './projectIcons';
import { projectsApi } from '../../lib/api';
import type { Project, ProjectMember } from '../../types/projects';
import AgentAvatar from '../AgentAvatar';
import { showToast } from '../Toast';

const PRIORITY_OPTIONS = [
  { value: 'p0', label: 'P0 — Urgent', color: 'text-error' },
  { value: 'p1', label: 'P1 — High',   color: 'text-warning' },
  { value: 'p2', label: 'P2 — Medium', color: 'text-info' },
  { value: 'p3', label: 'P3 — Low',    color: 'text-mission-control-text-dim' },
];

interface ProjectDispatchModalProps {
  project: Project;
  members: ProjectMember[];
  onClose: () => void;
  onDispatched: () => void;
}

export default function ProjectDispatchModal({ project, members, onClose, onDispatched }: ProjectDispatchModalProps) {
  const [agentId, setAgentId] = useState(members[0]?.agentId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'p0' | 'p1' | 'p2' | 'p3'>('p2');
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDispatch = async () => {
    if (!agentId || !title.trim()) return;
    setDispatching(true);
    setError(null);
    try {
      await projectsApi.dispatch(project.id, {
        agentId,
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      onDispatched();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch failed');
      setDispatching(false);
    }
  };

  const canDispatch = agentId && title.trim().length >= 3 && !dispatching;

  return (
    <Flex align="center" justify="center" p="4" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <Flex align="center" justify="between" className="px-5 py-4 border-b border-mission-control-border">
          <Flex align="center" gap="2">
            <Bot size={16} className="text-mission-control-accent" />
            <span className="font-semibold text-mission-control-text text-sm">Dispatch Agent</span>
          </Flex>
          <IconButton
            size="1"
            variant="ghost"

            onClick={onClose}
          >
            <X size={15} />
          </IconButton>
        </Flex>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Project context badge */}
          <Flex align="center" gap="2" className="px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg">
            {(() => { const DispIcon = getProjectIcon(project.emoji); return <DispIcon size={16} style={{ color: project.color }} />; })()}
            <div className="min-w-0">
              <p className="text-xs font-medium text-mission-control-text truncate">{project.name}</p>
              {project.goal && (
                <p className="text-xs text-mission-control-text-dim truncate flex items-center gap-1">
                  <Target size={9} /> {project.goal}
                </p>
              )}
            </div>
          </Flex>

          {error && (
            <Flex align="start" gap="2" className="px-3 py-2 bg-error-subtle border border-error/30 rounded-lg text-error text-xs">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              {error}
            </Flex>
          )}

          {/* Agent selector */}
          <div>
            <label className="text-xs text-mission-control-text-dim mb-2 block">Assign to agent</label>
            {members.length === 0 ? (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle size={12} /> No agents assigned to this project. Add agents first.
              </p>
            ) : (
              <div className="space-y-1.5">
                {members.map(m => (
                  <Button
                    key={m.agentId}
                    variant={agentId === m.agentId ? 'soft' : 'ghost'}
                    size="2"
                    className="w-full justify-start"
                    onClick={() => setAgentId(m.agentId)}
                  >
                    <AgentAvatar agentId={m.agentId} size="sm" />
                    <span className="text-sm">{(m as any).agentName || m.agentId}</span>
                    {agentId === m.agentId && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-mission-control-accent flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Task title */}
          <div>
            <label className="text-xs text-mission-control-text-dim mb-1.5 block">Task title *</label>
            <TextField.Root
              placeholder="What should the agent do?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-mission-control-text-dim mb-1.5 block">
              Brief <span className="opacity-50">(optional — project goal is auto-included)</span>
            </label>
            <TextArea
              placeholder="Additional context, requirements, or constraints..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ resize: 'none' }}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-mission-control-text-dim mb-1.5 block">Priority</label>
            <Flex gap="2">
              {PRIORITY_OPTIONS.map(p => (
                <Button
                  key={p.value}
                  size="1"
                  variant={priority === p.value ? 'soft' : 'ghost'}
                  className="flex-1"
                  onClick={() => setPriority(p.value as typeof priority)}
                >
                  {p.value.toUpperCase()}
                </Button>
              ))}
            </Flex>
          </div>
        </div>

        {/* Footer */}
        <Flex align="center" gap="2" className="px-5 py-4 border-t border-mission-control-border">
          <Button
            size="2"
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="2"
            variant="solid"
            className="flex-1"
            onClick={handleDispatch}
            disabled={!canDispatch}
          >
            <Send size={14} />
            {dispatching ? 'Dispatching...' : 'Dispatch Task'}
          </Button>
        </Flex>
      </div>
    </Flex>
  );
}
