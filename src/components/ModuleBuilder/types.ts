// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * ModuleBuilder types — defines the full ModuleSpec and all sub-types
 * generated through the conversational interview flow.
 */

export interface ViewSpec {
  id: string;
  name: string;
  description: string;
  route?: string;
  components: string[];
}

export interface ServiceSpec {
  id: string;
  name: string;
  description: string;
  type: 'electron-main' | 'renderer' | 'shared';
  methods: string[];
}

export interface StoreSpec {
  name: string;
  description: string;
  fields: { name: string; type: string; default?: string }[];
  actions: string[];
}

export interface SettingSpec {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'color';
  default?: string | number | boolean;
  options?: string[]; // for select type
  description?: string;
}

export interface ApiKeySpec {
  service: string;
  envVar: string;
  required: boolean;
  description: string;
  docsUrl?: string;
}

export interface ComponentSpec {
  id: string;
  name: string;
  type: 'chart' | 'table' | 'form' | 'list' | 'card' | 'custom';
  description: string;
  props?: Record<string, string>;
}

export interface ModuleSpec {
  // Section 1: Identity
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'social' | 'finance' | 'dev-tools' | 'communication' | 'other';
  icon: string;

  // Section 2: Type
  type: 'page' | 'widget' | 'service' | 'hybrid';
  hasNavigation: boolean;

  // Section 3: Features & UI
  views: ViewSpec[];
  components: ComponentSpec[];
  layout: 'single-panel' | 'split' | 'tabs' | 'grid';

  // Section 4: Data & Integrations
  ipcChannels: { handle: string[]; on: string[] };
  services: ServiceSpec[];
  storeSlice: StoreSpec | null;
  externalApis: string[];

  // Section 5: Settings & Permissions
  permissions: string[];
  settings: SettingSpec[];
  requiredApiKeys: ApiKeySpec[];
}

export type SectionId = 'identity' | 'type' | 'features' | 'data' | 'settings';

export interface InterviewQuestion {
  id: string;
  section: SectionId;
  text: string;
  /** Field(s) in ModuleSpec this question populates */
  targets: string[];
  /** Input type hint for the UI */
  inputType: 'text' | 'select' | 'multiselect' | 'confirm' | 'list';
  options?: string[];
  /** Whether to show this question (based on current spec state) */
  condition?: (spec: Partial<ModuleSpec>) => boolean;
  /** Parse free-text answer into structured data */
  parse?: (answer: string, spec: Partial<ModuleSpec>) => Partial<ModuleSpec>;
}

export interface ConversationMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
  section?: SectionId;
}

export interface SectionProgress {
  id: SectionId;
  label: string;
  complete: boolean;
  questionCount: number;
  answeredCount: number;
}

export const SECTION_LABELS: Record<SectionId, string> = {
  identity: 'Module Identity',
  type: 'Module Type',
  features: 'Features & UI',
  data: 'Data & Integrations',
  settings: 'Settings & Permissions',
};

export const SECTION_ORDER: SectionId[] = ['identity', 'type', 'features', 'data', 'settings'];

export function createEmptySpec(): Partial<ModuleSpec> {
  return {
    id: '',
    name: '',
    description: '',
    category: 'other',
    icon: '',
    type: 'page',
    hasNavigation: true,
    views: [],
    components: [],
    layout: 'single-panel',
    ipcChannels: { handle: [], on: [] },
    services: [],
    storeSlice: null,
    externalApis: [],
    permissions: [],
    settings: [],
    requiredApiKeys: [],
  };
}
