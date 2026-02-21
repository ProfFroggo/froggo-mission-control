/**
 * manifestSchema — Zod validation for module manifests.
 *
 * Enforces structure and constraints on module.json files.
 * Used by ModuleLoader during registration to catch bad manifests early.
 */

import { z } from 'zod';

const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

export const ModuleViewDeclarationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().min(1),
  entrypoint: z.string().min(1),
});

export const ModuleServiceDeclarationSchema = z.object({
  id: z.string().min(1),
  entrypoint: z.string().min(1),
  electron: z.boolean().optional(),
});

export const CredentialDeclarationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(false),
  type: z.enum(['api_key', 'oauth_token', 'password', 'url', 'custom']),
});

export const ModuleManifestSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Module ID must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1),
  version: z.string().regex(semverRegex, 'Version must be valid semver (e.g. 1.0.0)'),
  description: z.string().optional(),
  author: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),

  views: z.array(ModuleViewDeclarationSchema).optional(),

  ipcChannels: z.object({
    handle: z.array(z.string()).optional(),
    on: z.array(z.string()).optional(),
  }).optional(),

  services: z.array(ModuleServiceDeclarationSchema).optional(),

  store: z.object({
    id: z.string().min(1),
    entrypoint: z.string().min(1),
  }).optional(),

  dependencies: z.object({
    core: z.string().optional(),
    modules: z.array(z.string()).optional(),
  }).optional(),

  permissions: z.object({
    ipc: z.array(z.string()).optional(),
    filesystem: z.array(z.string()).optional(),
    network: z.boolean().optional(),
    shell: z.boolean().optional(),
  }).optional(),

  credentials: z.array(CredentialDeclarationSchema).optional(),
});

export type ValidatedManifest = z.infer<typeof ModuleManifestSchema>;
export type ValidatedCredential = z.infer<typeof CredentialDeclarationSchema>;

/**
 * Validate a manifest object. Returns the parsed manifest or throws a descriptive error.
 */
export function validateManifest(raw: unknown): ValidatedManifest {
  return ModuleManifestSchema.parse(raw);
}

/**
 * Safe validation — returns { success, data, error } instead of throwing.
 */
export function validateManifestSafe(raw: unknown): {
  success: boolean;
  data?: ValidatedManifest;
  error?: string;
} {
  const result = ModuleManifestSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}
