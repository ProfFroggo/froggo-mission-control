import { describe, it, expect, beforeEach } from 'vitest';
import { ViewRegistry, type ViewRegistration } from '../ViewRegistry';

function makeView(overrides: Partial<ViewRegistration> = {}): ViewRegistration {
  const id = overrides.id ?? `view-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    label: 'Test View',
    icon: () => null,
    component: () => null,
    ...overrides,
  } as ViewRegistration;
}

describe('ViewRegistry', () => {
  beforeEach(() => {
    // Unregister everything for a clean slate
    ViewRegistry.getAll().forEach(v => ViewRegistry.unregister(v.id));
  });

  it('registers and retrieves a view', () => {
    const view = makeView({ id: 'vr-get' });
    ViewRegistry.register(view);
    expect(ViewRegistry.get('vr-get')).toBe(view);
  });

  it('has() returns true for registered views', () => {
    ViewRegistry.register(makeView({ id: 'vr-has' }));
    expect(ViewRegistry.has('vr-has')).toBe(true);
    expect(ViewRegistry.has('nope')).toBe(false);
  });

  it('overwrites on duplicate register', () => {
    ViewRegistry.register(makeView({ id: 'vr-dup', label: 'First' }));
    ViewRegistry.register(makeView({ id: 'vr-dup', label: 'Second' }));
    expect(ViewRegistry.get('vr-dup')!.label).toBe('Second');
  });

  it('getIcon and getComponent return correct values', () => {
    const icon = () => null;
    const component = () => null;
    ViewRegistry.register(makeView({ id: 'vr-ic', icon, component } as any));
    expect(ViewRegistry.getIcon('vr-ic')).toBe(icon);
    expect(ViewRegistry.getComponent('vr-ic')).toBe(component);
  });

  it('getByModule filters correctly', () => {
    ViewRegistry.register(makeView({ id: 'vr-mod-a', moduleId: 'mod-x' }));
    ViewRegistry.register(makeView({ id: 'vr-mod-b', moduleId: 'mod-y' }));
    ViewRegistry.register(makeView({ id: 'vr-core' }));
    expect(ViewRegistry.getByModule('mod-x').length).toBe(1);
    expect(ViewRegistry.getByModule('mod-x')[0].id).toBe('vr-mod-a');
  });

  it('getCoreViews returns views without moduleId', () => {
    ViewRegistry.register(makeView({ id: 'vr-core2' }));
    ViewRegistry.register(makeView({ id: 'vr-mod2', moduleId: 'some-mod' }));
    const core = ViewRegistry.getCoreViews();
    expect(core.every(v => !v.moduleId)).toBe(true);
  });

  it('getModuleViews returns views with moduleId', () => {
    ViewRegistry.register(makeView({ id: 'vr-mv', moduleId: 'mod-z' }));
    const mod = ViewRegistry.getModuleViews();
    expect(mod.every(v => !!v.moduleId)).toBe(true);
  });

  it('unregister removes a view', () => {
    ViewRegistry.register(makeView({ id: 'vr-unreg' }));
    expect(ViewRegistry.unregister('vr-unreg')).toBe(true);
    expect(ViewRegistry.has('vr-unreg')).toBe(false);
  });

  it('unregisterModule removes all views for a module', () => {
    ViewRegistry.register(makeView({ id: 'vr-um-a', moduleId: 'kill-mod' }));
    ViewRegistry.register(makeView({ id: 'vr-um-b', moduleId: 'kill-mod' }));
    ViewRegistry.register(makeView({ id: 'vr-um-c', moduleId: 'keep-mod' }));
    const removed = ViewRegistry.unregisterModule('kill-mod');
    expect(removed).toBe(2);
    expect(ViewRegistry.has('vr-um-a')).toBe(false);
    expect(ViewRegistry.has('vr-um-c')).toBe(true);
  });
});
