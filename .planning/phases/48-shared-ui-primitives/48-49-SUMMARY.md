# Phases 48 & 49 — Shared UI Primitives & Layout/Navigation Radix Migration

## Overview

Migrated all shared primitive components and layout/navigation components from raw HTML UI elements to Radix Themes equivalents. These are the foundational components used across the entire platform.

## Files Migrated (35 total)

### Phase 48 — Shared UI Primitives

| File | Changes |
|------|---------|
| `BadgeWrapper.tsx` | `BadgeWrapper`, `NumberBadge` → `<Badge>` with color/size mapping; `DotBadge` kept as `<span>` (dot indicator) |
| `ReadStateBadge.tsx` | Custom badge divs → `<Badge color="blue|orange" variant="soft">` |
| `IconBadge.tsx` | No changes needed (icon container, not interactive elements) |
| `BadgeShowcase.tsx` | `<h1>`, `<h2>`, `<p>`, `<div>` → `<Heading>`, `<Text>`, `<Flex>`, `<Box>` |
| `Toast.tsx` | Toast items → `<Callout.Root>` with color-mapped variants; dismiss → `<IconButton variant="ghost">` |
| `LoadingStates.tsx` | `Spinner` → wraps `<RadixSpinner>`; `LoadingButton` → `<Button>`; `LoadingOverlay`/`InlineLoader` use Radix Spinner |
| `LoadingPanel.tsx` | Custom spinner div → `<Spinner size="3">`; label → `<Text>` |
| `Skeleton.tsx` | All `Skeleton*` components → `<RadixSkeleton>` from `@radix-ui/themes` |
| `PanelSkeleton.tsx` | Uses `<Skeleton>` from `@radix-ui/themes` directly |
| `EmptyState.tsx` | Container → `<Flex>`; `<h3>` → `<Heading>`; `<p>` → `<Text>`; buttons → `<Button>` |
| `ErrorDisplay.tsx` | Inline mode → `<Callout.Root>`; full mode buttons → `<Button>`; `FieldError` → `<Flex>` + `<Text>` |
| `Tooltip.tsx` | Entire custom portal impl → `<RadixTooltip content={string}>`; `HelpTooltip` → `<IconButton>` |
| `Toggle.tsx` | Custom track/thumb → `<Switch>` with color/size mapping |
| `VoiceButton.tsx` | Main button → `<IconButton>`; chips → `<Badge>` |
| `SnoozeButton.tsx` | Snoozed state → `<Badge>`; modal buttons → `<Button>`; close → `<IconButton>` |

### Phase 49 — Layout, Navigation & Widget Primitives

| File | Changes |
|------|---------|
| `SnoozeNotifications.tsx` | Reminder notifications → `<Callout.Root color="orange">` with click handling |
| `NetworkStatus.tsx` | Offline/online banners → `<Callout.Root>` in fixed wrapper; dismiss → `<IconButton>` |
| `CircuitBreakerStatus.tsx` | Error container → `<Callout.Root>`; status labels → `<Badge>` |
| `LiveActivity.tsx` | Container → `<Card>`; header → `<Text>`; `<Separator>`; scroll → `<ScrollArea>`; spinner → `<Spinner>` |
| `TopBar.tsx` | Bell → `<IconButton>`; unread badge → `<Badge>`; connection status → `<Badge>` with `<Spinner>` |
| `PanelHeader.tsx` | Already migrated — no changes needed |
| `MobileNavDrawer.tsx` | Close → `<IconButton>`; "Navigation" → `<Text>`; nav badges → `<Badge>`; bottom buttons remain native (complex active states) |
| `SessionStatsBar.tsx` | Reconnect/reset/compact → `<IconButton>`; container → `<Flex>`; context % → `<Text>` |
| `AgentActivityBar.tsx` | No changes (nav buttons have complex active-state classNames, kept native) |
| `WidgetLoader.tsx` | `WidgetError` → `<Callout.Root>`; loading spinner → `<Spinner>`; `<h3>` → `<Heading>`; tags → `<Badge>` |
| `WidgetLoading.tsx` | No changes needed (uses local `Skeleton` and `Spinner` wrappers already migrated) |
| `HelpPanel.tsx` | Header → `<IconButton>` close, `<Heading>`; nav tabs → `<Button>`; section headings → `<Text>`; article/FAQ cards use `<Text>` and `<Flex>`; article view → `<Badge>` + `<Heading>` + `<Button>` back |
| `TourGuide.tsx` | Header → `<Heading>` + `<IconButton>` close; step text → `<Text>`; footer buttons → `<Button>`/`<IconButton>` |
| `ProtectedPanels.tsx` | No changes (lazy imports + HOC only, no UI elements) |
| `QuickModals.tsx` | Refresh buttons → `<IconButton variant="ghost">` across CalendarModal, EmailModal, MentionsModal, MessagesModal |
| `NewContentWidget.tsx` | Error → `<Callout.Root>`; count badge → `<Badge color="violet">`; header → `<Flex>` |
| `InboxWidget.tsx` | Error → `<Callout.Root>`; unread badge → `<Badge color="blue">`; header → `<Flex>` |
| `WeatherWidget.tsx` | Header `<h2>` → `<Text>`; refresh → `<IconButton>`; retry → `<Button>`; header → `<Flex>` |
| `QuickStatsWidget.tsx` | `<h2>` → `<Text>` + `<Flex>`; loading `<h2>` → `<Heading>` |
| `QuickActions.tsx` | Close buttons → `<IconButton>` in all sub-modals; send buttons → `<Button>`/`<IconButton>`; modal headings → `<Text>` |

## Key Migration Patterns Applied

- `<button onClick={...}>` close buttons → `<IconButton variant="ghost" color="gray" size="1|2">`
- `<button onClick={...}>` primary actions → `<Button variant="solid" color="grass" size="2">`
- `<button onClick={...}>` secondary actions → `<Button variant="surface" color="gray">`
- `<h1>/<h2>/<h3>` headings → `<Heading size="1-6">`
- `<p>/<span>` body text → `<Text size="1-4" color="gray">`
- `<div className="flex ...">` → `<Flex align/justify/gap>`
- `<div className="...">` layout wrappers → `<Box>`
- Custom badge spans → `<Badge color="..." variant="soft|solid" radius="full|none">`
- Error state divs → `<Callout.Root color="red">`
- Warning/notice divs → `<Callout.Root color="orange">`
- `<Loader2 animate-spin>` / custom spinner divs → `<Spinner size="1|2|3">`
- Custom shimmer skeleton divs → `<Skeleton>`
- Custom checkbox+track+thumb → `<Switch>`
- Custom portal tooltip → `<Tooltip content={string}>`

## Preserved

- All logic, state, handlers, effects, refs, callbacks
- All layout classNames that drive positioning/sizing
- Custom active-state classNames on nav buttons (too complex to replace without risk)
- Complex drag-and-drop toolbar controls in QuickActions
- Call/video/screen-share controls in QuickActions (kept native for reliability)

## Build Status

- Webpack compilation: passes (all groups)
- TypeScript: passes (pre-existing errors in out-of-scope files remain: AgentCoachingCard, AccessibilitySettings, Dashboard, Kanban)
- One TypeScript fix applied: `CampaignCommentsPanel.tsx` numeric `Spinner size` → string literal `'3'`
