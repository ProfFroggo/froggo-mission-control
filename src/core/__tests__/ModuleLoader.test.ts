/**
 * ModuleLoader unit tests — validates module lifecycle, dependency ordering,
 * and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ViewRegistry before importing ModuleLoader
vi.mock('../ViewRegistry', () => ({
  ViewRegistry: {
    register: vi.fn(),
    unregisterModule: vi.fn(),
    getAll: vi.fn(() => []),
  },
}));

// We need to re-create the ModuleLoader for each test since it's a singleton
// So we test the class behavior through the module

describe('ModuleLoader', () => {
  let ModuleLoader: typeof import('../ModuleLoader').ModuleLoader;

  beforeEach(async () => {
    // Reset module cache to get fresh singleton
    vi.resetModules();
    const mod = await import('../ModuleLoader');
    ModuleLoader = mod.ModuleLoader;
  });

  it('should register a module', () => {
    const manifest = {
      id: 'test-module',
      name: 'Test Module',
      version: '1.0.0',
    };
    const lifecycle = { init: vi.fn().mockResolvedValue(undefined) };

    ModuleLoader.register(manifest, lifecycle);
    expect(ModuleLoader.get('test-module')).toBeDefined();
    expect(ModuleLoader.get('test-module')?.status).toBe('registered');
  });

  it('should reject invalid manifest (missing fields)', () => {
    const manifest = { id: '', name: '', version: '' };
    const lifecycle = { init: vi.fn() };

    ModuleLoader.register(manifest as any, lifecycle);
    expect(ModuleLoader.get('')).toBeUndefined();
  });

  it('should initialize all modules', async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    ModuleLoader.register(
      { id: 'mod-a', name: 'A', version: '1.0.0' },
      { init: initFn },
    );

    await ModuleLoader.initAll();
    expect(initFn).toHaveBeenCalledOnce();
    expect(ModuleLoader.get('mod-a')?.status).toBe('active');
    expect(ModuleLoader.isInitialized()).toBe(true);
  });

  it('should handle init failures gracefully', async () => {
    const failingInit = vi.fn().mockRejectedValue(new Error('boom'));
    ModuleLoader.register(
      { id: 'bad-mod', name: 'Bad', version: '1.0.0' },
      { init: failingInit },
    );

    await ModuleLoader.initAll(); // Should not throw
    expect(ModuleLoader.get('bad-mod')?.status).toBe('error');
    expect(ModuleLoader.get('bad-mod')?.error).toBe('boom');
    expect(ModuleLoader.getErrored()).toHaveLength(1);
  });

  it('should resolve dependencies in correct order', async () => {
    const order: string[] = [];

    ModuleLoader.register(
      { id: 'child', name: 'Child', version: '1.0.0', dependencies: { modules: ['parent'] } },
      { init: async () => { order.push('child'); } },
    );
    ModuleLoader.register(
      { id: 'parent', name: 'Parent', version: '1.0.0' },
      { init: async () => { order.push('parent'); } },
    );

    await ModuleLoader.initAll();
    expect(order).toEqual(['parent', 'child']);
  });

  it('should not double-initialize', async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    ModuleLoader.register(
      { id: 'once', name: 'Once', version: '1.0.0' },
      { init: initFn },
    );

    await ModuleLoader.initAll();
    await ModuleLoader.initAll(); // second call
    expect(initFn).toHaveBeenCalledOnce();
  });

  it('should detect circular dependencies', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    ModuleLoader.register(
      { id: 'a', name: 'A', version: '1.0.0', dependencies: { modules: ['b'] } },
      { init: vi.fn().mockResolvedValue(undefined) },
    );
    ModuleLoader.register(
      { id: 'b', name: 'B', version: '1.0.0', dependencies: { modules: ['a'] } },
      { init: vi.fn().mockResolvedValue(undefined) },
    );

    await ModuleLoader.initAll(); // Should not hang
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should dispose modules', async () => {
    const disposeFn = vi.fn();
    ModuleLoader.register(
      { id: 'disposable', name: 'D', version: '1.0.0' },
      { init: vi.fn().mockResolvedValue(undefined), dispose: disposeFn },
    );

    await ModuleLoader.initAll();
    ModuleLoader.dispose('disposable');
    expect(disposeFn).toHaveBeenCalledOnce();
    expect(ModuleLoader.get('disposable')?.status).toBe('disposed');
  });
});
