# Roadmap: UI Finalization — Froggo Mission Control

## Overview

Systematic elimination of every design anti-pattern, token violation, incorrect Radix usage pattern,
and content inaccuracy identified across three audit rounds and two debate sessions. Work flows from
foundation (fix the token layer everything builds on) through component normalization (enforce 100%
Radix Themes 3 patterns), content accuracy, iterative Stripe-level polish passes, and final
accessibility hardening — leaving a production-grade UI with zero AI-slop tells, zero green CTAs,
zero glassmorphism, and zero hardcoded colors.

## Design System Constraints (HARD RULES — Never Violate)

- **Platform**: 100% Radix Themes 3 (`accentColor="violet"`)
- **Nav tabs**: Raw `<button>` + `border-b-2 border-mission-control-accent` (NEVER Radix Button)
- **Segment controls**: Raw `<button>` in bordered container, `bg-mission-control-accent/10` active
- **Primary CTA**: `<Button variant="solid">` — no `color=` prop (violet default)
- **Destructive**: `<Button color="red">` only
- **Semantic green**: Allowed ONLY for approve/deny pairs and enabled-state indicators
- **No emojis**: Lucide icons only throughout UI chrome
- **No glassmorphism**: `backdrop-blur` + opacity cards → `bg-mission-control-surface`
- **No gradient text**: `bg-clip-text text-transparent` is banned — use solid token colors
- **No hardcoded colors**: Everything via CSS design tokens

## Domain Expertise

- `.claude/skills/ui-components/SKILL.md` — Radix UI component conventions
- `.claude/skills/ui-ux-polish/SKILL.md` — Stripe-level iterative polish methodology
- `.agents/skills/frontend-design/SKILL.md` — Anti-pattern detection, AI slop test
- `.agents/skills/normalize/SKILL.md` — Design system normalization
- `.agents/skills/audit/SKILL.md` — Technical quality checks
- `.agents/skills/polish/SKILL.md` — Final polish pass methodology
- `.agents/skills/colorize/SKILL.md` — Token-based color system
- `.agents/skills/typeset/SKILL.md` — Typography system

## Phases

- [x] **Phase 1: Design Token Foundation** — Fix the CSS layer everything builds on
- [ ] **Phase 2: Anti-Pattern Elimination** — Glassmorphism, gradient text, hardcoded colors gone
- [ ] **Phase 3: Navigation & Information Architecture** — Sidebar grouping, tab reduction, empty state hierarchy
- [ ] **Phase 4: Radix Component Normalization** — 100% correct Radix Themes 3 patterns
- [ ] **Phase 5: Icon, Media & UX Copy Accuracy** — X logo, Lucide everywhere, developer language → user language
- [ ] **Phase 6: Content & Data Accuracy** — KPI neutral dashes, human cron, real badge counts
- [ ] **Phase 7: Stripe-Level Polish** — Iterative desktop + mobile polish passes, delight moments
- [ ] **Phase 8: Accessibility Hardening** — WCAG AA contrast, focus states, touch targets
- [ ] **Phase 9: Final Verification** — Build clean, screenshot spot-check, ship-ready sign-off

## Phase Details

### Phase 1: Design Token Foundation
**Goal**: Fix the CSS foundation everything builds on. Two parallel token systems loaded
simultaneously with conflicting values is a P0 — one must be the canonical source. 28 hardcoded
green rgba values across 7 CSS files must be replaced with accent-aware tokens. Font size, placeholder
contrast, easing, and button CSS system consolidation complete the foundation layer.
**Depends on**: Nothing (must go first — downstream phases depend on correct tokens)
**Research**: Unlikely (known files, known lines — confirmed by 3 debate agents)
**Plans**: 6 plans

Plans:
- [ ] 01-01: Confirm which token file is canonical — audit `src/design-tokens.css` vs `src/design-system/tokens.css` for all conflicting values (`--radius-sm`, `--z-dropdown`, `--shadow-*`, `--ease-*`); migrate unique values from `design-system/tokens.css` into `design-tokens.css`; delete `design-system/tokens.css`; verify imports in `index.css`
- [ ] 01-02: Fix base font size — `design-tokens.css:72` `14px` → `1rem`; also update min-bound on font-size slider in `EnhancedSettingsPanel.tsx:227` so users cannot set it below 14px via settings
- [ ] 01-03: Fix all 28 hardcoded `rgba(34, 197, 94, ...)` — replace with `color-mix(in srgb, var(--mission-control-accent) N%, transparent)` across 7 files: `design-tokens.css`, `design-system/tokens.css` (before deletion), `component-patterns.css`, `glass-theme.css`, `dashboard-redesign.css`, `index.css`, `writing-editor.css`; **critical**: `glass-theme.css:222-226` uses `!important` on input focus ring — remove the `!important` and convert to accent token
- [ ] 01-04: Consolidate `glass-card` triple-definition — exists in `index.css:128`, `dashboard-redesign.css:63`, `glass-theme.css:95`; the `glass-theme.css` version wins via `!important`; merge into single definition in `component-patterns.css`, remove other two; eliminate other duplicate classes (`.modern-scrollbar`, `.skeleton`, `.truncate-2`/`.truncate-3`)
- [ ] 01-05: Fix placeholder contrast — `forms.css:107-110` remove stacked `opacity: 0.6` on `var(--mission-control-text-dim)`; raise `--leading-normal` to `1.55` in token file for dark-mode body text legibility
- [ ] 01-06: Remove `--ease-bounce` + consolidate button CSS systems — delete `--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55)` from token file, replace with `--ease-quint-out: cubic-bezier(0.22, 1, 0.36, 1)`; consolidate 3 competing button systems (`.btn` in `index.css`, `.btn-base` in `component-patterns.css`, `.mission-control-btn-*` in `forms.css`) into single canonical system in `component-patterns.css`

### Phase 2: Anti-Pattern Elimination
**Goal**: Purge every AI-slop tell: glassmorphism cards, gradient text on headings/metrics, and
hardcoded non-token palette colors. These are the highest-visibility issues — the ones that make
the UI read as AI-generated at first glance.
**Depends on**: Phase 1 (tokens must be correct before applying them)
**Research**: Unlikely (all specific files and line numbers known)
**Plans**: 3 plans

Plans:
- [ ] 02-01: Remove glassmorphism from `DashboardRedesigned.tsx` — `StatCard` (line 324), `Quick Actions` (415), `ApprovalsQueue` (519): `backdrop-blur-xl` → `bg-mission-control-surface`
- [ ] 02-02: Remove gradient text — `Dashboard.tsx:78` and `DashboardRedesigned.tsx` ×5 (lines 140, 239, 274, 312, 344): `bg-clip-text text-transparent` → solid `text-mission-control-text`
- [ ] 02-03: Fix hardcoded palette colors in `DashboardRedesigned.tsx` (lines 340, 410-411) `shadow-green-400/50`/`shadow-purple-400/50`/`shadow-blue-400/50` → token classes; remove `animate-gradient-x` usage (lines 134, 226) — it is not defined in `tailwind.config.js` and produces no animation; fix `AgentPanel.tsx` inline style `style={{ backgroundColor: themeColor + '22' }}` → CSS variable with token-based opacity

### Phase 3: Navigation & Information Architecture
**Goal**: Fix the structural problems that make the app feel overwhelming regardless of visual polish.
18 unstructured sidebar items need section grouping. Tab-heavy detail panels need audit and
consolidation. Empty states need differentiation. These are P1 issues identified by ALL three auditors.
**Depends on**: Phase 2 (anti-patterns gone first)
**Research**: Unlikely (known files, patterns established)
**Plans**: 4 plans

Plans:
- [ ] 03-01: Sidebar nav grouping — add section dividers: **Core** (Dashboard, Inbox, Tasks, Approvals) / **Team** (Agents, Chat, Meetings) / **Work** (Projects, Campaigns, Schedule) / **Intelligence** (Analytics, Knowledge) / **Tools** (Library, Automations, Modules, Social, Module Builder)
- [ ] 03-02: Campaign detail tab audit — 11 tabs is too many; remove Comments tab (duplicates Chat exactly); consider merging Performance/ROI; final target ≤8 tabs
- [ ] 03-03: Empty state differentiation — 15 identical empty states all use `icon + "No X yet" + subtitle`; create at least 3 distinct tiers: global empty (no campaigns ever), local empty (no tasks in this project), error empty (failed to load)
- [ ] 03-04: Remove "2 Issues" debug badge — either fix the 2 underlying issues and remove the badge, or move it to Settings > System Health; it appears on ~30% of screens as if it's a feature
- [ ] 03-05: KnowledgeBase triple-filter consolidation — three simultaneous filter mechanisms (sidebar categories + header pills + search box) create cognitive overload; remove header pills (keep sidebar + search); dashboard metric cards double-report: `DashboardRedesigned.tsx` Pending Approvals shows same count as `text-5xl` AND `animate-pulse` badge simultaneously — remove the badge, trust the big number
- [ ] 03-06: Agent card density — each card currently shows 12-15 data points with equal visual weight (fails 5/8 cognitive load checklist items); collapse card to surface layer: avatar + name + status dot + current task only; all other data (metrics, tokens, capabilities, trust tier) already exists in `AgentDetailModal` — just stop duplicating it on the card

### Phase 4: Radix Component Normalization
**Goal**: Enforce 100% Radix Themes 3 patterns. Every segment control and filter pill that
incorrectly uses `<Button>` must become a raw `<button>`. Every remaining green CTA that should
be violet. `TabNav.tsx` is the gold standard — everything else must match it.
**Depends on**: Phase 1
**Research**: Unlikely (patterns established, files identified)
**Plans**: 5 plans

Plans:
- [ ] 04-01: Fix `KnowledgeBase.tsx:1300-1312` — Radix `<Button>` filter pills → raw `<button>` segment control; fix `KnowledgeBase.tsx` "Add Asset" green CTA → violet
- [ ] 04-02: Fix `ModuleBuilder/ConversationPanel.tsx:72-81` — Radix `<Button color="green">` section pills → raw `<button>` segment control; `'✓ '` string → `<CheckCircle size={12} />`
- [ ] 04-03: Fix `ModuleBuilder/SpecPreviewPanel.tsx` — remove `pink-500`/`cyan-500` (lines 33-35); inline tab impl (92-114) → `<TabNav />` component
- [ ] 04-04: Fix Meetings green accent inconsistency — phone icon and "New Meeting" button use green; either deliberately assign green to live/active states throughout, or align to violet (pick one, document the decision)
- [ ] 04-05: Codebase-wide CTA audit — `grep -rn 'color="green"\|color="grass"'` to catch remaining CTAs not in identified files; fix all to violet or document as semantic semantic exceptions

### Phase 5: Icon, Media & UX Copy Accuracy
**Goal**: Every icon must be accurate. Every label must use human language, not developer language.
Twitter bird is dead. `'✓ '` is not an icon. "Safety Lock" and "Task Watcher" are not user-facing
labels. Credential checkmarks that mean "has content" should not look like "validated."
**Depends on**: Phase 4 (✓ string fix overlaps with 04-02)
**Research**: Unlikely (specific files known)
**Plans**: 4 plans

Plans:
- [ ] 05-01: Replace `<Twitter />` → `<X />` Lucide icon in `XSetupWizard.tsx`; fix `bg-info-subtle` (line 162) → `bg-mission-control-accent/20`; credential field green checkmarks → neutral (only green after "Save & Verify" succeeds)
- [ ] 05-02: Developer language → user language: "Safety Lock" → "Safety Controls", "Task Watcher" → "Task Processing", "Soul" tab title → "Personality", raw YAML in Soul tab behind "Advanced → Edit Config" escape hatch
- [ ] 05-03: Audit all `src/components/` for emoji in UI chrome — `grep -rn '🧩\|✅\|⚡\|📋\|🎯\|✓'` — replace with Lucide icons (user-generated content emoji are acceptable)
- [ ] 05-05: XSetupWizard progressive disclosure — 7 credential fields shown simultaneously violates 4-item working memory limit; group into 2 steps: Step 1 = API Key + API Secret + Bearer Token (the essentials), Step 2 (expandable) = Access Token + Access Token Secret + OAuth Client ID + OAuth Client Secret; keep "Get credentials from X Developer Portal" link above the form not below the CTA
- [ ] 05-04: Fix remaining `style={}` inline color props — `grep -rn 'style={{.*color'` — convert to token classes; `XSetupWizard.tsx:261` inline width/justify → Tailwind; `Dashboard.tsx:323` inline style → Tailwind

### Phase 6: Content & Data Accuracy
**Goal**: Data displayed to users must be accurate and readable. Zero should not look like decline.
Raw cron syntax should be human-readable. File names should be humanized. Badge counts should be
real numbers. Agent status dots must have discoverable meaning.
**Depends on**: Phase 4
**Research**: Unlikely (all identified in audit)
**Plans**: 5 plans

Plans:
- [ ] 06-01: Fix red downward arrows on empty/zero KPI data — show neutral dash (`—`) instead of directional indicator when value is null/zero/undefined; Campaign Performance tab 6 KPI cards
- [ ] 06-02: Fix raw cron notation display in `CronTab.tsx` — add `cronToHuman()` helper: `0 23 * * *` → "Daily at 11:00 PM"
- [ ] 06-03: Fix raw filenames in `KnowledgeBase.tsx` and `Library/Files` breadcrumb — humanize: strip extension, replace `-`/`_` with spaces, title-case
- [ ] 06-04: Fix badge counts — `99+` cap → real numbers (already fixed in sidebar, audit for any remaining instances); Notifications "All 214" vs "Actionable 214" same count — fix the semantic distinction or merge the tabs
- [ ] 06-05: Fix Campaign link automation ambiguous empty state: "All automations already linked, or none exist" → two distinct states with different copy; fix Schedule Scheduler default tab to "All" (not "Active/0")

### Phase 7: Stripe-Level Polish
**Goal**: Multiple iterative polish passes. Desktop and mobile separately. Target: five specific
delight moments identified by audit + two full polish passes using the ui-ux-polish methodology.
**Depends on**: Phases 1-6 (anti-patterns and content must be correct before polishing)
**Research**: Unlikely (methodology defined in ui-ux-polish skill)
**Plans**: 5 plans

Plans:
- [ ] 07-01: Delight moments — implement all 5 from audit: (1) chat input focus border glow 200ms ease-out-expo, (2) stat numbers tabular-nums + fade on change, (3) agent online dot CSS opacity pulse 2s no-JS, (4) KB article rows: action buttons fade in on hover, (5) Module Builder tab completion CheckCircle scale-in 200ms ease-out-quart
- [ ] 07-02: Desktop polish pass 1 — spacing rhythm (cards p-4 vs panels p-6 inconsistency), typography hierarchy (name bolder than role in Leaderboard/Agent cards), hover state consistency, shadow/depth intentionality
- [ ] 07-03: Mobile polish pass — touch targets ≥44px, responsive breakpoints, 7-icon unlabeled toolbar in Task Board, social pipeline approval buttons (icon-only approve/deny = misclick risk on mobile)
- [ ] 07-04: Social Engage consolidation — 9 sub-tabs → 4: "Needs Action / In Progress / Done / Archive"; Approve Reply button position — move to top of card, not after full scroll
- [ ] 07-05: Desktop polish pass 2 — second iteration; add "Add Action" CTAs to AI suggestions in Social Measure; "Before You Post" skeleton output; Library Templates community CTA for empty lower half

### Phase 8: Accessibility Hardening
**Goal**: WCAG AA compliance throughout. After font-size fix in Phase 1, recheck all contrast
ratios. Verify keyboard navigation doesn't trap or skip. Ensure every interactive element has
proper ARIA labels. All touch targets meet 44px minimum.
**Depends on**: Phase 1 (font-size changes contrast), Phase 7 (polish may shift colors)
**Research**: Unlikely (internal audit work)
**Plans**: 4 plans

Plans:
- [ ] 08-01: Contrast audit — check all `text-mission-control-text-dim` on surface backgrounds post-font-fix; check all placeholder text; verify semantic color tokens meet 4.5:1 ratio
- [ ] 08-02: Focus state audit — every interactive element must have visible focus ring; no `outline: none` without replacement; test full keyboard navigation paths in Sidebar, Task Board toolbar, tab bars
- [ ] 08-03: ARIA label audit — `grep -rn '<IconButton\|<Button' src/` without `aria-label`; all icon-only buttons need labels; Schedule "Ask" button; Social pipeline approve/deny icons
- [ ] 08-04: Touch target audit — ≥44×44px on all interactive surfaces; calendar color legend missing (Schedule calendar); agent card color stripe legend; add legend tooltip to all unlabeled color systems

### Phase 9: Final Verification
**Goal**: Ship-ready sign-off. Clean build, full screenshot spot-check against highest-risk screens,
final git commit, npm publish readiness confirmation.
**Depends on**: All phases
**Research**: Unlikely (verification work)
**Plans**: 3 plans

Plans:
- [ ] 09-01: Full build verify — `rm -rf .next-verify && npm run build:verify` — zero errors, zero warnings on changed files
- [ ] 09-02: Screenshot spot-check — re-verify 20 highest-risk screens: Dashboards, AgentPanel (card + Soul tab), KnowledgeBase, ModuleBuilder, XSetupWizard, CronTab, Campaign Performance KPIs, Notifications, Social Pipeline board, Sidebar
- [ ] 09-03: Pre-publish checklist — verify `accentColor="violet"` in root, zero `color="green"` CTAs (except semantic approve/deny), zero `backdrop-blur` on content cards, zero gradient text, build passes — then npm publish

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Design Token Foundation | 6/6 | ✅ Complete | 2026-03-25 |
| 2. Anti-Pattern Elimination | 0/3 | Not started | - |
| 3. Navigation & IA Architecture | 0/6 | Not started | - |
| 4. Radix Component Normalization | 0/5 | Not started | - |
| 5. Icon, Media & Copy Accuracy | 0/5 | Not started | - |
| 6. Content & Data Accuracy | 0/5 | Not started | - |
| 7. Stripe-Level Polish | 0/5 | Not started | - |
| 8. Accessibility Hardening | 0/4 | Not started | - |
| 9. Final Verification | 0/3 | Not started | - |

**Total: 6/42 plans complete** (14%)

---

## Audit Findings Reference

*Sources: 3-auditor debate (Design Systems / UX Flow / Visual Polish) × 2 rounds, plus 109-screen
pixel-perfect critique from UI Audit.md (2026-03-25)*

### Consensus (All 3 Auditors Agreed Without Prompting)
1. Gradient text on Dashboard = cut it → Phase 2
2. Glass/backdrop-blur on cards = cut it → Phase 2
3. KB tag pills overload the list view → Phase 3/7
4. "17%" and "30" badge need labels → Phase 6
5. Twitter bird → X logo → Phase 5

### P0 — Blocking
- Radix `<Select.Item value="">` crash in CronTab → raw error shown to users (ALREADY FIXED in session 059)
- Decorative gradient background buried under fully-opaque panels — decision needed: remove gradient OR make panels semi-transparent; given anti-glass stance, remove the SVG radial gradient → Phase 2

### P1 — Must fix before publish
- `design-tokens.css:72` — `14px` base font → Phase 1
- `design-tokens.css:178-179` — green glow hardcoded → Phase 1
- `Dashboard.tsx:78` + `DashboardRedesigned.tsx` ×5 — gradient text → Phase 2
- `DashboardRedesigned.tsx` — `backdrop-blur-xl` on StatCard/QuickActions/ApprovalsQueue → Phase 2
- 18 flat sidebar items, no grouping → Phase 3
- Campaign Comments tab duplicates Chat → Phase 3
- "2 Issues" debug badge on ~30% of screens → Phase 3
- `KnowledgeBase.tsx:1300` — Radix Button for filter pills → Phase 4
- `ConversationPanel.tsx:72` — Radix Button green for section pills → Phase 4
- KB "Add Asset" green CTA → Phase 4
- Meetings green accent (phone icon + New Meeting) — align decision → Phase 4
- `XSetupWizard.tsx` — Twitter bird icon → Phase 5
- `ConversationPanel.tsx:79` — `'✓ '` string icon → Phase 5
- Agent Soul tab exposes raw YAML directly → Phase 5
- "Safety Lock"/"Task Watcher" — developer language → Phase 5
- Duplicate "Create Agent" CTA in AgentPanel → Phase 5
- Red downward arrows on zero KPI → Phase 6

### P2 — This week
- `forms.css:107-110` — placeholder opacity stacking → Phase 1
- `--ease-bounce` — dated easing → Phase 1
- Three competing button CSS systems → Phase 1
- `DashboardRedesigned.tsx:340,410-411` — hardcoded palette colors → Phase 2
- `SpecPreviewPanel.tsx:33-35` — pink-500/cyan-500 → Phase 4
- `SpecPreviewPanel.tsx:92-114` — inline tab impl → Phase 4
- Credential green checkmarks = "has content" not "validated" → Phase 5
- `style={}` inline color props throughout → Phase 5
- Raw cron notation → human-readable → Phase 6
- Raw filenames in KnowledgeBase/Library breadcrumb → Phase 6
- `99+` badge cap remaining instances → Phase 6
- Notifications "All" vs "Actionable" same count → Phase 6
- Campaign link automation ambiguous empty state → Phase 6
- Schedule Scheduler default to "All" not "Active/0" → Phase 6
- 15 identical empty states → Phase 3
- Filter chips on empty state (Campaigns) → Phase 3
- Agent card color stripe has no legend → Phase 8
- Checklist checkbox spacing → Phase 7
- Social Engage 9 sub-tabs → 3-4 → Phase 7
- Approve/Deny button at bottom of long social cards → Phase 7
- Schedule calendar color legend missing → Phase 8

### P3 — Polish sprint
- Spacing rhythm inconsistency → Phase 7
- Missing loading skeletons → Phase 7
- Transition timing mix → Phase 1/7
- Mobile touch targets → Phase 8
- Missing ARIA labels on icon-only buttons → Phase 8
- tabular-nums on all stat numbers → Phase 7
- Agent dot CSS pulse (no JS bounce) → Phase 7
- KB article rows action buttons on hover only → Phase 7
- "Before You Post" predictor missing sample → Phase 7
- Library Templates community CTA for empty lower half → Phase 7
- any types in ChatPanel.tsx → Phase 8

### Known Good (Maintain These Patterns)
- `TabNav.tsx` — gold standard for tab implementation; all other tabs must match it
- Module Builder — best-designed screen; split pane + progress stepper is excellent
- Campaign Planner flow — excellent UX; keep the conversational step structure
- Posting Heatmap — "absolutely excellent feature, well-executed"
- Credentials form in XSetupWizard — "best credentials UI in the app"
- Leaderboard — clean, functional
- Agent bubble grid in Chat Team Meeting — "most visually delightful element in the entire app"
- Dispatch Agent dialog — "well designed"
