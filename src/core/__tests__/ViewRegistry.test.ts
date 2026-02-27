/**
 * ViewRegistry unit tests — validates registration, module filtering,
 * and unregistration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ViewRegistry', () => {
  let ViewRegistry: typeof import('../ViewRegistry').ViewRegistry;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../ViewRegistry');
    ViewRegistry = mod.ViewRegistry;
  });

  const DummyIcon = () => null;
  const DummyComponent = () => null;

  it('should register and retrieve a view', () => {
    ViewRegistry.register({
      id: 'test-view',
      label: 'Test',
      icon: DummyIcon,
      component: DummyComponent,
    });

    expect(ViewRegistry.has('test-view')).toBe(true);
    expect(ViewRegistry.get('test-view')?.label).toBe('Test');
  });

  it('should return all views', () => {
    ViewRegistry.register({ id: 'v1', label: 'V1', icon: DummyIcon, component: DummyComponent });
    ViewRegistry.register({ id: 'v2', label: 'V2', icon: DummyIcon, component: DummyComponent });

    expect(ViewRegistry.getAll()).toHaveLength(2);
  });

  it('should overwrite on duplicate ID', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ViewRegistry.register({ id: 'dup', label: 'First', icon: DummyIcon, component: DummyComponent });
    ViewRegistry.register({ id: 'dup', label: 'Second', icon: DummyIcon, component: DummyComponent });

    expect(ViewRegistry.get('dup')?.label).toBe('Second');
    expect(ViewRegistry.getAll()).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('dup');
    warnSpy.mockRestore();
  });

  it('should include both moduleIds in the duplicate warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ViewRegistry.register({ id: 'dup2', label: 'First', icon: DummyIcon, component: DummyComponent, moduleId: 'module-a' });
    ViewRegistry.register({ id: 'dup2', label: 'Second', icon: DummyIcon, component: DummyComponent, moduleId: 'module-b' });

    expect(warnSpy).toHaveBeenCalledOnce();
    const warnMsg = warnSpy.mock.calls[0][0];
    expect(warnMsg).toContain('module-a');
    expect(warnMsg).toContain('module-b');
    warnSpy.mockRestore();
  });

  it('should filter by module', () => {
    ViewRegistry.register({ id: 'core', label: 'Core', icon: DummyIcon, component: DummyComponent });
    ViewRegistry.register({ id: 'mod1', label: 'Mod1', icon: DummyIcon, component: DummyComponent, moduleId: 'my-mod' });
    ViewRegistry.register({ id: 'mod2', label: 'Mod2', icon: DummyIcon, component: DummyComponent, moduleId: 'my-mod' });

    expect(ViewRegistry.getCoreViews()).toHaveLength(1);
    expect(ViewRegistry.getModuleViews()).toHaveLength(2);
    expect(ViewRegistry.getByModule('my-mod')).toHaveLength(2);
  });

  it('should unregister a single view', () => {
    ViewRegistry.register({ id: 'bye', label: 'Bye', icon: DummyIcon, component: DummyComponent });
    expect(ViewRegistry.unregister('bye')).toBe(true);
    expect(ViewRegistry.has('bye')).toBe(false);
  });

  it('should unregister all views for a module', () => {
    ViewRegistry.register({ id: 'a', label: 'A', icon: DummyIcon, component: DummyComponent, moduleId: 'mod-x' });
    ViewRegistry.register({ id: 'b', label: 'B', icon: DummyIcon, component: DummyComponent, moduleId: 'mod-x' });
    ViewRegistry.register({ id: 'c', label: 'C', icon: DummyIcon, component: DummyComponent, moduleId: 'mod-y' });

    const removed = ViewRegistry.unregisterModule('mod-x');
    expect(removed).toBe(2);
    expect(ViewRegistry.getAll()).toHaveLength(1);
    expect(ViewRegistry.get('c')?.moduleId).toBe('mod-y');
  });

  it('should provide icon and component accessors', () => {
    ViewRegistry.register({ id: 'acc', label: 'Acc', icon: DummyIcon, component: DummyComponent });
    expect(ViewRegistry.getIcon('acc')).toBe(DummyIcon);
    expect(ViewRegistry.getComponent('acc')).toBe(DummyComponent);
  });
});
