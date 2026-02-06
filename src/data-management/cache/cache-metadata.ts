import type { Constructor } from '../../DI/types';
import type { CacheProvider } from './cache-provider.interface';
import type { TagExtractor } from './cache-tags.decorator';

/**
 * Metadata storage para cache decorators
 * Usamos un WeakMap con el método como key para evitar colisiones
 */

interface CacheMethodMetadata {
  cacheProviderClass?: Constructor<CacheProvider>;
  tagExtractor?: TagExtractor;
}

// WeakMap: método → metadata
const cacheMetadataMap = new WeakMap<Function, CacheMethodMetadata>();

export function setCacheProviderClass(
  method: Function,
  providerClass: Constructor<CacheProvider>
): void {
  const existing = cacheMetadataMap.get(method) || {};
  cacheMetadataMap.set(method, { ...existing, cacheProviderClass: providerClass });
}

export function setTagExtractor(
  method: Function,
  extractor: TagExtractor
): void {
  const existing = cacheMetadataMap.get(method) || {};
  cacheMetadataMap.set(method, { ...existing, tagExtractor: extractor });
}

export function getCacheMetadata(
  method: Function
): CacheMethodMetadata {
  return cacheMetadataMap.get(method) || {};
}
