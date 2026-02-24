/**
 * Marketplace Schema
 *
 * Zod validation schemas for froggo.pro registry data.
 * Used by marketplace-handlers.ts to validate incoming JSON before storing.
 */

import { z } from 'zod';

const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

// ── Agent package schemas ─────────────────────────────────────────────────────

export const AgentCredentialDeclarationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(false),
  type: z.enum(['api_key', 'oauth_token', 'password', 'url', 'custom']),
});

export const AgentPackageMetaSchema = z.object({
  agentId: z.string().regex(/^[a-z0-9-]+$/),
  soulPreview: z.string().min(1).max(2000),
  credentials: z.array(AgentCredentialDeclarationSchema).optional(),
  templateFiles: z.record(z.string(), z.string()).optional(),
});

export type AgentPackageMeta = z.infer<typeof AgentPackageMetaSchema>;
export type AgentCredentialDeclaration = z.infer<typeof AgentCredentialDeclarationSchema>;

// ── Registry entry schema ─────────────────────────────────────────────────────

export const RegistryEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  version: z.string().regex(semverRegex),
  author: z.string().min(1),
  description: z.string(),
  category: z.string(),
  downloads: z.number().int().min(0),
  verified: z.boolean(),
  sha256: z.string().default(''),
  icon: z.string().optional(),
  tags: z.array(z.string()).optional(),
  manifestUrl: z.string(),
  packageUrl: z.string(),
  updatedAt: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  agent: AgentPackageMetaSchema.optional(),
});

export const ModuleRegistrySchema = z.object({
  version: z.number().int(),
  modules: z.array(RegistryEntrySchema),
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type ModuleRegistry = z.infer<typeof ModuleRegistrySchema>;
