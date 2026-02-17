/**
 * ViewRegistry — dynamic view registration for Froggo dashboard.
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
  component: ComponentType<any>;
}

class ViewRegistryClass {
  private views = new Map<string, ViewRegistration>();

  register(view: ViewRegistration) {
    if (this.views.has(view.id)) {
      console.warn(`[ViewRegistry] View "${view.id}" already registered — overwriting`);
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

  getComponent(id: string): ComponentType<any> | undefined {
    return this.views.get(id)?.component;
  }
}

/** Singleton registry — import and call `.register()` to add a view */
export const ViewRegistry = new ViewRegistryClass();

/** Read all registered views (static snapshot — all views register at module load) */
export function getAllViews(): ViewRegistration[] {
  return ViewRegistry.getAll();
}
