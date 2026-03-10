// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * TaskGenerator — Multi-task generation for Module Builder.
 *
 * Generates phase-specific tasks, each with the correct agent assignment,
 * detailed descriptions, and full subtask breakdowns.
 */

import type { ModuleSpec } from './types';

export interface GeneratedSubtask {
  title: string;
  description: string;
}

export interface GeneratedTask {
  title: string;
  description: string;
  status: 'todo';
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  assignedTo: string;
  reviewerId: string;
  moduleId: string;
  subtasks: GeneratedSubtask[];
}

// ─── Complexity / Priority helpers ──────────────────────────────────

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

function derivePriority(spec: ModuleSpec): 'p0' | 'p1' | 'p2' {
  const c = estimateComplexity(spec);
  return c === 'complex' ? 'p0' : c === 'medium' ? 'p1' : 'p2';
}

// ─── Description builders ────────────────────────────────────────────

function buildDesignTaskDescription(spec: ModuleSpec, moduleId: string, wireframeHtml: string): string {
  const viewNames = spec.views.map(v => v.name).join(', ') || 'main view';
  return [
    `## Design & Architecture Review — ${spec.name}`,
    '',
    spec.description,
    '',
    '### Wireframe',
    'Review the wireframe below before implementation begins. Validate that all views are represented.',
    '',
    wireframeHtml
      ? `[View in Module Builder: /module-builder/${moduleId}]`
      : 'Wireframe not yet generated — generate from Module Builder first.',
    '',
    '### Spec Summary',
    `- Type: ${spec.type}`,
    `- Layout: ${spec.layout}`,
    `- Views: ${viewNames}`,
    `- Components: ${spec.components.map(c => c.type).join(', ') || 'none'}`,
    '',
    '### Acceptance Criteria',
    '- [ ] Wireframe reviewed and approved',
    '- [ ] Component hierarchy documented',
    '- [ ] No design system gaps identified',
    '- [ ] Ready for implementation',
  ].join('\n');
}

function buildScaffoldTaskDescription(spec: ModuleSpec): string {
  return [
    `## Module Scaffold — ${spec.name}`,
    '',
    'Set up the module directory structure, manifest, and registration so the module',
    'appears in the Module Library and can be navigated to.',
    '',
    '### Spec',
    JSON.stringify({ id: spec.id, name: spec.name, type: spec.type, category: spec.category, icon: spec.icon, hasNavigation: spec.hasNavigation }, null, 2),
    '',
    '### Acceptance Criteria',
    `- [ ] Directory created at src/modules/${spec.id}/`,
    '- [ ] manifest.json written with correct fields',
    '- [ ] Module registers in ViewRegistry without errors',
    '- [ ] Appears in Modules Library panel',
  ].join('\n');
}

function buildViewsTaskDescription(spec: ModuleSpec, wireframeHtml: string): string {
  return [
    `## UI Views Implementation — ${spec.name}`,
    '',
    `Implement all ${spec.views.length} view(s) for the ${spec.name} module.`,
    wireframeHtml ? 'Reference the wireframe for layout guidance.' : '',
    '',
    '### Views to implement',
    ...spec.views.map(v => `- **${v.name}**: src/components/${spec.id}/${v.name}.tsx`),
    '',
    '### Layout',
    `Type: ${spec.layout}`,
    '',
    '### Acceptance Criteria',
    '- [ ] All views render without TypeScript errors',
    '- [ ] Layout type implemented correctly',
    '- [ ] CSS variables used throughout (no hardcoded colors)',
    '- [ ] All Lucide icons resolve (no emoji)',
    '- [ ] Responsive at 320px+',
  ].join('\n');
}

function buildDataTaskDescription(spec: ModuleSpec): string {
  return [
    `## Data Layer & Integrations — ${spec.name}`,
    '',
    'Implement store slice, IPC handlers, and external API integrations.',
    '',
    spec.storeSlice ? `### Store: ${spec.storeSlice.name}\nFields: ${spec.storeSlice.fields.map(f => f.name).join(', ')}\nActions: ${spec.storeSlice.actions.join(', ')}` : '',
    spec.externalApis.length > 0 ? `\n### External APIs\n${spec.externalApis.map(a => `- ${a}`).join('\n')}` : '',
    spec.ipcChannels.handle.length > 0 ? `\n### IPC Handlers\n${spec.ipcChannels.handle.map(ch => `- ${ch}`).join('\n')}` : '',
    '',
    '### Acceptance Criteria',
    '- [ ] Store slice type-safe and tested',
    '- [ ] All IPC handlers registered and tested',
    '- [ ] External API errors handled gracefully',
  ].filter(Boolean).join('\n');
}

function buildServicesTaskDescription(spec: ModuleSpec): string {
  return [
    `## Background Services — ${spec.name}`,
    '',
    `Implement ${spec.services.length} background service(s).`,
    '',
    ...spec.services.map(s => `### ${s.name} (${s.type})\n${s.description || 'See module spec for details.'}`),
    '',
    '### Acceptance Criteria',
    '- [ ] All services start/stop cleanly',
    '- [ ] Error handling and logging in place',
    '- [ ] No memory leaks (proper cleanup on unmount)',
  ].join('\n');
}

function buildSettingsTaskDescription(spec: ModuleSpec): string {
  return [
    `## Settings & Configuration UI — ${spec.name}`,
    '',
    `Implement settings panel for ${spec.settings.length} configurable option(s).`,
    '',
    '### Settings',
    ...spec.settings.map(s => `- **${s.label}** (${s.type}): key=${s.key}`),
    spec.permissions.length > 0 ? `\n### Permissions\n${spec.permissions.map(p => `- ${p}`).join('\n')}` : '',
    '',
    '### Acceptance Criteria',
    '- [ ] Settings panel renders in module settings tab',
    '- [ ] All settings persisted and loaded correctly',
    '- [ ] Permission requests handle grant/deny gracefully',
  ].filter(Boolean).join('\n');
}

function buildTestsTaskDescription(spec: ModuleSpec): string {
  return [
    `## Tests & QA — ${spec.name}`,
    '',
    `Test coverage for all ${spec.name} module logic and UI.`,
    '',
    '### Acceptance Criteria',
    '- [ ] Unit tests for all service/store logic (80%+ coverage)',
    spec.type !== 'service' ? '- [ ] Component render tests for each view' : '',
    '- [ ] TypeScript: zero errors on tsc --noEmit',
    '- [ ] Accessibility: keyboard navigation and aria labels',
    spec.externalApis.length > 0 ? '- [ ] Mock API integration tests (error states, timeouts, empty responses)' : '',
  ].filter(Boolean).join('\n');
}

function buildDocsTaskDescription(spec: ModuleSpec): string {
  return [
    `## Documentation & Library Registration — ${spec.name}`,
    '',
    `Document the ${spec.name} module and register it in the catalog.`,
    '',
    '### Deliverables',
    `- Module README at ~/mission-control/library/docs/platform/${spec.id}-readme.md`,
    '- Module added to catalog_modules (enabled, installed=true)',
    '- Module visible in Modules Library panel',
    `- Commit: feat(module): add ${spec.name} module`,
    '',
    '### Acceptance Criteria',
    '- [ ] README covers purpose, setup, and usage',
    '- [ ] syncCatalogModules() picks up the new manifest',
    '- [ ] Install/uninstall flow works end-to-end',
  ].join('\n');
}

// ─── Main generator ──────────────────────────────────────────────────

export function generateTasksForModule(
  spec: ModuleSpec,
  moduleId: string,
  wireframeHtml: string,
): GeneratedTask[] {
  const priority = derivePriority(spec);
  const complexity = estimateComplexity(spec);
  const tasks: GeneratedTask[] = [];

  // Task 1: Design & Architecture Review
  tasks.push({
    title: `[${spec.name}] Design & Architecture Review`,
    description: buildDesignTaskDescription(spec, moduleId, wireframeHtml),
    status: 'todo',
    priority,
    assignedTo: 'designer',
    reviewerId: 'clara',
    moduleId,
    subtasks: [
      { title: 'Review wireframe and validate layout matches spec', description: `Check that wireframe covers all views: ${spec.views.map(v => v.name).join(', ') || 'main view'}` },
      { title: 'Define component hierarchy and data flow', description: 'Map out which components need which data' },
      { title: 'Identify any design system gaps (missing Lucide icons, color tokens)', description: '' },
      { title: 'Sign off on final layout before implementation begins', description: '' },
    ],
  });

  // Task 2: Scaffold & Registration (always present)
  tasks.push({
    title: `[${spec.name}] Scaffold & Module Registration`,
    description: buildScaffoldTaskDescription(spec),
    status: 'todo',
    priority,
    assignedTo: complexity === 'complex' ? 'senior-coder' : 'coder',
    reviewerId: 'clara',
    moduleId,
    subtasks: [
      { title: `Create src/modules/${spec.id}/ directory structure`, description: 'index.ts, module.json, lifecycle hooks' },
      { title: `Write catalog/modules/${spec.id}.json manifest`, description: JSON.stringify({ id: spec.id, name: spec.name, type: spec.type, icon: spec.icon }, null, 2) },
      { title: 'Register module in ViewRegistry', description: 'Add to optional-registry.ts or equivalent' },
      { title: `Add navigation entry (hasNavigation=${spec.hasNavigation})`, description: spec.hasNavigation ? 'Add to Sidebar nav items' : 'Skip — service module has no nav entry' },
    ],
  });

  // Task 3: UI Views (only if not a service)
  if (spec.type !== 'service' && spec.views.length > 0) {
    tasks.push({
      title: `[${spec.name}] UI Views Implementation`,
      description: buildViewsTaskDescription(spec, wireframeHtml),
      status: 'todo',
      priority,
      assignedTo: spec.views.length > 3 ? 'senior-coder' : 'coder',
      reviewerId: 'clara',
      moduleId,
      subtasks: [
        ...spec.views.map(view => ({
          title: `Implement ${view.name} view`,
          description: `Component: src/components/${spec.id}/${view.name}.tsx. Layout: ${spec.layout}. Components: ${view.components.length > 0 ? view.components.join(', ') : spec.components.map(c => c.type).join(', ') || 'none'}`,
        })),
        { title: `Wire layout container (${spec.layout})`, description: `Layout type: ${spec.layout}` },
        { title: 'Implement responsive styling using CSS variables', description: 'No hardcoded colors. Use var(--color-*) tokens.' },
        { title: 'Verify all Lucide icons resolve (no emoji, no undefined icons)', description: '' },
      ],
    });
  }

  // Task 4: Data Layer (only if there's something to wire)
  const hasData = spec.externalApis.length > 0 || spec.storeSlice !== null || spec.ipcChannels.handle.length > 0 || spec.ipcChannels.on.length > 0;
  if (hasData) {
    const dataSubtasks: GeneratedSubtask[] = [];
    if (spec.storeSlice) {
      dataSubtasks.push({ title: `Create Zustand store slice for ${spec.name}`, description: `Fields: ${spec.storeSlice.fields.map(f => f.name).join(', ')}. Actions: ${spec.storeSlice.actions.join(', ')}` });
    }
    for (const ch of spec.ipcChannels.handle) {
      dataSubtasks.push({ title: `IPC handler: ${ch}`, description: `ipcMain.handle('${ch}', ...)` });
    }
    for (const api of spec.externalApis) {
      dataSubtasks.push({ title: `Integrate ${api} API`, description: `Implement ${api} client, auth, error handling` });
    }
    for (const k of spec.requiredApiKeys) {
      dataSubtasks.push({ title: `Add ${k.service} API key to settings`, description: `User-configurable, stored securely` });
    }
    tasks.push({
      title: `[${spec.name}] Data Layer & Integrations`,
      description: buildDataTaskDescription(spec),
      status: 'todo',
      priority,
      assignedTo: 'coder',
      reviewerId: 'clara',
      moduleId,
      subtasks: dataSubtasks,
    });
  }

  // Task 5: Background Services (only if services exist)
  if (spec.services.length > 0) {
    tasks.push({
      title: `[${spec.name}] Background Services`,
      description: buildServicesTaskDescription(spec),
      status: 'todo',
      priority,
      assignedTo: 'coder',
      reviewerId: 'clara',
      moduleId,
      subtasks: spec.services.map(svc => ({
        title: `Implement ${svc.name} service`,
        description: `Service class at src/services/${svc.name}.ts. Handles: ${svc.description || 'background processing'}`,
      })),
    });
  }

  // Task 6: Settings UI (only if settings or permissions exist)
  if (spec.settings.length > 0 || spec.permissions.length > 0) {
    const settingsSubtasks: GeneratedSubtask[] = [
      { title: 'Build settings panel component', description: 'Add to module settings tab or app settings' },
      ...spec.settings.map(s => ({ title: `Setting: ${s.key}`, description: `Type: ${s.type}, default: ${String(s.default ?? '')}` })),
      ...spec.permissions.map(p => ({ title: `Request permission: ${p}`, description: 'Handle permission grant/deny gracefully' })),
    ];
    tasks.push({
      title: `[${spec.name}] Settings & Configuration UI`,
      description: buildSettingsTaskDescription(spec),
      status: 'todo',
      priority: 'p2',
      assignedTo: 'coder',
      reviewerId: 'clara',
      moduleId,
      subtasks: settingsSubtasks,
    });
  }

  // Task 7: Tests & QA (always)
  const testSubtasks: GeneratedSubtask[] = [
    { title: 'Unit tests for all service/store logic', description: 'Vitest. 80%+ coverage on business logic.' },
  ];
  if (spec.type !== 'service') {
    testSubtasks.push({ title: 'Component render tests for each view', description: 'Test: renders without crash, key interactions work' });
  }
  testSubtasks.push({ title: 'TypeScript: zero errors on tsc --noEmit', description: 'No `any` unless justified with a comment' });
  testSubtasks.push({ title: 'Accessibility: keyboard navigation and aria labels on interactive elements', description: '' });
  if (spec.externalApis.length > 0) {
    testSubtasks.push({ title: 'Mock API integration tests', description: 'Test error states, timeouts, empty responses' });
  }
  tasks.push({
    title: `[${spec.name}] Tests & QA`,
    description: buildTestsTaskDescription(spec),
    status: 'todo',
    priority: 'p2',
    assignedTo: 'coder',
    reviewerId: 'clara',
    moduleId,
    subtasks: testSubtasks,
  });

  // Task 8: Documentation & Library Registration
  tasks.push({
    title: `[${spec.name}] Documentation & Library Registration`,
    description: buildDocsTaskDescription(spec),
    status: 'todo',
    priority: 'p3',
    assignedTo: 'writer',
    reviewerId: 'clara',
    moduleId,
    subtasks: [
      { title: 'Write module README (purpose, setup, usage)', description: `Save to ~/mission-control/library/docs/platform/${spec.id}-readme.md` },
      { title: 'Add module to catalog_modules (enabled, installed=true)', description: 'syncCatalogModules() should pick it up from catalog/modules/' },
      { title: 'Verify module appears in Modules Library panel', description: 'Test install/uninstall flow works end-to-end' },
      { title: `Commit and tag release`, description: `git commit -m "feat(module): add ${spec.name} module"` },
    ],
  });

  return tasks;
}

// ─── Legacy single-task plan (kept for export JSON / preview) ────────

interface GeneratedTaskPlan {
  title: string;
  description: string;
  assign: string;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  deliverable: string;
  subtasks: { title: string; description: string }[];
}

export function generateTaskPlan(spec: ModuleSpec): GeneratedTaskPlan {
  const complexity = estimateComplexity(spec);
  const tasks = generateTasksForModule(spec, 'preview', '');
  return {
    title: `Build Module: ${spec.name}`,
    description: `${spec.description}\n\nType: ${spec.type} | Layout: ${spec.layout} | Views: ${spec.views.length} | Services: ${spec.services.length}`,
    assign: complexity === 'simple' ? 'coder' : 'senior-coder',
    priority: derivePriority(spec),
    deliverable: `src/modules/${spec.id}/`,
    subtasks: tasks.flatMap(t => t.subtasks),
  };
}

// ─── Export spec as JSON ────────────────────────────────────────────

export function exportSpecAsJson(spec: ModuleSpec): string {
  return JSON.stringify({ spec, taskPlan: generateTaskPlan(spec) }, null, 2);
}
