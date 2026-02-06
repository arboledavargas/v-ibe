import { Service } from '../../DI/decorators/service';
import type { CacheProvider, CacheEntry } from './cache-provider.interface';

/**
 * SESSIONSTORAGE CACHE PROVIDER
 *
 * Provider de cache en SessionStorage.
 *
 * CARACTERÍSTICAS:
 * - Persistente solo durante la sesión del navegador
 * - Se limpia al cerrar la pestaña/ventana
 * - Límite ~5-10MB (depende del navegador)
 * - Ideal para: datos temporales de la sesión, estado de UI
 *
 * IMPORTANTE: Los datos deben ser serializables a JSON.
 */
@Service
export class SessionStorageCache implements CacheProvider {
  private readonly prefix = 'cache';
  private readonly tagIndexKey = 'cache:tagIndex';

  private getStorageKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private getTagIndex(): Map<string, Set<string>> {
    try {
      const data = sessionStorage.getItem(this.tagIndexKey);
      if (!data) {
        return new Map();
      }
      const parsed = JSON.parse(data);
      // Convertir el objeto plano a Map<string, Set<string>>
      return new Map(
        Object.entries(parsed).map(([tag, keys]) => [tag, new Set(keys as string[])])
      );
    } catch {
      return new Map();
    }
  }

  private saveTagIndex(tagIndex: Map<string, Set<string>>): void {
    try {
      // Convertir Map<string, Set<string>> a objeto plano para serialización
      const obj: Record<string, string[]> = {};
      tagIndex.forEach((keys, tag) => {
        obj[tag] = Array.from(keys);
      });
      sessionStorage.setItem(this.tagIndexKey, JSON.stringify(obj));
    } catch (error) {
      console.error('[SessionStorageCache] Error saving tag index:', error);
    }
  }

  get<T>(key: string): T | null {
    try {
      const storageKey = this.getStorageKey(key);
      const item = sessionStorage.getItem(storageKey);

      if (!item) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(item);
      const now = Date.now();
      const age = now - entry.timestamp;

      if (age > entry.ttl) {
        this.delete(key);
        return null;
      }

      return entry.value;
    } catch (error) {
      console.error('[SessionStorageCache] Error getting item:', error);
      return null;
    }
  }

  set<T>(key: string, value: T, ttl: number, tags: string[] = []): void {
    try {
      const storageKey = this.getStorageKey(key);
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl,
        tags
      };

      sessionStorage.setItem(storageKey, JSON.stringify(entry));

      // Actualizar tag index
      if (tags.length > 0) {
        const tagIndex = this.getTagIndex();
        tags.forEach(tag => {
          if (!tagIndex.has(tag)) {
            tagIndex.set(tag, new Set());
          }
          tagIndex.get(tag)!.add(key);
        });
        this.saveTagIndex(tagIndex);
      }
    } catch (error) {
      console.error('[SessionStorageCache] Error setting item:', error);
      this.clearExpired();
    }
  }

  delete(key: string): void {
    try {
      const storageKey = this.getStorageKey(key);
      const item = sessionStorage.getItem(storageKey);

      if (item) {
        const entry: CacheEntry<any> = JSON.parse(item);

        // Actualizar tag index
        if (entry.tags && entry.tags.length > 0) {
          const tagIndex = this.getTagIndex();
          entry.tags.forEach(tag => {
            tagIndex.get(tag)?.delete(key);
            if (tagIndex.get(tag)?.size === 0) {
              tagIndex.delete(tag);
            }
          });
          this.saveTagIndex(tagIndex);
        }
      }

      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.error('[SessionStorageCache] Error deleting item:', error);
    }
  }

  clear(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(`${this.prefix}:`)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    sessionStorage.removeItem(this.tagIndexKey);
  }

  invalidatePattern(pattern: RegExp): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < sessionStorage.length; i++) {
      const storageKey = sessionStorage.key(i);
      if (storageKey && storageKey.startsWith(`${this.prefix}:`)) {
        const key = storageKey.substring(this.prefix.length + 1);
        if (pattern.test(key)) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => this.delete(key));
  }

  invalidateTag(tag: string): void {
    const tagIndex = this.getTagIndex();
    const keysToInvalidate = tagIndex.get(tag);

    if (!keysToInvalidate) {
      return;
    }

    // Copiar el set porque delete() modifica tagIndex
    const keys = Array.from(keysToInvalidate);
    keys.forEach(key => this.delete(key));
  }

  getKeysByTag(tag: string): string[] {
    const tagIndex = this.getTagIndex();
    const keys = tagIndex.get(tag);
    return keys ? Array.from(keys) : [];
  }

  updateByTags<T>(tags: string[], value: T): void {
    const tagIndex = this.getTagIndex();
    const keysToUpdate = new Set<string>();

    // Recolectar todas las keys que tienen alguno de los tags
    tags.forEach(tag => {
      const keys = tagIndex.get(tag);
      if (keys) {
        keys.forEach(key => keysToUpdate.add(key));
      }
    });

    // Actualizar cada key preservando su TTL y tags
    keysToUpdate.forEach(key => {
      // Obtener la entrada completa directamente desde sessionStorage
      const storageKey = this.getStorageKey(key);
      const item = sessionStorage.getItem(storageKey);
      
      if (item) {
        try {
          const fullEntry: CacheEntry<any> = JSON.parse(item);
          this.set(key, value, fullEntry.ttl, fullEntry.tags);
        } catch (error) {
          console.error(`[SessionStorageCache] Error parsing entry for ${key}:`, error);
        }
      }
    });
  }

  invalidateTags(tags: string[]): void {
    const tagIndex = this.getTagIndex();
    const keysToInvalidate = new Set<string>();

    // Recolectar todas las keys que tienen alguno de los tags
    tags.forEach(tag => {
      const keys = tagIndex.get(tag);
      if (keys) {
        keys.forEach(key => keysToInvalidate.add(key));
      }
    });

    // Eliminar cada key
    keysToInvalidate.forEach(key => this.delete(key));
  }

  clearExpired(): void {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < sessionStorage.length; i++) {
      const storageKey = sessionStorage.key(i);
      if (storageKey && storageKey.startsWith(`${this.prefix}:`)) {
        try {
          const item = sessionStorage.getItem(storageKey);
          if (item) {
            const entry: CacheEntry<any> = JSON.parse(item);
            const age = now - entry.timestamp;
            if (age > entry.ttl) {
              const key = storageKey.substring(this.prefix.length + 1);
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          const key = storageKey.substring(this.prefix.length + 1);
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => this.delete(key));
  }

  /**
   * Lifecycle hook - se ejecuta cuando el container se destruye
   */
  onDestroy(): void {
    // Limpiar entradas expiradas
    this.clearExpired();
  }
}
