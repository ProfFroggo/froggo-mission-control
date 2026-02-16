# Research Report: Modular Dashboard Architecture & Marketplace Design

**Date:** 2026-02-16  
**Author:** Senior Coder  
**Task:** task-1771236951733

---

## Executive Summary

This report analyzes the current froggo-dashboard architecture and proposes a modular system design that enables:
1. Easy addition/removal of feature modules (pages)
2. Third-party module marketplace support
3. Clear separation between core infrastructure and modules
4. Backward compatibility with existing code

---

## 1. Current Architecture Analysis

### 1.1 High-Level Structure

```
froggo-dashboard/
├── src/
│   ├── App.tsx                 # Main app shell, view routing
│   ├── components/
│   │   ├── ProtectedPanels.tsx # Lazy loading + error boundaries
│   │   ├── Sidebar.tsx         # Navigation
│   │   └── [20+ page panels]  # Dashboard, Kanban, XPanel, etc.
│   ├── store/
│   │   ├── store.ts            # Main Zustand store
│   │   └── panelConfig.ts      # Panel visibility/order config
│   ├── lib/
│   │   ├── gateway.ts          # WebSocket client
│   │   └── notifications.ts    # Toast system
│   └── utils/
├── electron/
│   ├── main.ts                 # IPC handlers, 50+ registered
│   ├── database.ts             # SQLite connections
│   └── [service modules]       # calendar, accounts, writing, etc.
```

### 1.2 View System (App.tsx)

**Current Pattern:**
```typescript
type View = 'dashboard' | 'kanban' | 'agents' | ... ; // 25 hardcoded views

// Conditional rendering in App.tsx:
{currentView === 'dashboard' && <Dashboard ... />}
{currentView === 'kanban' && <Kanban />}
// ... 25 more lines
```

**Problems:**
- Adding a view requires editing App.tsx
- View type is centralized and hardcoded
- No dynamic view registration

### 1.3 Panel Loading (ProtectedPanels.tsx)

**Current Pattern:**
```typescript
const DashboardRaw = lazy(() => import('./Dashboard'));
export const Dashboard = withErrorBoundary(DashboardRaw, 'Dashboard');
// Repeated for each panel
```

**Benefits:**
- Lazy loading works
- Error boundaries are automatic

**Problems:**
- All panels must be imported here
- No runtime panel registration
- Third-party panels impossible

### 1.4 Navigation (Sidebar.tsx)

**Current Pattern:**
```typescript
const panelIconMap: Record<string, any> = {
  inbox: Mail,
  dashboard: LayoutDashboard,
  // ... 25 more
};

// Uses panelConfig store for visibility/order
const { panels: panelConfig } = usePanelConfigStore();
```

**Benefits:**
- Panel config store allows visibility/order customization
- Icon mapping is centralized

**Problems:**
- Icons must be known at compile time
- No dynamic icon registration
- URL routing not integrated

### 1.5 State Management (Zustand)

**Core Store (store.ts):**
- Tasks, agents, sessions, approvals
- Connected to gateway WebSocket
- Used by ALL panels

**Panel Config Store (panelConfig.ts):**
- Panel visibility, order
- Persisted to localStorage

### 1.6 IPC/Electron Main Process (main.ts)

**Current Pattern:**
```typescript
// 50+ handlers registered inline
ipcMain.handle('tasks:list', async (...) => {...});
ipcMain.handle('writing:projects', async (...) => {...});
// etc.
```

**Service Modules:**
- `calendar-service.ts` - Google Calendar integration
- `accounts-service.ts` - OAuth account management
- `writing-*-service.ts` - 6 writing-related services
- `x-automations-service.ts` - X/Twitter automation

**Problems:**
- Main.ts is 9000+ lines
- New services require editing main.ts
- No service discovery mechanism

---

## 2. Core vs Modules Separation

### 2.1 Core Infrastructure (Must Remain Stable)

| Component | Responsibility | Why It's Core |
|-----------|---------------|---------------|
| Gateway (WebSocket) | Real-time comms with backend | All modules need it |
| Auth/Token Management | Secure credential storage | Security critical |
| Base UI Components | Button, Toast, Modal, etc. | Design system consistency |
| Theme System | Dark/light mode, accent colors | Global UX |
| Error Boundaries | Crash isolation | App stability |
| Panel Config Store | Panel visibility/order | Navigation framework |
| IPC Database Bridge | Secure DB access | Data integrity |

### 2.2 Module Candidates (Can Be Extracted)

| Module | Components | Electron Services | Dependencies |
|--------|-----------|-------------------|--------------|
| **Writing** | WritingWorkspace, Editor | 6 writing services | gateway, db |
| **Finance** | FinancePanel | finance-agent-bridge | gateway, db |
| **X/Twitter** | XPanel, XAutomationsTab | x-automations-service, x-api-client | gateway, db |
| **Calendar** | SchedulePanel | calendar-service | gateway, accounts |
| **Meetings** | MeetingsPanel, VoiceChatPanel | None (pure frontend) | gateway |
| **Analytics** | AnalyticsDashboard | None (pure frontend) | gateway, store |
| **Library** | LibraryPanel | None (uses fs IPC) | gateway |
| **Inbox** | InboxPanel, CommsInbox3Pane | notification-service | gateway, db |

---

## 3. Proposed Modular Architecture

### 3.1 Module Definition

A **Module** consists of:

```typescript
interface DashboardModule {
  // Metadata
  id: string;                    // Unique identifier
  name: string;                  // Display name
  version: string;               // Semver
  description: string;
  author: string;
  icon: string | ComponentType;  // Icon name or component
  
  // UI Components
  panel: ComponentType;          // Main panel component
  settings?: ComponentType;      // Optional settings panel
  
  // Routing
  routes?: Array<{
    path: string;
    component: ComponentType;
  }>;
  
  // State
  stores?: Array<StoreApi<any>>; // Zustand stores to register
  
  // Electron (main process)
  ipcHandlers?: Array<{
    channel: string;
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>;
  }>;
  
  // Database migrations
  migrations?: Array<{
    version: number;
    up: string;    // SQL
    down?: string; // SQL
  }>;
  
  // Lifecycle
  onInstall?: () => Promise<void>;
  onUninstall?: () => Promise<void>;
  onEnable?: () => void;
  onDisable?: () => void;
}
```

### 3.2 Module Registration System

**Option A: Manifest File (Recommended)**

```json
// modules/writing/manifest.json
{
  "id": "writing",
  "name": "Writing Workspace",
  "version": "1.0.0",
  "entry": "dist/index.js",
  "icon": "PenLine",
  "permissions": ["database", "filesystem", "gateway"],
  "dependencies": [],
  "optionalDependencies": ["ai-assistance"]
}
```

**Option B: API Registration (Runtime)**

```typescript
// In module entry point
import { registerModule } from '@froggo/core';

registerModule({
  id: 'writing',
  panel: WritingWorkspace,
  icon: PenLine,
  // ...
});
```

**Recommendation:** Use Option A (manifest) for marketplace support, Option B for built-in modules.

### 3.3 Core Module Loader

```typescript
// src/core/ModuleLoader.ts
class ModuleLoader {
  private modules = new Map<string, LoadedModule>();
  private coreAPI: CoreAPI;
  
  async loadFromDirectory(dir: string): Promise<void> {
    const manifests = await this.discoverManifests(dir);
    for (const manifest of manifests) {
      await this.loadModule(manifest);
    }
  }
  
  async loadModule(manifest: ModuleManifest): Promise<void> {
    // Check dependencies
    await this.resolveDependencies(manifest.dependencies);
    
    // Load module code
    const module = await import(manifest.entry);
    
    // Register with core
    this.modules.set(manifest.id, {
      manifest,
      exports: module,
      enabled: true,
    });
    
    // Notify UI
    this.coreAPI.emit('module:loaded', manifest);
  }
  
  getEnabledModules(): LoadedModule[] {
    return Array.from(this.modules.values()).filter(m => m.enabled);
  }
}
```

### 3.4 Dynamic View Registration

**Replace hardcoded View type:**

```typescript
// Instead of:
type View = 'dashboard' | 'kanban' | ... ;

// Use:
interface ViewRegistration {
  id: string;
  component: ComponentType;
  icon: ComponentType;
  label: string;
  category?: string;
}

// Core maintains registry
class ViewRegistry {
  private views = new Map<string, ViewRegistration>();
  
  register(view: ViewRegistration) {
    this.views.set(view.id, view);
    // Auto-update Sidebar, App.tsx, etc.
    this.emit('view:registered', view);
  }
  
  getView(id: string): ViewRegistration | undefined {
    return this.views.get(id);
  }
  
  getAllViews(): ViewRegistration[] {
    return Array.from(this.views.values());
  }
}
```

### 3.5 Sidebar Integration

```typescript
// Sidebar.tsx becomes dynamic
function Sidebar() {
  const views = useViewRegistry(); // Gets all registered views
  const panelConfig = usePanelConfigStore();
  
  return (
    <nav>
      {views
        .filter(v => panelConfig.isVisible(v.id))
        .sort((a, b) => panelConfig.getOrder(a.id) - panelConfig.getOrder(b.id))
        .map(view => (
          <NavItem 
            key={view.id}
            icon={view.icon}
            label={view.label}
            active={currentView === view.id}
            onClick={() => navigate(view.id)}
          />
        ))}
    </nav>
  );
}
```

### 3.6 Electron Main Process Modularization

**Current:** All IPC handlers in main.ts

**Proposed:** Service registry pattern

```typescript
// electron/core/ServiceRegistry.ts
interface ServiceModule {
  name: string;
  register: (registry: ServiceRegistry) => void;
  unregister?: (registry: ServiceRegistry) => void;
}

class ServiceRegistry {
  private handlers = new Map<string, Function>();
  private db: Database;
  
  registerHandler(channel: string, handler: Function) {
    if (this.handlers.has(channel)) {
      console.warn(`Handler ${channel} already registered, overwriting`);
    }
    this.handlers.set(channel, handler);
    ipcMain.handle(channel, handler);
  }
  
  unregisterHandler(channel: string) {
    this.handlers.delete(channel);
    // Note: Electron doesn't support unregistering, 
    // so we replace with no-op
    ipcMain.handle(channel, () => {
      throw new Error(`Service ${channel} is not available`);
    });
  }
  
  // Core services can be accessed by modules
  getDatabase(): Database { return this.db; }
  getGateway(): GatewayClient { return this.gateway; }
}

// Module registration
import { writingService } from './services/writing';
import { financeService } from './services/finance';

const registry = new ServiceRegistry();

// Register core services
registry.registerHandler('tasks:list', taskListHandler);
// ...

// Register module services
writingService.register(registry);
financeService.register(registry);
```

---

## 4. Marketplace Design

### 4.1 Module Distribution Format

```
module-name-v1.0.0.fgm  (FrogGo Module)
├── manifest.json       # Module metadata
├── dist/
│   ├── renderer.js     # Frontend code
│   ├── main.js         # Electron main code (optional)
│   └── styles.css      # Module styles
├── assets/
│   └── icon.svg
└── migrations/
    └── 001-initial.sql
```

### 4.2 Marketplace API

```typescript
interface MarketplaceClient {
  // Discovery
  search(query: string): Promise<ModuleListing[]>;
  getFeatured(): Promise<ModuleListing[]>;
  getCategories(): Promise<string[]>;
  
  // Installation
  install(moduleId: string): Promise<void>;
  uninstall(moduleId: string): Promise<void>;
  update(moduleId: string): Promise<void>;
  
  // Management
  getInstalled(): Promise<InstalledModule[]>;
  checkForUpdates(): Promise<ModuleUpdate[]>;
  
  // Ratings/Reviews
  getReviews(moduleId: string): Promise<Review[]>;
  submitReview(moduleId: string, review: Review): Promise<void>;
}

interface ModuleListing {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloads: number;
  rating: number;
  reviewCount: number;
  icon: string;
  price?: number;  // Optional paid modules
  tags: string[];
}
```

### 4.3 Security Model

**Permission System:**
```typescript
type Permission = 
  | 'database:read'
  | 'database:write'
  | 'filesystem:read'
  | 'filesystem:write'
  | 'gateway:send'
  | 'gateway:receive'
  | 'ipc:register'
  | 'network:external'
  | 'shell:execute';  // High risk

// Manifest declares required permissions
{
  "permissions": ["database:read", "gateway:send"]
}

// User approves at install time
// Core enforces at runtime
```

**Sandboxing:**
- Renderer code runs in standard Electron renderer sandbox
- Main process code runs in a restricted VM context
- Database access through parameterized APIs only
- No direct shell access (must use validated APIs)

### 4.4 Versioning & Updates

```typescript
interface ModuleUpdate {
  moduleId: string;
  currentVersion: string;
  newVersion: string;
  changelog: string;
  breakingChanges: boolean;
  autoUpdate?: boolean;  // For patch versions
}

// Update flow
// 1. Check for updates
// 2. Download in background
// 3. Notify user (or auto-update if safe)
// 4. Apply on next restart (or hot-reload if possible)
```

---

## 5. Migration Strategy

### Phase 1: Core Extraction (2-3 weeks)

1. **Create ModuleLoader** infrastructure
2. **Create ViewRegistry** for dynamic views
3. **Migrate Sidebar** to use dynamic views
4. **Migrate App.tsx** to use dynamic view rendering

### Phase 2: Module Extraction (4-6 weeks)

1. **Extract Writing Module** (largest, most complex)
2. **Extract Finance Module**
3. **Extract X/Twitter Module**
4. **Extract Calendar Module**

### Phase 3: Marketplace (4-6 weeks)

1. **Build Module Store UI**
2. **Build Module Packaging Tools**
3. **Build Distribution Infrastructure**
4. **Security Audit & Hardening**

### Backward Compatibility

```typescript
// Keep existing imports working
export { WritingWorkspace } from '@modules/writing';

// But also support:
const module = await moduleLoader.load('writing');
```

---

## 6. Recommended Next Steps

1. **Proof of Concept** (1 week)
   - Create ModuleLoader
   - Extract ONE simple module (e.g., Meetings)
   - Demonstrate dynamic registration

2. **Architecture Review** (1 week)
   - Review with Chief Architect
   - Security review
   - Performance testing

3. **Gradual Migration** (8-10 weeks)
   - Phase 1: Core infrastructure
   - Phase 2: Module extraction
   - Phase 3: Marketplace

---

## 7. Open Questions

1. **Hot Reload:** Should modules support hot-reload during development?
2. **Code Splitting:** How do we ensure modules are properly code-split?
3. **State Isolation:** Should each module have its own Zustand store, or shared?
4. **Theming:** How do modules define custom themes/extensions?
5. **AI Integration:** How do modules register AI capabilities/agents?

---

## Appendix A: Module Interface Draft

```typescript
// @froggo/core module

export interface DashboardModule {
  metadata: ModuleMetadata;
  ui: UIPackage;
  electron?: ElectronPackage;
}

export interface ModuleMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  permissions: Permission[];
  dependencies: string[];
  optionalDependencies: string[];
}

export interface UIPackage {
  panel: ComponentType;
  routes?: RouteConfig[];
  stores?: Array<StoreApi<any>>;
  commandPalette?: CommandConfig[];
}

export interface ElectronPackage {
  handlers: IPCHandlerConfig[];
  migrations?: MigrationConfig[];
  scheduledJobs?: JobConfig[];
}
```

---

## Appendix B: Comparison with Existing Solutions

| Feature | VS Code | Obsidian | Proposed Froggo |
|---------|---------|----------|-----------------|
| Extension API | Rich | Limited | Medium (focused) |
| Marketplace | Yes | Yes | Yes |
| Sandboxing | Limited | None | Yes (planned) |
| Hot Reload | Yes | Partial | Yes |
| Paid Extensions | Yes | No | Optional |
| Core/Module Split | Clear | Clear | Clear |

---

**End of Report**
