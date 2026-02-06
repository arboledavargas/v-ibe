import { services } from './di-container';
import { getAllServiceMetadata } from './service-metadata';

/**
 * Bootstrap function to register all services marked with @Service decorator
 * and initialize them in topological order.
 * 
 * This should be called once at application startup, before rendering components.
 * 
 * @example
 * ```typescript
 * import { bootstrap } from './framework';
 * 
 * // Register all services and bootstrap
 * await bootstrap();
 * 
 * // Now render your app
 * document.getElementById('root')!.innerHTML = '<my-app></my-app>';
 * ```
 */
export async function bootstrap(): Promise<void> {
  const metadata = getAllServiceMetadata();

  // Register all services in the container
  for (const [ctor, meta] of metadata) {
    services.register(ctor);
  }

  // Register all dependencies
  for (const [ctor, meta] of metadata) {
    for (const dep of meta.dependencies) {
      services.registerDependency(ctor, dep);
    }
  }

  // Bootstrap all services (eager initialization in topological order)
  await services.bootstrap();
}
