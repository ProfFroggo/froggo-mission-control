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

export default function WizardReview() {
  const { plan, updatePlan, setStep, cancelWizard, sessionId } = useWizardStore();
  const { openProject, loadProjects } = useWritingStore();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTheme, setNewTheme] = useState('');

  const bridge = () => (window as any).clawdbot?.writing;

  if (!plan) {
    return (
      <div className="h-full flex items-center justify-center bg-clawd-bg">
        <div className="text-center p-8">
          <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
          <p className="text-clawd-text text-sm font-medium">No plan to review</p>
          <button
            onClick={() => setStep('conversation')}
            className="mt-4 flex items-center gap-1.5 mx-auto px-4 py-2 rounded-lg border border-clawd-border text-sm text-clawd-text-dim hover:border-clawd-accent transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Chat
          </button>
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
      const result = await bridge()?.project?.createFromWizard(plan);

      if (!result?.success) {
        throw new Error(result?.error || 'Project creation failed');
      }

      // Clean up wizard state file
      try {
        if (sessionId) {
          await bridge()?.wizard?.delete(sessionId);
        }
      } catch {
        // best-effort cleanup
      }

      // Refresh project list and open the new project
      await loadProjects();
      await openProject(result.project.id);

      // Reset wizard state
      useWizardStore.getState().reset();
    } catch (e: any) {
      console.error('[WizardReview] create failed:', e);
      setError(e.message || 'Unknown error');
      setStep('review');
      setCreating(false);
    }
  };

  // ── Shared styles ──

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-clawd-bg border border-clawd-border text-clawd-text text-sm placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent';
  const textareaClass = `${inputClass} resize-y min-h-[60px]`;
  const labelClass = 'block text-xs font-medium text-clawd-text-dim mb-1.5';
  const sectionClass = 'space-y-3 pb-5 border-b border-clawd-border';

  return (
    <div className="h-full flex flex-col bg-clawd-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-clawd-border bg-clawd-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-clawd-accent" />
          <span className="text-sm font-medium text-clawd-text">Review Your Plan</span>
        </div>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
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
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={plan.title}
              onChange={(e) => updateField('title', e.target.value)}
              className={inputClass}
              placeholder="Book title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type</label>
              <input
                type="text"
                value={plan.type}
                onChange={(e) => updateField('type', e.target.value)}
                className={inputClass}
                placeholder="e.g. novel, memoir"
              />
            </div>
            <div>
              <label className={labelClass}>Genre</label>
              <input
                type="text"
                value={plan.genre}
                onChange={(e) => updateField('genre', e.target.value)}
                className={inputClass}
                placeholder="e.g. literary fiction"
              />
            </div>
          </div>
        </div>

        {/* Premise */}
        <div className={sectionClass}>
          <label className={labelClass}>Premise</label>
          <textarea
            value={plan.premise}
            onChange={(e) => updateField('premise', e.target.value)}
            className={textareaClass}
            rows={3}
            placeholder="One-paragraph premise"
          />
        </div>

        {/* Themes */}
        <div className={sectionClass}>
          <label className={labelClass}>Themes</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {plan.themes.map((theme, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-clawd-accent/10 text-clawd-accent border border-clawd-accent/20"
              >
                {theme}
                <button
                  onClick={() => removeTheme(i)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTheme}
              onChange={(e) => setNewTheme(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTheme())}
              className={inputClass}
              placeholder="Add a theme"
            />
            <button
              onClick={addTheme}
              disabled={!newTheme.trim()}
              className="px-3 py-2 rounded-lg bg-clawd-accent/10 text-clawd-accent text-xs font-medium hover:bg-clawd-accent/20 transition-colors disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Story Arc */}
        <div className={sectionClass}>
          <label className={labelClass}>Story Arc</label>
          <textarea
            value={plan.storyArc}
            onChange={(e) => updateField('storyArc', e.target.value)}
            className={textareaClass}
            rows={4}
            placeholder="Overview of the story arc"
          />
        </div>

        {/* Chapters */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Chapters ({plan.chapters.length})</label>
          </div>
          <div className="space-y-3">
            {plan.chapters.map((ch, i) => (
              <div key={i} className="p-3 rounded-lg border border-clawd-border bg-clawd-surface space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-clawd-text-dim font-mono w-6 text-right flex-shrink-0">
                    {i + 1}.
                  </span>
                  <input
                    type="text"
                    value={ch.title}
                    onChange={(e) => updateChapter(i, 'title', e.target.value)}
                    className={`${inputClass} flex-1`}
                    placeholder="Chapter title"
                  />
                  <button
                    onClick={() => removeChapter(i)}
                    className="p-1.5 rounded text-clawd-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={ch.synopsis}
                  onChange={(e) => updateChapter(i, 'synopsis', e.target.value)}
                  className={`${textareaClass} ml-8`}
                  rows={2}
                  placeholder="Chapter synopsis"
                />
              </div>
            ))}
          </div>
          <button
            onClick={addChapter}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-clawd-accent hover:bg-clawd-accent/10 transition-colors"
          >
            <Plus size={14} />
            Add Chapter
          </button>
        </div>

        {/* Characters */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Characters ({plan.characters.length})</label>
          </div>
          <div className="space-y-3">
            {plan.characters.map((c, i) => (
              <div key={i} className="p-3 rounded-lg border border-clawd-border bg-clawd-surface space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                    className={`${inputClass} flex-1`}
                    placeholder="Character name"
                  />
                  <select
                    value={
                      ['protagonist', 'antagonist', 'supporting', 'narrator'].includes(c.role)
                        ? c.role
                        : '_custom'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== '_custom') updateCharacter(i, 'role', val);
                    }}
                    className="px-2 py-2 rounded-lg bg-clawd-bg border border-clawd-border text-clawd-text text-xs focus:outline-none focus:border-clawd-accent"
                  >
                    <option value="protagonist">Protagonist</option>
                    <option value="antagonist">Antagonist</option>
                    <option value="supporting">Supporting</option>
                    <option value="narrator">Narrator</option>
                    <option value="_custom">Custom...</option>
                  </select>
                  <button
                    onClick={() => removeCharacter(i)}
                    className="p-1.5 rounded text-clawd-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {/* Custom role input */}
                {!['protagonist', 'antagonist', 'supporting', 'narrator'].includes(c.role) && (
                  <input
                    type="text"
                    value={c.role}
                    onChange={(e) => updateCharacter(i, 'role', e.target.value)}
                    className={inputClass}
                    placeholder="Custom role"
                  />
                )}
                <textarea
                  value={c.description}
                  onChange={(e) => updateCharacter(i, 'description', e.target.value)}
                  className={textareaClass}
                  rows={2}
                  placeholder="Character description"
                />
                <div>
                  <label className="text-[10px] text-clawd-text-dim">Traits (comma-separated)</label>
                  <input
                    type="text"
                    value={c.traits.join(', ')}
                    onChange={(e) =>
                      updateCharacter(
                        i,
                        'traits',
                        e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                      )
                    }
                    className={inputClass}
                    placeholder="brave, cunning, compassionate"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addCharacter}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-clawd-accent hover:bg-clawd-accent/10 transition-colors"
          >
            <Plus size={14} />
            Add Character
          </button>
        </div>

        {/* Timeline */}
        <div className="space-y-3 pb-5">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Timeline ({plan.timeline.length})</label>
          </div>
          <div className="space-y-3">
            {plan.timeline.map((evt, i) => (
              <div key={i} className="p-3 rounded-lg border border-clawd-border bg-clawd-surface space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={evt.date}
                    onChange={(e) => updateTimelineEvent(i, 'date', e.target.value)}
                    className={`${inputClass} w-40`}
                    placeholder="Date / period"
                  />
                  <textarea
                    value={evt.description}
                    onChange={(e) => updateTimelineEvent(i, 'description', e.target.value)}
                    className={`${textareaClass} flex-1`}
                    rows={1}
                    placeholder="Event description"
                  />
                  <button
                    onClick={() => removeTimelineEvent(i)}
                    className="p-1.5 rounded text-clawd-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addTimelineEvent}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-clawd-accent hover:bg-clawd-accent/10 transition-colors"
          >
            <Plus size={14} />
            Add Event
          </button>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-clawd-border bg-clawd-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep('conversation')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-bg transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Chat
          </button>
          <button
            onClick={() => cancelWizard()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-clawd-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !plan.title.trim() || plan.chapters.length === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-clawd-accent text-white text-sm font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
        </button>
      </div>
    </div>
  );
}
