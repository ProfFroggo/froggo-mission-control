import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need fresh instances per test, so we re-import the class
// But the module exports singletons, so we'll test the class behavior
// by clearing state between tests.

// For testing, we'll import and reset the singleton
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../ModuleLoader';
import { ServiceRegistry } from '../ServiceRegistry';

function makeManifest(overrides: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id: `test-module-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Module',
    version: '1.0.0',
    ...overrides,
  };
}

function makeLifecycle(overrides: Partial<ModuleLifecycle> = {}): ModuleLifecycle {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn().mockResolvedValue(undefined),
    deactivate: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  };
}

describe('ModuleLoader', () => {
  beforeEach(() => {
    // Reset loader to fresh state (clears modules + initialized flag)
    (ModuleLoader as any)._reset();
    ServiceRegistry.clear();
  });

  describe('register', () => {
    it('registers a valid module', () => {
      const manifest = makeManifest({ id: 'reg-test' });
      const lifecycle = makeLifecycle();
      ModuleLoader.register(manifest, lifecycle);
      expect(ModuleLoader.get('reg-test')).toBeDefined();
      expect(ModuleLoader.get('reg-test')!.status).toBe('registered');
    });

    it('rejects duplicate module IDs', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manifest = makeManifest({ id: 'dup-test' });
      ModuleLoader.register(manifest, makeLifecycle());
      ModuleLoader.register(manifest, makeLifecycle());
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
      warnSpy.mockRestore();
    });

    it('rejects invalid manifest (bad version)', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const manifest = makeManifest({ id: 'bad-ver', version: 'not-semver' });
      ModuleLoader.register(manifest, makeLifecycle());
      expect(ModuleLoader.get('bad-ver')).toBeUndefined();
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid manifest'));
      errSpy.mockRestore();
    });

    it('rejects manifest with empty id', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const manifest = makeManifest({ id: '' });
      ModuleLoader.register(manifest, makeLifecycle());
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it('rejects manifest with uppercase in id', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const manifest = makeManifest({ id: 'Bad-Module' });
      ModuleLoader.register(manifest, makeLifecycle());
      expect(ModuleLoader.get('Bad-Module')).toBeUndefined();
      errSpy.mockRestore();
    });
  });

  describe('initAll', () => {
    it('initializes all registered modules', async () => {
      const lifecycle = makeLifecycle();
      ModuleLoader.register(makeManifest({ id: 'init-a' }), lifecycle);
      await ModuleLoader.initAll();
      expect(lifecycle.init).toHaveBeenCalled();
      expect(ModuleLoader.get('init-a')!.status).toBe('active');
    });

    it('catches init errors without crashing', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const lifecycle = makeLifecycle({
        init: vi.fn().mockRejectedValue(new Error('boom')),
      });
      ModuleLoader.register(makeManifest({ id: 'fail-init' }), lifecycle);
      await ModuleLoader.initAll();
      expect(ModuleLoader.get('fail-init')!.status).toBe('error');
      expect(ModuleLoader.get('fail-init')!.error).toBe('boom');
      errSpy.mockRestore();
    });

    it('respects dependency order', async () => {
      const order: string[] = [];
      const makeTracked = (id: string) => makeLifecycle({
        init: vi.fn().mockImplementation(async () => { order.push(id); }),
      });

      ModuleLoader.register(
        makeManifest({ id: 'dep-child', dependencies: { modules: ['dep-parent'] } }),
        makeTracked('dep-child'),
      );
      ModuleLoader.register(
        makeManifest({ id: 'dep-parent' }),
        makeTracked('dep-parent'),
      );

      await ModuleLoader.initAll();
      expect(order.indexOf('dep-parent')).toBeLessThan(order.indexOf('dep-child'));
    });
  });

  describe('activate / deactivate', () => {
    it('calls activate on active module', async () => {
      const lifecycle = makeLifecycle();
      ModuleLoader.register(makeManifest({ id: 'act-test' }), lifecycle);
      await ModuleLoader.initAll();
      await ModuleLoader.activate('act-test');
      expect(lifecycle.activate).toHaveBeenCalled();
    });

    it('calls deactivate on active module', async () => {
      const lifecycle = makeLifecycle();
      ModuleLoader.register(makeManifest({ id: 'deact-test' }), lifecycle);
      await ModuleLoader.initAll();
      ModuleLoader.deactivate('deact-test');
      expect(lifecycle.deactivate).toHaveBeenCalled();
    });

    it('does not crash on non-existent module', async () => {
      await expect(ModuleLoader.activate('ghost')).resolves.toBeUndefined();
      expect(() => ModuleLoader.deactivate('ghost')).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('disposes module and cleans up services', async () => {
      const lifecycle = makeLifecycle();
      ModuleLoader.register(makeManifest({ id: 'disp-test' }), lifecycle);
      await ModuleLoader.initAll();
      ModuleLoader.dispose('disp-test');
      expect(lifecycle.dispose).toHaveBeenCalled();
      expect(ModuleLoader.get('disp-test')!.status).toBe('disposed');
    });
  });

  describe('query helpers', () => {
    it('getAll returns all modules', () => {
      ModuleLoader.register(makeManifest({ id: 'q-a' }), makeLifecycle());
      ModuleLoader.register(makeManifest({ id: 'q-b' }), makeLifecycle());
      expect(ModuleLoader.getAll().length).toBeGreaterThanOrEqual(2);
    });

    it('getActive returns only active modules', async () => {
      ModuleLoader.register(makeManifest({ id: 'active-q' }), makeLifecycle());
      expect(ModuleLoader.getActive().find(m => m.manifest.id === 'active-q')).toBeUndefined();
      await ModuleLoader.initAll();
      expect(ModuleLoader.getActive().find(m => m.manifest.id === 'active-q')).toBeDefined();
    });

    it('getErrored returns errored modules', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      ModuleLoader.register(
        makeManifest({ id: 'err-q' }),
        makeLifecycle({ init: vi.fn().mockRejectedValue(new Error('fail')) }),
      );
      await ModuleLoader.initAll();
      expect(ModuleLoader.getErrored().find(m => m.manifest.id === 'err-q')).toBeDefined();
      vi.restoreAllMocks();
    });
  });
});
