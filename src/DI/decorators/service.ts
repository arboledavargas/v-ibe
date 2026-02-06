import { Constructor } from '../types';
import { registerServiceMetadata, getServiceMetadata } from '../service-metadata';

// Symbol for storing dependencies in class metadata
const DEPENDENCIES_KEY = Symbol('dependencies');

/**
 * Decorator to mark a class as a Service
 * Only stores metadata - actual registration happens when container is created
 * All services are bootstrapped eagerly during container bootstrap
 * 
 * @example
 * ```typescript
 * @Service
 * class AuthService {
 *   @Inject(HttpClient) http!: HttpClient;
 *   
 *   async login(credentials: Credentials) {
 *     return this.http.post('/auth/login', credentials);
 *   }
 * }
 * ```
 */
export function Service<T extends Constructor>(ctor: T): T {
  // Collect dependencies that were marked with @Inject
  const dependencies = (ctor as any)[DEPENDENCIES_KEY] as Set<Constructor> | undefined;

  // Store metadata instead of registering directly
  registerServiceMetadata(ctor, {
    dependencies: dependencies || new Set(),
  });

  return ctor;
}

/**
 * Export the dependencies key for use by @Inject decorator
 */
export { DEPENDENCIES_KEY };
