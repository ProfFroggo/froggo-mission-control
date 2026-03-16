// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { create } from 'zustand';

export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DashboardWidgetSlot {
  id: string;
  widgetId: string;
  size: WidgetSize;
  position: number;
  visible: boolean;
}

export interface DashboardLayout {
  widgets: DashboardWidgetSlot[];
  version?: number;
}

const STORAGE_KEY = 'mission-control.dashboard-layout';
const LAYOUT_VERSION = 2; // Increment to force layout reset on upgrade

const DEFAULT_WIDGET_IDS = [
  'task-stats',
  'agent-activity',
  'approval-queue',
  'system-health',
];

const DEFAULT_SIZES: Record<string, WidgetSize> = {
  'task-stats': 'xl',
  'agent-activity': 'md',
  'approval-queue': 'md',
  'system-health': 'xl',
};

function buildDefaultLayout(): DashboardWidgetSlot[] {
  return DEFAULT_WIDGET_IDS.map((widgetId, i) => ({
    id: `slot-${widgetId}`,
    widgetId,
    size: DEFAULT_SIZES[widgetId] ?? 'md',
    position: i,
    visible: true,
  }));
}

function loadLayout(): DashboardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Force reset if layout version is outdated
      if (parsed?.version !== LAYOUT_VERSION) {
        const defaults = { widgets: buildDefaultLayout(), version: LAYOUT_VERSION };
        saveLayout(defaults);
        return defaults;
      }
      if (parsed?.widgets && Array.isArray(parsed.widgets) && parsed.widgets.length > 0) {
        return parsed as DashboardLayout;
      }
    }
  } catch { /* ignore */ }
  return { widgets: buildDefaultLayout(), version: LAYOUT_VERSION };
}

function saveLayout(layout: DashboardLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch { /* ignore */ }
}

interface DashboardStore {
  layout: DashboardLayout;
  setLayout: (layout: DashboardLayout) => void;
  addWidget: (widgetId: string, size?: WidgetSize) => void;
  removeWidget: (slotId: string) => void;
  resizeWidget: (slotId: string, size: WidgetSize) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  resetLayout: () => void;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  layout: loadLayout(),

  setLayout: (layout) => {
    saveLayout(layout);
    set({ layout });
  },

  addWidget: (widgetId, size = 'md') => {
    const { layout } = get();
    const maxPos = layout.widgets.reduce((m, w) => Math.max(m, w.position), -1);
    const newSlot: DashboardWidgetSlot = {
      id: `slot-${widgetId}-${Date.now()}`,
      widgetId,
      size,
      position: maxPos + 1,
      visible: true,
    };
    const updated: DashboardLayout = {
      widgets: [...layout.widgets, newSlot],
    };
    saveLayout(updated);
    set({ layout: updated });
  },

  removeWidget: (slotId) => {
    const { layout } = get();
    const filtered = layout.widgets
      .filter(w => w.id !== slotId)
      .map((w, i) => ({ ...w, position: i }));
    const updated: DashboardLayout = { widgets: filtered };
    saveLayout(updated);
    set({ layout: updated });
  },

  resizeWidget: (slotId, size) => {
    const { layout } = get();
    const updated: DashboardLayout = {
      widgets: layout.widgets.map(w => w.id === slotId ? { ...w, size } : w),
    };
    saveLayout(updated);
    set({ layout: updated });
  },

  reorderWidgets: (fromIndex, toIndex) => {
    const { layout } = get();
    const sorted = [...layout.widgets].sort((a, b) => a.position - b.position);
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    const reindexed = sorted.map((w, i) => ({ ...w, position: i }));
    const updated: DashboardLayout = { widgets: reindexed };
    saveLayout(updated);
    set({ layout: updated });
  },

  resetLayout: () => {
    const defaults: DashboardLayout = { widgets: buildDefaultLayout(), version: LAYOUT_VERSION };
    saveLayout(defaults);
    set({ layout: defaults });
  },
}));
