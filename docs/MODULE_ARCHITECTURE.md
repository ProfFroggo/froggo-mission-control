# MODULE_ARCHITECTURE.md — Froggo Dashboard Modular System

> Canonical specification for the modular dashboard architecture and marketplace integration.
> **Author:** Chief · **Date:** 2026-02-20 · **Status:** Draft v1

---

## 1. Problem Statement

The Froggo Dashboard has grown organically to 180+ components, a 10K-line `electron/main.ts`, and tightly coupled feature domains. This makes it:

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

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Froggo Dashboard                      │
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

## 4. Module Manifest (`module.json`)

Every module has a manifest file that describes its capabilities:

```json
{
  "id": "froggo-finance",
  "name": "Finance",
  "version": "1.0.0",
  "description": "Financial management, budgets, and Solana wallet integration",
  "author": "Froggo Team",
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
  
  "ipcChannels": {
    "handle": [
      "finance:getTransactions",
      "finance:getBudget",
      "finance:transfer"
    ],
    "on": [
      "finance:statusUpdate"
    ]
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
  
  "dependencies": {
    "core": ">=1.0.0",
    "modules": []
  },
  
  "permissions": {
    "ipc": ["finance:*"],
    "filesystem": ["$DATA_DIR/finance/"],
    "network": false,
    "shell": false
  }
}
```

## 5. Directory Structure

### 5.1 Core Dashboard (unchanged, just reorganized)

```
src/
├── core/
│   ├── ViewRegistry.ts          # EXISTING — extended with module metadata
│   ├── ServiceRegistry.ts       # NEW — dependency injection for services
│   ├── ModuleLoader.ts          # NEW — discovers, validates, loads modules
│   ├── ModuleContext.tsx         # NEW — React context for module APIs
│   └── CoreViews.tsx            # EXISTING — registers built-in views
│
├── modules/                     # NEW — each module is self-contained
│   ├── finance/
│   │   ├── module.json          # Manifest
│   │   ├── index.ts             # Module entry (registers views, services)
│   │   ├── views/
│   │   │   └── FinancePanel.tsx
│   │   ├── services/
│   │   │   └── finance-service.ts
│   │   └── store/
│   │       └── financeStore.ts
│   │
│   ├── writing/
│   │   ├── module.json
│   │   ├── index.ts
│   │   ├── views/
│   │   ├── services/
│   │   └── store/
│   │
│   └── twitter/
│       ├── module.json
│       ├── index.ts
│       ├── views/
│       ├── services/
│       └── store/
│
├── components/                  # Shared components (not module-specific)
└── App.tsx                      # Uses ModuleLoader to init all modules
```

### 5.2 Electron Side

```
electron/
├── main.ts                      # Thin orchestrator (<500 lines target)
├── module-host.ts               # NEW — loads module IPC handlers
├── ipc-registry.ts              # EXISTING — extended with permission checks
├── handlers/                    # Extracted IPC handler modules
│   ├── index.ts
│   ├── agent-handlers.ts       # EXISTING
│   └── ...                     # Phase 2/3 extractions
└── services/                    # Shared electron services
```

## 6. Core Systems

### 6.1 ModuleLoader

The ModuleLoader is the orchestrator. It:

1. **Discovers** modules by scanning `src/modules/*/module.json`
2. **Validates** manifests against schema
3. **Resolves** dependency order
4. **Loads** modules by calling their `index.ts` register function
5. **Provides** lifecycle hooks (init, activate, deactivate, dispose)

```typescript
// src/core/ModuleLoader.ts

export interface ModuleLifecycle {
  /** Called once during app startup */
  init(): Promise<void>;
  /** Called when module view is first activated */
  activate?(): Promise<void>;
  /** Called when module view is deactivated (navigated away) */
  deactivate?(): void;
  /** Called during app shutdown */
  dispose?(): void;
}

export interface ModuleRegistration {
  manifest: ModuleManifest;
  lifecycle: ModuleLifecycle;
}

class ModuleLoaderClass {
  private modules = new Map<string, ModuleRegistration>();
  private initialized = false;

  /** Register a module (called by module's index.ts) */
  register(manifest: ModuleManifest, lifecycle: ModuleLifecycle): void {
    if (this.modules.has(manifest.id)) {
      console.warn(`[ModuleLoader] Module "${manifest.id}" already registered`);
      return;
    }
    this.modules.set(manifest.id, { manifest, lifecycle });
  }

  /** Initialize all registered modules in dependency order */
  async initAll(): Promise<void> {
    if (this.initialized) return;
    
    const sorted = this.topologicalSort();
    for (const mod of sorted) {
      try {
        await mod.lifecycle.init();
        // Register views from manifest
        for (const view of mod.manifest.views) {
          // ViewRegistry.register() called by module's init
        }
      } catch (err) {
        console.error(`[ModuleLoader] Failed to init "${mod.manifest.id}":`, err);
      }
    }
    this.initialized = true;
  }

  /** Get module by ID */
  get(id: string): ModuleRegistration | undefined {
    return this.modules.get(id);
  }

  /** List all modules */
  getAll(): ModuleRegistration[] {
    return Array.from(this.modules.values());
  }

  /** Topological sort by dependencies */
  private topologicalSort(): ModuleRegistration[] {
    // Simple sort — modules with no deps first
    const all = Array.from(this.modules.values());
    const sorted: ModuleRegistration[] = [];
    const visited = new Set<string>();

    const visit = (mod: ModuleRegistration) => {
      if (visited.has(mod.manifest.id)) return;
      visited.add(mod.manifest.id);
      
      for (const dep of mod.manifest.dependencies?.modules || []) {
        const depMod = this.modules.get(dep);
        if (depMod) visit(depMod);
      }
      sorted.push(mod);
    };

    all.forEach(visit);
    return sorted;
  }
}

export const ModuleLoader = new ModuleLoaderClass();
```

### 6.2 ServiceRegistry

Services provide shared functionality across modules. Unlike views (UI), services are headless.

```typescript
// src/core/ServiceRegistry.ts

export interface ServiceDefinition<T = unknown> {
  id: string;
  factory: () => T | Promise<T>;
  singleton?: boolean; // default true
}

class ServiceRegistryClass {
  private services = new Map<string, ServiceDefinition>();
  private instances = new Map<string, unknown>();

  register<T>(def: ServiceDefinition<T>): void {
    this.services.set(def.id, def as ServiceDefinition);
  }

  async get<T>(id: string): Promise<T> {
    // Return cached singleton
    if (this.instances.has(id)) {
      return this.instances.get(id) as T;
    }

    const def = this.services.get(id);
    if (!def) throw new Error(`Service "${id}" not registered`);

    const instance = await def.factory();
    if (def.singleton !== false) {
      this.instances.set(id, instance);
    }
    return instance as T;
  }

  has(id: string): boolean {
    return this.services.has(id);
  }
}

export const ServiceRegistry = new ServiceRegistryClass();
```

### 6.3 ViewRegistry Extensions

The existing ViewRegistry gets minimal additions:

```typescript
// Extended ViewRegistration
export interface ViewRegistration {
  id: string;
  label: string;
  icon: ComponentType<any>;
  component: ComponentType<any>;
  // NEW fields:
  moduleId?: string;        // Which module owns this view
  category?: string;        // For marketplace categorization
  description?: string;     // For marketplace listing
  permissions?: string[];   // Required permissions
}
```

## 7. Module Example: Extracting Finance

The Finance module is a good proof-of-concept because it's relatively self-contained.

### Current state (scattered):
- `src/components/FinancePanel.tsx` — UI
- `src/components/FinanceInsightsPanel.tsx` — UI
- `src/components/FinanceAgentChat.tsx` — UI  
- `electron/finance-service.ts` — IPC handlers
- `electron/finance-agent-bridge.ts` — Agent bridge
- `src/store/store.ts` — Finance state mixed into global store

### Target state (modular):
```
src/modules/finance/
├── module.json
├── index.ts
├── views/
│   ├── FinancePanel.tsx
│   ├── FinanceInsightsPanel.tsx
│   └── FinanceAgentChat.tsx
├── services/
│   └── finance-ipc.ts          # Wraps IPC calls
└── store/
    └── financeStore.ts          # Extracted from global store
```

### Migration steps:
1. Create `src/modules/finance/` directory
2. Move component files (update imports)
3. Extract finance state from global store → `financeStore.ts`
4. Create `module.json` manifest
5. Create `index.ts` that registers views + services
6. Update `CoreViews.tsx` to skip finance (module handles it)
7. Verify no regressions

## 8. IPC Refactoring Strategy

The 10K-line `electron/main.ts` is the biggest risk. Strategy:

### Phase 1: Extract to handler files (already started)
- `handlers/agent-handlers.ts` ✅ Done
- `handlers/toolbar-handlers.ts` ✅ Done  
- Continue extracting per REFACTORING-PLAN.md

### Phase 2: Module-aware IPC
- Each module declares IPC channels in `module.json`
- `module-host.ts` loads electron-side handlers per module
- IPC registry validates channels against manifest permissions

### Phase 3: main.ts becomes thin orchestrator
- Window management + lifecycle only
- All IPC through registered handlers
- Target: <500 lines

### IPC Namespace Convention:
```
<module-id>:<domain>:<action>

Examples:
  finance:transactions:list
  finance:budget:get
  writing:project:create
  twitter:draft:publish
```

## 9. Marketplace Integration

### 9.1 Marketplace Site (Next.js)

Standalone site at `marketplace.froggo.app` (or similar):

```
froggo-marketplace/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Browse modules
│   │   ├── module/[id]/page.tsx  # Module detail
│   │   └── publish/page.tsx      # Submit module
│   ├── components/
│   │   ├── ModuleCard.tsx
│   │   ├── ModuleGrid.tsx
│   │   └── InstallButton.tsx
│   └── lib/
│       ├── manifest-schema.ts    # Shared validation
│       └── api.ts
├── public/
│   └── modules/                  # Static module registry
│       └── registry.json         # All published manifests
├── package.json
└── next.config.js
```

### 9.2 Module Registry Format

```json
{
  "version": 1,
  "modules": [
    {
      "id": "froggo-finance",
      "name": "Finance",
      "version": "1.0.0",
      "author": "Froggo Team",
      "description": "Financial management and wallet integration",
      "category": "productivity",
      "downloads": 0,
      "verified": true,
      "manifestUrl": "https://marketplace.froggo.app/modules/froggo-finance/module.json",
      "packageUrl": "https://marketplace.froggo.app/modules/froggo-finance/froggo-finance-1.0.0.tar.gz"
    }
  ]
}
```

### 9.3 Install Flow

1. User browses marketplace → clicks "Install"
2. Dashboard downloads module package
3. ModuleLoader validates manifest + permissions
4. Module extracted to `~/.froggo/modules/<id>/`
5. Dashboard restarts or hot-reloads module
6. Module appears in sidebar

### 9.4 Security Model

- **Manifest validation** — schema-checked before load
- **IPC sandboxing** — modules can only use declared channels
- **Filesystem sandboxing** — limited to declared paths
- **No arbitrary shell** — shell access requires explicit permission + user approval
- **Code signing** — future: verified modules signed by publisher

## 10. Hourly Sync Protocol

For development coordination:

1. **Module authors** push module packages to marketplace registry
2. **Dashboard** checks registry hourly for updates
3. **Auto-update** for verified modules (user can disable)
4. **Manual update** for community modules (notification only)

Config in dashboard settings:
```json
{
  "marketplace": {
    "registryUrl": "https://marketplace.froggo.app/modules/registry.json",
    "autoUpdate": true,
    "checkIntervalMs": 3600000,
    "allowCommunityModules": false
  }
}
```

## 11. Migration Path

### Week 1: Foundation
- [x] ViewRegistry exists and works
- [x] IPC Registry exists
- [ ] Create ModuleLoader
- [ ] Create ServiceRegistry  
- [ ] Create module.json schema

### Week 2: Proof of Concept
- [ ] Extract Finance module as PoC
- [ ] Verify no regressions
- [ ] Document extraction pattern

### Week 3: Marketplace
- [ ] Scaffold Next.js marketplace site
- [ ] Create registry.json schema
- [ ] Build module card + detail views
- [ ] Wire up manifest validation

### Week 4: Polish
- [ ] Extract 1-2 more modules (Writing, Twitter/X)
- [ ] Dashboard settings for marketplace config
- [ ] Install/uninstall flow in dashboard
- [ ] Documentation

## 12. Open Questions

1. **Hot reload vs restart?** — Hot reload is nicer UX but complex. Start with restart.
2. **Module store isolation?** — Zustand allows independent stores. Prefer separate stores per module.
3. **Shared component library?** — Modules need access to design system. Export as `@froggo/ui`.
4. **Electron handler loading?** — Dynamic require vs static import? Start static, go dynamic later.
5. **Versioning strategy?** — SemVer for modules, core version compatibility in manifest.

## 13. Non-Goals (for now)

- Runtime plugin loading (too complex, start with build-time)
- Cross-module communication (modules talk through ServiceRegistry, not directly)
- Module-level permissions UI (use manifest declarations, add UI later)
- Paid modules / marketplace commerce (future)

---

## Appendix: Existing Infrastructure

| System | Status | File | Notes |
|--------|--------|------|-------|
| ViewRegistry | ✅ Working | `src/core/ViewRegistry.ts` | Core of view system |
| CoreViews | ✅ Working | `src/core/CoreViews.tsx` | 20 views registered |
| IPC Registry | ✅ Working | `electron/ipc-registry.ts` | Dedup + type safety |
| Handler extraction | 🔄 Partial | `electron/handlers/` | 2 of ~12 done |
| REFACTORING-PLAN | 📋 Exists | `electron/REFACTORING-PLAN.md` | Phase 1 complete |
