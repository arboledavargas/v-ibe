import { Constructor } from '../types';
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

    // Track dependency in decorator metadata (runs at CLASS DEFINITION time).
    // ctx.metadata is shared across all decorators of the same class.
    // Field decorators run BEFORE the class decorator (@Service),
    // so dependencies will be available when @Service reads them.
    if (!(ctx.metadata as any)[DEPENDENCIES_KEY]) {
      (ctx.metadata as any)[DEPENDENCIES_KEY] = new Set<Constructor>();
    }
    ((ctx.metadata as any)[DEPENDENCIES_KEY] as Set<Constructor>).add(ctor);

    // Property getter for lazy access (runs at INSTANCE creation time)
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
          // Set during bootstrap (for services) or by BaseComponent (for components)
          const container = (this as any).__container;

          if (!container) {
            throw new Error(
              `@Inject(${ctor.name}): No container found on ${this.constructor?.name || 'unknown'}. ` +
              `Ensure this instance is within a component tree that provides ${ctor.name}.`
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
