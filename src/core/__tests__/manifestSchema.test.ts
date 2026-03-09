// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { describe, it, expect } from 'vitest';
import { validateManifest, validateManifestSafe } from '../manifestSchema';

const validManifest = {
  id: 'test-module',
  name: 'Test Module',
  version: '1.0.0',
};

describe('manifestSchema', () => {
  describe('validateManifest', () => {
    it('accepts a minimal valid manifest', () => {
      const result = validateManifest(validManifest);
      expect(result.id).toBe('test-module');
    });

    it('accepts a full manifest', () => {
      const full = {
        ...validManifest,
        description: 'A test',
        author: 'Test Author',
        icon: 'Zap',
        category: 'testing',
        views: [{ id: 'v1', label: 'View 1', icon: 'Eye', entrypoint: './View.tsx' }],
        services: [{ id: 's1', entrypoint: './svc.ts', electron: true }],
        ipcChannels: { handle: ['chan:a'], on: ['chan:b'] },
        store: { id: 'store1', entrypoint: './store.ts' },
        dependencies: { core: '>=1.0.0', modules: ['other-mod'] },
        permissions: { ipc: ['*'], filesystem: ['/tmp'], network: true, shell: false },
      };
      expect(() => validateManifest(full)).not.toThrow();
    });

    it('rejects missing id', () => {
      expect(() => validateManifest({ name: 'X', version: '1.0.0' })).toThrow();
    });

    it('rejects empty id', () => {
      expect(() => validateManifest({ id: '', name: 'X', version: '1.0.0' })).toThrow();
    });

    it('rejects uppercase in id', () => {
      expect(() => validateManifest({ id: 'Bad-Id', name: 'X', version: '1.0.0' })).toThrow();
    });

    it('rejects invalid semver', () => {
      expect(() => validateManifest({ id: 'x', name: 'X', version: 'latest' })).toThrow();
    });

    it('accepts semver with prerelease', () => {
      expect(() => validateManifest({ id: 'x', name: 'X', version: '1.0.0-beta.1' })).not.toThrow();
    });

    it('rejects missing name', () => {
      expect(() => validateManifest({ id: 'x', version: '1.0.0' })).toThrow();
    });

    it('rejects view with missing entrypoint', () => {
      expect(() => validateManifest({
        ...validManifest,
        views: [{ id: 'v', label: 'V', icon: 'X' }], // missing entrypoint
      })).toThrow();
    });

    it('accepts manifest with credentials array', () => {
      expect(() => validateManifest({
        ...validManifest,
        credentials: [{ id: 'api_key', label: 'API Key', type: 'api_key', required: true }],
      })).not.toThrow();
    });

    it('accepts manifest with empty credentials array', () => {
      expect(() => validateManifest({
        ...validManifest,
        credentials: [],
      })).not.toThrow();
    });

    it('rejects credential with missing type', () => {
      expect(() => validateManifest({
        ...validManifest,
        credentials: [{ id: 'key', label: 'Key' }], // missing type
      })).toThrow();
    });

    it('rejects credential with invalid type', () => {
      expect(() => validateManifest({
        ...validManifest,
        credentials: [{ id: 'key', label: 'Key', type: 'invalid' }],
      })).toThrow();
    });

    it('defaults credential required to false', () => {
      const result = validateManifest({
        ...validManifest,
        credentials: [{ id: 'key', label: 'Key', type: 'api_key' }],
      });
      expect(result.credentials?.[0].required).toBe(false);
    });
  });

  describe('validateManifestSafe', () => {
    it('returns success for valid manifest', () => {
      const result = validateManifestSafe(validManifest);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('returns error string for invalid manifest', () => {
      const result = validateManifestSafe({ id: 'BAD', version: 'nope' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });
});
