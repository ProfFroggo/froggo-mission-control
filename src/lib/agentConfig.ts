// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Centralized agent configuration constants.
 * Import from here — never hardcode agent IDs in components.
 */

/** Agent IDs that cannot be deleted or disabled via the UI. */
export const PROTECTED_AGENTS = ['mission-control', 'main', 'clara'] as const;

/** Check if an agent ID is protected. */
export function isProtectedAgent(id: string): boolean {
  return PROTECTED_AGENTS.includes(id as typeof PROTECTED_AGENTS[number]);
}

/** Default agent label map for display purposes. */
export const AGENT_LABELS: Record<string, string> = {
  'mission-control': 'Mission Control',
  'main': 'Main',
  'clara': 'Clara',
  'coder': 'Coder',
  'senior-coder': 'Senior Coder',
  'chief': 'Chief',
  'designer': 'Designer',
  'analyst': 'Analyst',
  'inbox': 'Inbox',
};

/** Agents that are always present in a new installation. */
export const CORE_AGENTS = ['mission-control', 'clara', 'coder', 'chief'] as const;
