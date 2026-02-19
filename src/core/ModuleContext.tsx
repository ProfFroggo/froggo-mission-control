/**
 * ModuleContext — React context providing module APIs to components.
 *
 * Wrap module views in <ModuleProvider> to give them access to
 * the ModuleLoader and ServiceRegistry via hooks.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { ModuleLoader, type ModuleRegistration } from './ModuleLoader';
import { ServiceRegistry } from './ServiceRegistry';

interface ModuleContextValue {
  /** Current module ID (if rendered inside a module) */
  moduleId: string | null;
  /** Get the current module's registration */
  getModule: () => ModuleRegistration | undefined;
  /** Resolve a service by ID */
  getService: <T>(id: string) => Promise<T>;
  /** Check if a service exists */
  hasService: (id: string) => boolean;
  /** Get all active modules */
  getActiveModules: () => ModuleRegistration[];
}

const ModuleCtx = createContext<ModuleContextValue>({
  moduleId: null,
  getModule: () => undefined,
  getService: async () => { throw new Error('ModuleContext not provided'); },
  hasService: () => false,
  getActiveModules: () => [],
});

interface ModuleProviderProps {
  moduleId: string | null;
  children: ReactNode;
}

export function ModuleProvider({ moduleId, children }: ModuleProviderProps) {
  const value: ModuleContextValue = {
    moduleId,
    getModule: () => moduleId ? ModuleLoader.get(moduleId) : undefined,
    getService: <T,>(id: string) => ServiceRegistry.get<T>(id),
    hasService: (id: string) => ServiceRegistry.has(id),
    getActiveModules: () => ModuleLoader.getActive(),
  };

  return <ModuleCtx.Provider value={value}>{children}</ModuleCtx.Provider>;
}

/** Access module context from any component inside a ModuleProvider */
export function useModule(): ModuleContextValue {
  return useContext(ModuleCtx);
}

/** Get the current module ID (null if in core) */
export function useModuleId(): string | null {
  return useContext(ModuleCtx).moduleId;
}

/**
 * Convenience hook: resolve a service by ID.
 * Returns [service, loading, error] tuple.
 */
export function useService<T>(serviceId: string): {
  service: T | null;
  loading: boolean;
  error: string | null;
} {
  const { getService } = useModule();
  const [state, setState] = __react_useState<{
    service: T | null;
    loading: boolean;
    error: string | null;
  }>({ service: null, loading: true, error: null });

  __react_useEffect(() => {
    let cancelled = false;
    getService<T>(serviceId)
      .then(svc => {
        if (!cancelled) setState({ service: svc, loading: false, error: null });
      })
      .catch(err => {
        if (!cancelled) setState({ service: null, loading: false, error: err.message });
      });
    return () => { cancelled = true; };
  }, [serviceId]);

  return state;
}

// Re-export React hooks to avoid import issues in this file
import { useState as __react_useState, useEffect as __react_useEffect } from 'react';
