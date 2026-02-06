import { setTagExtractor } from './cache-metadata';

/**
 * @CacheTags DECORATOR
 *
 * Asigna tags a las cache entries para invalidación granular.
 * Los tags se extraen del resultado del método o de sus argumentos.
 */

/**
 * Función que extrae tags del resultado y/o argumentos del método.
 *
 * @param result - El valor retornado por el método
 * @param args - Los argumentos con los que se llamó el método
 * @returns Array de tags (strings)
 */
export type TagExtractor = (result: any, args: any[]) => string[];

/**
 * @CacheTags - Asigna tags a cache entries para invalidación granular
 *
 * Los tags permiten invalidar selectivamente entries relacionadas sin
 * necesitar eventos o regenerar cache keys.
 *
 * @param extractor - Función que extrae tags del resultado/args
 *
 * @example
 * // Tag basado en el resultado
 * @CacheTags((result) => [`product:${result.id}`])
 * async getProduct(id: string) { }
 *
 * @example
 * // Tag basado en argumentos
 * @CacheTags((_, args) => [`product:${args[0]}`])
 * async getProduct(id: string) { }
 *
 * @example
 * // Múltiples tags
 * @CacheTags((result) => [
 *   `product:${result.id}`,
 *   `category:${result.category}`,
 *   `brand:${result.brand}`
 * ])
 * async getProduct(id: string) { }
 *
 * @example
 * // Tags de array de resultados
 * @CacheTags((result) => result.map(p => `product:${p.id}`))
 * async getProducts() { }
 *
 * @example
 * // Invalidar por tag
 * await productService.updateProduct(id, data);
 * cache.invalidateTag(`product:${id}`);
 */
export function CacheTags(extractor: TagExtractor) {
  return function (
    target: any,
    context: ClassMethodDecoratorContext
  ) {
    const metadata = context.metadata as any;
    const methodName = String(context.name);

    if (!metadata.cacheTagExtractors) {
      metadata.cacheTagExtractors = {};
    }
    metadata.cacheTagExtractors[methodName] = extractor;
  };
}
