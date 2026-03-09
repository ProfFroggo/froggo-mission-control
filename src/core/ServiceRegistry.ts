// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * ServiceRegistry — dependency injection for headless services.
 *
 * Modules register services (singletons by default) that other modules
 * or core code can resolve by ID. Factory functions are lazy — the
 * service instance is created on first `get()` call.
 */

export interface ServiceDefinition<T = unknown> {
  /** Unique service identifier */
  id: string;
  /** Factory that produces the service instance */
  factory: () => T | Promise<T>;
  /** If true (default), instance is cached after first creation */
  singleton?: boolean;
  /** Optional module that owns this service */
  moduleId?: string;
}

class ServiceRegistryClass {
  private definitions = new Map<string, ServiceDefinition>();
  private instances = new Map<string, unknown>();

  /**
   * Register a service definition.
   * The factory is NOT called until someone requests the service via get().
   */
  register<T>(def: ServiceDefinition<T>): void {
    if (this.definitions.has(def.id)) {
      // Already registered (e.g. React StrictMode double-invoke) — skip silently
      return;
    }
    this.definitions.set(def.id, def as ServiceDefinition);
  }

  /**
   * Resolve a service by ID. Creates the instance on first call (lazy).
   * Throws if the service is not registered.
   */
  async get<T>(id: string): Promise<T> {
    // Return cached singleton
    if (this.instances.has(id)) {
      return this.instances.get(id) as T;
    }

    const def = this.definitions.get(id);
    if (!def) {
      throw new Error(`[ServiceRegistry] Service "${id}" not registered`);
    }

    const instance = await def.factory();
    if (def.singleton !== false) {
      this.instances.set(id, instance);
    }
    return instance as T;
  }

  /**
   * Synchronous get — only works if the service was already resolved.
   * Returns undefined if not yet instantiated.
   */
  getCached<T>(id: string): T | undefined {
    return this.instances.get(id) as T | undefined;
  }

  /** Check if a service is registered (not necessarily instantiated) */
  has(id: string): boolean {
    return this.definitions.has(id);
  }

  /** Check if a service instance exists (already resolved) */
  isResolved(id: string): boolean {
    return this.instances.has(id);
  }

  /** Get all registered service IDs */
  getRegisteredIds(): string[] {
    return Array.from(this.definitions.keys());
  }

  /** Get services owned by a specific module */
  getByModule(moduleId: string): ServiceDefinition[] {
    const result: ServiceDefinition[] = [];
    this.definitions.forEach(d => {
      if (d.moduleId === moduleId) result.push(d);
    });
    return result;
  }

  /**
   * Dispose a service (remove instance, keep definition).
   * Useful when unloading a module.
   */
  dispose(id: string): void {
    this.instances.delete(id);
  }

  /** Dispose all services owned by a module */
  disposeModule(moduleId: string): void {
    this.definitions.forEach(def => {
      if (def.moduleId === moduleId) {
        this.instances.delete(def.id);
      }
    });
  }

  /** Clear everything (testing only) */
  clear(): void {
    this.definitions.clear();
    this.instances.clear();
  }
}

/** Singleton registry */
export const ServiceRegistry = new ServiceRegistryClass();
