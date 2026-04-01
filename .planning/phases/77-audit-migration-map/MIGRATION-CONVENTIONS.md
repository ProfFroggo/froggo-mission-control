# Migration Conventions: Tailwind → Radix UI v8.0

All phase agents (78–85) MUST follow these rules exactly.

---

## The 6 Rules

1. **Replace layout divs with Radix primitives** — Any `<div className="flex...">` → `<Flex>`. Any `<div className="grid...">` → `<Grid>`. Plain divs with only padding/margin → `<Box>`. No exceptions.

2. **Replace typography utilities with Text/Heading** — `text-sm font-medium` → `<Text size="2" weight="medium">`. Only when the element is ONLY doing typography (no layout). Don't wrap layout divs in Text.

3. **Keep all mission-control-* classes in className** — `bg-mission-control-surface`, `text-mission-control-text`, etc. NEVER remove these. They are the design system.

4. **Keep all non-migratable patterns in className** — overflow-*, absolute, relative, z-*, cursor-*, transition-*, animate-*, rounded-*, border-*, etc. Add these as className prop on the Radix component.

5. **Never touch Radix component props** — Button, Badge, Spinner, Dialog, etc. are already Radix — don't change their internal layout unless it's a wrapper div around them.

6. **Never migrate conditional className patterns for active/hover states** — Lines like `active ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:...'` are our custom tab/nav system — leave exactly as-is.

---

## Required Import

Add to every file that uses Radix layout primitives:
```tsx
import { Box, Flex, Grid, Text, Heading } from '@radix-ui/themes';
```
Only import what's actually used in that file (no unused imports).

If the file already imports from `@radix-ui/themes` (e.g., `import { Button } from '@radix-ui/themes'`), add Box/Flex/Grid/Text/Heading to the same import statement.

---

## The 10 Most Common Patterns

### 1. Panel/Card Header Row
```tsx
// BEFORE
<div className="flex items-center justify-between p-4 border-b border-mission-control-border">
// AFTER
<Flex align="center" justify="between" p="4" className="border-b border-mission-control-border">
```

### 2. Card/Panel Container
```tsx
// BEFORE
<div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
// AFTER
<Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
```

### 3. Icon + Label Inline Row
```tsx
// BEFORE
<div className="flex items-center gap-2">
// AFTER
<Flex align="center" gap="2">
```

### 4. Vertical Stack
```tsx
// BEFORE
<div className="flex flex-col gap-3">
// AFTER
<Flex direction="column" gap="3">
```

### 5. Full-Height Scrollable Container
```tsx
// BEFORE
<div className="flex flex-col h-full bg-mission-control-bg">
// AFTER
<Flex direction="column" height="100%" className="bg-mission-control-bg">
```
Note: bg-mission-control-bg stays in className — it's a design token class.

### 6. Scrollable Content Area
```tsx
// BEFORE
<div className="flex-1 overflow-y-auto p-4 space-y-3">
// AFTER
<Box flexGrow="1" p="4" className="overflow-y-auto space-y-3">
```
Note: overflow-y-auto and space-y-* are non-migratable — stay in className.

### 7. Card Grid
```tsx
// BEFORE
<div className="grid grid-cols-3 gap-4">
// AFTER
<Grid columns="3" gap="4">
```

### 8. Small Label/Caption
```tsx
// BEFORE
<span className="text-xs text-mission-control-text-dim">label</span>
// AFTER
<Text size="1" className="text-mission-control-text-dim">label</Text>
```

### 9. Section with Top Border
```tsx
// BEFORE
<div className="flex items-center gap-2 mt-3 pt-3 border-t border-mission-control-border">
// AFTER
<Flex align="center" gap="2" mt="3" pt="3" className="border-t border-mission-control-border">
```

### 10. Absolute Positioned Overlay
```tsx
// BEFORE
<div className="absolute inset-0 bg-mission-control-bg/80 flex items-center justify-center">
// AFTER
<Flex align="center" justify="center" className="absolute inset-0 bg-mission-control-bg/80">
```

---

## What NOT to Touch

- `<button>` elements with className — these are our custom tab/nav system
- `<input>`, `<textarea>`, `<select>` with className — form elements, leave as-is
- Radix `<Button>`, `<Badge>`, `<Spinner>`, `<Dialog>`, `<DropdownMenu>`, `<Select>`, etc. — already correct, don't wrap
- `style={{}}` props — leave as-is
- SVG elements — leave as-is
- Recharts components — leave as-is
- Any className containing only `sr-only` — accessibility, leave
- `<li>`, `<ul>` elements — keep as-is unless they have flex/grid layout
- Conditional ternary className strings — leave as-is

---

## Per-Phase Component Ownership

To prevent duplicate work across phases:

| Phase | Component Groups | Key Files |
|-------|-----------------|-----------|
| 78 | Core: App.tsx, ErrorBoundary, LoadingStates, DependencyGate, Toast, shared wrappers, IconBadge, QuickActions, BadgeShowcase | src/App.tsx, src/components/ErrorBoundary.tsx, src/components/LoadingStates.tsx, src/components/DependencyGate.tsx, src/components/IconBadge.tsx, src/components/QuickActions.tsx, src/components/BadgeShowcase.tsx |
| 79 | Navigation: Sidebar, FolderTabs, FolderSelector, FolderManager, GlobalSearch, KeyboardShortcuts, ShortcutsModal, QuickModals, BulkFolderAssign | src/components/Sidebar.tsx, FolderTabs.tsx, FolderSelector.tsx, FolderManager.tsx, GlobalSearch.tsx, KeyboardShortcuts.tsx, ShortcutsModal.tsx, QuickModals.tsx, BulkFolderAssign.tsx |
| 80 | Agents: All Agent*.tsx files | src/components/AgentPanel.tsx, AgentDetailModal.tsx, AgentHealthDashboard.tsx, AgentLeaderboard.tsx, AgentCoachingCard.tsx, AgentConfigPanel.tsx, AgentLibraryPanel.tsx, AgentSoulEditor.tsx, AgentHireWizard.tsx, AgentGoalsPanel.tsx, AgentCapabilityMatrix.tsx, AgentCompareModal.tsx, AgentManagementModal.tsx, AgentMetricsCard.tsx, AgentActivityBar.tsx, AgentActivityTimeline.tsx, AgentInstallModal.tsx, AgentSkillsModal.tsx, AgentSelector.tsx, AgentTokenDetailModal.tsx, AgentChatModal.tsx, PokeModal.tsx, TrainingLogModal.tsx, HealthCheckModal.tsx |
| 81 | Chat & Comms: Chat*.tsx, Comms*.tsx, Inbox*.tsx, Thread*.tsx, Voice*.tsx, Meeting*.tsx, FocusMode.tsx | src/components/ChatPanel.tsx, VoiceChatPanel.tsx, ChatRoomView.tsx, CommsInbox3Pane.tsx, InboxPanel.tsx, InboxFilter.tsx, ThreadView.tsx, ThreadListItem.tsx, TaskChatTab.tsx, ContextPanel.tsx, MarkdownMessage.tsx, MessageReactions.tsx, TeamVoiceMeeting.tsx, MeetingTranscriptionPanel.tsx, MeetingTranscribe.tsx, MeetingsPanel.tsx, FocusMode.tsx |
| 82 | Social: All X*.tsx files | src/components/X*.tsx (all ~30 files) |
| 83 | Projects & Finance: projects/*, Finance*.tsx, Budget*.tsx, HR*.tsx, TimeTracking*.tsx, campaigns/*.tsx | src/components/projects/*, FinancePanel.tsx, FinanceAgentChat.tsx, FinanceScenarioPanel.tsx, BudgetPanel.tsx, BudgetDashboard.tsx, HRSection.tsx, HRAgentCreationModal.tsx, TimeTrackingPanel.tsx, campaigns/*.tsx |
| 84 | Settings & Modals: *Settings*.tsx, *Config*.tsx, *Modal.tsx, *Wizard.tsx, Notification*.tsx, Onboarding*.tsx, ConnectedAccounts*.tsx | src/components/SettingsPanel.tsx, EnhancedSettingsPanel.tsx, ConfigTab.tsx, SecuritySettings.tsx, VIPSettingsPanel.tsx, GlobalNotificationSettings.tsx, NotificationSettingsModal.tsx, ChannelsTab.tsx, ExportBackupTab.tsx, DebugTab.tsx, LogsTab.tsx, UsageStatsPanel.tsx, SessionsFilter.tsx, OnboardingFlow.tsx, OnboardingWizard.tsx, AddAccountWizard.tsx, ConnectedAccountsPanel.tsx, AccountDetailModal.tsx, SnoozeModal.tsx, CalendarFilterModal.tsx, FilePreviewModal.tsx, SmartFolderRuleEditor.tsx, NotificationCenter.tsx, NotificationsPanelV2.tsx, QuickStatsWidget.tsx, MorningBrief.tsx |
| 85 | Remaining: Dashboard*.tsx, Analytics*.tsx, Reports*.tsx, KnowledgeBase*.tsx, Library*.tsx, Brand*.tsx, Automations*.tsx, Task*.tsx, Content*.tsx, Calendar*.tsx, Modules*.tsx, Kanban*.tsx, Approval*.tsx, writing/*.tsx, Widget*.tsx, Help*.tsx, all remaining | All not covered in phases 78–84 |

---

## Commit Convention

Each phase or sub-batch of migrated components gets its own atomic commit:
```
feat(78): migrate App.tsx and core layout infrastructure to Radix primitives
feat(79): migrate Sidebar and navigation components to Radix Flex/Box
feat(80): migrate AgentPanel and agent components to Radix layout
feat(81): migrate ChatPanel and communications to Radix layout
feat(82): migrate social X module to Radix layout primitives
feat(83): migrate projects, finance, HR components to Radix layout
feat(84): migrate settings, config, and modals to Radix layout
feat(85): migrate remaining components, zero Tailwind layout classes remain
```

---

## Verification Per Phase

After completing each phase, run this command on the phase's files to confirm no unmigrated layout classes remain:
```bash
# Check for remaining flex/grid layout classes
grep -l 'className="[^"]*flex\|className="[^"]*grid\|className="[^"]*gap-[0-9]\|className="[^"]*\bp-[0-9]\|className="[^"]*px-[0-9]\|className="[^"]*py-[0-9]' [phase-files]
```

Zero matches (or only valid non-migratable className usage remaining) = phase complete.

---

## Edge Cases

### When div has BOTH flex AND non-migratable classes:
```tsx
// BEFORE
<div className="flex items-center gap-2 overflow-hidden cursor-pointer">
// AFTER
<Flex align="center" gap="2" className="overflow-hidden cursor-pointer">
```

### When element is inline (span) with layout:
```tsx
// BEFORE
<span className="inline-flex items-center gap-1">
// AFTER — keep as-is since Radix Flex renders as div (block);
// OR if inline-flex is critical:
<Flex align="center" gap="1" className="inline-flex">
// OR just leave as span with className if migration would break layout
```

### When div has only non-migratable classes (no Box needed):
```tsx
// BEFORE
<div className="absolute inset-0 overflow-hidden z-10">
// AFTER — Box adds value here for future Radix integration
<Box className="absolute inset-0 overflow-hidden z-10">
// BUT if the div has no Radix-migratable props, it's OK to leave as-is
```

### When there's a conditional class only:
```tsx
// BEFORE
<div className={isOpen ? 'flex flex-col gap-2' : 'hidden'}>
// AFTER — still migrate the layout portion:
<Flex direction="column" gap="2" className={isOpen ? '' : 'hidden'}>
// OR leave the whole thing if the condition makes it complex
```

### Zero-value spacing:
```tsx
// BEFORE
<div className="py-0 mt-0 gap-0">
// AFTER — use style prop for zeros (no Radix token for 0)
<Box style={{ paddingTop: 0, paddingBottom: 0, marginTop: 0, gap: 0 }}>
// OR keep these in className if they're already mixed with other non-migratable classes
```
