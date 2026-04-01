# Phase 22 — Automations Overhaul Summary

## Completed

### Task 1: Upgrade create-task subtask UI
- `AutomationStepBuilder.tsx`: Changed subtask items from plain `string[]` to `{title: string, assignedTo: string}[]`
- Each subtask row now has two fields: title input + agent assignment input
- Backward compat: existing string subtasks are normalized on render (`{ title: str, assignedTo: '' }`)
- Added `Users` icon to lucide imports
- Uses `Trash2` icon for remove, `Plus` button for add — no emojis
- All styles use CSS variables

### Task 2: Wire Templates Gallery to Builder Modal
- `AutomationsPanel.tsx`: Updated `handleUseGalleryTemplate` to open `AutomationBuilderModal` pre-filled instead of creating the automation directly
- Clicking "Use this template" in the gallery now: closes gallery → opens builder pre-filled with template name/description/trigger/steps → user can customize then save
- This gives the user a chance to review and adjust before creating

### Task 3: automationExecutor already handles new format
- `automationExecutor.ts` `create-task` step already handles both `string` and `{title, assignedTo}` subtask formats (lines 86-93)
- No changes needed

## Result
Build clean (0 TypeScript errors). Phase 22 complete.
