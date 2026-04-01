# Phase 28 Plan 01: Syntax Highlighting + Thinking Block UX Summary

**Added Shiki syntax highlighting to code blocks and improved thinking block label/metrics.**

## Accomplishments

- Shiki installed (`npm install shiki`) — tree-shakeable, SSR-safe, github-dark theme
- CodeBlock in MarkdownMessage.tsx now async-highlights code using Shiki's `codeToHtml`, with graceful fallback to plain monospace on unknown language or Shiki error
- Thinking blocks in ContentBlock.tsx updated: label changed from "Thinking..." to "Thought process", char count replaced with word count, visual style made subtler
- tool_use block header updated to show "Running" status instead of raw truncated ID when collapsed
- Also resolved a pre-existing build failure (missing `xlsx` package) that was blocking all builds

## Files Created/Modified

- `src/components/MarkdownMessage.tsx` — CodeBlock now uses Shiki async highlighting
- `src/components/ContentBlock.tsx` — thinking block UX improved
- `package.json` — shiki + xlsx added as dependencies

## Decisions Made

- Used dynamic `import('shiki')` to avoid SSR issues and keep bundle size minimal
- Kept plain fallback rendering so pages load immediately before Shiki resolves
- Kept `Zap` icon for thinking blocks (Brain not available in Lucide version used)

## Issues Encountered

- Pre-existing build failure from missing `xlsx` package used by `/api/budget/import/route.ts` — installed it to unblock all subsequent build checks

## Next Step

Ready for 28-02-PLAN.md
