import { Service } from '../../DI/decorators/service';
import type { CacheProvider, CacheEntry } from './cache-provider.interface';

/**
 * MEMORY CACHE PROVIDER
 *
 * Provider de cache en memoria (RAM).
 *
 * CARACTERÍSTICAS:
 * - Rápido (acceso directo a Map)
 * - No persistente (se pierde al recargar)
 * - Ideal para: datos temporales, sesión actual
 *
 * Este es el provider por defecto cuando no se especifica @Cache.
 */
@Service
export class MemoryCache implements CacheProvider {
  public cache = new Map<string, CacheEntry<any>>();
  public tagIndex = new Map<string, Set<string>>(); // tag → cache keys

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Si expiró, eliminar y retornar null
    if (age > entry.ttl) {
      this.delete(key);
      return null;
    }

    return entry.value;
  }

  set<T>(key: string, value: T, ttl: number, tags: string[] = []): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
      tags
    });

    // Indexar tags
    tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    });
  }

  delete(key: string): void {
    const entry = this.cache.get(key);

    // Remover de tag index
    if (entry) {
      entry.tags.forEach(tag => {
        this.tagIndex.get(tag)?.delete(key);
        // Si el set está vacío, eliminar el tag del índice
        if (this.tagIndex.get(tag)?.size === 0) {
          this.tagIndex.delete(tag);
        }
      });
    }

    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key);
      }
    }
  }

  invalidateTag(tag: string): void {
    const keysToInvalidate = this.tagIndex.get(tag);

    if (!keysToInvalidate) {
      return;
    }

    // Copiar el set porque delete() modifica tagIndex
    const keys = Array.from(keysToInvalidate);
    keys.forEach(key => this.delete(key));
  }

  getKeysByTag(tag: string): string[] {
    const keys = this.tagIndex.get(tag);
    return keys ? Array.from(keys) : [];
  }

  updateByTags<T>(tags: string[], value: T): void {
    const keysToUpdate = new Set<string>();

    // Recolectar todas las keys que tienen alguno de los tags
    tags.forEach(tag => {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.forEach(key => keysToUpdate.add(key));
      }
    });

    // Actualizar cada key preservando su TTL y tags
    keysToUpdate.forEach(key => {
      const entry = this.cache.get(key);
      if (entry) {
        this.set(key, value, entry.ttl, entry.tags);
      }
    });
  }

  invalidateTags(tags: string[]): void {
    const keysToInvalidate = new Set<string>();

    // Recolectar todas las keys que tienen alguno de los tags
    tags.forEach(tag => {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.forEach(key => keysToInvalidate.add(key));
      }
    });

    // Eliminar cada key
    keysToInvalidate.forEach(key => this.delete(key));
  }

  /**
   * Método de utilidad para debugging.
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Lifecycle hook - se ejecuta cuando el container se destruye
   */
  onDestroy(): void {
    this.clear();
  }
}
