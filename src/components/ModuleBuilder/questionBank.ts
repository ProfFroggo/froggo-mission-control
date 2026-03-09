// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * questionBank.ts — All interview questions organized by 5 sections.
 * Each question knows how to parse user answers into ModuleSpec updates.
 */

import type { InterviewQuestion, ModuleSpec } from './types';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Section 1: Identity ────────────────────────────────────────────
const identityQuestions: InterviewQuestion[] = [
  {
    id: 'identity-name',
    section: 'identity',
    text: "What's the name of your module?",
    targets: ['name', 'id'],
    inputType: 'text',
    parse: (answer) => ({ name: answer.trim(), id: slugify(answer.trim()) }),
  },
  {
    id: 'identity-description',
    section: 'identity',
    text: 'Describe what it does in one sentence.',
    targets: ['description'],
    inputType: 'text',
    parse: (answer) => ({ description: answer.trim() }),
  },
  {
    id: 'identity-category',
    section: 'identity',
    text: 'What category does it belong to?',
    targets: ['category'],
    inputType: 'select',
    options: ['productivity', 'social', 'finance', 'dev-tools', 'communication', 'other'],
    parse: (answer) => {
      const cat = answer.toLowerCase().trim();
      const valid = ['productivity', 'social', 'finance', 'dev-tools', 'communication', 'other'];
      return { category: (valid.includes(cat) ? cat : 'other') as ModuleSpec['category'] };
    },
  },
  {
    id: 'identity-icon',
    section: 'identity',
    text: 'Choose an icon name (Lucide icon, e.g. "BarChart3", "Users", "Wallet"). Or type "auto" to pick later.',
    targets: ['icon'],
    inputType: 'text',
    parse: (answer) => ({ icon: answer.trim() === 'auto' ? '' : answer.trim() }),
  },
];

// ─── Section 2: Type ────────────────────────────────────────────────
const typeQuestions: InterviewQuestion[] = [
  {
    id: 'type-kind',
    section: 'type',
    text: 'Is this a full dashboard page, a widget panel, a background service, or a hybrid (page + service)?',
    targets: ['type'],
    inputType: 'select',
    options: ['page', 'widget', 'service', 'hybrid'],
    parse: (answer) => {
      const map: Record<string, ModuleSpec['type']> = {
        page: 'page', 'full page': 'page', 'full dashboard page': 'page', dashboard: 'page',
        widget: 'widget', 'widget panel': 'widget', panel: 'widget',
        service: 'service', 'background service': 'service', background: 'service',
        hybrid: 'hybrid',
      };
      const key = answer.toLowerCase().trim();
      return { type: map[key] || 'page' };
    },
  },
  {
    id: 'type-navigation',
    section: 'type',
    text: 'Should it appear in the sidebar navigation?',
    targets: ['hasNavigation'],
    inputType: 'confirm',
    condition: (spec) => spec.type !== 'service',
    parse: (answer) => {
      const yes = /^(y|yes|yeah|yep|sure|true|1)/i.test(answer.trim());
      return { hasNavigation: yes };
    },
  },
];

// ─── Section 3: Features & UI ───────────────────────────────────────
const featuresQuestions: InterviewQuestion[] = [
  {
    id: 'features-layout',
    section: 'features',
    text: 'Describe the layout — single panel, split view, tabs, or grid?',
    targets: ['layout'],
    inputType: 'select',
    options: ['single-panel', 'split', 'tabs', 'grid'],
    condition: (spec) => spec.type !== 'service',
    parse: (answer) => {
      const map: Record<string, ModuleSpec['layout']> = {
        'single panel': 'single-panel', single: 'single-panel', 'single-panel': 'single-panel',
        split: 'split', 'split view': 'split',
        tabs: 'tabs', tabbed: 'tabs',
        grid: 'grid',
      };
      return { layout: map[answer.toLowerCase().trim()] || 'single-panel' };
    },
  },
  {
    id: 'features-views',
    section: 'features',
    text: 'What are the main views/screens? List them separated by commas (e.g. "Dashboard, Settings, Detail").',
    targets: ['views'],
    inputType: 'list',
    condition: (spec) => spec.type !== 'service',
    parse: (answer, spec) => {
      const views = answer.split(',').map((v) => v.trim()).filter(Boolean).map((name) => ({
        id: slugify(name),
        name,
        description: '',
        route: `/${spec.id || 'module'}/${slugify(name)}`,
        components: [],
      }));
      return { views };
    },
  },
  {
    id: 'features-components',
    section: 'features',
    text: 'What component types does it need? (charts, tables, forms, lists, cards, custom)',
    targets: ['components'],
    inputType: 'multiselect',
    options: ['chart', 'table', 'form', 'list', 'card', 'custom'],
    condition: (spec) => spec.type !== 'service',
    parse: (answer) => {
      const types = ['chart', 'table', 'form', 'list', 'card', 'custom'] as const;
      const lower = answer.toLowerCase();
      const components = types
        .filter((t) => lower.includes(t) || lower.includes(t + 's'))
        .map((t, i) => ({
          id: `comp-${t}-${i}`,
          name: `${t.charAt(0).toUpperCase() + t.slice(1)}Component`,
          type: t,
          description: '',
        }));
      return { components };
    },
  },
];

// ─── Section 4: Data & Integrations ─────────────────────────────────
const dataQuestions: InterviewQuestion[] = [
  {
    id: 'data-external-apis',
    section: 'data',
    text: 'What external APIs should it connect to? List them separated by commas (or "none").',
    targets: ['externalApis'],
    inputType: 'list',
    parse: (answer) => {
      if (/^(none|n\/a|no|nothing)$/i.test(answer.trim())) return { externalApis: [] };
      return { externalApis: answer.split(',').map((a) => a.trim()).filter(Boolean) };
    },
  },
  {
    id: 'data-ipc',
    section: 'data',
    text: 'Does it need its own Electron IPC handlers? If yes, list the channel names (e.g. "module:getData, module:save"). Otherwise say "no".',
    targets: ['ipcChannels'],
    inputType: 'list',
    parse: (answer) => {
      if (/^(no|none|n\/a|nope)$/i.test(answer.trim())) {
        return { ipcChannels: { handle: [], on: [] } };
      }
      const channels = answer.split(',').map((c) => c.trim()).filter(Boolean);
      // Default to handle (request-response); user can refine later
      return { ipcChannels: { handle: channels, on: [] } };
    },
  },
  {
    id: 'data-services',
    section: 'data',
    text: 'Does it need background Electron services? List names (e.g. "x-api-client, data-sync") or say "no".',
    targets: ['services'],
    inputType: 'list',
    parse: (answer) => {
      if (/^(no|none|n\/a|nope)$/i.test(answer.trim())) return { services: [] };
      const services = answer.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({
        id: slugify(name),
        name,
        description: '',
        type: 'electron-main' as const,
        methods: [],
      }));
      return { services };
    },
  },
  {
    id: 'data-store',
    section: 'data',
    text: 'Does it need its own Zustand store slice? If yes, describe the main data fields. Otherwise say "no".',
    targets: ['storeSlice'],
    inputType: 'text',
    parse: (answer, spec) => {
      if (/^(no|none|n\/a|nope)$/i.test(answer.trim())) return { storeSlice: null };
      // Create a basic store spec; fields parsed from comma-separated list
      const fields = answer.split(',').map((f) => f.trim()).filter(Boolean).map((name) => ({
        name: slugify(name).replace(/-/g, '_'),
        type: 'unknown',
      }));
      return {
        storeSlice: {
          name: `${spec.id || 'module'}Store`,
          description: answer.trim(),
          fields,
          actions: ['set', 'reset'],
        },
      };
    },
  },
];

// ─── Section 5: Settings & Permissions ──────────────────────────────
const settingsQuestions: InterviewQuestion[] = [
  {
    id: 'settings-permissions',
    section: 'settings',
    text: 'What permissions does it require? (storage, network, filesystem, clipboard, notifications — or "none")',
    targets: ['permissions'],
    inputType: 'multiselect',
    options: ['storage', 'network', 'filesystem', 'clipboard', 'notifications'],
    parse: (answer) => {
      if (/^(none|n\/a|no|nothing)$/i.test(answer.trim())) return { permissions: [] };
      const valid = ['storage', 'network', 'filesystem', 'clipboard', 'notifications'];
      const lower = answer.toLowerCase();
      return { permissions: valid.filter((p) => lower.includes(p)) };
    },
  },
  {
    id: 'settings-user-config',
    section: 'settings',
    text: 'What should users be able to configure? List settings (e.g. "refresh interval, theme, language") or "none".',
    targets: ['settings'],
    inputType: 'list',
    parse: (answer) => {
      if (/^(none|n\/a|no|nothing)$/i.test(answer.trim())) return { settings: [] };
      const settings = answer.split(',').map((s) => s.trim()).filter(Boolean).map((label) => ({
        key: slugify(label).replace(/-/g, '_'),
        label,
        type: 'string' as const,
        description: '',
      }));
      return { settings };
    },
  },
  {
    id: 'settings-api-keys',
    section: 'settings',
    text: 'Does it need API keys from the user? List them (e.g. "Twitter API key, OpenAI key") or "none".',
    targets: ['requiredApiKeys'],
    inputType: 'list',
    parse: (answer) => {
      if (/^(none|n\/a|no|nothing)$/i.test(answer.trim())) return { requiredApiKeys: [] };
      const keys = answer.split(',').map((k) => k.trim()).filter(Boolean).map((service) => ({
        service,
        envVar: slugify(service).replace(/-/g, '_').toUpperCase() + '_KEY',
        required: true,
        description: `API key for ${service}`,
      }));
      return { requiredApiKeys: keys };
    },
  },
];

// ─── Exports ────────────────────────────────────────────────────────
export const questionBank: InterviewQuestion[] = [
  ...identityQuestions,
  ...typeQuestions,
  ...featuresQuestions,
  ...dataQuestions,
  ...settingsQuestions,
];

export function getQuestionsForSection(section: InterviewQuestion['section']): InterviewQuestion[] {
  return questionBank.filter((q) => q.section === section);
}

export function getApplicableQuestions(
  section: InterviewQuestion['section'],
  spec: Partial<ModuleSpec>,
): InterviewQuestion[] {
  return getQuestionsForSection(section).filter((q) => !q.condition || q.condition(spec));
}
