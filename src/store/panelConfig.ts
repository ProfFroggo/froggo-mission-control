import { create } from 'zustand';

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
  { id: 'agentdms', label: 'Agent DMs', visible: true, order: 5 },
  { id: 'twitter', label: 'Social Media', visible: true, order: 6 },
  { id: 'meetings', label: 'Meetings', visible: true, order: 7 },
  { id: 'voicechat', label: 'Voice Chat', visible: true, order: 8 },
  { id: 'chat', label: 'Chat', visible: true, order: 9 },
  { id: 'accounts', label: 'Accounts', visible: true, order: 10 },
  { id: 'approvals', label: 'Approvals', visible: true, order: 11 },
  { id: 'context', label: 'Context', visible: true, order: 12 },
  { id: 'codeagent', label: 'Dev', visible: true, order: 13 },
  { id: 'library', label: 'Library', visible: true, order: 14 },
  { id: 'schedule', label: 'Schedule', visible: true, order: 15 },
  { id: 'notifications', label: 'Notifications', visible: true, order: 16 },
  { id: 'writing', label: 'Writing', visible: true, order: 17 },
  { id: 'finance', label: 'Finance', visible: true, order: 18 },
  { id: 'modulebuilder', label: 'Module Builder', visible: true, order: 19 },
  { id: 'toolbar', label: 'Floating Toolbar', visible: true, order: 20 },
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
    // This picks up newly installed modules automatically
    const { ViewRegistry } = require('../core/ViewRegistry');
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
