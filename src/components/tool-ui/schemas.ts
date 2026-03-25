// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Tool-UI Zod schemas — one file, all schemas.
 * Components import their schema from here and call safeParse before rendering.
 *
 * Pattern: tool returns JSON matching a schema → UI renders the matching component.
 * Agents embed tool-ui JSON in ````json { "@type": "stats-display", ... }` code blocks.
 */
import { z } from 'zod';

// ─── Image ────────────────────────────────────────────────────────────────────

export const ImageSchema = z.object({
  '@type': z.literal('image'),
  id: z.string(),
  src: z.string(),
  alt: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  href: z.string().optional(),
  domain: z.string().optional(),
  ratio: z.enum(['auto', '1:1', '4:3', '16:9', '9:16']).optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  source: z.object({
    label: z.string(),
    iconUrl: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
  createdAt: z.string().optional(),
  fileSizeBytes: z.number().optional(),
});
export type SerializableImage = z.infer<typeof ImageSchema>;
export function safeParseImage(data: unknown) {
  const r = ImageSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Stats Display ────────────────────────────────────────────────────────────

export const StatItemSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  trend: z.object({
    direction: z.enum(['up', 'down', 'flat']),
    value: z.string(),
    label: z.string().optional(),
  }).optional(),
  description: z.string().optional(),
  color: z.enum(['accent', 'blue', 'violet', 'amber', 'rose', 'cyan', 'success', 'warning', 'error', 'neutral']).optional(),
  icon: z.string().optional(),
});

export const StatsDisplaySchema = z.object({
  '@type': z.literal('stats-display'),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  stats: z.array(StatItemSchema).min(1).max(12),
  layout: z.enum(['grid', 'row', 'list']).optional(),
  period: z.string().optional(),
});
export type SerializableStatsDisplay = z.infer<typeof StatsDisplaySchema>;
export function safeParseStatsDisplay(data: unknown) {
  const r = StatsDisplaySchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Data Table ───────────────────────────────────────────────────────────────

export const DataTableSchema = z.object({
  '@type': z.literal('data-table'),
  title: z.string().optional(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['string', 'number', 'date', 'boolean', 'badge', 'link', 'currency']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    width: z.string().optional(),
    format: z.string().optional(),
    sortable: z.boolean().optional(),
  })),
  rows: z.array(z.record(z.string(), z.unknown())).max(500),
  footer: z.string().optional(),
  caption: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  searchable: z.boolean().optional(),
});
export type SerializableDataTable = z.infer<typeof DataTableSchema>;
export function safeParseDataTable(data: unknown) {
  const r = DataTableSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Approval Card ────────────────────────────────────────────────────────────

export const ApprovalCardSchema = z.object({
  '@type': z.literal('approval-card'),
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  action: z.string(),
  details: z.array(z.object({
    label: z.string(),
    value: z.string(),
    critical: z.boolean().optional(),
  })).optional(),
  risk: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  requester: z.string().optional(),
  expiresAt: z.string().optional(),
  confirmLabel: z.string().optional(),
  cancelLabel: z.string().optional(),
});
export type SerializableApprovalCard = z.infer<typeof ApprovalCardSchema>;
export function safeParseApprovalCard(data: unknown) {
  const r = ApprovalCardSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Terminal ─────────────────────────────────────────────────────────────────

export const TerminalSchema = z.object({
  '@type': z.literal('terminal'),
  title: z.string().optional(),
  command: z.string().optional(),
  output: z.string(),
  exitCode: z.number().optional(),
  shell: z.string().optional(),
  duration: z.number().optional(),
  timestamp: z.string().optional(),
  collapsed: z.boolean().optional(),
});
export type SerializableTerminal = z.infer<typeof TerminalSchema>;
export function safeParseTerminal(data: unknown) {
  const r = TerminalSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

export const PlanSchema = z.object({
  '@type': z.literal('plan'),
  title: z.string(),
  description: z.string().optional(),
  steps: z.array(z.object({
    id: z.string().optional(),
    label: z.string(),
    description: z.string().optional(),
    status: z.enum(['pending', 'in-progress', 'done', 'skipped', 'blocked']).optional(),
    substeps: z.array(z.string()).optional(),
    tool: z.string().optional(),
    duration: z.string().optional(),
  })).min(1),
  currentStep: z.number().optional(),
  estimatedDuration: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type SerializablePlan = z.infer<typeof PlanSchema>;
export function safeParsePlan(data: unknown) {
  const r = PlanSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Option List ──────────────────────────────────────────────────────────────

export const OptionListSchema = z.object({
  '@type': z.literal('option-list'),
  question: z.string(),
  description: z.string().optional(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    badge: z.string().optional(),
    recommended: z.boolean().optional(),
    disabled: z.boolean().optional(),
  })).min(1).max(20),
  multiple: z.boolean().optional(),
  required: z.boolean().optional(),
});
export type SerializableOptionList = z.infer<typeof OptionListSchema>;
export function safeParseOptionList(data: unknown) {
  const r = OptionListSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Link Preview ─────────────────────────────────────────────────────────────

export const LinkPreviewSchema = z.object({
  '@type': z.literal('link-preview'),
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  domain: z.string().optional(),
  favicon: z.string().optional(),
  type: z.enum(['article', 'video', 'product', 'profile', 'website', 'document']).optional(),
  readTime: z.string().optional(),
  publishedAt: z.string().optional(),
  author: z.string().optional(),
});
export type SerializableLinkPreview = z.infer<typeof LinkPreviewSchema>;
export function safeParseLinkPreview(data: unknown) {
  const r = LinkPreviewSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Progress Tracker ─────────────────────────────────────────────────────────

export const ProgressTrackerSchema = z.object({
  '@type': z.literal('progress-tracker'),
  title: z.string().optional(),
  description: z.string().optional(),
  progress: z.number().min(0).max(100),
  status: z.enum(['idle', 'running', 'done', 'failed', 'paused']).optional(),
  phase: z.string().optional(),
  steps: z.array(z.object({
    label: z.string(),
    status: z.enum(['pending', 'running', 'done', 'failed', 'skipped']),
    detail: z.string().optional(),
  })).optional(),
  startedAt: z.string().optional(),
  estimatedDoneAt: z.string().optional(),
});
export type SerializableProgressTracker = z.infer<typeof ProgressTrackerSchema>;
export function safeParseProgressTracker(data: unknown) {
  const r = ProgressTrackerSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Message Draft ────────────────────────────────────────────────────────────

export const MessageDraftSchema = z.object({
  '@type': z.literal('message-draft'),
  platform: z.enum(['email', 'slack', 'discord', 'sms', 'chat', 'twitter', 'linkedin']).optional(),
  subject: z.string().optional(),
  to: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
  body: z.string(),
  preview: z.string().optional(),
  tone: z.enum(['formal', 'casual', 'urgent', 'friendly', 'professional']).optional(),
  wordCount: z.number().optional(),
  tags: z.array(z.string()).optional(),
});
export type SerializableMessageDraft = z.infer<typeof MessageDraftSchema>;
export function safeParseMessageDraft(data: unknown) {
  const r = MessageDraftSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Order Summary ────────────────────────────────────────────────────────────

export const OrderSummarySchema = z.object({
  '@type': z.literal('order-summary'),
  title: z.string().optional(),
  items: z.array(z.object({
    label: z.string(),
    value: z.string(),
    type: z.enum(['line', 'subtotal', 'discount', 'tax', 'total', 'note']).optional(),
    description: z.string().optional(),
  })),
  cta: z.object({ label: z.string(), id: z.string() }).optional(),
  note: z.string().optional(),
});
export type SerializableOrderSummary = z.infer<typeof OrderSummarySchema>;
export function safeParseOrderSummary(data: unknown) {
  const r = OrderSummarySchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Citation ─────────────────────────────────────────────────────────────────

export const CitationSchema = z.object({
  '@type': z.literal('citation'),
  sources: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    url: z.string().optional(),
    domain: z.string().optional(),
    excerpt: z.string().optional(),
    author: z.string().optional(),
    publishedAt: z.string().optional(),
    relevance: z.number().min(0).max(1).optional(),
  })).min(1),
  query: z.string().optional(),
});
export type SerializableCitation = z.infer<typeof CitationSchema>;
export function safeParseCitation(data: unknown) {
  const r = CitationSchema.safeParse(data);
  return r.success ? r.data : null;
}

// ─── Registry — all schemas for auto-detection ────────────────────────────────

export type ToolUIType =
  | 'image' | 'stats-display' | 'data-table' | 'approval-card'
  | 'terminal' | 'plan' | 'option-list' | 'link-preview'
  | 'progress-tracker' | 'message-draft' | 'order-summary' | 'citation';

export function detectToolUIType(data: unknown): ToolUIType | null {
  if (typeof data !== 'object' || data === null) return null;
  const t = (data as Record<string, unknown>)['@type'];
  if (typeof t !== 'string') return null;
  const valid: ToolUIType[] = [
    'image', 'stats-display', 'data-table', 'approval-card',
    'terminal', 'plan', 'option-list', 'link-preview',
    'progress-tracker', 'message-draft', 'order-summary', 'citation',
  ];
  return valid.includes(t as ToolUIType) ? (t as ToolUIType) : null;
}
