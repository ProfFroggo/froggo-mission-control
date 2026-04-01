// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Lightweight tool-UI type detection — no zod dependency.
 *
 * Extracted from schemas.ts so that MarkdownMessage can detect @type fields
 * without pulling in the full zod schema bundle. The heavy ToolUIRenderer
 * (recharts, diff, etc.) is only lazy-loaded when detection succeeds.
 */

export type ToolUIType =
  | 'image' | 'stats-display' | 'data-table' | 'approval-card'
  | 'terminal' | 'plan' | 'option-list' | 'link-preview'
  | 'progress-tracker' | 'message-draft' | 'order-summary' | 'citation'
  | 'chart' | 'code-diff' | 'x-post' | 'image-gallery' | 'parameter-slider'
  | 'question-flow' | 'item-carousel' | 'preferences-panel' | 'weather'
  | 'audio' | 'video' | 'geo-map' | 'instagram-post' | 'linkedin-post';

const VALID_TYPES: readonly string[] = [
  'image', 'stats-display', 'data-table', 'approval-card',
  'terminal', 'plan', 'option-list', 'link-preview',
  'progress-tracker', 'message-draft', 'order-summary', 'citation',
  'chart', 'code-diff', 'x-post', 'image-gallery', 'parameter-slider',
  'question-flow', 'item-carousel', 'preferences-panel', 'weather',
  'audio', 'video', 'geo-map', 'instagram-post', 'linkedin-post',
];

export function detectToolUIType(data: unknown): ToolUIType | null {
  if (typeof data !== 'object' || data === null) return null;
  const t = (data as Record<string, unknown>)['@type'];
  if (typeof t !== 'string') return null;
  return VALID_TYPES.includes(t) ? (t as ToolUIType) : null;
}
