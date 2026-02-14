import { Constructor } from './types';
import { hasLifecycle } from './lifecycle';

/**
 * Hierarchical DI container that supports parent-chain resolution.
 *
 * Each component with `services: [...]` in its @Component config
 * gets a ScopedContainer. Services not found locally are resolved
 * by walking up the parent chain.
 *
 * Uses topological sort (Kahn's algorithm) to bootstrap services
 * in correct dependency order — same algorithm as DIContainer.
 */
export class ScopedContainer {
  #local = new Map<Constructor<any>, any>();
  #registered = new Set<Constructor<any>>();
  #parent?: ScopedContainer;

  // Dependency graph for topological sort
  #dependencies = new Map<Constructor, Set<Constructor>>();
  #dependents = new Map<Constructor, Set<Constructor>>();

  #ready = false;

  constructor(parent?: ScopedContainer) {
    this.#parent = parent;
  }

  /**
   * Register a service constructor in this scope
   */
  register(token: Constructor): void {
    this.#registered.add(token);

    if (!this.#dependencies.has(token)) {
      this.#dependencies.set(token, new Set());
    }
    if (!this.#dependents.has(token)) {
      this.#dependents.set(token, new Set());
    }
  }

  /**
   * Register a dependency relationship between services in this scope.
   * Only for dependencies that are BOTH registered locally.
   * Cross-scope dependencies are resolved via parent chain at get() time.
   */
  registerDependency(parent: Constructor, dependency: Constructor): void {
    if (!this.#registered.has(parent)) {
      throw new Error(
        `Cannot register dependency: ${parent.name} is not registered in this scope.`,
      );
    }
    if (!this.#registered.has(dependency)) {
      throw new Error(
        `Cannot register dependency: ${dependency.name} is not registered in this scope.`,
      );
    }

    if (!this.#dependencies.has(parent)) {
      this.#dependencies.set(parent, new Set());
    }
    this.#dependencies.get(parent)!.add(dependency);

    if (!this.#dependents.has(dependency)) {
      this.#dependents.set(dependency, new Set());
    }
    this.#dependents.get(dependency)!.add(parent);
  }

  /**
   * Get bootstrap order using topological sort (Kahn's algorithm).
   * Only considers locally registered services.
   */
  *#getBootstrapOrder(): Generator<Constructor, void, unknown> {
    const inDegree = new Map<Constructor, number>();
    const queue: Constructor[] = [];

    for (const service of this.#registered) {
      const deps = this.#dependencies.get(service) || new Set();
      inDegree.set(service, deps.size);

      if (deps.size === 0) {
        queue.push(service);
      }
    }

    while (queue.length > 0) {
      const service = queue.shift()!;
      yield service;

      const dependents = this.#dependents.get(service) || new Set();
      for (const dependent of dependents) {
        const newInDegree = inDegree.get(dependent)! - 1;
        inDegree.set(dependent, newInDegree);

        if (newInDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    // Check for circular dependencies
    const remaining = Array.from(inDegree.entries()).filter(
      ([_, degree]) => degree > 0,
    );

    if (remaining.length > 0) {
      const cycleServices = remaining.map(([service]) => service.name).join(', ');
      throw new Error(
        `Circular dependency detected in scope. Services with unresolved dependencies: ${cycleServices}`,
      );
    }
  }

  /**
   * Bootstrap all locally registered services in dependency order.
   * Each instance is associated with this container via __container.
   *
   * Services with async onBootstrap() are launched as fire-and-forget.
   * Use the reactive pattern (@Store with isLoading) to handle async state.
   */
  bootstrapSync(): void {
    if (this.#ready) return;

    for (const ctor of this.#getBootstrapOrder()) {
      const inst: any = new ctor();
      inst.__container = this;
      this.#local.set(ctor, inst);

      // Launch onBootstrap as fire-and-forget
      if (hasLifecycle(inst)) {
        inst.onBootstrap().catch((err: any) => {
          console.error(`[ScopedContainer] Error in onBootstrap for ${ctor.name}:`, err);
        });
      }
    }

    this.#ready = true;
  }

  /**
   * Bootstrap all locally registered services, awaiting async onBootstrap hooks.
   * Use this in the DOM init() path where async is available.
   */
  async bootstrap(): Promise<void> {
    if (this.#ready) return;

    for (const ctor of this.#getBootstrapOrder()) {
      const inst: any = new ctor();
      inst.__container = this;
      this.#local.set(ctor, inst);

      if (hasLifecycle(inst)) {
        await inst.onBootstrap();
      }
    }

    this.#ready = true;
  }

  /**
   * Resolve a service by walking up the parent chain.
   * Checks local scope first, then parent, then grandparent, etc.
   */
  get<T>(ctor: Constructor<T>): T {
    // Check local scope
    if (this.#local.has(ctor)) {
      return this.#local.get(ctor);
    }

    // Walk up the parent chain
    if (this.#parent) {
      return this.#parent.get(ctor);
    }

    throw new Error(
      `Service ${ctor.name} not found in any scope. ` +
      `Make sure a parent component provides it via services: [${ctor.name}].`
    );
  }

  /**
   * Check if a service exists in this scope or any parent scope.
   */
  has(ctor: Constructor): boolean {
    if (this.#local.has(ctor)) return true;
    if (this.#parent) return this.#parent.has(ctor);
    return false;
  }

  /**
   * Check if a service is registered locally (not including parents).
   */
  hasLocal(ctor: Constructor): boolean {
    return this.#local.has(ctor);
  }

  /**
   * Check if bootstrap has been called.
   */
  get isReady(): boolean {
    return this.#ready;
  }

  /**
   * Get the parent container.
   */
  get parent(): ScopedContainer | undefined {
    return this.#parent;
  }

  /**
   * Get all locally instantiated service instances.
   */
  getAllInstances(): any[] {
    return Array.from(this.#local.values());
  }

  /**
   * Dispose all local services and reset container.
   * Calls onDestroy() on services that implement it.
   */
  dispose(): void {
    for (const instance of this.#local.values()) {
      if (typeof instance.onDestroy === 'function') {
        try {
          instance.onDestroy();
        } catch (error) {
          console.error('[ScopedContainer] Error in onDestroy:', error);
        }
      }
    }

    this.#local.clear();
    this.#registered.clear();
    this.#dependencies.clear();
    this.#dependents.clear();
    this.#ready = false;
  }
}
