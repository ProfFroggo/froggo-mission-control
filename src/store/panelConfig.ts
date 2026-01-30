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
  { id: 'twitter', label: 'X/Twitter', visible: true, order: 5 },
  { id: 'voice', label: 'Voice', visible: true, order: 6 },
  { id: 'chat', label: 'Chat', visible: true, order: 7 },
  { id: 'accounts', label: 'Accounts', visible: true, order: 8 },
  { id: 'approvals', label: 'Approvals', visible: true, order: 9 },
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
            merged.push({ ...def, ...p });
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
  } catch {}
  return DEFAULT_PANELS.map(p => ({ ...p }));
}

function saveToStorage(panels: PanelConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
  } catch {}
}

interface PanelConfigStore {
  panels: PanelConfig[];
  editModalOpen: boolean;
  openEditModal: () => void;
  closeEditModal: () => void;
  savePanels: (panels: PanelConfig[]) => void;
  resetPanels: () => void;
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
}));

export { DEFAULT_PANELS };
