// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * ViewRegistry — dynamic view registration for Mission Control dashboard.
 *
 * Replaces the hardcoded `type View = 'dashboard' | 'kanban' | ...` union
 * and the `panelIconMap` in Sidebar.tsx. Any module can register a view;
 * the Sidebar and App.tsx render from the registry automatically.
 */

import { ComponentType } from 'react';

export interface ViewRegistration {
  /** Unique ID — must match the panelConfig store ID */
  id: string;
  /** Display label */
  label: string;
  /** Lucide icon or any icon-like React component */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: ComponentType<any>;
  /** The panel component to render (already wrapped with error boundary + lazy) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  /** Module that owns this view (undefined = core) */
  moduleId?: string;
  /** Category for marketplace/filtering */
  category?: string;
  /** Description for marketplace listing */
  description?: string;
}

class ViewRegistryClass {
  private views = new Map<string, ViewRegistration>();

  register(view: ViewRegistration) {
    if (this.views.has(view.id)) {
      const existing = this.views.get(view.id)!;
      // Same module re-registering (e.g. HMR / React strict mode) — skip silently
      if (existing.moduleId === view.moduleId) return;
      console.warn(
        `[ViewRegistry] Duplicate view ID "${view.id}" — ` +
        `overwriting (was: moduleId="${existing.moduleId ?? 'core'}", now: moduleId="${view.moduleId ?? 'core'}")`
      );
    }
    this.views.set(view.id, view);
  }

  get(id: string): ViewRegistration | undefined {
    return this.views.get(id);
  }

  getAll(): ViewRegistration[] {
    return Array.from(this.views.values());
  }

  has(id: string): boolean {
    return this.views.has(id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getIcon(id: string): ComponentType<any> | undefined {
    return this.views.get(id)?.icon;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getComponent(id: string): ComponentType<any> | undefined {
    return this.views.get(id)?.component;
  }

  /** Get all views belonging to a specific module */
  getByModule(moduleId: string): ViewRegistration[] {
    return this.getAll().filter(v => v.moduleId === moduleId);
  }

  /** Get all core views (no module owner) */
  getCoreViews(): ViewRegistration[] {
    return this.getAll().filter(v => !v.moduleId);
  }

  /** Get all module views */
  getModuleViews(): ViewRegistration[] {
    return this.getAll().filter(v => !!v.moduleId);
  }

  /** Unregister a view (for module unloading) */
  unregister(id: string): boolean {
    return this.views.delete(id);
  }

  /** Unregister all views belonging to a module */
  unregisterModule(moduleId: string): number {
    let count = 0;
    const toDelete: string[] = [];
    this.views.forEach((view, id) => {
      if (view.moduleId === moduleId) toDelete.push(id);
    });
    toDelete.forEach(id => { this.views.delete(id); count++; });
    return count;
  }
}

/** Singleton registry — import and call `.register()` to add a view */
export const ViewRegistry = new ViewRegistryClass();

/** Read all registered views (static snapshot — all views register at module load) */
export function getAllViews(): ViewRegistration[] {
  return ViewRegistry.getAll();
}
