# Social Media Module Consolidation

## Context

The social module has 15 tabs, a rigid 3-pane layout, and 5 separate approval surfaces. Most tabs overlap heavily — Pipeline/Drafts/Plan/Calendar all render the same scheduleApi data, Mentions/Reply Guy process the same inbox data, Research/Competitors/Hashtags all use the same search endpoint. The approval queue pane shows on 8 tabs but misses most actual approval actions.

Full audit and proposal: `.planning/proposals/social-module-consolidation.md`

## Goal

Consolidate 15 tabs to 5 + floating compose. Kill the rigid 3-pane layout. Make approvals inline. Agent chat becomes a slide-in toggle. Polish all UI/UX along the way.

```
BEFORE: 15 tabs | 3 rigid panes | 5 approval surfaces | 40% content width
AFTER:  5 tabs + compose | adaptive layout | inline approvals | 100% content width
```

## Phases

- [ ] **Phase 20.1: Layout Overhaul** — Kill 3-pane, build adaptive layout with slide-in chat + floating compose + approval badge
- [ ] **Phase 20.2: Pipeline Consolidation** — Merge Pipeline + Drafts + Plan + Calendar + Campaigns into multi-view Pipeline tab
- [ ] **Phase 20.3: Engage Tab** — Merge Mentions + Reply Guy into unified engagement inbox
- [ ] **Phase 20.4: Intelligence Tab** — Merge Research + Competitors + Hashtags with sub-tab routing
- [ ] **Phase 20.5: Measure + Configure Tabs** — Absorb Content Mix into Analytics, merge Automations + Agent Mode into Configure
- [ ] **Phase 20.6: Polish + Cleanup** — Remove dead components, update agent chat contexts, final UI/UX pass

## Phase Details

### Phase 20.1: Layout Overhaul
**Goal**: Replace the rigid XThreePaneLayout with an adaptive layout. Content gets full width. Agent chat becomes a toggle slide-in panel. Compose becomes a floating modal. Approval queue pane is removed — approvals go inline.
**Plans**: 2

Plans:
- [ ] 20.1-01: Build XSocialLayout (adaptive 2-pane) + XComposeModal (floating composer)
- [ ] 20.1-02: Build XApprovalBadge (unified count + dropdown) + wire into header

### Phase 20.2: Pipeline Consolidation
**Goal**: Pipeline tab gets view mode toggle: Board (kanban) | Calendar | List | Campaigns. Absorbs 5 former tabs. Inline approvals on every card.
**Plans**: 2

Plans:
- [ ] 20.2-01: Add view mode toggle + calendar/list views to Pipeline
- [ ] 20.2-02: Integrate campaigns as Pipeline view mode + inline approval actions on cards

### Phase 20.3: Engage Tab
**Goal**: Unified engagement inbox merging Mentions + Reply Guy. Smart filters (All/Hot/Pending/Replied/Ignored), priority accounts, sentiment, templates, inline reply composer with approval gate.
**Plans**: 2

Plans:
- [ ] 20.3-01: Build XEngageView with unified mention loading + smart filters + priority/sentiment
- [ ] 20.3-02: Add inline reply composer with templates, fast-track toggle, approval gate

### Phase 20.4: Intelligence Tab
**Goal**: Research + Competitors + Hashtags as sub-tabs within one Intelligence view. Shared agent chat context.
**Plans**: 1

Plans:
- [ ] 20.4-01: Build XIntelligenceView wrapper with sub-tab routing

### Phase 20.5: Measure + Configure Tabs
**Goal**: Content Mix becomes a card in Analytics. Automations + Agent Mode + Credentials become sub-tabs in Configure.
**Plans**: 1

Plans:
- [ ] 20.5-01: Absorb ContentMix into Analytics + build XConfigureView with sub-tabs

### Phase 20.6: Polish + Cleanup
**Goal**: Delete dead components, update XTab type, update agent chat tab contexts, final UI/UX consistency pass.
**Plans**: 1

Plans:
- [ ] 20.6-01: Remove dead files, update types + chat contexts, final polish pass

## Execution Order

20.1 → 20.2 → 20.3 → 20.4 → 20.5 → 20.6

Phase 20.1 must go first (layout is the foundation). Phases 20.2-20.5 can technically parallel but sequential is safer. Phase 20.6 is cleanup after all consolidation.

## Progress

| Phase | Plans | Status |
|-------|-------|--------|
| 20.1 Layout Overhaul | 0/2 | Not started |
| 20.2 Pipeline Consolidation | 0/2 | Not started |
| 20.3 Engage Tab | 0/2 | Not started |
| 20.4 Intelligence Tab | 0/1 | Not started |
| 20.5 Measure + Configure | 0/1 | Not started |
| 20.6 Polish + Cleanup | 0/1 | Not started |
