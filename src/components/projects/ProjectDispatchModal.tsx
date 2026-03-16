'use client';

import { useState } from 'react';
import { X, Bot, Send, Target, AlertTriangle } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mission-control-border">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-mission-control-accent" />
            <span className="font-semibold text-mission-control-text text-sm">Dispatch Agent</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface rounded transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Project context badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg">
            {(() => { const DispIcon = getProjectIcon(project.emoji); return <DispIcon size={16} style={{ color: project.color }} />; })()}
            <div className="min-w-0">
              <p className="text-xs font-medium text-mission-control-text truncate">{project.name}</p>
              {project.goal && (
                <p className="text-xs text-mission-control-text-dim truncate flex items-center gap-1">
                  <Target size={9} /> {project.goal}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-error-subtle border border-error/30 rounded-lg text-error text-xs">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
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
                  <button
                    key={m.agentId}
                    onClick={() => setAgentId(m.agentId)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left ${
                      agentId === m.agentId
                        ? 'border-mission-control-accent/50 bg-mission-control-accent/10'
                        : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/30'
                    }`}
                  >
                    <AgentAvatar agentId={m.agentId} size="sm" />
                    <span className="text-sm text-mission-control-text">{(m as any).agentName || m.agentId}</span>
                    {agentId === m.agentId && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-mission-control-accent flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Task title */}
          <div>
            <label className="text-xs text-mission-control-text-dim mb-1.5 block">Task title *</label>
            <input
              type="text"
              placeholder="What should the agent do?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text placeholder-mission-control-text-dim text-sm focus:outline-none focus:border-mission-control-accent/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-mission-control-text-dim mb-1.5 block">
              Brief <span className="opacity-50">(optional — project goal is auto-included)</span>
            </label>
            <textarea
              placeholder="Additional context, requirements, or constraints..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text placeholder-mission-control-text-dim text-sm focus:outline-none focus:border-mission-control-accent/50 resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-mission-control-text-dim mb-1.5 block">Priority</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value as typeof priority)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                    priority === p.value
                      ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                      : 'border-mission-control-border text-mission-control-text-dim hover:border-mission-control-accent/30'
                  }`}
                >
                  {p.value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-mission-control-border">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-mission-control-border text-mission-control-text-dim rounded-lg hover:text-mission-control-text hover:bg-mission-control-surface transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleDispatch}
            disabled={!canDispatch}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <Send size={14} />
            {dispatching ? 'Dispatching...' : 'Dispatch Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
