# Phase 35: Form & Input Migration

## Status: COMPLETE (2026-03-24)

## What Was Done

### ChatPanel.tsx — Radix TextArea
- Added `TextArea` to `@radix-ui/themes` import
- Replaced `<textarea>` in the composer area (line ~1924) with Radix `<TextArea>`
- Props preserved: `ref={inputRef}`, `aria-label`, `value`, `onChange`, `onKeyDown`, `placeholder`, `rows={1}`, `readOnly`
- Radix props: `resize="none"`, `variant="soft"`, `color="gray"`
- `style={{ minHeight: '44px', maxHeight: '120px' }}` matches previous behavior
- Auto-resize useEffect (lines 664-668) still works — Radix TextArea forwards ref to the underlying HTMLTextAreaElement

### Sidebar search input
- Sidebar uses an `<input>` inside the AgentSelector dropdown which is a custom dropdown pattern, not a Sidebar component input. Left as-is since it's inside AgentSelector's custom dropdown (not a Sidebar.tsx search input).

## Build: PASS
