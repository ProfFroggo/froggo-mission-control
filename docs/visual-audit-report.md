# Visual/UI Consistency Audit Report

**Date:** 2026-02-16
**Agent:** Coder
**Scope:** froggo-dashboard/src/components/**/*.tsx

## Summary

This audit identified widespread use of hardcoded Tailwind colors instead of design system tokens. This causes:
- Visual inconsistencies across the dashboard
- Light/dark mode compatibility issues
- Maintenance burden when changing themes

## Issues Found by Category

### 1. Hardcoded Color Classes (Priority: High)

Pattern: Using `bg-{color}-{shade}` instead of semantic tokens like `bg-success-subtle`

**Files with hardcoded colors:**

| File | Hardcoded Pattern | Should Be |
|------|-------------------|-----------|
| Toast.tsx | `bg-yellow-500/10` | `bg-warning-subtle` |
| ConfigTab.tsx | `bg-yellow-500/10` | `bg-warning-subtle` |
| AgentMetricsCard.tsx | `bg-green-500/20`, `bg-blue-500/20` | `bg-success-subtle`, `bg-info-subtle` |
| CalendarFilterModal.tsx | `bg-blue-500/20` | `bg-info-subtle` |
| CodeAgentDashboard.tsx | `bg-yellow-500`, `bg-green-500`, `bg-red-500` | `bg-warning`, `bg-success`, `bg-error` |
| ChannelsTab.tsx | `bg-green-500/20` | `bg-success-subtle` |
| ContactModal.tsx | `bg-green-500/20`, `bg-red-500/20` | `bg-success-subtle`, `bg-error-subtle` |
| ContentCalendar.tsx | `bg-red-500/20`, `bg-green-500/20` | `bg-error-subtle`, `bg-success-subtle` |
| AIAssistancePanel.tsx | `bg-green-500/20`, `bg-blue-500/20`, `bg-red-500/20` | semantic tokens |
| ActivityFeed.tsx | `bg-blue-600/20`, `bg-indigo-500/20`, `bg-purple-600/20` | semantic tokens |
| AddAccountWizard.tsx | `bg-yellow-500/10`, `bg-green-500/20` | `bg-warning-subtle`, `bg-success-subtle` |
| Dashboard.tsx | `bg-green-500/20`, `bg-red-500/20`, `bg-blue-500/20` | semantic tokens |
| DashboardRedesigned.tsx | `bg-green-500/20`, `bg-blue-500/20` | semantic tokens |
| EnhancedSettingsPanel.tsx | `bg-yellow-500/10`, `bg-green-500/20`, `bg-red-500/20` | semantic tokens |
| ErrorDisplay.tsx | `bg-red-500/20`, `bg-yellow-500/10`, `bg-yellow-500/20`, `bg-blue-500/20` | semantic tokens |
| FinanceAgentChat.tsx | `bg-red-500/20` | `bg-error-subtle` |
| FinanceInsightsPanel.tsx | `bg-yellow-500/10` | `bg-warning-subtle` |
| FloatingToolbar.tsx | `bg-yellow-500` | `bg-warning` |
| GlobalSearch.tsx | `bg-yellow-500/10` | `bg-warning-subtle` |
| HRAgentCreationModal.tsx | `bg-blue-500/20`, `text-blue-100` | `bg-info-subtle`, `text-info` |
| HealthCheckModal.tsx | `bg-yellow-500/10` | `bg-warning-subtle` |
| HealthStatusWidget.tsx | `bg-green-500/20`, `bg-yellow-500/20`, `bg-red-500/20` | semantic tokens |
| HelpPanel.tsx | `bg-blue-500/20` | `bg-info-subtle` |
| IconBadge.tsx | `bg-yellow-500/10`, `bg-blue-500/20`, `bg-green-500/20` | semantic tokens |
| IconWrapper.tsx | `hover:bg-red-500/20` | `hover:bg-error-subtle` |
| InboxFilter.tsx | `hover:bg-red-500/20` | `hover:bg-error-subtle` |
| InboxPanel.tsx | `bg-red-500/20`, `bg-yellow-500/20`, `bg-blue-500/20` | semantic tokens |
| Kanban.tsx | `bg-red-500/20`, `bg-yellow-500/20`, `bg-green-500/20` | semantic tokens |
| LibraryFilesTab.tsx | `hover:bg-red-500/20` | `hover:bg-error-subtle` |
| LibrarySkillsTab.tsx | `bg-yellow-500` | `bg-warning` |
| LibraryTemplatesTab.tsx | `hover:bg-red-500/20` | `hover:bg-error-subtle` |
| MeetingTranscribe.tsx | `bg-yellow-500/20`, `bg-red-500/20` | semantic tokens |
| MeetingTranscriptionPanel.tsx | `bg-red-500/20` | `bg-error-subtle` |
| MeetingsPanel.tsx | `hover:bg-red-500/20` | `hover:bg-error-subtle` |
| MorningBrief.tsx | `bg-green-500/20` | `bg-success-subtle` |
| NetworkStatus.tsx | `bg-yellow-500` | `bg-warning` |
| NodesTab.tsx | `bg-yellow-500/10`, `bg-green-500/20` | semantic tokens |
| NotificationSettingsModal.tsx | `bg-yellow-500/10`, `hover:bg-red-500/20` | semantic tokens |
| NotificationsPanel.tsx | `bg-yellow-500/10` | `bg-warning-subtle` |
| NotificationsPanelV2.tsx | `bg-yellow-500/10` | `bg-warning-subtle` |
| PerformanceTable.tsx | `bg-yellow-500` | `bg-warning` |
| QuickActions.tsx | `bg-yellow-500` | `bg-warning` |
| SessionsFilter.tsx | `bg-yellow-500/10`, `hover:bg-green-500/20`, `hover:bg-blue-500/20`, `hover:bg-yellow-500/20`, `hover:bg-red-500/20` | semantic tokens |
| SmartFolderRuleEditor.tsx | `bg-red-500/20` | `bg-error-subtle` |
| SnoozeButton.tsx | `bg-yellow-500/20` | `bg-warning-subtle` |
| SnoozeModal.tsx | `bg-yellow-500/10`, `hover:bg-red-500/20` | semantic tokens |
| TaskModal.tsx | `bg-red-500/20`, `bg-yellow-500/20` | semantic tokens |
| TaskStatusIndicator.tsx | `bg-green-500/20`, `bg-yellow-500`, `bg-yellow-500/20`, `bg-red-500/20` | semantic tokens |
| VIPSettingsPanel.tsx | `hover:bg-blue-500/20`, `hover:bg-green-500/20` | `hover:bg-info-subtle`, `hover:bg-success-subtle` |
| VoiceChatPanel.tsx | `bg-red-500/20`, `bg-yellow-500/10`, `bg-yellow-500` | semantic tokens |
| XAutomationsPanel.tsx | `bg-green-500/20`, `hover:bg-yellow-500/30`, `hover:bg-red-500/20` | semantic tokens |
| XDraftComposer.tsx | `hover:bg-red-500/20` | `hover:bg-error-subtle` |
| XPanel.tsx | `bg-blue-500/20`, `bg-green-500/20`, `bg-yellow-500/20` | semantic tokens |
| XResearchIdeaEditor.tsx | `hover:bg-red-500/20` | `hover:bg-error-subtle` |

### 2. Color Token Mapping

| Hardcoded | Design Token |
|-----------|--------------|
| `bg-green-500/20` | `bg-success-subtle` |
| `bg-green-500` | `bg-success` |
| `bg-blue-500/20` | `bg-info-subtle` |
| `bg-blue-500` | `bg-info` |
| `bg-red-500/20` | `bg-error-subtle` |
| `bg-red-500` | `bg-error` |
| `bg-yellow-500/10` | `bg-warning-subtle` |
| `bg-yellow-500/20` | `bg-warning-subtle` |
| `bg-yellow-500` | `bg-warning` |
| `bg-purple-500/20` | `bg-review-subtle` |
| `bg-purple-500` | `bg-review` |
| `text-blue-100` | `text-info` |

### 3. Light/Dark Mode Issues

The following patterns break light mode:
- `bg-yellow-100` → Use `bg-warning-subtle`
- `bg-yellow-50` → Use `bg-warning-subtle/50`
- `text-yellow-300` → Use `text-warning`
- `bg-blue-900/30` → Use `bg-info-subtle`
- `bg-green-900/30` → Use `bg-success-subtle`
- `bg-yellow-900/30` → Use `bg-warning-subtle`

## Fixes Applied (Batch 1)

1. **Toast.tsx** - Fixed warning toast background
2. **ConfigTab.tsx** - Fixed issues banner styling
3. **AgentMetricsCard.tsx** - Fixed rating badges and progress bars
4. **CalendarFilterModal.tsx** - Fixed header icon background
5. **CodeAgentDashboard.tsx** - Fixed status colors
6. **ChannelsTab.tsx** - Fixed connection status indicator
7. **ContactModal.tsx** - Fixed save status message backgrounds
8. **ContentCalendar.tsx** - Fixed type config backgrounds
9. **AIAssistancePanel.tsx** - Fixed sentiment colors
10. **ActivityFeed.tsx** - Fixed channel config colors
11. **AddAccountWizard.tsx** - Fixed warning and success states
12. **CircuitBreakerStatus.tsx** - Fixed error background
13. **ConfirmDialog.tsx** - Fixed icon backgrounds
14. **DMFeed.tsx** - Fixed message type backgrounds
15. **EnhancedSettingsPanel.tsx** - Fixed developer warning banner
16. **ErrorDisplay.tsx** - Fixed error/warning/info backgrounds
17. **FinanceInsightsPanel.tsx** - Fixed severity styles
18. **GlobalSearch.tsx** - Fixed type colors
19. **HealthCheckModal.tsx** - Fixed warning/info backgrounds
20. **HRAgentCreationModal.tsx** - Fixed user message bubble

## Recommendations

1. **Add ESLint rule** to detect hardcoded color classes
2. **Update component templates** to use design tokens by default
3. **Document the color system** for new contributors
4. **Add visual regression tests** for light/dark mode

## Remaining Work

Many files still need to be updated. Search for these patterns:
```bash
grep -rn "bg-green-500\|bg-blue-500\|bg-red-500\|bg-yellow-500" src/components/
```

## Verification

Run the following to check for remaining issues:
```bash
npm run lint
npm run build:dev
```
