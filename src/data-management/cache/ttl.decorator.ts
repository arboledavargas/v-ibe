import { services } from '../../DI/di-container';
import { MemoryCache } from './memory-cache';
import { getCacheMetadata } from './cache-metadata';

/**
 * @TTL DECORATOR - Time-To-Live Cache
 *
 * Cachea el resultado de un método durante un tiempo especificado.
 *
 * Funciona con el DI system para obtener el cache provider.
 * Por defecto usa MemoryCache si no se especifica @Cache.
 */

/**
 * Genera una cache key automáticamente.
 *
 * Formato: `ClassName:methodName` o `ClassName:methodName:args`
 *
 * @param instance - Instancia del servicio/clase
 * @param methodName - Nombre del método
 * @param args - Argumentos del método
 * @returns Cache key generada
 *
 * @example
 * generateCacheKey(apiService, 'getProfile', [])
 * → "ApiService:getProfile"
 *
 * @example
 * generateCacheKey(apiService, 'getUserById', ['123'])
 * → "ApiService:getUserById:["123"]"
 */
function generateCacheKey(
  instance: any,
  methodName: string,
  args: any[]
): string {
  const className = instance.constructor.name;

  // Si no hay argumentos, key simple
  if (args.length === 0) {
    return `${className}:${methodName}`;
  }

  // Si hay argumentos, serializarlos
  const argsKey = JSON.stringify(args);
  return `${className}:${methodName}:${argsKey}`;
}

/**
 * @TTL - Decorador para cachear resultados de métodos con time-to-live.
 *
 * IMPORTANTE: El método debe ser async o retornar una Promise.
 *
 * @param ttl - Time-to-live en milisegundos
 *
 * @example
 * // Cache en memoria (default) por 5 segundos
 * @TTL(5000)
 * async getStores() {
 *   return await fetch('/api/stores').then(r => r.json());
 * }
 *
 * @example
 * // Cache en localStorage por 1 hora
 * @Cache(LocalStorageCache)
 * @TTL(3600000)
 * async getUserPreferences() {
 *   return await fetch('/api/preferences').then(r => r.json());
 * }
 *
 * @example
 * // Cache con argumentos
 * @Cache(LocalStorageCache)
 * @TTL(5000)
 * async getUserById(id: string) {
 *   return await fetch(`/api/users/${id}`).then(r => r.json());
 * }
 */
export function TTL(ttl: number) {
  return function (
    originalMethod: Function,
    context: ClassMethodDecoratorContext
  ) {
    const methodName = String(context.name);

    const wrappedMethod = async function (this: any, ...args: any[]) {
      const className = this.constructor.name;

      // Obtener provider y tag extractor desde metadata usando el nombre del método
      const metadata = context.metadata as any;
      const ProviderClass = metadata.cacheProviders?.[methodName] || MemoryCache;
      const tagExtractor = metadata.cacheTagExtractors?.[methodName];

      // 2. Obtener instancia del DI container (singleton)
      const provider = services.get(ProviderClass);

      // 3. Generar cache key
      const cacheKey = generateCacheKey(this, methodName, args);

      // 4. Intentar obtener del cache
      const cached = provider.get(cacheKey);

      if (cached !== null) {
        return cached;
      }

      // 5. Cache miss → ejecutar método original
      const result = await originalMethod.apply(this, args);

      // 6. Extraer tags si hay @CacheTags
      const tags = tagExtractor ? tagExtractor(result, args) : [];

      // 7. Guardar en cache con tags
      provider.set(cacheKey, result, ttl, tags);

      return result;
    };

    return wrappedMethod;
  };
}
