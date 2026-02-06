/**
 * CACHE PROVIDER INTERFACE
 * 
 * Todos los cache providers deben implementar esta interface.
 */
export interface CacheProvider {
  /**
   * Obtiene un valor del cache.
   * @param key - La clave del cache
   * @returns El valor cacheado o null si no existe o expiró
   */
  get<T>(key: string): T | null;

  /**
   * Almacena un valor en el cache con TTL.
   * @param key - La clave del cache
   * @param value - El valor a cachear
   * @param ttl - Time-to-live en milisegundos
   * @param tags - Tags para invalidación granular
   */
  set<T>(key: string, value: T, ttl: number, tags?: string[]): void;

  /**
   * Elimina una entrada específica del cache.
   * @param key - La clave a eliminar
   */
  delete(key: string): void;

  /**
   * Elimina todas las entradas del cache.
   */
  clear(): void;

  /**
   * Elimina entradas que coincidan con un patrón.
   * @param pattern - RegExp para matching de keys
   */
  invalidatePattern(pattern: RegExp): void;

  /**
   * Invalida todas las cache entries que tengan un tag específico.
   * @param tag - El tag a invalidar
   */
  invalidateTag(tag: string): void;

  /**
   * Obtiene todas las cache keys que tienen un tag específico.
   * @param tag - El tag a buscar
   * @returns Array de cache keys que tienen ese tag
   */
  getKeysByTag(tag: string): string[];

  /**
   * Actualiza todas las cache entries que tengan cualquiera de los tags especificados.
   * Preserva el TTL original de cada entrada.
   * @param tags - Array de tags
   * @param value - El nuevo valor a asignar
   */
  updateByTags<T>(tags: string[], value: T): void;

  /**
   * Invalida (elimina) todas las cache entries que tengan cualquiera de los tags especificados.
   * @param tags - Array de tags a invalidar
   */
  invalidateTags(tags: string[]): void;
}

/**
 * Estructura de una entrada en el cache.
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  tags: string[]; // Tags para invalidación granular
}
