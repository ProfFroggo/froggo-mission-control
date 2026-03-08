# MODULE_ARCHITECTURE.md — Mission Control Dashboard Modular System

> **Canonical specification** for the modular dashboard architecture and marketplace integration.
> This document merges and supersedes:
> - `archives/.../modular-dashboard-architecture-report.md` (Senior Coder, 2026-02-16)
> - `agent-chief/module-system-design.md` (Chief, 2026-02-10)
> - `agent-mission-control/data/marketplace-research/INDEX.md` (Researcher, 2026-01-30)
>
> **Author:** Chief · **Date:** 2026-02-20 · **Status:** CANONICAL v2

---

## 1. Problem Statement

The Mission Control Dashboard has grown organically to 180+ components, a 10K-line `electron/main.ts` with 308 IPC handlers, and tightly coupled feature domains. This makes it:

- **Hard to maintain** — changes to one feature risk breaking others
- **Hard to extend** — adding a new "module" means touching 5+ files
- **Impossible to distribute** — features can't be packaged for a marketplace
- **Slow to load** — everything is bundled, even unused features

## 2. Design Goals

1. **Module = self-contained feature unit** — UI, IPC handlers, store slice, all in one boundary
2. **Existing ViewRegistry is the foundation** — don't reinvent, extend it
3. **Zero disruption** — existing 20 core views keep working unchanged
4. **Marketplace-ready** — modules have a manifest, can be installed/removed
5. **IPC safety** — modules declare their IPC channels, sandboxed by default
6. **Incremental adoption** — migrate one feature at a time, no big bang

## 3. Industry Research Summary

| System | Manifest | Discovery | Isolation | Marketplace | Key Lesson |
|--------|----------|-----------|-----------|-------------|------------|
| **VS Code** | package.json | extensions/ dir | Separate process | ✅ | Architecture gold standard |
| **Obsidian** | manifest.json | .obsidian/plugins/ | Same process | ✅ | Simplicity & community |
| **Chrome** | manifest.json | chrome://extensions | Separate process | ✅ | Security evolution |
| **WordPress** | Plugin headers | /wp-content/plugins/ | Same process | ✅ | Mass market reach |
| **Shopify** | App config | App API | Sandboxed iframe | ✅ | Commercial marketplace |
| **Raycast** | manifest.json | ~/.raycast/ | Sandboxed | ✅ | Store UX |

**Best fit for Mission Control:** Obsidian-style (single-process, manifest.json, user-installed) with VS Code–style contribution points for navigation, commands, and settings.

**Market verdict:** ✅ HIGHLY FEASIBLE (9/10 score from feasibility study). No technical blockers. All critical components have proven patterns.

## 4. Core vs Module Separation

### 4.1 Core Infrastructure (Must Remain Stable)

| Component | Responsibility | Why It's Core |
|-----------|---------------|---------------|
| Gateway (WebSocket) | Real-time comms with backend | All modules need it |
| Auth/Token Management | Secure credential storage | Security critical |
| Base UI Components | Button, Toast, Modal, etc. | Design system consistency |
| Theme System | Dark/light mode, accent colors | Global UX |
| Error Boundaries | Crash isolation | App stability |
| Panel Config Store | Panel visibility/order | Navigation framework |
| IPC Database Bridge | Secure DB access | Data integrity |
| ViewRegistry | Dynamic view registration | Core routing |
| ModuleLoader | Module lifecycle management | Module system itself |
| ServiceRegistry | Dependency injection | Cross-module services |

### 4.2 Module Candidates

| Module | Components | Electron Services | IPC Handlers | Priority |
|--------|-----------|-------------------|-------------|----------|
| **Finance** | FinancePanel, FinanceInsightsPanel | finance-service, finance-agent-bridge | 5 | ✅ Extracted |
| **Settings** | SettingsPanel, SecuritySettings | settings-handlers | 4 | ✅ Extracted |
| **Analytics** | AnalyticsDashboard | — | 4 | ✅ Extracted |
| **Library** | LibraryPanel | — (uses fs IPC) | 8 | ✅ Extracted |
| **X/Twitter** | XPanel, XAutomationsTab, 15+ components | x-automations-service, x-api-client | 60 | Next |
| **Writing** | WritingWorkspace, Editor | 6 writing services | ~30 | Next |
| **Comms** | InboxPanel, CommsInbox3Pane | notification-service | 64 | Next |
| **Calendar** | SchedulePanel | calendar-service | 17 | Future |
| **Meetings** | MeetingsPanel, VoiceChatPanel | — | ~5 | Future |

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Mission Control Dashboard                      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Module   │  │  Module   │  │  Module   │  ...        │
│  │ Finance   │  │ Writing   │  │ Twitter/X │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                     │
│  ┌────┴──────────────┴──────────────┴────┐              │
│  │          ModuleLoader                  │              │
│  │   (discovery, lifecycle, sandboxing)   │              │
│  └────┬──────────────┬──────────────┬────┘              │
│       │              │              │                     │
│  ┌────┴────┐   ┌─────┴─────┐  ┌────┴──────┐            │
│  │ View    │   │  Service   │  │   IPC      │            │
│  │Registry │   │  Registry  │  │  Registry  │            │
│  │(exists) │   │   (new)    │  │  (exists)  │            │
│  └─────────┘   └───────────┘  └───────────┘            │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Marketplace Site   │
              │   (Next.js, static)  │
              │   manifest ↔ module  │
              └─────────────────────┘
```

## 6. Module Manifest (`module.json`)

The canonical manifest schema, combining all three design inputs:

```json
{
  "id": "mission-control-finance",
  "name": "Finance",
  "version": "1.0.0",
  "description": "Financial management, budgets, and Solana wallet integration",
  "author": "Mission Control Team",
  "license": "MIT",
  "icon": "DollarSign",
  "category": "productivity",

  "views": [
    {
      "id": "finance",
      "label": "Finance",
      "icon": "DollarSign",
      "entrypoint": "./views/FinancePanel.tsx"
    }
  ],

  "navigation": {
    "position": 18,
    "shortcut": "⌘⇧F"
  },

  "ipcChannels": {
    "handle": ["finance:getTransactions", "finance:getBudget"],
    "on": ["finance:statusUpdate"]
  },

  "services": [
    {
      "id": "finance-service",
      "entrypoint": "./services/finance-service.ts",
      "electron": true
    }
  ],

  "store": {
    "id": "finance",
    "entrypoint": "./store/financeStore.ts"
  },

  "permissions": [
    "database:read",
    "database:write",
    "gateway:send"
  ],

  "requiredApiKeys": [
    {
      "id": "solana_rpc_url",
      "name": "Solana RPC URL",
      "optional": true,
      "docs": "https://docs.solana.com/"
    }
  ],

  "settings": [
    {
      "id": "default_currency",
      "type": "select",
      "label": "Default Currency",
      "default": "USD",
      "options": ["USD", "EUR", "GBP"]
    }
  ],

  "dependencies": {
    "core": ">=1.0.0",
    "modules": []
  },

  "metadata": {
    "homepage": "https://mission-control.app/modules/finance",
    "repository": "https://github.com/ProfMission Control/mission-control-finance",
    "category": "finance",
    "tags": ["finance", "wallet", "solana", "budget"]
  }
}
```

### 6.1 Permission Types

Granular permission system (inspired by Chrome + Obsidian):

| Permission | Risk | Description |
|-----------|------|-------------|
| `database:read` | Low | Read from dashboard database |
| `database:write` | Medium | Write to dashboard database |
| `gateway:send` | Low | Send messages via WebSocket |
| `gateway:receive` | Low | Receive WebSocket events |
| `filesystem:read` | Medium | Read files in allowed paths |
| `filesystem:write` | Medium | Write files in allowed paths |
| `ipc:register` | Medium | Register new IPC handlers |
| `network:external` | High | Make external HTTP requests |
| `shell:execute` | **Critical** | Execute shell commands |
| `notifications` | Low | Show system notifications |
| `storage` | Low | Use module-scoped localStorage |

Users approve permissions at install time. Core enforces at runtime.

## 7. Directory Structure

### 7.1 Dashboard Module Layout

```
src/
├── core/
│   ├── ViewRegistry.ts          # EXISTING — extended with module metadata
│   ├── ServiceRegistry.ts       # NEW — dependency injection for services
│   ├── ModuleLoader.ts          # NEW — discovers, validates, loads modules
│   ├── ModuleContext.tsx         # NEW — React context for module APIs
│   └── CoreViews.tsx            # EXISTING — registers built-in views
│
├── modules/                     # Each module is self-contained
│   ├── index.ts                 # Imports all modules (side-effect registration)
│   ├── finance/
│   │   ├── module.json
│   │   └── index.ts
│   ├── settings/
│   │   ├── module.json
│   │   └── index.ts
│   ├── analytics/
│   │   ├── module.json
│   │   └── index.ts
│   └── library/
│       ├── module.json
│       └── index.ts
│
├── components/                  # Shared components (not module-specific)
└── App.tsx                      # Uses ModuleLoader to init all modules
```

### 7.2 Electron Side

```
electron/
├── main.ts                      # Thin orchestrator (<500 lines target)
├── module-host.ts               # NEW — loads module IPC handlers
├── ipc-registry.ts              # EXISTING — extended with permission checks
├── handlers/                    # Extracted IPC handler modules
│   ├── index.ts
│   ├── agent-handlers.ts       # EXISTING ✅
│   ├── toolbar-handlers.ts     # EXISTING ✅
│   └── ...                     # Phase 2/3 extractions
└── services/                    # Shared electron services
```

## 8. Core Systems (Implemented)

### 8.1 ModuleLoader

**File:** `src/core/ModuleLoader.ts` — ✅ Implemented

Key capabilities:
- Register modules with manifest + lifecycle object
- Validate manifest basics (id, name, version)
- Topological sort by dependencies (with cycle detection)
- Per-module error handling (one broken module doesn't kill the app)
- Lifecycle: `init → activate → deactivate → dispose`

### 8.2 ServiceRegistry

**File:** `src/core/ServiceRegistry.ts` — ✅ Implemented

Key capabilities:
- Lazy instantiation (factory called on first `get()`)
- Singleton by default, opt-in transient
- Module-scoped disposal
- Async factory support

### 8.3 ViewRegistry Extensions

**File:** `src/core/ViewRegistry.ts` — ✅ Extended

Added fields: `moduleId`, `category`, `description`
Added methods: `getByModule()`, `getCoreViews()`, `getModuleViews()`, `unregister()`, `unregisterModule()`

### 8.4 ModuleContext

**File:** `src/core/ModuleContext.tsx` — ✅ Implemented

React hooks: `useModules()`, `useModule(id)`, `useService(id)`

### 8.5 Auto-Sidebar Sync

**File:** `src/store/panelConfig.ts` — ✅ Extended

`syncWithViewRegistry()` auto-discovers module views not yet in panelConfig and adds them to the sidebar.

## 9. IPC Refactoring Strategy

The 10K-line `electron/main.ts` with 308 IPC handlers is the biggest risk.

### 9.1 Handler Distribution

| Namespace | Count | Module Target | Priority |
|-----------|-------|--------------|----------|
| x (Twitter/X) | 57 | twitter module | P1 |
| inbox + folders + email + etc | 64 | comms module | P1 |
| calendar | 17 | calendar module | P2 |
| agents | 12 | core | P1 |
| tasks + subtasks | 16 | core | P1 |
| security | 8 | core | P2 |
| financeAgent | 5 | finance module | ✅ |
| library | 8 | library module | ✅ |
| analytics | 4 | analytics module | ✅ |
| settings | 4 | settings module | ✅ |

### 9.2 Extraction Strategy

**Phase 1:** Extract to `electron/handlers/<namespace>-handlers.ts` files
**Phase 2:** Module-aware IPC — each module declares channels in manifest
**Phase 3:** main.ts becomes thin orchestrator (<500 lines)

### 9.3 IPC Namespace Convention

```
<module-id>:<domain>:<action>

Examples:
  finance:transactions:list
  writing:project:create
  twitter:draft:publish
```

## 10. Marketplace

### 10.1 Architecture

Standalone Next.js static site at `~/mission-control-marketplace/`:

```
mission-control-marketplace/
├── src/app/
│   ├── page.tsx                  # Browse modules
│   └── module/[id]/page.tsx      # Module detail
├── src/components/
│   └── ModuleCard.tsx            # Module listing card
├── src/lib/
│   └── manifest-schema.ts       # Shared validation
└── public/modules/
    ├── registry.json             # All published manifests
    └── mission-control-finance/
        └── module.json           # Individual manifest
```

### 10.2 Registry Format

```json
{
  "version": 1,
  "modules": [
    {
      "id": "mission-control-finance",
      "name": "Finance",
      "version": "1.0.0",
      "author": "Mission Control Team",
      "description": "...",
      "category": "finance",
      "downloads": 0,
      "verified": true,
      "manifestUrl": "/modules/mission-control-finance/module.json",
      "packageUrl": "/modules/mission-control-finance/mission-control-finance-1.0.0.tar.gz"
    }
  ]
}
```

### 10.3 Install Flow

1. User browses marketplace → clicks "Install"
2. Dashboard downloads module package
3. ModuleLoader validates manifest + permissions
4. User approves permissions
5. Module extracted to `~/.mission-control/modules/<id>/`
6. Dashboard restarts or hot-reloads module
7. Module appears in sidebar automatically (via `syncWithViewRegistry`)

### 10.4 Security Model

- **Manifest validation** — schema-checked before load
- **IPC sandboxing** — modules can only use declared channels
- **Filesystem sandboxing** — limited to declared paths
- **Permission approval** — user must approve at install time
- **No arbitrary shell** — `shell:execute` requires explicit permission + user approval
- **Database access** — through parameterized APIs only
- **Code signing** — future: verified modules signed by publisher

### 10.5 Update Flow

```
1. Check for updates (hourly or on-demand)
2. Download in background
3. Patch versions: auto-update (if enabled)
4. Minor/major versions: notify user
5. Breaking changes: require explicit approval
6. Apply on next restart (hot-reload future goal)
```

### 10.6 Revenue Model (from feasibility study)

| Year | Users | Conversion | GMV | Platform Revenue (30%) |
|------|-------|-----------|-----|----------------------|
| 1 | 5,000 | 20% | $240K | $72K |
| 3 | 50,000 | 20% | $3M | $900K |
| 5 | 200,000 | 20% | $14.4M | $4.3M |

Revenue sources: Platform commission (30%), premium features, developer tools.

## 11. Migration Path

### Phase 1: Foundation (✅ Complete)
- [x] ViewRegistry exists and works
- [x] IPC Registry exists
- [x] ModuleLoader implemented
- [x] ServiceRegistry implemented
- [x] ModuleContext (React hooks) implemented
- [x] Auto-sidebar sync implemented
- [x] 4 modules extracted (Finance, Settings, Analytics, Library)
- [x] Test suite (54 tests passing)

### Phase 2: Major Extractions (Next)
- [ ] Extract Twitter/X module (60 IPC handlers)
- [ ] Extract Communications module (64 IPC handlers)
- [ ] Extract Writing module (~30 IPC handlers)
- [ ] Continue IPC handler extraction in electron/

### Phase 3: Marketplace (Future)
- [ ] Marketplace site deployed
- [ ] Module packaging system (tar.gz + code signing)
- [ ] Install/uninstall flow in dashboard settings
- [ ] Update checking + auto-update
- [ ] Developer documentation for module authors

### Phase 4: Ecosystem (Future)
- [ ] Community module submissions
- [ ] Review process (automated + manual)
- [ ] Payment integration (Stripe Connect)
- [ ] Developer portal

## 12. Open Questions

1. **Hot reload vs restart?** — Start with restart. Hot reload is complex.
2. **Module store isolation?** — Zustand allows independent stores. Prefer separate per module.
3. **Shared component library?** — Export as `@mission-control/ui`. Modules import shared components.
4. **Electron handler loading?** — Static import now, dynamic import later.
5. **Versioning strategy?** — SemVer for modules, core version compatibility in manifest.
6. **npm dependencies in modules?** — Bundle at build time. No runtime npm in modules.

## 13. Test Coverage

**54 tests across 5 files:**
- `ModuleLoader.test.ts` — 8 tests (register, init, deps, errors, cycles, dispose)
- `ServiceRegistry.test.ts` — 7 tests (register, resolve, singleton, transient, dispose)
- `ViewRegistry.test.ts` — 7 tests (register, filter, module ops, unregister)
- `manifest-validation.test.ts` — 32 tests (validates all 4 extracted module manifests)

---

## Appendix A: Existing Infrastructure

| System | Status | File | Notes |
|--------|--------|------|-------|
| ViewRegistry | ✅ Extended | `src/core/ViewRegistry.ts` | Core of view system |
| CoreViews | ✅ Working | `src/core/CoreViews.tsx` | 20 views registered |
| IPC Registry | ✅ Working | `electron/ipc-registry.ts` | Dedup + type safety |
| ModuleLoader | ✅ Implemented | `src/core/ModuleLoader.ts` | Lifecycle management |
| ServiceRegistry | ✅ Implemented | `src/core/ServiceRegistry.ts` | Lazy DI |
| ModuleContext | ✅ Implemented | `src/core/ModuleContext.tsx` | React hooks |
| Handler extraction | 🔄 Partial | `electron/handlers/` | 2 of ~12 done |
| REFACTORING-PLAN | 📋 Exists | `electron/REFACTORING-PLAN.md` | Phase 1 complete |
| Marketplace scaffold | ✅ Created | `~/mission-control-marketplace/` | Next.js static site |

## Appendix B: Source Document Mapping

| Section in this doc | Primary source |
|---|---|
| §3 Industry Research | Chief's module-system-design.md (Jan 10) |
| §4 Core vs Module | Senior Coder's architecture report (Feb 16) |
| §6 Manifest schema | Chief's design + Senior Coder's report (merged) |
| §6.1 Permissions | Senior Coder's architecture report |
| §9 IPC Refactoring | Chief's IPC_REFACTOR_SPIKE.md (Feb 20) |
| §10 Marketplace | Researcher's feasibility study (Jan 30) |
| §10.6 Revenue | Researcher's executive summary |
| All implementation | Chief (Feb 20) |
