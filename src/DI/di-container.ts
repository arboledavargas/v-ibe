import { Constructor } from './types';
import { hasLifecycle } from './lifecycle';

/**
 * Singleton global dependency injection container
 * 
 * Uses topological sort (Kahn's algorithm) to bootstrap services in correct dependency order.
 * All services are eagerly initialized during bootstrap.
 */
export class DIContainer {
  #singletons = new Map<Constructor<any>, any>();
  #registered = new Set<Constructor<any>>();

  // Dependency graph for topological sort
  #dependencies = new Map<Constructor, Set<Constructor>>();  // What each service depends on
  #dependents = new Map<Constructor, Set<Constructor>>();    // What depends on each service

  #ready = false;

  /**
   * Register a service constructor
   */
  register(token: Constructor) {
    this.#registered.add(token);

    // Initialize dependency maps
    if (!this.#dependencies.has(token)) {
      this.#dependencies.set(token, new Set());
    }
    if (!this.#dependents.has(token)) {
      this.#dependents.set(token, new Set());
    }
  }

  /**
   * Register a dependency relationship between services
   * @param parent - The service that depends on another
   * @param dependency - The service that parent depends on
   */
  registerDependency(parent: Constructor, dependency: Constructor) {
    if (!this.#registered.has(parent)) {
      throw new Error(
        `Cannot register dependency: ${parent.name} is not registered. Use @Service decorator first.`,
      );
    }
    if (!this.#registered.has(dependency)) {
      throw new Error(
        `Cannot register dependency: ${dependency.name} is not registered. Use @Service decorator first.`,
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
   * Get bootstrap order using topological sort (Kahn's algorithm)
   * This ensures dependencies are initialized before dependents
   */
  async *#getBootstrapOrder(): AsyncGenerator<Constructor, void, unknown> {
    const inDegree = new Map<Constructor, number>();
    const queue: Constructor[] = [];

    // Initialize in-degree (count of dependencies) for each service
    for (const service of this.#registered) {
      const deps = this.#dependencies.get(service) || new Set();
      inDegree.set(service, deps.size);

      // Services with no dependencies can be initialized first
      if (deps.size === 0) {
        queue.push(service);
      }
    }

    // Process services in topological order
    while (queue.length > 0) {
      const service = queue.shift()!;
      yield service;

      // Reduce in-degree for services that depend on this one
      const dependents = this.#dependents.get(service) || new Set();
      for (const dependent of dependents) {
        const newInDegree = inDegree.get(dependent)! - 1;
        inDegree.set(dependent, newInDegree);

        // When all dependencies are satisfied, add to queue
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
      const cycleServices = remaining.map(([service]) => service.name).join(", ");
      throw new Error(
        `Circular dependency detected. Services with unresolved dependencies: ${cycleServices}`,
      );
    }
  }

  /**
   * Bootstrap all services in dependency order
   * All services are eagerly initialized during bootstrap
   * Each instance is associated with this container for property injection
   */
  async bootstrap() {
    if (this.#ready) return;

    // Initialize ALL services in topological order
    for await (const ctor of this.#getBootstrapOrder()) {
      const inst: any = new ctor();

      // Associate instance with this container for property injection
      // This allows @Inject to know which container to use
      (inst as any).__container = this;

      this.#singletons.set(ctor, inst);

      // Execute onBootstrap hook if present
      if (hasLifecycle(inst)) {
        await inst.onBootstrap();
      }
    }

    this.#ready = true;
  }

  /**
   * Get the container associated with an instance
   * Useful for property injection (fallback for @Inject)
   */
  static getContainerForInstance(instance: any): DIContainer | undefined {
    return instance.__container;
  }

  /**
   * Get a service instance
   * All services must be bootstrapped before calling get()
   */
  get<T>(ctor: Constructor<T>): T {
    if (!this.#registered.has(ctor)) {
      throw new Error(`Service not registered: ${ctor.name}`);
    }

    // All services must be in singletons after bootstrap
    if (!this.#singletons.has(ctor)) {
      throw new Error(
        `Service ${ctor.name} not found in singletons. Make sure bootstrap() has been called.`,
      );
    }

    return this.#singletons.get(ctor);
  }

  /**
   * Get all service instances
   * Useful for collecting metadata from all services after bootstrap
   */
  getAllInstances(): any[] {
    return Array.from(this.#singletons.values());
  }

  /**
   * Check if bootstrap has been called
   */
  get isReady(): boolean {
    return this.#ready;
  }

  /**
   * Dispose all services and reset container
   */
  dispose(): void {
    // Call onDestroy on services that implement it
    for (const instance of this.#singletons.values()) {
      if (typeof instance.onDestroy === 'function') {
        try {
          instance.onDestroy();
        } catch (error) {
          console.error('[DIContainer] Error en onDestroy:', error);
        }
      }
    }

    this.#singletons.clear();
    this.#registered.clear();
    this.#dependencies.clear();
    this.#dependents.clear();
    this.#ready = false;
  }
}

/**
 * Global singleton container instance
 */
export const services = new DIContainer();
