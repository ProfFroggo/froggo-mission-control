'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState } from 'react';
import { X, Bot, Send, AlertTriangle, Megaphone } from 'lucide-react';
import { Button, TextField, TextArea, Flex } from '@radix-ui/themes';
import { campaignsApi } from '../../lib/api';
import type { Campaign, CampaignMember } from '../../types/campaigns';
import AgentAvatar from '../AgentAvatar';
import { showToast } from '../Toast';

const PRIORITY_OPTIONS = [
  { value: 'p0', label: 'P0 — Urgent', color: 'text-error' },
  { value: 'p1', label: 'P1 — High',   color: 'text-warning' },
  { value: 'p2', label: 'P2 — Medium', color: 'text-info' },
  { value: 'p3', label: 'P3 — Low',    color: 'text-mission-control-text-dim' },
];

interface CampaignDispatchModalProps {
  campaign: Campaign;
  members: CampaignMember[];
  onClose: () => void;
  onDispatched: () => void;
}

export default function CampaignDispatchModal({ campaign, members, onClose, onDispatched }: CampaignDispatchModalProps) {
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
      await campaignsApi.dispatch(campaign.id, {
        agentId,
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      showToast('Task dispatched!', 'success');
      onDispatched();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch failed');
      setDispatching(false);
    }
  };

  const canDispatch = agentId && title.trim().length >= 3 && !dispatching;

  return (
    <Flex align="center" justify="center" p="4" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <Flex align="center" gap="2">
            <Bot size={16} className="text-mission-control-accent" />
            <span className="text-base font-semibold text-mission-control-text">Dispatch Agent</span>
          </Flex>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Campaign context badge */}
          <Flex align="center" gap="2" className="px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <Megaphone size={15} style={{ color: campaign.color }} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-mission-control-text truncate">{campaign.name}</p>
              {campaign.goal && (
                <p className="text-xs text-mission-control-text-dim truncate">{campaign.goal}</p>
              )}
            </div>
            <span className="ml-auto text-xs text-mission-control-text-dim flex-shrink-0">{campaign.type}</span>
          </Flex>

          {error && (
            <Flex align="start" gap="2" className="px-3 py-2 bg-error/10 border border-error/30 rounded-lg text-error text-xs">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              {error}
            </Flex>
          )}

          {/* Agent selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-mission-control-text-dim mb-1 block">Assign to agent</label>
            {members.length === 0 ? (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle size={12} /> No agents assigned to this campaign. Add agents first.
              </p>
            ) : (
              <div className="space-y-1.5">
                {members.map(m => (
                  <button
                    key={m.agentId}
                    type="button"
                    onClick={() => setAgentId(m.agentId)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                      agentId === m.agentId ? 'bg-mission-control-accent/10 border-mission-control-accent/40' : 'border-mission-control-border hover:border-mission-control-accent/30'
                    }`}
                  >
                    <AgentAvatar agentId={m.agentId} size="sm" />
                    <span className="text-sm">{(m as any).agentName || m.agentId}</span>
                    {agentId === m.agentId && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-mission-control-accent flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-mission-control-surface" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Task title */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-mission-control-text-dim mb-1 block">Task title *</label>
            <TextField.Root
              placeholder="What should the agent do?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-mission-control-text-dim mb-1 block">
              Brief <span className="opacity-50">(optional — campaign context is auto-included)</span>
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-mission-control-text-dim mb-1 block">Priority</label>
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value as typeof priority)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
                    priority === p.value ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  {p.value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <Button
            type="button"
            size="2"
            variant="ghost"
            color="gray"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="2"
            variant="solid"
            onClick={handleDispatch}
            disabled={!canDispatch}
          >
            <Send size={14} />
            {dispatching ? 'Dispatching...' : 'Dispatch Task'}
          </Button>
        </div>
      </div>
    </Flex>
  );
}
