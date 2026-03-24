/**
 * WizardPlanPreview — read-only sidebar showing current plan state during conversation.
 *
 * Compact summary: title, type/genre badge, chapters list, characters list, themes badges.
 * Shows "No plan extracted yet" placeholder when plan is null.
 */

import { useWizardStore } from '../../store/wizardStore';
import { Users, List, Tag } from 'lucide-react';
import { Box, Flex } from '@radix-ui/themes';

export default function WizardPlanPreview() {
  const plan = useWizardStore((s) => s.plan);

  if (!plan) {
    return (
      <Box p="4" className="text-center text-mission-control-text-dim text-xs">
        No plan extracted yet
      </Box>
    );
  }

  return (
    <Box p="3" className="rounded-lg border border-mission-control-border bg-mission-control-surface overflow-y-auto max-h-full space-y-3">
      {/* Title */}
      <Box>
        <h3 className="text-sm font-bold text-mission-control-text truncate">{plan.title}</h3>
        <Flex align="center" gap="1" mt="1">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-mission-control-accent/15 text-mission-control-accent">
            {plan.type}
          </span>
          {plan.genre && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-mission-control-border text-mission-control-text-dim">
              {plan.genre}
            </span>
          )}
        </Flex>
      </Box>

      {/* Chapters */}
      {plan.chapters.length > 0 && (
        <Box>
          <Flex align="center" gap="1" mb="1" className="text-xs text-mission-control-text-dim">
            <List size={10} />
            <span>{plan.chapters.length} chapter{plan.chapters.length !== 1 ? 's' : ''}</span>
          </Flex>
          <ul className="space-y-0.5">
            {plan.chapters.map((ch, i) => (
              <li key={i} className="text-xs text-mission-control-text truncate pl-2">
                {i + 1}. {ch.title}
              </li>
            ))}
          </ul>
        </Box>
      )}

      {/* Characters */}
      {plan.characters.length > 0 && (
        <Box>
          <Flex align="center" gap="1" mb="1" className="text-xs text-mission-control-text-dim">
            <Users size={10} />
            <span>{plan.characters.length} character{plan.characters.length !== 1 ? 's' : ''}</span>
          </Flex>
          <ul className="space-y-0.5">
            {plan.characters.map((c, i) => (
              <li key={i} className="text-xs text-mission-control-text truncate pl-2">
                {c.name} <span className="text-mission-control-text-dim">({c.role})</span>
              </li>
            ))}
          </ul>
        </Box>
      )}

      {/* Themes */}
      {plan.themes.length > 0 && (
        <Box>
          <Flex align="center" gap="1" mb="1" className="text-xs text-mission-control-text-dim">
            <Tag size={10} />
            <span>Themes</span>
          </Flex>
          <Flex gap="1" className="flex-wrap">
            {plan.themes.map((t, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[10px] bg-mission-control-bg border border-mission-control-border text-mission-control-text-dim"
              >
                {t}
              </span>
            ))}
          </Flex>
        </Box>
      )}
    </Box>
  );
}
