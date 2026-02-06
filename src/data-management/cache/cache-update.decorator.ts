import { services } from '../../DI/di-container';
import type { CacheProvider } from './cache-provider.interface';

export type Constructor<T> = new (...args: any[]) => T;
export type TagExtractor = (result: any, args: any[]) => string[];

/**
 * @CacheUpdate Decorator
 * 
 * Actualiza las entradas del cache que coincidan con los tags extraídos del resultado
 * de un método. Útil para mantener el cache sincronizado después de operaciones de
 * actualización (PUT, PATCH, etc.).
 * 
 * Preserva el TTL original de cada entrada del cache.
 * 
 * @param ProviderClass - La clase del cache provider a usar
 * @param tagExtractor - Función que extrae tags del resultado y argumentos
 * 
 * @example
 * ```typescript
 * @CacheUpdate(
 *   LocalStorageCache,
 *   (result) => [`user:${result.id}`]
 * )
 * async updateUser(userId: string, data: any): Promise<User> {
 *   const response = await this.httpClient.put(`/users/${userId}`, data);
 *   return response.data;
 * }
 * ```
 */
export function CacheUpdate(
  ProviderClass: Constructor<CacheProvider>,
  tagExtractor: TagExtractor
) {
  return function (
    originalMethod: Function,
    context: ClassMethodDecoratorContext
  ) {
    return async function (this: any, ...args: any[]) {
      // 1. Ejecutar el método original
      const result = await originalMethod.apply(this, args);

      // 2. Obtener el provider del DI
      const provider = services.get(ProviderClass);

      if (!provider) {
        console.warn(`[CacheUpdate] Provider ${ProviderClass.name} not found in DI container`);
        return result;
      }

      // 3. Extraer los tags del resultado
      const tags = tagExtractor(result, args);

      if (!tags || tags.length === 0) {
        return result;
      }

      // 4. Actualizar todas las entradas que tengan esos tags
      provider.updateByTags(tags, result);

      return result;
    };
  };
}
