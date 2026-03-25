// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Tool UI — barrel export.
 *
 * Components are rendered automatically from JSON code blocks with @type fields.
 * Agents can trigger any component by returning:
 *
 *   ```json
 *   { "@type": "stats-display", "title": "KPIs", "stats": [...] }
 *   ```
 *
 * Available @type values:
 *   image, stats-display, data-table, approval-card, terminal, plan,
 *   option-list, link-preview, progress-tracker, message-draft,
 *   order-summary, citation
 */
export { ToolUIRenderer } from './ToolUIRenderer';
export {
  ToolUIImage,
  ToolUIStatsDisplay,
  ToolUIDataTable,
  ToolUIApprovalCard,
  ToolUITerminal,
  ToolUIPlan,
  ToolUIOptionList,
  ToolUILinkPreview,
  ToolUIProgressTracker,
  ToolUIMessageDraft,
  ToolUIOrderSummary,
  ToolUICitation,
} from './ToolUIRenderer';
export * from './schemas';
