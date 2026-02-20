import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceRegistry } from '../ServiceRegistry';

describe('ServiceRegistry', () => {
  beforeEach(() => {
    ServiceRegistry.clear();
  });

  it('registers and resolves a service', async () => {
    ServiceRegistry.register({
      id: 'svc-a',
      factory: () => ({ value: 42 }),
    });
    const svc = await ServiceRegistry.get<{ value: number }>('svc-a');
    expect(svc.value).toBe(42);
  });

  it('caches singleton by default', async () => {
    const factory = vi.fn(() => ({ ts: Date.now() }));
    ServiceRegistry.register({ id: 'svc-single', factory });
    const a = await ServiceRegistry.get('svc-single');
    const b = await ServiceRegistry.get('svc-single');
    expect(a).toBe(b);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('does not cache when singleton=false', async () => {
    let counter = 0;
    ServiceRegistry.register({
      id: 'svc-multi',
      factory: () => ({ n: ++counter }),
      singleton: false,
    });
    const a = await ServiceRegistry.get<{ n: number }>('svc-multi');
    const b = await ServiceRegistry.get<{ n: number }>('svc-multi');
    expect(a.n).toBe(1);
    expect(b.n).toBe(2);
  });

  it('throws on unknown service', async () => {
    await expect(ServiceRegistry.get('ghost')).rejects.toThrow('not registered');
  });

  it('handles async factories', async () => {
    ServiceRegistry.register({
      id: 'svc-async',
      factory: async () => {
        await new Promise(r => setTimeout(r, 10));
        return { async: true };
      },
    });
    const svc = await ServiceRegistry.get<{ async: boolean }>('svc-async');
    expect(svc.async).toBe(true);
  });

  it('has() checks registration', () => {
    expect(ServiceRegistry.has('nope')).toBe(false);
    ServiceRegistry.register({ id: 'svc-has', factory: () => ({}) });
    expect(ServiceRegistry.has('svc-has')).toBe(true);
  });

  it('isResolved() checks instantiation', async () => {
    ServiceRegistry.register({ id: 'svc-res', factory: () => ({}) });
    expect(ServiceRegistry.isResolved('svc-res')).toBe(false);
    await ServiceRegistry.get('svc-res');
    expect(ServiceRegistry.isResolved('svc-res')).toBe(true);
  });

  it('getCached returns undefined before resolution', () => {
    ServiceRegistry.register({ id: 'svc-cache', factory: () => 'val' });
    expect(ServiceRegistry.getCached('svc-cache')).toBeUndefined();
  });

  it('getCached returns instance after resolution', async () => {
    ServiceRegistry.register({ id: 'svc-cache2', factory: () => 'val' });
    await ServiceRegistry.get('svc-cache2');
    expect(ServiceRegistry.getCached('svc-cache2')).toBe('val');
  });

  it('getByModule filters by moduleId', () => {
    ServiceRegistry.register({ id: 'svc-m1', factory: () => 1, moduleId: 'mod-a' });
    ServiceRegistry.register({ id: 'svc-m2', factory: () => 2, moduleId: 'mod-b' });
    expect(ServiceRegistry.getByModule('mod-a').length).toBe(1);
    expect(ServiceRegistry.getByModule('mod-a')[0].id).toBe('svc-m1');
  });

  it('dispose removes instance but keeps definition', async () => {
    ServiceRegistry.register({ id: 'svc-disp', factory: () => 'x' });
    await ServiceRegistry.get('svc-disp');
    ServiceRegistry.dispose('svc-disp');
    expect(ServiceRegistry.isResolved('svc-disp')).toBe(false);
    expect(ServiceRegistry.has('svc-disp')).toBe(true);
  });

  it('disposeModule clears all instances for a module', async () => {
    ServiceRegistry.register({ id: 'dm-1', factory: () => 1, moduleId: 'mod-kill' });
    ServiceRegistry.register({ id: 'dm-2', factory: () => 2, moduleId: 'mod-kill' });
    await ServiceRegistry.get('dm-1');
    await ServiceRegistry.get('dm-2');
    ServiceRegistry.disposeModule('mod-kill');
    expect(ServiceRegistry.isResolved('dm-1')).toBe(false);
    expect(ServiceRegistry.isResolved('dm-2')).toBe(false);
  });

  it('getRegisteredIds lists all service IDs', () => {
    ServiceRegistry.register({ id: 'ids-a', factory: () => {} });
    ServiceRegistry.register({ id: 'ids-b', factory: () => {} });
    const ids = ServiceRegistry.getRegisteredIds();
    expect(ids).toContain('ids-a');
    expect(ids).toContain('ids-b');
  });
});
