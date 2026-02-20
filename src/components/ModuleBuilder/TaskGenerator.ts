/**
 * TaskGenerator — Takes a completed ModuleSpec and generates froggo-db
 * task-add + subtask-add calls via Electron IPC.
 */

import type { ModuleSpec } from './types';

interface GeneratedSubtask {
  title: string;
  description: string;
}

interface GeneratedTaskPlan {
  title: string;
  description: string;
  assign: string;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  deliverable: string;
  subtasks: GeneratedSubtask[];
}

// ─── Complexity estimation ──────────────────────────────────────────

function estimateComplexity(spec: ModuleSpec): 'simple' | 'medium' | 'complex' {
  let score = 0;
  score += spec.views.length * 2;
  score += spec.services.length * 3;
  score += spec.components.length;
  score += spec.externalApis.length * 2;
  score += spec.ipcChannels.handle.length + spec.ipcChannels.on.length;
  score += spec.settings.length;
  score += spec.requiredApiKeys.length;
  if (spec.storeSlice) score += 3;
  if (spec.type === 'hybrid') score += 3;

  if (score <= 5) return 'simple';
  if (score <= 15) return 'medium';
  return 'complex';
}

function complexityToPriority(c: ReturnType<typeof estimateComplexity>): 'p0' | 'p1' | 'p2' {
  return c === 'complex' ? 'p0' : c === 'medium' ? 'p1' : 'p2';
}

// ─── Build subtask list from spec ───────────────────────────────────

function buildSubtasks(spec: ModuleSpec): GeneratedSubtask[] {
  const subtasks: GeneratedSubtask[] = [];

  // 1. Scaffold
  subtasks.push({
    title: `Create module scaffold for ${spec.name}`,
    description: `Create directory structure at src/modules/${spec.id}/, manifest.json, and index.ts. Category: ${spec.category}. Type: ${spec.type}.`,
  });

  // 2. Views
  for (const view of spec.views) {
    subtasks.push({
      title: `Implement "${view.name}" view component`,
      description: `Create ${view.name} view at route ${view.route || 'TBD'}. Layout: ${spec.layout}. Components needed: ${view.components.length > 0 ? view.components.join(', ') : 'see component list'}.`,
    });
  }

  // 3. Services
  for (const svc of spec.services) {
    subtasks.push({
      title: `Implement ${svc.name} Electron service`,
      description: `Create ${svc.type} service: ${svc.name}. ${svc.description || 'See module spec for details.'}`,
    });
  }

  // 4. Store
  if (spec.storeSlice) {
    subtasks.push({
      title: `Implement Zustand store slice for ${spec.name}`,
      description: `Store: ${spec.storeSlice.name}. Fields: ${spec.storeSlice.fields.map((f) => f.name).join(', ')}. Actions: ${spec.storeSlice.actions.join(', ')}.`,
    });
  }

  // 5. IPC handlers
  const allChannels = [...spec.ipcChannels.handle, ...spec.ipcChannels.on];
  if (allChannels.length > 0) {
    subtasks.push({
      title: `Add IPC handlers for ${spec.id} namespace`,
      description: `Handle channels: ${spec.ipcChannels.handle.join(', ') || 'none'}. On channels: ${spec.ipcChannels.on.join(', ') || 'none'}.`,
    });
  }

  // 6. External APIs
  for (const api of spec.externalApis) {
    subtasks.push({
      title: `Integrate external API: ${api}`,
      description: `Add API client/adapter for ${api}. Wire into service layer and IPC if needed.`,
    });
  }

  // 7. Settings UI
  if (spec.settings.length > 0) {
    subtasks.push({
      title: `Add settings UI for ${spec.name}`,
      description: `Settings: ${spec.settings.map((s) => s.label).join(', ')}. API keys required: ${spec.requiredApiKeys.map((k) => k.service).join(', ') || 'none'}.`,
    });
  }

  // 8. Tests
  subtasks.push({
    title: `Write tests for ${spec.name}`,
    description: `Unit tests for services, store slice, and component rendering. Integration test for IPC handlers if applicable.`,
  });

  // 9. Registration
  if (spec.hasNavigation && spec.type !== 'service') {
    subtasks.push({
      title: `Register ${spec.name} in CoreViews and sidebar`,
      description: `Add to CoreViews.tsx with icon: ${spec.icon || 'auto-select'}. Add sidebar navigation entry.`,
    });
  }

  // 10. Commit
  subtasks.push({
    title: 'Commit and push to dev branch',
    description: `Commit all ${spec.name} module files. Branch: dev. Run lint before push.`,
  });

  return subtasks;
}

// ─── Build full description ─────────────────────────────────────────

function buildDescription(spec: ModuleSpec): string {
  const lines = [
    `Build the "${spec.name}" module (${spec.type}).`,
    spec.description,
    '',
    `Category: ${spec.category}`,
    `Layout: ${spec.layout}`,
    `Views: ${spec.views.length}`,
    `Services: ${spec.services.length}`,
    `External APIs: ${spec.externalApis.length > 0 ? spec.externalApis.join(', ') : 'none'}`,
    `IPC channels: ${spec.ipcChannels.handle.length + spec.ipcChannels.on.length}`,
    `Settings: ${spec.settings.length}`,
    `API keys required: ${spec.requiredApiKeys.map((k) => k.service).join(', ') || 'none'}`,
    `Permissions: ${spec.permissions.join(', ') || 'none'}`,
  ];
  return lines.join('\n');
}

// ─── Plan generation (for preview) ─────────────────────────────────

export function generateTaskPlan(spec: ModuleSpec): GeneratedTaskPlan {
  const complexity = estimateComplexity(spec);
  return {
    title: `Build Module: ${spec.name}`,
    description: buildDescription(spec),
    assign: complexity === 'simple' ? 'coder' : 'senior-coder',
    priority: complexityToPriority(complexity),
    deliverable: `src/modules/${spec.id}/`,
    subtasks: buildSubtasks(spec),
  };
}

// ─── Execute via Electron IPC ───────────────────────────────────────

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}

export async function generateTasks(spec: ModuleSpec): Promise<{ taskId: string; subtaskIds: string[] }> {
  const ipc = window.electronAPI;
  if (!ipc) {
    throw new Error('Electron IPC not available. Are you running in the dashboard?');
  }

  const plan = generateTaskPlan(spec);

  // Create main task
  const taskResult = await ipc.invoke('froggo-db:task-add', {
    title: plan.title,
    description: plan.description,
    assign: plan.assign,
    priority: plan.priority,
    deliverable: plan.deliverable,
  });

  const taskId = (taskResult as { id: string }).id;
  const subtaskIds: string[] = [];

  // Create subtasks
  for (const subtask of plan.subtasks) {
    const result = await ipc.invoke('froggo-db:subtask-add', {
      taskId,
      title: subtask.title,
      description: subtask.description,
    });
    subtaskIds.push((result as { id: string }).id);
  }

  return { taskId, subtaskIds };
}

// ─── Export spec as JSON (fallback for non-Electron environments) ───

export function exportSpecAsJson(spec: ModuleSpec): string {
  return JSON.stringify({ spec, taskPlan: generateTaskPlan(spec) }, null, 2);
}
