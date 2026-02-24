/**
 * Marketplace Schema
 *
 * Zod validation schemas for froggo.pro registry data.
 * Used by marketplace-handlers.ts to validate incoming JSON before storing.
 */

import { z } from 'zod';

const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

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
});

export const ModuleRegistrySchema = z.object({
  version: z.number().int(),
  modules: z.array(RegistryEntrySchema),
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type ModuleRegistry = z.infer<typeof ModuleRegistrySchema>;
