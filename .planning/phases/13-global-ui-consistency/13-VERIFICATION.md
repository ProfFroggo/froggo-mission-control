---
phase: 13-global-ui-consistency
verified: 2026-02-18T00:00:00Z
status: gaps_found
score: 27/28 must-haves verified
gaps:
  - truth: "No bg-blue-600 anywhere in src/components/"
    status: failed
    reason: "bg-blue-600 appears as a hover state in 5 component files"
    artifacts:
      - path: "src/components/VIPSettingsPanel.tsx"
        issue: "Line 508: bg-blue-500 hover:bg-blue-600 on a button"
      - path: "src/components/OxAnalytics.tsx"
        issue: "Line 143: color=\"bg-blue-600\" prop"
      - path: "src/components/SnoozeButton.tsx"
        issue: "Line 170: bg-blue-500 hover:bg-blue-600 on a button"
      - path: "src/components/InboxPanel.tsx"
        issue: "Line 1479: bg-blue-500 hover:bg-blue-600"
      - path: "src/components/CalendarFilterModal.tsx"
        issue: "Line 368: bg-blue-500 hover:bg-blue-600"
    missing:
      - "Replace bg-blue-600 hover states with bg-clawd-accent-dim or equivalent design token"
      - "Replace bg-blue-500 bases with bg-clawd-accent"
      - "Replace OxAnalytics color prop bg-blue-600 with design token"
---

# Phase 13: Global UI Consistency Verification Report

**Phase Goal:** Every page looks and behaves correctly in dark mode with consistent UI components
**Verified:** 2026-02-18
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | bg-clawd-bg-alt defined in tailwind.config.js | VERIFIED | Line 22: `'bg-alt': 'var(--clawd-bg-alt, #1a1a1a)'` |
| 2  | bg-clawd-bg-alt defined in src/index.css | VERIFIED | Lines 33 (dark) + 67 (light): `--clawd-bg-alt` |
| 3  | bg-clawd-bg0 defined in tailwind.config.js | VERIFIED | Line 23: `'bg0': 'var(--clawd-bg0, #0a0a0a)'` |
| 4  | bg-clawd-bg0 defined in src/index.css | VERIFIED | Lines 34 + 68: `--clawd-bg0` |
| 5  | bg-clawd-card defined in tailwind.config.js | VERIFIED | Line 24: `'card': 'var(--clawd-card, #141414)'` |
| 6  | bg-clawd-card defined in src/index.css | VERIFIED | Lines 35 + 69: `--clawd-card` |
| 7  | AgentPanel.tsx has zero border-clawd-border/50 | VERIFIED | grep count = 0 |
| 8  | AgentPanel.tsx has theme.border in 3+ places | VERIFIED | 6 occurrences: lines 246, 350, 364, 387, 402, 419 |
| 9  | ChatPanel.tsx user bubbles use bg-clawd-accent/50 | VERIFIED | Line 1335: `'bg-clawd-accent/50 text-white rounded-tr-sm'` |
| 10 | ChatRoomView.tsx user bubbles use bg-clawd-accent/50 | VERIFIED | Line 642: `'bg-clawd-accent/50 text-white rounded-tr-sm'` |
| 11 | AgentChatModal.tsx user bubbles use bg-clawd-accent/50 | VERIFIED | Line 457: `'bg-clawd-accent/50 text-white'` |
| 12 | writing/ChatMessage.tsx user bubbles use bg-clawd-accent/50 | VERIFIED | Line 42: `bg-clawd-accent/50 text-white` |
| 13 | XAgentChatPane.tsx user bubbles use bg-clawd-accent/50 | VERIFIED | Line 241: `'bg-clawd-accent/50 text-white'` |
| 14 | FinanceAgentChat.tsx user bubbles use bg-clawd-accent/50 | VERIFIED | Line 206: `'bg-clawd-accent/50 text-white'` |
| 15 | FinanceAgentChat.tsx send button uses bg-clawd-accent | VERIFIED | Line 270: `bg-clawd-accent hover:bg-clawd-accent-dim` |
| 16 | VoiceChatPanel.tsx user bubbles use bg-clawd-accent/50 | VERIFIED | Line 619: `'bg-clawd-accent/50 text-white'` |
| 17 | QuickActions.tsx voice transcript uses bg-clawd-accent/50 | VERIFIED | Line 1041: `'bg-clawd-accent/50 text-white'` |
| 18 | QuickActions.tsx text chat uses bg-clawd-accent/50 | VERIFIED | Line 1141: `'bg-clawd-accent/50 text-white'` |
| 19 | No bg-blue-600 anywhere in src/components/ | FAILED | 5 files still use bg-blue-600 (see gaps) |
| 20 | XAgentChatPane.tsx input bar: border-t border-clawd-border bg-clawd-surface | VERIFIED | Line 284: `p-4 border-t border-clawd-border bg-clawd-surface` |
| 21 | FinanceAgentChat.tsx input bar: border-t border-clawd-border bg-clawd-surface | VERIFIED | Line 255: `p-4 border-t border-clawd-border bg-clawd-surface` |
| 22 | ChatRoomView.tsx input bar: border-t border-clawd-border bg-clawd-surface | VERIFIED | Line 694: `p-4 border-t border-clawd-border bg-clawd-surface` |
| 23 | QuickActions.tsx text chat input: border-t border-clawd-border bg-clawd-surface | VERIFIED | Line 1158: `px-3 py-2.5 border-t border-clawd-border bg-clawd-surface` |

**Score:** 22/23 truths verified (27/28 individual must-have checks)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tailwind.config.js` | bg-clawd-bg-alt, bg-clawd-bg0, bg-clawd-card tokens | VERIFIED | All three at lines 22-24 |
| `src/index.css` | CSS variables for all three tokens | VERIFIED | Dark + light values for all three |
| `src/components/AgentPanel.tsx` | zero border-clawd-border/50, 3+ theme.border | VERIFIED | 0 old patterns, 6 theme.border uses |
| `src/components/ChatPanel.tsx` | bg-clawd-accent/50 user bubbles | VERIFIED | Line 1335 |
| `src/components/ChatRoomView.tsx` | bg-clawd-accent/50 user bubbles, input bar tokens | VERIFIED | Lines 642, 694 |
| `src/components/AgentChatModal.tsx` | bg-clawd-accent/50 user bubbles | VERIFIED | Line 457 |
| `src/components/writing/ChatMessage.tsx` | bg-clawd-accent/50 user bubbles | VERIFIED | Line 42 |
| `src/components/XAgentChatPane.tsx` | bg-clawd-accent/50 user bubbles, input bar tokens | VERIFIED | Lines 241, 284 |
| `src/components/FinanceAgentChat.tsx` | bg-clawd-accent/50 bubbles, bg-clawd-accent button, input bar | VERIFIED | Lines 206, 255, 270 |
| `src/components/VoiceChatPanel.tsx` | bg-clawd-accent/50 user bubbles | VERIFIED | Line 619 |
| `src/components/QuickActions.tsx` | bg-clawd-accent/50 bubbles, input bar tokens | VERIFIED | Lines 1041, 1141, 1158 |
| `src/components/VIPSettingsPanel.tsx` | No bg-blue-600 | FAILED | Line 508: hover:bg-blue-600 |
| `src/components/OxAnalytics.tsx` | No bg-blue-600 | FAILED | Line 143: color="bg-blue-600" |
| `src/components/SnoozeButton.tsx` | No bg-blue-600 | FAILED | Line 170: hover:bg-blue-600 |
| `src/components/InboxPanel.tsx` | No bg-blue-600 | FAILED | Line 1479: hover:bg-blue-600 |
| `src/components/CalendarFilterModal.tsx` | No bg-blue-600 | FAILED | Line 368: hover:bg-blue-600 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| tailwind.config.js tokens | src/index.css CSS vars | var() references | WIRED | All three tokens use CSS variable references |
| User bubble classes | design tokens | bg-clawd-accent/50 | WIRED | All 8 chat components use consistent token |
| Input bars | design tokens | border-clawd-border bg-clawd-surface | WIRED | All 4 target input bars use consistent tokens |
| AgentPanel border | design tokens | theme.border | WIRED | 6 sites use theme.border, zero use hardcoded /50 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| VIPSettingsPanel.tsx | 508 | `hover:bg-blue-600` | Warning | Non-token hover color, breaks dark mode |
| OxAnalytics.tsx | 143 | `color="bg-blue-600"` | Warning | Hardcoded blue in analytics badge/chart |
| SnoozeButton.tsx | 170 | `hover:bg-blue-600` | Warning | Non-token hover color |
| InboxPanel.tsx | 1479 | `hover:bg-blue-600` | Warning | Non-token hover color |
| CalendarFilterModal.tsx | 368 | `hover:bg-blue-600` | Warning | Non-token hover color |

Note: The XAgentChatPane.tsx line 206 `bg-info-subtle` is for an agent label/tag badge, not a user message bubble — this is appropriate use of a semantic color token.

### Gaps Summary

All chat component user bubbles and input bars were successfully migrated to design tokens. The color system foundation (CSS variables + Tailwind aliases) is properly defined. AgentPanel.tsx border cleanup is complete.

The single failing must-have is "No bg-blue-600 anywhere in src/components/". Five files contain `bg-blue-600` as hover states or color props — all in non-chat UI components (settings, analytics, snooze, inbox actions, calendar modal). These were not in the migration scope of plans 13-01 through 13-05 but are flagged by the blanket requirement from 13-04.

The occurrences are all on buttons or badge elements using `bg-blue-500 hover:bg-blue-600` — they should become `bg-clawd-accent hover:bg-clawd-accent-dim` to be consistent with the design token system.

---

_Verified: 2026-02-18_
_Verifier: Claude (gsd-verifier)_
