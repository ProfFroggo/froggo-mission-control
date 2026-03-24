'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState } from 'react';
import { X, Bot, Send, AlertTriangle, Megaphone } from 'lucide-react';
import { Button, IconButton, TextField, TextArea, Flex } from '@radix-ui/themes';
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
      <div className="w-full max-w-md bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mission-control-border">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-mission-control-accent" />
            <span className="font-semibold text-mission-control-text text-sm">Dispatch Agent</span>
          </div>
          <IconButton
            size="1"
            variant="ghost"
           
            onClick={onClose}
          >
            <X size={15} />
          </IconButton>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Campaign context badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <Megaphone size={15} style={{ color: campaign.color }} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-mission-control-text truncate">{campaign.name}</p>
              {campaign.goal && (
                <p className="text-xs text-mission-control-text-dim truncate">{campaign.goal}</p>
              )}
            </div>
            <span className="ml-auto text-xs text-mission-control-text-dim flex-shrink-0">{campaign.type}</span>
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
                <AlertTriangle size={12} /> No agents assigned to this campaign. Add agents first.
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
          <div>
            <label className="text-xs text-mission-control-text-dim mb-1.5 block">Priority</label>
            <div className="flex gap-2">
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
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-mission-control-border">
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
        </div>
      </div>
    </Flex>
  );
}
