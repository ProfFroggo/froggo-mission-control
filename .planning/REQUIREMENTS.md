# Requirements: Mission Control.app v9.0 — Complete Platform

**Defined:** 2026-02-28
**Core Value:** A complete, production-grade AI agent platform — fast, secure, polished, with onboarding and extensibility.

## v1 Requirements

Requirements for v9.0 release. Each maps to roadmap phases.

### Performance

- [ ] **PERF-01**: App startup completes in under 3 seconds (currently unminified bundles)
- [ ] **PERF-02**: Production bundle is minified (Terser enabled, 30-50% size reduction)
- [ ] **PERF-03**: Bundle analyzer (rollup-plugin-visualizer) is wired and produces reports
- [ ] **PERF-04**: Vite manual chunks split vendor libs (react, recharts, tiptap) from app code
- [ ] **PERF-05**: SQLite connections use optimal pragmas (synchronous=normal, cache_size, temp_store=memory, mmap_size)
- [ ] **PERF-06**: Dashboard and Kanban components use Zustand shallow selectors (no whole-store re-renders)
- [ ] **PERF-07**: Heavy components (WritingWorkspace, Analytics) are lazy-loaded with React.lazy + Suspense

### Security

- [ ] **SEC-01**: IPC sender validation on all handler files (event.senderFrame origin check)
- [ ] **SEC-02**: Navigation lockdown (will-navigate handler blocks non-app URLs)
- [ ] **SEC-03**: Window open handler blocks popup creation (setWindowOpenHandler)
- [ ] **SEC-04**: Shell commands use execFile with arg arrays instead of exec with string interpolation
- [ ] **SEC-05**: Electron Fuses configured (@electron/fuses — disable ELECTRON_RUN_AS_NODE, NODE_OPTIONS, --inspect)
- [ ] **SEC-06**: CSP tightened (remove unsafe-eval if possible, remove unsafe-inline)
- [ ] **SEC-07**: npm audit vulnerabilities resolved (0 critical, 0 high in runtime deps)
- [ ] **SEC-08**: Process sandbox explicitly enabled in webPreferences

### UI Polish

- [ ] **UI-01**: All hardcoded colors replaced with design token CSS variables
- [ ] **UI-02**: Broken clawd-primary token references fixed to clawd-accent
- [ ] **UI-03**: Light mode toggle knobs visible (not white-on-white)
- [ ] **UI-04**: Consistent spacing/padding across all module views
- [ ] **UI-05**: All modules have proper empty states, loading states, and error states
- [ ] **UI-06**: Typography hierarchy consistent across all views (headings, body, labels)

### Feature Completeness

- [ ] **FEAT-01**: useFirstTimeUser hook wired in App.tsx (tour auto-triggers on first run)
- [ ] **FEAT-02**: Tour data attributes added to target components (Kanban columns, voice orb, etc.)
- [ ] **FEAT-03**: Every module's buttons, tabs, and flows verified end-to-end functional
- [ ] **FEAT-04**: SELECT * queries replaced with explicit column lists in IPC handlers
- [ ] **FEAT-05**: Missing database indexes added for tasks table and frequently-queried tables

### Onboarding

- [ ] **ONBD-01**: First-run detection triggers onboarding wizard automatically
- [ ] **ONBD-02**: Welcome overlay with app introduction and "Get Started" action
- [ ] **ONBD-03**: OpenClaw dependency check (gateway running, CLI available)
- [ ] **ONBD-04**: macOS permissions wizard (automation, notifications, accessibility, microphone)
- [ ] **ONBD-05**: Gateway connection setup (local/remote/skip with credential configuration)
- [ ] **ONBD-06**: Sample data population option (demo tasks, agents, conversations)
- [ ] **ONBD-07**: Interactive guided tour of key features (Kanban, Chat, Agents, Inbox)
- [ ] **ONBD-08**: Keyboard shortcuts quick-reference overlay

### Testing

- [ ] **TEST-01**: Playwright configured for Electron (_electron.launch with dist-electron/main.js)
- [ ] **TEST-02**: E2E tests for app startup and main navigation
- [ ] **TEST-03**: E2E tests for Kanban drag-and-drop task lifecycle
- [ ] **TEST-04**: E2E tests for chat message send/receive flow
- [ ] **TEST-05**: data-testid attributes on all interactive elements in critical paths
- [ ] **TEST-06**: CI-compatible test script (npm run test:e2e)

### Database & Memory

- [ ] **DBMEM-01**: Prepared statement caching for frequently-used queries
- [ ] **DBMEM-02**: Transaction batching for bulk operations (task imports, migrations)
- [ ] **DBMEM-03**: IPC listener cleanup audit (no leaked listeners on component unmount)
- [ ] **DBMEM-04**: Zustand store array bounds (prevent unbounded growth in message/event arrays)
- [ ] **DBMEM-05**: Memory profiling baseline established (heap snapshot before/after navigation)

### Multi-User

- [ ] **MUSER-01**: User profile system with local password authentication
- [ ] **MUSER-02**: Profile switcher in settings (create/switch/delete profiles)
- [ ] **MUSER-03**: Per-profile data isolation (separate DB files per user)
- [ ] **MUSER-04**: Credential namespace scoped to active profile
- [ ] **MUSER-05**: Gateway session token per-user (multi-client support)

### PWA & Mobile

- [ ] **PWA-01**: Responsive layout for 5 core views (Dashboard, Chat, Tasks, Inbox, Agents)
- [ ] **PWA-02**: IPC bridge abstraction (window.clawdbot calls routed through bridge.ts)
- [ ] **PWA-03**: Local HTTP server serves React build for PWA access
- [ ] **PWA-04**: Service worker with offline-first caching strategy
- [ ] **PWA-05**: Mobile-friendly navigation (bottom tabs or hamburger menu)

### Plugin SDK

- [ ] **PSDK-01**: Stable API surface defined (mission-control-sdk types package)
- [ ] **PSDK-02**: Plugin scaffolder CLI (create-mission-control-plugin)
- [ ] **PSDK-03**: Plugin developer documentation (getting started, API reference, examples)
- [ ] **PSDK-04**: Sample plugin (working example demonstrating all SDK features)
- [ ] **PSDK-05**: Plugin validation and loading from external directories

## v2 Requirements

Deferred to future release.

### Advanced Multi-User
- **MUSER-06**: OAuth login (Google, GitHub)
- **MUSER-07**: Cloud-synced user profiles
- **MUSER-08**: Real-time collaborative workspaces

### Advanced Plugin
- **PSDK-06**: Plugin marketplace submission and review process
- **PSDK-07**: Sandboxed plugin execution (untrusted code isolation)
- **PSDK-08**: Plugin hot reload without app restart

### Advanced Mobile
- **PWA-06**: Push notifications for mobile PWA
- **PWA-07**: Native mobile app (React Native or Capacitor)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native iOS/Android app | PWA covers mobile needs for v9.0; native app is v10+ |
| Cloud-hosted backend | Single-user local-first is core value; cloud sync is v10+ |
| Plugin monetization/payments | No public marketplace yet; premature |
| Video calling/screenshare | Not core to agent management |
| Real-time collaboration | Requires cloud infrastructure; v10+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERF-01 | Phase 56 | Complete |
| PERF-02 | Phase 56 | Complete |
| PERF-03 | Phase 56 | Complete |
| PERF-04 | Phase 56 | Complete |
| PERF-05 | Phase 56 | Complete |
| PERF-06 | Phase 56 | Complete |
| PERF-07 | Phase 56 | Complete |
| SEC-01 | Phase 57 | Complete |
| SEC-02 | Phase 57 | Complete |
| SEC-03 | Phase 57 | Complete |
| SEC-04 | Phase 57 | Complete |
| SEC-05 | Phase 57 | Complete |
| SEC-06 | Phase 57 | Complete |
| SEC-07 | Phase 57 | Complete |
| SEC-08 | Phase 57 | Complete |
| UI-01 | Phase 58 | Complete |
| UI-02 | Phase 58 | Complete |
| UI-03 | Phase 58 | Complete |
| UI-04 | Phase 58 | Complete |
| UI-05 | Phase 58 | Complete |
| UI-06 | Phase 58 | Complete |
| FEAT-01 | Phase 59 | Complete |
| FEAT-02 | Phase 59 | Complete |
| FEAT-03 | Phase 59 | Complete |
| FEAT-04 | Phase 59 | Complete |
| FEAT-05 | Phase 59 | Complete |
| ONBD-01 | Phase 60 | Complete |
| ONBD-02 | Phase 60 | Complete |
| ONBD-03 | Phase 60 | Complete |
| ONBD-04 | Phase 60 | Complete |
| ONBD-05 | Phase 60 | Complete |
| ONBD-06 | Phase 60 | Complete |
| ONBD-07 | Phase 60 | Complete |
| ONBD-08 | Phase 60 | Complete |
| TEST-01 | Phase 61 | Pending |
| TEST-02 | Phase 61 | Pending |
| TEST-03 | Phase 61 | Pending |
| TEST-04 | Phase 61 | Pending |
| TEST-05 | Phase 61 | Pending |
| TEST-06 | Phase 61 | Pending |
| DBMEM-01 | Phase 59 | Complete |
| DBMEM-02 | Phase 59 | Complete |
| DBMEM-03 | Phase 59 | Complete |
| DBMEM-04 | Phase 59 | Complete |
| DBMEM-05 | Phase 59 | Complete |
| MUSER-01 | Phase 63 | Pending |
| MUSER-02 | Phase 63 | Pending |
| MUSER-03 | Phase 63 | Pending |
| MUSER-04 | Phase 63 | Pending |
| MUSER-05 | Phase 63 | Pending |
| PWA-01 | Phase 64 | Pending |
| PWA-02 | Phase 64 | Pending |
| PWA-03 | Phase 64 | Pending |
| PWA-04 | Phase 64 | Pending |
| PWA-05 | Phase 64 | Pending |
| PSDK-01 | Phase 65 | Pending |
| PSDK-02 | Phase 65 | Pending |
| PSDK-03 | Phase 65 | Pending |
| PSDK-04 | Phase 65 | Pending |
| PSDK-05 | Phase 65 | Pending |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 55
- Unmapped: 0

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after initial definition*
