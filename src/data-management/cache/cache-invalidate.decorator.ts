import { services } from '../../DI/di-container';
import type { CacheProvider } from './cache-provider.interface';

export type Constructor<T> = new (...args: any[]) => T;
export type TagExtractor = (result: any, args: any[]) => string[];

/**
 * @CacheInvalidate Decorator
 * 
 * Invalida (elimina) las entradas del cache que coincidan con los tags extraídos del
 * resultado de un método. Útil para limpiar el cache después de operaciones de
 * escritura que afectan a múltiples entradas relacionadas.
 * 
 * @param ProviderClass - La clase del cache provider a usar
 * @param tagExtractor - Función que extrae tags del resultado y argumentos
 * 
 * @example
 * ```typescript
 * @CacheInvalidate(
 *   LocalStorageCache,
 *   (result) => ['users-list', `org:${result.organizationId}`]
 * )
 * async deleteUser(userId: string): Promise<void> {
 *   await this.httpClient.delete(`/users/${userId}`);
 * }
 * ```
 * 
 * @example Combinar con @CacheUpdate
 * ```typescript
 * @CacheUpdate(LocalStorageCache, (result) => [`user:${result.id}`])
 * @CacheInvalidate(LocalStorageCache, (result) => ['users-list', `org:${result.organizationId}`])
 * async updateUser(id: string, data: any): Promise<User> {
 *   const response = await this.httpClient.put(`/users/${id}`, data);
 *   return response.data;
 * }
 * ```
 */
export function CacheInvalidate(
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
        console.warn(`[CacheInvalidate] Provider ${ProviderClass.name} not found in DI container`);
        return result;
      }

      // 3. Extraer los tags del resultado
      const tags = tagExtractor(result, args);

      if (!tags || tags.length === 0) {
        return result;
      }

      // 4. Invalidar todas las entradas que tengan esos tags
      provider.invalidateTags(tags);

      return result;
    };
  };
}
