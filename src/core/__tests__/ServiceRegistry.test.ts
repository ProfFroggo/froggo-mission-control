// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * ServiceRegistry unit tests — validates lazy instantiation, singleton behavior,
 * and module disposal.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ServiceRegistry', () => {
  let ServiceRegistry: typeof import('../ServiceRegistry').ServiceRegistry;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../ServiceRegistry');
    ServiceRegistry = mod.ServiceRegistry;
  });

  it('should register and resolve a service', async () => {
    const instance = { greeting: 'hello' };
    ServiceRegistry.register({
      id: 'test-svc',
      factory: () => instance,
    });

    const result = await ServiceRegistry.get<typeof instance>('test-svc');
    expect(result).toBe(instance);
  });

  it('should cache singletons', async () => {
    let callCount = 0;
    ServiceRegistry.register({
      id: 'counter',
      factory: () => ({ count: ++callCount }),
    });

    const a = await ServiceRegistry.get('counter');
    const b = await ServiceRegistry.get('counter');
    expect(a).toBe(b);
    expect(callCount).toBe(1);
  });

  it('should NOT cache non-singletons', async () => {
    let callCount = 0;
    ServiceRegistry.register({
      id: 'transient',
      factory: () => ({ count: ++callCount }),
      singleton: false,
    });

    const a = await ServiceRegistry.get('transient');
    const b = await ServiceRegistry.get('transient');
    expect(a).not.toBe(b);
    expect(callCount).toBe(2);
  });

  it('should throw for unregistered service', async () => {
    await expect(ServiceRegistry.get('nope')).rejects.toThrow('not registered');
  });

  it('should support async factories', async () => {
    ServiceRegistry.register({
      id: 'async-svc',
      factory: async () => {
        return { data: 'loaded' };
      },
    });

    const result = await ServiceRegistry.get<{ data: string }>('async-svc');
    expect(result.data).toBe('loaded');
  });

  it('should dispose module services', async () => {
    ServiceRegistry.register({
      id: 'mod-svc',
      factory: () => ({ active: true }),
      moduleId: 'my-module',
    });

    await ServiceRegistry.get('mod-svc');
    expect(ServiceRegistry.isResolved('mod-svc')).toBe(true);

    ServiceRegistry.disposeModule('my-module');
    expect(ServiceRegistry.isResolved('mod-svc')).toBe(false);
    // Definition still exists — can be re-resolved
    expect(ServiceRegistry.has('mod-svc')).toBe(true);
  });

  it('should report registered IDs', () => {
    ServiceRegistry.register({ id: 'a', factory: () => 1 });
    ServiceRegistry.register({ id: 'b', factory: () => 2 });

    const ids = ServiceRegistry.getRegisteredIds();
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });
});
