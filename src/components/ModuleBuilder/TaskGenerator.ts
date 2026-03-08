/**
 * TaskGenerator — Takes a completed ModuleSpec and generates mission-control-db
 * task-add + subtask-add calls via Electron IPC.
 */

import type { ModuleSpec } from './types';
import { taskApi } from '../../lib/api';

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
  subtasks.push({
    title: `Register ${spec.name} module in optional-registry and catalog`,
    description: [
      `1. Add entry to src/modules/optional-registry.ts: \`'${spec.id}': () => import('./${spec.id}')\``,
      `2. Create catalog manifest at catalog/modules/${spec.id}.json with id, name, version, description, category, icon, core: false, responsibleAgent, requiredApis, requiredAgents, requiredNpm fields.`,
      `3. Do NOT add to src/modules/index.ts (that is for core modules only).`,
      `4. Do NOT hardcode in CoreViews.tsx or Sidebar — the module self-registers via ViewRegistry in its index.ts lifecycle.init().`,
      `5. After creating the catalog manifest, the module will appear in the Modules page and can be installed from there.`,
    ].join(' '),
  });

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

// ─── Execute via REST API ────────────────────────────────────────────

export async function generateTasks(spec: ModuleSpec): Promise<{ taskId: string; subtaskIds: string[] }> {
  const plan = generateTaskPlan(spec);
  const taskId = `task-${Date.now()}`;

  // Create main task via REST API
  await taskApi.create({
    id: taskId,
    title: plan.title,
    status: 'todo',
    assignedTo: plan.assign,
  });

  const subtaskIds: string[] = [];

  // Create subtasks
  for (const subtask of plan.subtasks) {
    const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await taskApi.addSubtask(taskId, {
      id: subId,
      title: subtask.title,
      description: subtask.description,
    });
    subtaskIds.push(subId);
  }

  return { taskId, subtaskIds };
}

// ─── Export spec as JSON (fallback for non-Electron environments) ───

export function exportSpecAsJson(spec: ModuleSpec): string {
  return JSON.stringify({ spec, taskPlan: generateTaskPlan(spec) }, null, 2);
}
