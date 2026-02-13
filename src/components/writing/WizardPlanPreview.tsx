/**
 * WizardPlanPreview — read-only sidebar showing current plan state during conversation.
 *
 * Compact summary: title, type/genre badge, chapters list, characters list, themes badges.
 * Shows "No plan extracted yet" placeholder when plan is null.
 */

import { useWizardStore } from '../../store/wizardStore';
import { Users, List, Tag } from 'lucide-react';

export default function WizardPlanPreview() {
  const plan = useWizardStore((s) => s.plan);

  if (!plan) {
    return (
      <div className="p-4 text-center text-clawd-text-dim text-xs">
        No plan extracted yet
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg border border-clawd-border bg-clawd-surface overflow-y-auto max-h-full space-y-3">
      {/* Title */}
      <div>
        <h3 className="text-sm font-bold text-clawd-text truncate">{plan.title}</h3>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-clawd-accent/15 text-clawd-accent">
            {plan.type}
          </span>
          {plan.genre && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-clawd-border text-clawd-text-dim">
              {plan.genre}
            </span>
          )}
        </div>
      </div>

      {/* Chapters */}
      {plan.chapters.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs text-clawd-text-dim mb-1">
            <List size={10} />
            <span>{plan.chapters.length} chapter{plan.chapters.length !== 1 ? 's' : ''}</span>
          </div>
          <ul className="space-y-0.5">
            {plan.chapters.map((ch, i) => (
              <li key={i} className="text-xs text-clawd-text truncate pl-2">
                {i + 1}. {ch.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Characters */}
      {plan.characters.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs text-clawd-text-dim mb-1">
            <Users size={10} />
            <span>{plan.characters.length} character{plan.characters.length !== 1 ? 's' : ''}</span>
          </div>
          <ul className="space-y-0.5">
            {plan.characters.map((c, i) => (
              <li key={i} className="text-xs text-clawd-text truncate pl-2">
                {c.name} <span className="text-clawd-text-dim">({c.role})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Themes */}
      {plan.themes.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs text-clawd-text-dim mb-1">
            <Tag size={10} />
            <span>Themes</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {plan.themes.map((t, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[10px] bg-clawd-bg border border-clawd-border text-clawd-text-dim"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
