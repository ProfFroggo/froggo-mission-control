// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Manifest validation tests — ensures all extracted module manifests are valid.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Simple manifest validator (mirrors marketplace schema)
function validateManifest(manifest: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!manifest.id || typeof manifest.id !== 'string') errors.push('Missing id');
  if (!manifest.name || typeof manifest.name !== 'string') errors.push('Missing name');
  if (!manifest.version || typeof manifest.version !== 'string') errors.push('Missing version');
  if (typeof manifest.id === 'string' && !/^[a-z0-9-]+$/.test(manifest.id)) {
    errors.push('ID must be lowercase alphanumeric with hyphens');
  }
  if (typeof manifest.version === 'string' && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('Version must follow semver');
  }
  if (manifest.views && !Array.isArray(manifest.views)) {
    errors.push('views must be an array');
  }
  return errors;
}

const MODULES_DIR = path.resolve(__dirname, '../../modules');

describe('Module Manifest Validation', () => {
  const moduleDirs = fs.existsSync(MODULES_DIR)
    ? fs.readdirSync(MODULES_DIR).filter(d =>
        fs.statSync(path.join(MODULES_DIR, d)).isDirectory() &&
        fs.existsSync(path.join(MODULES_DIR, d, 'module.json'))
      )
    : [];

  it('should have at least 3 extracted modules', () => {
    expect(moduleDirs.length).toBeGreaterThanOrEqual(3);
  });

  for (const dir of moduleDirs) {
    describe(`Module: ${dir}`, () => {
      const manifestPath = path.join(MODULES_DIR, dir, 'module.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      it('should have a valid manifest', () => {
        const errors = validateManifest(manifest);
        expect(errors).toEqual([]);
      });

      it('should have an index.ts entry point', () => {
        const hasTs = fs.existsSync(path.join(MODULES_DIR, dir, 'index.ts'));
        const hasTsx = fs.existsSync(path.join(MODULES_DIR, dir, 'index.tsx'));
        expect(hasTs || hasTsx).toBe(true);
      });

      it('should declare at least one view', () => {
        expect(manifest.views?.length).toBeGreaterThanOrEqual(1);
      });

      it('should have valid view declarations', () => {
        for (const view of manifest.views || []) {
          expect(view.id).toBeTruthy();
          expect(view.label).toBeTruthy();
        }
      });

      it('should declare permissions', () => {
        expect(manifest.permissions).toBeDefined();
      });
    });
  }
});
