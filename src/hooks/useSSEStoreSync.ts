// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Phase 88.4: Central SSE→Store bridge — applies SSE event deltas directly to Zustand store.
// Mounted once in App.tsx. Replaces per-component refetch-on-SSE patterns.

import { useEventBus } from '@/lib/useEventBus';
import { useStore } from '@/store/store';
import { useCallback } from 'react';
import type { TaskStatus, TaskPriority } from '@/store/store';

export function useSSEStoreSync() {
  const patchTaskLocal = useStore(s => s.patchTaskLocal);
  const updateAgentStatus = useStore(s => s.updateAgentStatus);
  const addActivity = useStore(s => s.addActivity);
  const loadTasksFromDB = useStore(s => s.loadTasksFromDB);

  // task.created — reload tasks from DB (new task not in store yet)
  useEventBus('task.created', useCallback(() => {
    loadTasksFromDB();
  }, [loadTasksFromDB]));

  // task.updated — apply partial delta directly to store
  useEventBus('task.updated', useCallback((data: unknown) => {
    const d = data as { id?: string; ids?: string[]; status?: TaskStatus; assignedTo?: string; lastAgentUpdate?: string; priority?: TaskPriority };
    if (d?.id) {
      const updates: Record<string, unknown> = {};
      if (d.status != null) updates.status = d.status;
      if (d.assignedTo !== undefined) updates.assignedTo = d.assignedTo;
      if (d.lastAgentUpdate !== undefined) updates.lastAgentUpdate = d.lastAgentUpdate;
      if (d.priority != null) updates.priority = d.priority;
      if (Object.keys(updates).length > 0) {
        patchTaskLocal(d.id, updates);
      }
    }
    // Bulk updates (from bulk route)
    if (d?.ids && Array.isArray(d.ids)) {
      for (const id of d.ids) {
        const updates: Record<string, unknown> = {};
        if (d.status != null) updates.status = d.status;
        if (d.assignedTo !== undefined) updates.assignedTo = d.assignedTo;
        if (d.priority != null) updates.priority = d.priority;
        if (Object.keys(updates).length > 0) {
          patchTaskLocal(id, updates);
        }
      }
    }
  }, [patchTaskLocal]));

  // agent.status — update agent status in store
  useEventBus('agent.status', useCallback((data: unknown) => {
    const d = data as { agentId?: string; status?: string; sessionKey?: string };
    if (d?.agentId && d?.status) {
      updateAgentStatus(d.agentId, d.status as 'idle' | 'active' | 'busy' | 'offline', d.sessionKey);
    }
  }, [updateAgentStatus]));

  // agent.updated — update agent in store
  useEventBus('agent.updated', useCallback((data: unknown) => {
    const d = data as { agentId?: string; status?: string };
    if (d?.agentId && d?.status) {
      updateAgentStatus(d.agentId, d.status as 'idle' | 'active' | 'busy' | 'offline');
    }
  }, [updateAgentStatus]));

  // budget.dispatch_blocked — add to activity feed
  useEventBus('budget.dispatch_blocked', useCallback((data: unknown) => {
    const d = data as { agentId?: string; budget?: string };
    addActivity({
      type: 'system',
      message: `Budget limit reached for ${d?.agentId || 'agent'} — dispatch blocked`,
      timestamp: Date.now(),
    });
  }, [addActivity]));
}
