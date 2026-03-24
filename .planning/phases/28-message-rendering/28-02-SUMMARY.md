# Phase 28 Plan 02: Date Separators + ToolCallGroup Summary

**Added date separators between messages from different days and ToolCallGroup component to collapse repetitive tool calls.**

## Accomplishments

- `DateSeparator` component renders between messages from different calendar days (Today/Yesterday/date)
- `isSameDay` and `formatDateSeparator` helper functions handle the day boundary logic
- Message list now wraps each message+separator in a keyed div for stable React rendering
- `ToolCallGroup` exported from ContentBlock.tsx — collapses 3+ consecutive identical tool_use blocks into "toolname ×N" with expand to see individual calls
- `groupContentBlocks` function in ChatPanel handles the grouping logic with 3+ threshold

## Files Created/Modified

- `src/components/ChatPanel.tsx` — DateSeparator, isSameDay, formatDateSeparator, groupContentBlocks added; message list updated to inject separators and group tool calls
- `src/components/ContentBlock.tsx` — ToolCallGroup exported

## Decisions Made

- Used `<div key={msg.id ?? idx}>` wrapper instead of React.Fragment to avoid key warnings
- 3+ threshold for grouping prevents collapsing legitimate single/pair tool calls

## Issues Encountered

None

## Next Step

Phase 28 complete, ready for Phase 29 (Composer Input)
