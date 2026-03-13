// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { create } from 'zustand';
import { ViewRegistry } from '../core/ViewRegistry';
import { ModuleLoader } from '../core/ModuleLoader';

export interface PanelConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

const STORAGE_KEY = 'mission-control-panel-config';

// Default panel order and visibility for a fresh install.
// Module-owned panels (projects, schedule, library, settings, etc.) are included here
// so their position is correct when modules install. Panels without a registered icon
// are silently skipped by the sidebar, so non-installed modules cause no visual glitch.
// Optional module panels are also synced dynamically via syncWithViewRegistry().
const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'dashboard',     label: 'Dashboard',        visible: true,  order: 0  },
  { id: 'projects',      label: 'Projects',          visible: true,  order: 1  },
  { id: 'kanban',        label: 'Tasks',             visible: true,  order: 2  },
  { id: 'approvals',     label: 'Approvals',         visible: true,  order: 3  },
  { id: 'chat',          label: 'Chat',              visible: true,  order: 4  },
  { id: 'inbox',         label: 'Inbox',             visible: true,  order: 5  },
  { id: 'schedule',      label: 'Schedule',          visible: true,  order: 6  },
  { id: 'library',       label: 'Library',           visible: true,  order: 7  },
  { id: 'knowledge',     label: 'Knowledge',         visible: true,  order: 8  },
  { id: 'agents',        label: 'Agents',            visible: true,  order: 9  },
  { id: 'modules',       label: 'Modules',           visible: true,  order: 10 },
  { id: 'settings',      label: 'Settings',          visible: true,  order: 11 },
  { id: 'toolbar',       label: 'Floating Toolbar',  visible: true,  order: 12 },
  { id: 'notifications', label: 'Notifications',     visible: false, order: 13 },
];

function loadFromStorage(): PanelConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const stored = new Map(parsed.map((p: PanelConfig) => [p.id, p]));
        const merged: PanelConfig[] = [];
        let maxOrder = parsed.length;

        // Restore stored panels — keep order/visibility preferences
        for (const p of parsed) {
          const def = DEFAULT_PANELS.find(d => d.id === p.id);
          if (def) {
            // Core panel — always include
            merged.push({ ...def, ...p, label: def.label });
          } else {
            // Optional panel — include as-is (ViewRegistry will validate on sync)
            merged.push(p);
          }
        }

        // Add any new core defaults not yet in storage
        for (const def of DEFAULT_PANELS) {
          if (!stored.has(def.id)) {
            merged.push({ ...def, order: maxOrder++ });
          }
        }

        return merged;
      }
    }
  } catch { /* ignore error */ }
  return DEFAULT_PANELS.map(p => ({ ...p }));
}

function saveToStorage(panels: PanelConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
  } catch { /* ignore error */ }
}

interface PanelConfigStore {
  panels: PanelConfig[];
  editModalOpen: boolean;
  openEditModal: () => void;
  closeEditModal: () => void;
  savePanels: (panels: PanelConfig[]) => void;
  resetPanels: () => void;
  /** Sync with ViewRegistry — auto-discover module views not yet in panelConfig */
  syncWithViewRegistry: () => void;
}

export const usePanelConfigStore = create<PanelConfigStore>((set) => ({
  panels: loadFromStorage(),
  editModalOpen: false,
  openEditModal: () => set({ editModalOpen: true }),
  closeEditModal: () => set({ editModalOpen: false }),
  savePanels: (panels: PanelConfig[]) => {
    // Detect visibility changes for module-owned panels and call lifecycle methods
    const prevPanels = usePanelConfigStore.getState().panels;
    for (const panel of panels) {
      const prev = prevPanels.find(p => p.id === panel.id);
      if (prev && prev.visible !== panel.visible) {
        // Try ViewRegistry first; if view was unregistered (disposed module), fall back to ModuleLoader
        let moduleId = ViewRegistry.get(panel.id)?.moduleId;
        if (!moduleId) {
          for (const reg of ModuleLoader.getAll()) {
            if (reg.manifest.views?.some(v => v.id === panel.id)) {
              moduleId = reg.manifest.id;
              break;
            }
          }
        }
        if (moduleId) {
          if (!panel.visible) {
            ModuleLoader.disableModule(moduleId);
          } else {
            ModuleLoader.enableModule(moduleId).then(() => {
              // Force re-render so sidebar picks up re-registered ViewRegistry entries
              set(state => ({ panels: [...state.panels] }));
            }).catch(err => {
              console.error(`[PanelConfig] Failed to re-enable module "${moduleId}":`, err);
            });
          }
        }
      }
    }
    saveToStorage(panels);
    set({ panels, editModalOpen: false });
  },
  resetPanels: () => {
    const defaults = DEFAULT_PANELS.map(p => ({ ...p }));
    saveToStorage(defaults);
    set({ panels: defaults });
  },
  syncWithViewRegistry: () => {
    // Sync panel list with ViewRegistry:
    // - Add panels for newly installed module views
    // - Remove panels for views no longer in ViewRegistry (uninstalled modules)
    // - Never remove core panels (dashboard, toolbar, and DEFAULT_PANELS ids)
    const allViews = ViewRegistry.getAll();
    const registeredViewIds = new Set(allViews.map(v => v.id));
    const coreIds = new Set(DEFAULT_PANELS.map(p => p.id));

    set((state) => {
      // Strip panels for uninstalled module views (not in ViewRegistry, not core)
      const filtered = state.panels.filter(p =>
        coreIds.has(p.id) || registeredViewIds.has(p.id)
      );

      // Add panels for newly registered views not yet in list
      const existing = new Set(filtered.map(p => p.id));
      let maxOrder = Math.max(...filtered.map(p => p.order), 0);
      const newPanels: PanelConfig[] = [];

      for (const view of allViews) {
        if (!existing.has(view.id) && view.id !== 'comms') {
          newPanels.push({
            id: view.id,
            label: view.label,
            visible: true,
            order: ++maxOrder,
          });
        }
      }

      const merged = [...filtered, ...newPanels];
      if (merged.length !== state.panels.length || newPanels.length > 0) {
        saveToStorage(merged);
        return { panels: merged };
      }
      return state;
    });
  },
}));

export { DEFAULT_PANELS };
