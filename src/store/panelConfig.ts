import { create } from 'zustand';
import { ViewRegistry } from '../core/ViewRegistry';
import { ModuleLoader } from '../core/ModuleLoader';

export interface PanelConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

const STORAGE_KEY = 'froggo-panel-config';

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'dashboard', label: 'Dashboard', visible: true, order: 0 },
  { id: 'inbox', label: 'Inbox', visible: true, order: 1 },
  { id: 'analytics', label: 'Analytics', visible: true, order: 2 },
  { id: 'kanban', label: 'Tasks', visible: true, order: 3 },
  { id: 'agents', label: 'Agents', visible: true, order: 4 },
  { id: 'twitter', label: 'Social Media', visible: true, order: 5 },
  { id: 'meetings', label: 'Meetings', visible: true, order: 6 },
  { id: 'voicechat', label: 'Voice Chat', visible: true, order: 7 },
  { id: 'chat', label: 'Chat', visible: true, order: 8 },
  { id: 'accounts', label: 'Accounts', visible: true, order: 9 },
  { id: 'approvals', label: 'Approvals', visible: true, order: 10 },
  { id: 'codeagent', label: 'Dev', visible: true, order: 11 },
  { id: 'library', label: 'Library', visible: true, order: 12 },
  { id: 'schedule', label: 'Schedule', visible: true, order: 13 },
  { id: 'notifications', label: 'Notifications', visible: true, order: 14 },
  { id: 'writing', label: 'Writing', visible: true, order: 15 },
  { id: 'finance', label: 'Finance', visible: true, order: 16 },
  { id: 'modulebuilder', label: 'Module Builder', visible: true, order: 17 },
  { id: 'toolbar', label: 'Floating Toolbar', visible: true, order: 18 },
];

function loadFromStorage(): PanelConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with defaults to pick up any new panels added later
        const stored = new Map(parsed.map((p: PanelConfig) => [p.id, p]));
        const merged: PanelConfig[] = [];
        let maxOrder = parsed.length;
        
        // First add all stored panels in their order
        for (const p of parsed) {
          const def = DEFAULT_PANELS.find(d => d.id === p.id);
          if (def) {
            merged.push({ ...def, ...p, label: def.label });
          }
        }
        
        // Then add any new defaults not in storage
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
    // Auto-discover views from ViewRegistry not yet in panel config
    const allViews = ViewRegistry.getAll();
    
    set((state) => {
      const existing = new Set(state.panels.map((p: PanelConfig) => p.id));
      let maxOrder = Math.max(...state.panels.map((p: PanelConfig) => p.order), 0);
      const newPanels: PanelConfig[] = [];

      for (const view of allViews) {
        if (!existing.has(view.id) && view.id !== 'comms') { // skip aliases
          newPanels.push({
            id: view.id,
            label: view.label,
            visible: true,
            order: ++maxOrder,
          });
        }
      }

      if (newPanels.length > 0) {
        const merged = [...state.panels, ...newPanels];
        saveToStorage(merged);
        return { panels: merged };
      }
      return state;
    });
  },
}));

export { DEFAULT_PANELS };
