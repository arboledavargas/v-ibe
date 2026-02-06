import type { Constructor } from '../../DI/types';
import type { CacheProvider } from './cache-provider.interface';
import { setCacheProviderClass } from './cache-metadata';

/**
 * @Cache DECORATOR
 *
 * Define qué cache provider usar para un método.
 * El provider debe estar decorado con @Service.
 *
 * Si no se especifica @Cache, se usa MemoryCache por defecto.
 */

/**
 * @Cache - Define el provider de cache para un método
 *
 * @param ProviderClass - Clase del cache provider (debe tener @Service)
 *
 * @example
 * // Cache en LocalStorage
 * @Cache(LocalStorageCache)
 * @TTL(5000)
 * async getUserPreferences() { }
 *
 * @example
 * // Cache en SessionStorage
 * @Cache(SessionStorageCache)
 * @TTL(3000)
 * async getFilterState() { }
 */
export function Cache<T extends CacheProvider>(ProviderClass: Constructor<T>) {
  return function (target: any, context: ClassMethodDecoratorContext) {
    const metadata = context.metadata as any;
    const methodName = String(context.name);

    if (!metadata.cacheProviders) {
      metadata.cacheProviders = {};
    }
    metadata.cacheProviders[methodName] = ProviderClass;
  };
}
