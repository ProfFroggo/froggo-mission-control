/**
 * ModuleLoader — discovers, validates, and initializes dashboard modules.
 *
 * Each module provides a manifest (module.json) and a lifecycle object.
 * The loader handles dependency ordering, initialization, and graceful
 * error handling so one broken module doesn't take down the dashboard.
 */

import { ServiceRegistry } from './ServiceRegistry';
import { validateManifestSafe } from './manifestSchema';

// ─── Manifest types ─────────────────────────────────────────────

export interface ModuleViewDeclaration {
  id: string;
  label: string;
  icon: string; // Lucide icon name or custom
  entrypoint: string;
}

export interface ModuleServiceDeclaration {
  id: string;
  entrypoint: string;
  electron?: boolean;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  category?: string;
  core?: boolean;

  views?: ModuleViewDeclaration[];

  ipcChannels?: {
    handle?: string[];
    on?: string[];
  };

  services?: ModuleServiceDeclaration[];

  store?: {
    id: string;
    entrypoint: string;
  };

  dependencies?: {
    core?: string;
    modules?: string[];
  };

  permissions?: {
    ipc?: string[];
    filesystem?: string[];
    network?: boolean;
    shell?: boolean;
  };

  credentials?: Array<{
    id: string;
    label: string;
    description?: string;
    required?: boolean;
    type: 'api_key' | 'oauth_token' | 'password' | 'url' | 'custom';
  }>;

  healthCheck?: {
    type: 'url' | 'api_call';
    credentialId?: string;
    url?: string;
    method?: 'GET' | 'POST';
    successStatus?: number;
  };
}

// ─── Lifecycle ──────────────────────────────────────────────────

export interface ModuleLifecycle {
  /** Called once during app startup — register views, services, etc. */
  init(): Promise<void>;
  /** Called when module's primary view is first activated */
  activate?(): Promise<void>;
  /** Called when navigating away from module's view */
  deactivate?(): void;
  /** Called during app shutdown or module unload */
  dispose?(): void;
}

export interface ModuleRegistration {
  manifest: ModuleManifest;
  lifecycle: ModuleLifecycle;
  status: 'registered' | 'initializing' | 'active' | 'error' | 'disposed';
  error?: string;
}

// ─── Loader ─────────────────────────────────────────────────────

class ModuleLoaderClass {
  private modules = new Map<string, ModuleRegistration>();
  private initialized = false;

  /**
   * Register a module. Called by each module's index.ts at import time.
   */
  register(manifest: ModuleManifest, lifecycle: ModuleLifecycle): void {
    if (this.modules.has(manifest.id)) {
      console.warn(`[ModuleLoader] Module "${manifest.id}" already registered — skipping`);
      return;
    }

    // Validate manifest with Zod schema
    const validation = validateManifestSafe(manifest);
    if (!validation.success) {
      console.error(`[ModuleLoader] Invalid manifest for "${manifest.id || 'unknown'}": ${validation.error}`);
      return;
    }

    this.modules.set(manifest.id, {
      manifest,
      lifecycle,
      status: 'registered',
    });
  }

  /**
   * Initialize all registered modules in dependency order.
   * Safe — catches per-module errors without killing the app.
   */
  async initAll(): Promise<void> {
    if (this.initialized) return;

    // Load disabled module state from disk before initializing
    let disabledModules: string[] = [];
    try {
      const stateResult = await window.clawdbot?.modules?.invoke?.('module:state:load') as { disabled: string[] } | undefined;
      if (stateResult?.disabled) {
        disabledModules = stateResult.disabled;
      }
    } catch {
      // State load failure is non-fatal — all modules init as enabled
    }

    const sorted = this.topologicalSort();

    for (const reg of sorted) {
      // Skip disabled modules — but never skip core modules regardless of state file
      if (disabledModules.includes(reg.manifest.id) && !reg.manifest.core) {
        reg.status = 'disposed';
        console.log(`[ModuleLoader] Skipped disabled module "${reg.manifest.name}"`);
        continue;
      }
      reg.status = 'initializing';
      try {
        await reg.lifecycle.init();
        reg.status = 'active';
        console.log(`[ModuleLoader] ✅ Initialized "${reg.manifest.name}" v${reg.manifest.version}`);
      } catch (err) {
        reg.status = 'error';
        reg.error = err instanceof Error ? err.message : String(err);
        console.error(`[ModuleLoader] ❌ Failed to init "${reg.manifest.id}":`, err);
      }
    }

    this.initialized = true;
  }

  /** Activate a module (called when its view is navigated to) */
  async activate(moduleId: string): Promise<void> {
    const reg = this.modules.get(moduleId);
    if (reg?.lifecycle.activate && reg.status === 'active') {
      try {
        await reg.lifecycle.activate();
      } catch (err) {
        console.error(`[ModuleLoader] Activate failed for "${moduleId}":`, err);
      }
    }
  }

  /** Deactivate a module (called when navigating away) */
  deactivate(moduleId: string): void {
    const reg = this.modules.get(moduleId);
    if (reg?.lifecycle.deactivate && reg.status === 'active') {
      try {
        reg.lifecycle.deactivate();
      } catch (err) {
        console.error(`[ModuleLoader] Deactivate failed for "${moduleId}":`, err);
      }
    }
  }

  /** Dispose a specific module */
  dispose(moduleId: string): void {
    const reg = this.modules.get(moduleId);
    if (reg?.lifecycle.dispose) {
      try {
        reg.lifecycle.dispose();
      } catch (err) {
        console.error(`[ModuleLoader] Dispose failed for "${moduleId}":`, err);
      }
    }
    if (reg) {
      reg.status = 'disposed';
      ServiceRegistry.disposeModule(moduleId);
    }
  }

  /**
   * Disable a module — disposes lifecycle (views + services unregistered) and removes IPC handlers.
   * The module registration is retained so it can be re-enabled later.
   */
  disableModule(moduleId: string): void {
    const reg = this.modules.get(moduleId);
    if (!reg) {
      console.warn(`[ModuleLoader] disableModule: module "${moduleId}" not found`);
      return;
    }
    if (reg.manifest.core) {
      console.error(`[ModuleLoader] Cannot disable core module "${moduleId}"`);
      return;
    }
    this.dispose(moduleId);

    // Remove IPC handlers registered by this module in the main process
    // Always call — registerModuleHandler() tracking handles no-op if nothing tracked
    window.clawdbot?.modules?.invoke?.('module:ipc:removeHandlers', moduleId)
      .then((res: unknown) => {
        const result = res as { success: boolean; removed: number };
        if (result?.removed > 0) {
          // eslint-disable-next-line no-console
          console.log(`[ModuleLoader] Removed ${result.removed} IPC handler(s) for "${moduleId}"`);
        }
      })
      .catch((_err: unknown) => {
        // IPC removal is best-effort — module is already disposed
      });

    // Persist disabled state to disk
    window.clawdbot?.modules?.invoke?.('module:state:save', moduleId, false)
      .catch((_err: unknown) => { /* state persistence is best-effort */ });

    // eslint-disable-next-line no-console
    console.log(`[ModuleLoader] Module "${moduleId}" disabled`);
  }

  /**
   * Re-enable a disabled module — re-runs lifecycle.init() to restore views and services.
   *
   * IPC handlers: disableModule() calls unregisterModuleHandlers() which clears the dedup guard.
   * When the module's electron-side registration runs again (e.g., via module:ipc:registerHandlers
   * or at next app restart), handlers will re-register cleanly.
   */
  async enableModule(moduleId: string): Promise<void> {
    const reg = this.modules.get(moduleId);
    if (!reg) {
      console.warn(`[ModuleLoader] enableModule: module "${moduleId}" not found`);
      return;
    }
    if (reg.status === 'active') {
      // Already enabled — nothing to do
      return;
    }
    reg.status = 'initializing';
    try {
      await reg.lifecycle.init();
      reg.status = 'active';
      delete reg.error;
      console.log(`[ModuleLoader] Module "${moduleId}" re-enabled successfully`);

      // Re-register IPC handlers from stored factories (fire-and-forget)
      window.clawdbot?.modules?.invoke?.('module:ipc:registerHandlers', moduleId)
        .then((res: unknown) => {
          const result = res as { success: boolean; registered: number };
          if (result?.registered > 0) {
            // eslint-disable-next-line no-console
            console.log(`[ModuleLoader] Re-registered ${result.registered} IPC handler(s) for "${moduleId}"`);
          }
        })
        .catch((_err: unknown) => { /* IPC re-registration is best-effort */ });

      // Persist enabled state to disk (fire-and-forget)
      window.clawdbot?.modules?.invoke?.('module:state:save', moduleId, true)
        .catch((_err: unknown) => { /* state persistence is best-effort */ });
    } catch (err) {
      reg.status = 'error';
      reg.error = err instanceof Error ? err.message : String(err);
      console.error(`[ModuleLoader] Failed to re-enable module "${moduleId}":`, err);
    }
  }

  /**
   * Returns true if a module is currently active or initializing.
   */
  isModuleEnabled(moduleId: string): boolean {
    const reg = this.modules.get(moduleId);
    return reg?.status === 'active' || reg?.status === 'initializing';
  }

  /** Dispose all modules (app shutdown) */
  async disposeAll(): Promise<void> {
    Array.from(this.modules.keys()).forEach(id => this.dispose(id));
  }

  /** Reset loader state (testing only) */
  _reset(): void {
    this.modules.clear();
    this.initialized = false;
  }

  /** Get a module registration by ID */
  get(id: string): ModuleRegistration | undefined {
    return this.modules.get(id);
  }

  /** Get all registered modules */
  getAll(): ModuleRegistration[] {
    return Array.from(this.modules.values());
  }

  /** Get all active (successfully initialized) modules */
  getActive(): ModuleRegistration[] {
    return this.getAll().filter(m => m.status === 'active');
  }

  /** Get modules with errors */
  getErrored(): ModuleRegistration[] {
    return this.getAll().filter(m => m.status === 'error');
  }

  /** Check if the loader has run initAll */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ─── Internal ───────────────────────────────────────────────

  /**
   * Topological sort by module dependencies.
   * Modules with no deps come first.
   */
  private topologicalSort(): ModuleRegistration[] {
    const all = Array.from(this.modules.values());
    const sorted: ModuleRegistration[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>(); // cycle detection

    const visit = (reg: ModuleRegistration) => {
      const id = reg.manifest.id;
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        console.error(`[ModuleLoader] Circular dependency detected involving "${id}"`);
        return;
      }

      visiting.add(id);

      for (const depId of reg.manifest.dependencies?.modules || []) {
        const dep = this.modules.get(depId);
        if (dep) {
          visit(dep);
        } else {
          console.warn(`[ModuleLoader] Module "${id}" depends on missing module "${depId}"`);
        }
      }

      visiting.delete(id);
      visited.add(id);
      sorted.push(reg);
    };

    all.forEach(visit);
    return sorted;
  }
}

/** Singleton module loader */
export const ModuleLoader = new ModuleLoaderClass();
