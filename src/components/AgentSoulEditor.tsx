// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { Save, RefreshCw, FileText, Send, Info, Tag, X, Plus, Brain, MessageSquare, Star, ToggleLeft, ToggleRight } from 'lucide-react';
// SOUL V2 MARKER
import { showToast } from './Toast';
import { agentApi } from '../lib/api';

interface AgentSoulEditorProps {
  agentId: string;
  agentName: string;
}

const SOUL_HINT = `---
# SOUL.md — Identity file for this agent
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

export default function AgentSoulEditor({ agentId, agentName }: AgentSoulEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [charCount, setCharCount] = useState(0);

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

  useEffect(() => { loadSoul(); }, [agentId]);

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

  const handleTestDispatch = async () => {
    setDispatching(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[Test] Soul file read — ${agentName}`,
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

  const isDirty = content !== originalContent;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-mission-control-text-dim py-8 justify-center">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm">Loading soul file...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-mission-control-text">
          <FileText size={15} />
          <span>~/mission-control/agents/{agentId}/SOUL.md</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="p-1.5 rounded-lg hover:bg-mission-control-border text-mission-control-text-dim transition-colors"
            title="Show format hints"
          >
            <Info size={14} />
          </button>
          <button
            type="button"
            onClick={loadSoul}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-mission-control-border text-mission-control-text-dim transition-colors"
            title="Reload from disk"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Hint panel */}
      {showHint && (
        <div className="rounded-lg bg-info-subtle border border-info-border p-3">
          <p className="text-xs font-semibold text-info mb-2">Expected format</p>
          <pre className="text-[11px] text-mission-control-text-dim whitespace-pre-wrap font-mono leading-relaxed">
            {SOUL_HINT}
          </pre>
        </div>
      )}

      {/* Editor */}
      <textarea
        value={content}
        onChange={e => handleChange(e.target.value)}
        rows={18}
        spellCheck={false}
        className="w-full rounded-lg border border-mission-control-border bg-mission-control-bg px-3 py-3 text-sm font-mono text-mission-control-text placeholder-mission-control-text-dim/50 focus:outline-none focus:border-mission-control-accent/60 resize-y leading-relaxed"
        placeholder="No soul file yet. Write one to give this agent its identity, skills, and operating principles."
      />

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${charCount > MAX_CHARS * 0.9 ? 'text-warning' : 'text-mission-control-text-dim'}`}>
          {charCount.toLocaleString()} / {(MAX_CHARS / 1024).toFixed(0)}KB
          {isDirty && <span className="ml-2 text-mission-control-accent">Unsaved changes</span>}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestDispatch}
            disabled={dispatching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-mission-control-border rounded-lg hover:bg-mission-control-border text-mission-control-text-dim transition-colors disabled:opacity-50"
            title="Dispatch a test task to this agent to verify its soul file is working"
          >
            {dispatching ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            Test dispatch
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving...' : 'Save soul file'}
          </button>
        </div>
      </div>
    </div>
  );
}
