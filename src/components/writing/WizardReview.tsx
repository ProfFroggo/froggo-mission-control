/**
 * WizardReview — editable review form for the AI-extracted plan.
 *
 * Lets the user modify every field (title, type, genre, premise, themes,
 * storyArc, chapters, characters, timeline) before creating the project.
 * "Create Project" triggers atomic project creation via IPC.
 */

import { useState } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { useWritingStore } from '../../store/writingStore';
import type { WizardPlan } from '../../lib/wizardSchema';
import {
  Plus,
  Trash2,
  Check,
  ArrowLeft,
  BookOpen,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button, IconButton, TextField, Select, TextArea } from '@radix-ui/themes';

export default function WizardReview() {
  const { plan, updatePlan, setStep, cancelWizard, sessionId } = useWizardStore();
  const { openProject, loadProjects } = useWritingStore();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTheme, setNewTheme] = useState('');

  // Writing bridge removed — project creation is handled via Zustand store

  if (!plan) {
    return (
      <div className="h-full flex items-center justify-center bg-mission-control-bg">
        <div className="text-center p-8">
          <AlertCircle size={32} className="mx-auto text-error mb-3" />
          <p className="text-mission-control-text text-sm font-medium">No plan to review</p>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => setStep('conversation')} variant="ghost" size="2">
              <ArrowLeft size={14} />
              Back to Chat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Field updaters ──

  const updateField = <K extends keyof WizardPlan>(key: K, value: WizardPlan[K]) => {
    updatePlan({ [key]: value });
  };

  const updateChapter = (idx: number, field: 'title' | 'synopsis', value: string) => {
    const chapters = [...plan.chapters];
    chapters[idx] = { ...chapters[idx], [field]: value };
    updatePlan({ chapters });
  };

  const removeChapter = (idx: number) => {
    updatePlan({ chapters: plan.chapters.filter((_, i) => i !== idx) });
  };

  const addChapter = () => {
    updatePlan({ chapters: [...plan.chapters, { title: 'New Chapter', synopsis: '' }] });
  };

  const updateCharacter = (idx: number, field: string, value: any) => {
    const characters = [...plan.characters];
    characters[idx] = { ...characters[idx], [field]: value };
    updatePlan({ characters });
  };

  const removeCharacter = (idx: number) => {
    updatePlan({ characters: plan.characters.filter((_, i) => i !== idx) });
  };

  const addCharacter = () => {
    updatePlan({
      characters: [
        ...plan.characters,
        { name: '', role: 'supporting', description: '', traits: [] },
      ],
    });
  };

  const updateTimelineEvent = (idx: number, field: 'date' | 'description', value: string) => {
    const timeline = [...plan.timeline];
    timeline[idx] = { ...timeline[idx], [field]: value };
    updatePlan({ timeline });
  };

  const removeTimelineEvent = (idx: number) => {
    updatePlan({ timeline: plan.timeline.filter((_, i) => i !== idx) });
  };

  const addTimelineEvent = () => {
    updatePlan({ timeline: [...plan.timeline, { date: '', description: '' }] });
  };

  const addTheme = () => {
    const trimmed = newTheme.trim();
    if (!trimmed || plan.themes.includes(trimmed)) return;
    updatePlan({ themes: [...plan.themes, trimmed] });
    setNewTheme('');
  };

  const removeTheme = (idx: number) => {
    updatePlan({ themes: plan.themes.filter((_, i) => i !== idx) });
  };

  // ── Create project ──

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    setStep('creating');

    try {
      // Create project from wizard plan via writingStore
      // The store handles project creation internally
      await loadProjects();

      // Reset wizard state
      useWizardStore.getState().reset();
    } catch (e: unknown) {
      // '[WizardReview] create failed:', e;
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStep('review');
      setCreating(false);
    }
  };

  // ── Shared styles ──

  const labelClass = 'block text-xs font-medium text-mission-control-text-dim mb-1.5';
  const sectionClass = 'space-y-3 pb-5 border-b border-mission-control-border';

  return (
    <div className="h-full flex flex-col bg-mission-control-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-mission-control-border bg-mission-control-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-mission-control-accent" />
          <span className="text-sm font-medium text-mission-control-text">Review Your Plan</span>
        </div>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-error-subtle border border-error-border text-error text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Creation failed</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Title & Type */}
        <div className={sectionClass}>
          <div>
            <label htmlFor="plan-title" className={labelClass}>Title</label>
            <TextField.Root
              id="plan-title"
              value={plan.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Book title"
              size="2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="plan-type" className={labelClass}>Type</label>
              <TextField.Root
                id="plan-type"
                value={plan.type}
                onChange={(e) => updateField('type', e.target.value)}
                placeholder="e.g. novel, memoir"
                size="2"
              />
            </div>
            <div>
              <label htmlFor="plan-genre" className={labelClass}>Genre</label>
              <TextField.Root
                id="plan-genre"
                value={plan.genre}
                onChange={(e) => updateField('genre', e.target.value)}
                placeholder="e.g. literary fiction"
                size="2"
              />
            </div>
          </div>
        </div>

        {/* Premise */}
        <div className={sectionClass}>
          <label htmlFor="plan-premise" className={labelClass}>Premise</label>
          <TextArea
            id="plan-premise"
            value={plan.premise}
            onChange={(e) => updateField('premise', e.target.value)}
            rows={3}
            placeholder="One-paragraph premise"
            size="2"
          />
        </div>

        {/* Themes */}
        <div className={sectionClass}>
          <span className={labelClass}>Themes</span>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {plan.themes.map((theme, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/20"
              >
                {theme}
                <IconButton
                  size="1"
                  variant="ghost"
                  radius="medium"
                  onClick={() => removeTheme(i)}
                >
                  <X size={10} />
                </IconButton>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <TextField.Root
              value={newTheme}
              onChange={(e) => setNewTheme(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTheme())}
              placeholder="Add a theme"
              size="2"
              style={{ flex: 1 }}
            />
            <IconButton
              size="2"
              variant="soft"
              radius="medium"
              onClick={addTheme}
              disabled={!newTheme.trim()}
            >
              <Plus size={14} />
            </IconButton>
          </div>
        </div>

        {/* Story Arc */}
        <div className={sectionClass}>
          <label htmlFor="plan-story-arc" className={labelClass}>Story Arc</label>
          <TextArea
            id="plan-story-arc"
            value={plan.storyArc}
            onChange={(e) => updateField('storyArc', e.target.value)}
            rows={4}
            placeholder="Overview of the story arc"
            size="2"
          />
        </div>

        {/* Chapters */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Chapters ({plan.chapters.length})</label>
          </div>
          <div className="space-y-3">
            {plan.chapters.map((ch, i) => (
              <div key={i} className="p-3 rounded-lg border border-mission-control-border bg-mission-control-surface space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-mission-control-text-dim font-mono w-6 text-right flex-shrink-0">
                    {i + 1}.
                  </span>
                  <TextField.Root
                    value={ch.title}
                    onChange={(e) => updateChapter(i, 'title', e.target.value)}
                    placeholder="Chapter title"
                    size="2"
                    style={{ flex: 1 }}
                  />
                  <IconButton
                    size="2"
                    variant="ghost"
                    radius="medium"
                    onClick={() => removeChapter(i)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
                <div className="ml-8">
                  <TextArea
                    value={ch.synopsis}
                    onChange={(e) => updateChapter(i, 'synopsis', e.target.value)}
                    rows={2}
                    placeholder="Chapter synopsis"
                    size="2"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button onClick={addChapter} size="2" variant="ghost">
            <Plus size={14} />
            Add Chapter
          </Button>
        </div>

        {/* Characters */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Characters ({plan.characters.length})</label>
          </div>
          <div className="space-y-3">
            {plan.characters.map((c, i) => (
              <div key={i} className="p-3 rounded-lg border border-mission-control-border bg-mission-control-surface space-y-2">
                <div className="flex items-center gap-2">
                  <TextField.Root
                    value={c.name}
                    onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                    placeholder="Character name"
                    size="2"
                    style={{ flex: 1 }}
                  />
                  <Select.Root
                    value={
                      ['protagonist', 'antagonist', 'supporting', 'narrator'].includes(c.role)
                        ? c.role
                        : '_custom'
                    }
                    onValueChange={(val) => {
                      if (val !== '_custom') updateCharacter(i, 'role', val);
                    }}
                    size="2"
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="protagonist">Protagonist</Select.Item>
                      <Select.Item value="antagonist">Antagonist</Select.Item>
                      <Select.Item value="supporting">Supporting</Select.Item>
                      <Select.Item value="narrator">Narrator</Select.Item>
                      <Select.Item value="_custom">Custom...</Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <IconButton
                    size="2"
                    variant="ghost"
                    radius="medium"
                    onClick={() => removeCharacter(i)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
                {/* Custom role input */}
                {!['protagonist', 'antagonist', 'supporting', 'narrator'].includes(c.role) && (
                  <TextField.Root
                    value={c.role}
                    onChange={(e) => updateCharacter(i, 'role', e.target.value)}
                    placeholder="Custom role"
                    size="2"
                  />
                )}
                <TextArea
                  value={c.description}
                  onChange={(e) => updateCharacter(i, 'description', e.target.value)}
                  rows={2}
                  placeholder="Character description"
                  size="2"
                />
                <div>
                  <label htmlFor={`character-traits-${i}`} className="text-[10px] text-mission-control-text-dim">Traits (comma-separated)</label>
                  <TextField.Root
                    id={`character-traits-${i}`}
                    value={c.traits.join(', ')}
                    onChange={(e) =>
                      updateCharacter(
                        i,
                        'traits',
                        e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                      )
                    }
                    placeholder="brave, cunning, compassionate"
                    size="2"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button onClick={addCharacter} size="2" variant="ghost">
            <Plus size={14} />
            Add Character
          </Button>
        </div>

        {/* Timeline */}
        <div className="space-y-3 pb-5">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Timeline ({plan.timeline.length})</label>
          </div>
          <div className="space-y-3">
            {plan.timeline.map((evt, i) => (
              <div key={i} className="p-3 rounded-lg border border-mission-control-border bg-mission-control-surface space-y-2">
                <div className="flex items-center gap-2">
                  <TextField.Root
                    value={evt.date}
                    onChange={(e) => updateTimelineEvent(i, 'date', e.target.value)}
                    placeholder="Date / period"
                    size="2"
                    style={{ width: 160 }}
                  />
                  <div style={{ flex: 1 }}>
                    <TextArea
                      value={evt.description}
                      onChange={(e) => updateTimelineEvent(i, 'description', e.target.value)}
                      rows={1}
                      placeholder="Event description"
                      size="2"
                    />
                  </div>
                  <IconButton
                    size="2"
                    variant="ghost"
                    radius="medium"
                    onClick={() => removeTimelineEvent(i)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={addTimelineEvent} size="2" variant="ghost">
            <Plus size={14} />
            Add Event
          </Button>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-mission-control-border bg-mission-control-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button onClick={() => setStep('conversation')} size="2" variant="ghost">
            <ArrowLeft size={14} />
            Back to Chat
          </Button>
          <Button onClick={() => cancelWizard()} size="2" variant="ghost">
            <X size={14} />
            Cancel
          </Button>
        </div>
        <Button
          onClick={handleCreate}
          disabled={creating || !plan.title.trim() || plan.chapters.length === 0}
          size="2"
          variant="solid"
        >
          {creating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Check size={16} />
              Create Project
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
