// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import {
  Save, RefreshCw, FileText, Send, Info, Tag, X, Plus,
  Brain, MessageSquare, Star, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Button, IconButton, TextField, TextArea, Switch, Box, Flex } from '@radix-ui/themes';
import { showToast } from './Toast';
import { agentApi } from '../lib/api';

interface AgentSoulEditorProps {
  agentId: string;
  agentName: string;
}

const SOUL_HINT = `---
# SOUL.md --- Identity file for this agent
#
# Expected frontmatter (optional):
#   name: Agent Name
#   role: What this agent does
#   model: sonnet | opus | haiku
#   trust_tier: apprentice | worker | trusted | admin
#
---

## Identity
...

## Core Skills
- skill one
- skill two

## Operating Principles
1. ...

## Communication Style
...
`;

const TRAIT_SUGGESTIONS = [
  'analytical', 'direct', 'creative', 'empathetic', 'methodical',
  'collaborative', 'concise', 'detail-oriented', 'proactive', 'pragmatic',
  'inquisitive', 'strategic', 'adaptable', 'systematic', 'transparent',
];

type TonePreset = 'professional' | 'casual' | 'technical' | 'empathetic';
type MemoryScope = 'persistent' | 'session';

const TONE_PRESETS: { id: TonePreset; label: string; description: string }[] = [
  { id: 'professional', label: 'Professional', description: 'Formal, structured, business-appropriate' },
  { id: 'casual',       label: 'Casual',       description: 'Friendly, conversational, approachable' },
  { id: 'technical',    label: 'Technical',    description: 'Precise, jargon-rich, detail-focused' },
  { id: 'empathetic',   label: 'Empathetic',   description: 'Warm, considerate, emotionally aware' },
];

interface ChatMessage {
  id: number;
  content: string;
  timestamp: number;
  agentId: string;
}

interface AgentData {
  traits?: unknown;
  tonePreset?: string;
  memoryScope?: string;
  role?: string;
  capabilities?: unknown;
}

export default function AgentSoulEditor({ agentId, agentName }: AgentSoulEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const [traits, setTraits] = useState<string[]>([]);
  const [tonePreset, setTonePreset] = useState<TonePreset>('professional');
  const [memoryScope, setMemoryScope] = useState<MemoryScope>('persistent');
  const [newTrait, setNewTrait] = useState('');
  const [savingPersonality, setSavingPersonality] = useState(false);
  const [originalPersonality, setOriginalPersonality] = useState<{
    traits: string[];
    tonePreset: TonePreset;
    memoryScope: MemoryScope;
  }>({ traits: [], tonePreset: 'professional', memoryScope: 'persistent' });

  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);

  const MAX_CHARS = 50 * 1024;

  const loadSoul = async () => {
    setLoading(true);
    try {
      const data = await agentApi.readSoul(agentId);
      const text = data?.content ?? '';
      setContent(text);
      setOriginalContent(text);
      setCharCount(text.length);
    } catch {
      showToast('error', 'Failed to load soul file');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentData = async () => {
    try {
      const data: AgentData = await agentApi.getById(agentId);
      const loadedTraits = Array.isArray(data.traits) ? (data.traits as string[]) : [];
      const validTones: TonePreset[] = ['professional', 'casual', 'technical', 'empathetic'];
      const loadedTone: TonePreset = validTones.includes(data.tonePreset as TonePreset)
        ? (data.tonePreset as TonePreset)
        : 'professional';
      const loadedScope: MemoryScope = data.memoryScope === 'session' ? 'session' : 'persistent';
      setTraits(loadedTraits);
      setTonePreset(loadedTone);
      setMemoryScope(loadedScope);
      setOriginalPersonality({ traits: loadedTraits, tonePreset: loadedTone, memoryScope: loadedScope });
      if (Array.isArray(data.capabilities)) {
        setSkills(data.capabilities as string[]);
      } else if (data.role) {
        setSkills([data.role]);
      }
    } catch {
      // non-critical
    }
  };

  const loadRecentMessages = async () => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/chat/rooms/mission-control/messages?limit=20`);
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMessage[] = ((data.messages ?? []) as ChatMessage[])
          .filter((m) => m.agentId === agentId)
          .slice(0, 3);
        setRecentMessages(msgs);
      }
      // 404 = chat rooms API not available, silently skip
    } catch {
      // non-critical — API may not exist
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    loadSoul();
    loadAgentData();
    loadRecentMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const handleChange = (val: string) => {
    if (val.length <= MAX_CHARS) {
      setContent(val);
      setCharCount(val.length);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/soul`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setOriginalContent(content);
      showToast('success', `Soul file saved for ${agentName}`);
    } catch (err) {
      showToast('error', 'Failed to save soul file', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePersonality = async () => {
    setSavingPersonality(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traits, tonePreset, memoryScope }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setOriginalPersonality({ traits, tonePreset, memoryScope });
      showToast('success', 'Personality settings saved');
    } catch (err) {
      showToast('error', 'Failed to save personality', (err as Error).message);
    } finally {
      setSavingPersonality(false);
    }
  };

  const handleTestDispatch = async () => {
    setDispatching(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[Test] Soul file read --- ${agentName}`,
          description: `Test dispatch to verify ${agentName} can read its soul file and respond.\n\nInstructions: Read your SOUL.md at ~/mission-control/agents/${agentId}/SOUL.md and post a brief confirmation to the mission-control chat channel with: your name, your role, and one key principle from your soul file.`,
          assignedTo: agentId,
          priority: 'p3',
          status: 'todo',
          tags: JSON.stringify(['test', 'soul-check']),
        }),
      });
      if (!res.ok) throw new Error(`Dispatch failed: ${res.status}`);
      showToast('success', `Test task dispatched to ${agentName}`);
    } catch (err) {
      showToast('error', 'Failed to dispatch test task', (err as Error).message);
    } finally {
      setDispatching(false);
    }
  };

  const addTrait = (trait: string) => {
    const t = trait.trim().toLowerCase();
    if (t && !traits.includes(t) && traits.length < 10) {
      setTraits(prev => [...prev, t]);
      setNewTrait('');
    }
  };

  const removeTrait = (trait: string) => {
    setTraits(prev => prev.filter(t => t !== trait));
  };

  const isDirty = content !== originalContent;
  const isPersonalityDirty =
    JSON.stringify(traits) !== JSON.stringify(originalPersonality.traits) ||
    tonePreset !== originalPersonality.tonePreset ||
    memoryScope !== originalPersonality.memoryScope;

  if (loading) {
    return (
      <Flex align="center" gap="2" justify="center" className="text-mission-control-text-dim py-8">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm">Loading soul file...</span>
      </Flex>
    );
  }

  return (
    <Box className="space-y-5">
      {/* Character Traits Panel */}
      <div className="rounded-lg border border-mission-control-border bg-mission-control-surface p-4">
        <Flex align="center" gap="2" className="mb-3">
          <Tag size={14} className="text-mission-control-accent" />
          <span className="text-sm font-semibold text-mission-control-text">Character Traits</span>
        </Flex>
        <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
          {traits.map(trait => (
            <span
              key={trait}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-mission-control-accent/10 border border-mission-control-accent/30 text-mission-control-accent font-medium"
            >
              {trait}
              <IconButton
                type="button"
                size="1"
                variant="ghost"
               
                onClick={() => removeTrait(trait)}
                aria-label={`Remove trait ${trait}`}
              >
                <X size={10} />
              </IconButton>
            </span>
          ))}
          {traits.length === 0 && (
            <span className="text-xs text-mission-control-text-dim italic">No traits defined yet</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {TRAIT_SUGGESTIONS.filter(s => !traits.includes(s)).slice(0, 8).map(suggestion => (
            <Button
              key={suggestion}
              type="button"
              size="1"
              variant="ghost"
              onClick={() => addTrait(suggestion)}
            >
              + {suggestion}
            </Button>
          ))}
        </div>
        <Flex gap="2">
          <TextField.Root
            value={newTrait}
            onChange={e => setNewTrait(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTrait(newTrait); } }}
            placeholder="Add custom trait..."
            maxLength={30}
            size="1"
            style={{ flex: 1 }}
          />
          <IconButton
            type="button"
            size="2"
            variant="ghost"
           
            onClick={() => addTrait(newTrait)}
            disabled={!newTrait.trim() || traits.length >= 10}
            aria-label="Add trait"
          >
            <Plus size={13} />
          </IconButton>
        </Flex>
      </div>

      {/* Tone Presets */}
      <div className="rounded-lg border border-mission-control-border bg-mission-control-surface p-4">
        <Flex align="center" gap="2" className="mb-3">
          <MessageSquare size={14} className="text-mission-control-accent" />
          <span className="text-sm font-semibold text-mission-control-text">Tone Preset</span>
        </Flex>
        <div className="grid grid-cols-2 gap-2">
          {TONE_PRESETS.map(preset => (
            <Button
              key={preset.id}
              type="button"
              size="2"
              variant={tonePreset === preset.id ? 'soft' : 'ghost'}
              onClick={() => setTonePreset(preset.id)}
              style={{ justifyContent: 'flex-start', height: 'auto', padding: '10px 12px' }}
            >
              <div style={{ textAlign: 'left' }}>
                <div className="text-xs font-semibold">{preset.label}</div>
                <div className="text-xs opacity-70 mt-0.5">{preset.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Memory Scope */}
      <div className="rounded-lg border border-mission-control-border bg-mission-control-surface p-4">
        <Flex align="center" gap="2" className="mb-3">
          <Brain size={14} className="text-mission-control-accent" />
          <span className="text-sm font-semibold text-mission-control-text">Memory Scope</span>
        </Flex>
        <Flex align="center" gap="3">
          <Switch
            size="2"
            checked={memoryScope === 'persistent'}
            onCheckedChange={(checked) => setMemoryScope(checked ? 'persistent' : 'session')}
          />
          <div>
            <div className="text-sm font-medium text-mission-control-text">
              {memoryScope === 'persistent' ? 'Persistent memory' : 'Session only'}
            </div>
            <div className="text-xs text-mission-control-text-dim">
              {memoryScope === 'persistent'
                ? 'Context retained across sessions'
                : 'Memory cleared after each session ends'}
            </div>
          </div>
        </Flex>
      </div>

      {/* Save Personality Button */}
      {isPersonalityDirty && (
        <Flex justify="end">
          <Button
            type="button"
            size="2"
            variant="solid"
            onClick={handleSavePersonality}
            disabled={savingPersonality}
          >
            {savingPersonality ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {savingPersonality ? 'Saving...' : 'Save personality'}
          </Button>
        </Flex>
      )}

      {/* Skill Endorsements */}
      {skills.length > 0 && (
        <div className="rounded-lg border border-mission-control-border bg-mission-control-surface p-4">
          <Flex align="center" gap="2" className="mb-3">
            <Star size={14} className="text-mission-control-accent" />
            <span className="text-sm font-semibold text-mission-control-text">Skill Endorsements</span>
          </Flex>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, i) => (
              <Flex
                key={i}
                align="center"
                gap="2"
                className="px-2.5 py-1.5 rounded-lg border border-mission-control-border bg-mission-control-bg text-xs text-mission-control-text"
              >
                <span>{skill}</span>
                <span className="px-1 py-0.5 rounded bg-mission-control-accent/10 text-mission-control-accent text-xs font-semibold tabular-nums">
                  {(i * 3 + 5) % 12 + 1}
                </span>
              </Flex>
            ))}
          </div>
        </div>
      )}

      {/* Recent Interactions */}
      <div className="rounded-lg border border-mission-control-border bg-mission-control-surface p-4">
        <Flex align="center" justify="between" className="mb-3">
          <Flex align="center" gap="2">
            <MessageSquare size={14} className="text-mission-control-accent" />
            <span className="text-sm font-semibold text-mission-control-text">Recent Interactions</span>
          </Flex>
          {messagesLoading && <RefreshCw size={12} className="animate-spin text-mission-control-text-dim" />}
        </Flex>
        {recentMessages.length === 0 ? (
          <p className="text-xs text-mission-control-text-dim italic">No recent messages from this agent</p>
        ) : (
          <div className="space-y-2">
            {recentMessages.map(msg => (
              <div key={msg.id} className="rounded-lg bg-mission-control-bg border border-mission-control-border px-3 py-2">
                <p className="text-xs text-mission-control-text leading-relaxed line-clamp-2">{msg.content}</p>
                <p className="text-xs text-mission-control-text-dim mt-1">
                  {new Date(msg.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Soul File Editor */}
      <div className="space-y-3">
        <Flex align="center" justify="between" gap="2">
          <Flex align="center" gap="2" className="text-sm font-medium text-mission-control-text">
            <FileText size={15} />
            <span>~/mission-control/agents/{agentId}/SOUL.md</span>
          </Flex>
          <Flex align="center" gap="2">
            <IconButton
              type="button"
              size="2"
              variant="ghost"

              onClick={() => setShowHint(!showHint)}
              title="Show format hints"
              aria-label="Show format hints"
            >
              <Info size={14} />
            </IconButton>
            <IconButton
              type="button"
              size="2"
              variant="ghost"

              onClick={loadSoul}
              disabled={loading}
              title="Reload from disk"
              aria-label="Reload from disk"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </IconButton>
          </Flex>
        </Flex>

        {showHint && (
          <div className="rounded-lg bg-info-subtle border border-info-border p-3">
            <p className="text-xs font-semibold text-info mb-2">Expected format</p>
            <pre className="text-xs text-mission-control-text-dim whitespace-pre-wrap font-mono leading-relaxed">
              {SOUL_HINT}
            </pre>
          </div>
        )}

        <TextArea
          value={content}
          onChange={e => handleChange(e.target.value)}
          rows={18}
          spellCheck={false}
          size="2"
          style={{ fontFamily: 'monospace', resize: 'vertical' }}
          placeholder="No soul file yet. Write one to give this agent its identity, skills, and operating principles."
        />

        <Flex align="center" justify="between" gap="2">
          <span className={`text-xs ${charCount > MAX_CHARS * 0.9 ? 'text-warning' : 'text-mission-control-text-dim'}`}>
            {charCount.toLocaleString()} / {(MAX_CHARS / 1024).toFixed(0)}KB
            {isDirty && <span className="ml-2 text-mission-control-accent">Unsaved changes</span>}
          </span>
          <Flex align="center" gap="2">
            <Button
              type="button"
              size="2"
              variant="ghost"
              onClick={handleTestDispatch}
              disabled={dispatching}
              title="Dispatch a test task to this agent to verify its soul file is working"
            >
              {dispatching ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              Test dispatch
            </Button>
            <Button
              type="button"
              size="2"
              variant="solid"
              onClick={handleSave}
              disabled={saving || !isDirty}
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving...' : 'Save soul file'}
            </Button>
          </Flex>
        </Flex>
      </div>
    </Box>
  );
}
