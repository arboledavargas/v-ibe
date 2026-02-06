import { Constructor } from '../types';
import { registerServiceMetadata, getServiceMetadata } from '../service-metadata';
import { DIContainer, services } from '../di-container';
import { DEPENDENCIES_KEY } from './service';

/**
 * Decorator to inject a service dependency from the global DI container
 * 
 * Works by creating a lazy getter that retrieves the service from the container
 * associated with the instance. The value is cached after first access.
 * 
 * @param ctor - Constructor of the service to inject
 * 
 * @example In a service
 * ```typescript
 * @Service
 * class AuthService {
 *   @Inject(HttpClient) http!: HttpClient;
 *   @Inject(ConfigService) config!: ConfigService;
 *   
 *   async login(credentials: Credentials) {
 *     const url = this.config.getApiUrl();
 *     return this.http.post(url, credentials);
 *   }
 * }
 * ```
 * 
 * @example In a component
 * ```typescript
 * @Component
 * class MyComponent extends BaseComponent {
 *   @Inject(Router) router!: Router;
 *   @Inject(AuthService) auth!: AuthService;
 *   
 *   view() {
 *     return <div>Usuario: {this.auth.currentUser}</div>;
 *   }
 * }
 * ```
 */
export function Inject(ctor: Constructor) {
  return function (_: undefined, ctx: ClassFieldDecoratorContext) {
    if (ctx.kind !== 'field') {
      throw new Error('@Inject solo puede usarse en fields');
    }

    // Track dependency in class metadata
    ctx.addInitializer(function (this: any) {
      const parentClass = this.constructor as Constructor;

      // Initialize dependencies set if it doesn't exist
      if (!(parentClass as any)[DEPENDENCIES_KEY]) {
        (parentClass as any)[DEPENDENCIES_KEY] = new Set<Constructor>();
      }

      // Add this dependency to the class's dependency set
      (parentClass as any)[DEPENDENCIES_KEY].add(ctor);

      // Update service metadata with this dependency
      // This will be used when registering services in a container
      const existingMetadata = getServiceMetadata(parentClass);
      if (existingMetadata) {
        existingMetadata.dependencies.add(ctor);
      } else {
        // If metadata doesn't exist yet, create it
        // This can happen if @Inject is used before @Service
        registerServiceMetadata(parentClass, {
          dependencies: new Set([ctor]),
        });
      }
    });

    // Property getter for lazy access (value is already initialized after bootstrap)
    // Gets container from instance association (set during bootstrap)
    ctx.addInitializer(function () {
      const privateKey = Symbol(`__injected_${String(ctx.name)}`);

      Object.defineProperty(this, ctx.name, {
        enumerable: true,
        configurable: true,
        get() {
          // Si hay un override manual (para tests), usarlo
          if ((this as any)[privateKey]) {
            return (this as any)[privateKey];
          }

          // Get container associated with this instance
          // This was set when the instance was created during bootstrap
          const container = (this as any).__container ||
                           DIContainer.getContainerForInstance(this) ||
                           services; // Fallback to global singleton

          if (!container) {
            throw new Error(
              `Service ${ctor.name} not available. Instance not associated with a container. ` +
              `Make sure bootstrap() has been called.`
            );
          }

          const inst = container.get(ctor);

          // Cache the value to avoid calling get() again
          Object.defineProperty(this, ctx.name, {
            value: inst,
            writable: true,  // ← Permitir override en tests
            configurable: true,  // ← Permitir redefinir en tests
          });
          return inst;
        },
        set(value) {
          // Permitir override en tests
          (this as any)[privateKey] = value;
        },
      });
    });
  };
}
