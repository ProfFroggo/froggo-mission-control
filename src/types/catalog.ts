// src/types/catalog.ts
// TypeScript interfaces for the v4.0 Agent & Module Library catalog system.

export interface CatalogAgent {
  id: string;
  name: string;
  emoji: string;
  role: string | null;
  description: string | null;
  model: 'opus' | 'sonnet' | 'haiku';
  capabilities: string[];       // parsed from JSON TEXT column
  requiredApis: string[];       // env var names needed (e.g. 'TWITTER_API_KEY')
  requiredSkills: string[];     // skill names from .claude/skills/
  requiredTools: string[];      // CLI tools needed (e.g. 'git', 'node')
  version: string;
  category: string;
  installed: boolean;           // true = hired/active, false = available to hire
  createdAt: number;
  updatedAt: number;
}

export interface CatalogModule {
  id: string;
  name: string;
  description: string | null;
  version: string;
  category: string;
  icon: string;
  responsibleAgent: string | null;
  requiredAgents: string[];     // agent IDs that must be installed first
  requiredNpm: string[];        // npm packages to install
  requiredApis: string[];       // env var names needed
  requiredSkills: string[];     // skill names
  requiredCli: string[];        // CLI tools needed
  installed: boolean;
  enabled: boolean;             // only relevant when installed
  core: boolean;                // core modules cannot be uninstalled
  createdAt: number;
  updatedAt: number;
}

// Raw DB row (before JSON parsing) — used internally in API routes
export interface CatalogAgentRow extends Omit<CatalogAgent, 'capabilities' | 'requiredApis' | 'requiredSkills' | 'requiredTools' | 'installed'> {
  capabilities: string;
  requiredApis: string;
  requiredSkills: string;
  requiredTools: string;
  installed: number;
}

export interface CatalogModuleRow extends Omit<CatalogModule, 'requiredAgents' | 'requiredNpm' | 'requiredApis' | 'requiredSkills' | 'requiredCli' | 'installed' | 'enabled' | 'core'> {
  requiredAgents: string;
  requiredNpm: string;
  requiredApis: string;
  requiredSkills: string;
  requiredCli: string;
  installed: number;
  enabled: number;
  core: number;
}

// Helper to parse a raw DB row into a typed CatalogAgent
export function parseCatalogAgent(row: CatalogAgentRow): CatalogAgent {
  return {
    ...row,
    capabilities:   JSON.parse(row.capabilities   || '[]'),
    requiredApis:   JSON.parse(row.requiredApis   || '[]'),
    requiredSkills: JSON.parse(row.requiredSkills || '[]'),
    requiredTools:  JSON.parse(row.requiredTools  || '[]'),
    installed: row.installed === 1,
  };
}

// Helper to parse a raw DB row into a typed CatalogModule
export function parseCatalogModule(row: CatalogModuleRow): CatalogModule {
  return {
    ...row,
    requiredAgents: JSON.parse(row.requiredAgents || '[]'),
    requiredNpm:    JSON.parse(row.requiredNpm    || '[]'),
    requiredApis:   JSON.parse(row.requiredApis   || '[]'),
    requiredSkills: JSON.parse(row.requiredSkills || '[]'),
    requiredCli:    JSON.parse(row.requiredCli    || '[]'),
    installed: row.installed === 1,
    enabled:   row.enabled   === 1,
    core:      row.core      === 1,
  };
}

// Manifest file format (.catalog/agents/{id}.json)
export interface AgentManifestFile {
  id: string;
  name: string;
  emoji?: string;
  role?: string;
  description?: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  capabilities?: string[];
  requiredApis?: string[];
  requiredSkills?: string[];
  requiredTools?: string[];
  version?: string;
  category?: string;
}

// Manifest file format (.catalog/modules/{id}.json)
export interface ModuleManifestFile {
  id: string;
  name: string;
  description?: string;
  version?: string;
  category?: string;
  icon?: string;
  responsibleAgent?: string;
  requiredAgents?: string[];
  requiredNpm?: string[];
  requiredApis?: string[];
  requiredSkills?: string[];
  requiredCli?: string[];
  core?: boolean;
}
