/**
 * DATA MANAGEMENT SYSTEM - Public API
 *
 * Este archivo expone la API pública del sistema de gestión de datos.
 */

// EntityStore
export { EntityStore, registerModelMetadata, getModelMetadata } from './store/store';

// Decorators
export { Model } from './decorators/model';
export { Id } from './decorators/id';
export { Prop } from './decorators/prop';
export { Consume } from './decorators/consume';

// Cache
export { MemoryCache, LocalStorageCache, SessionStorageCache, Cache, TTL, CacheTags, CacheUpdate, CacheInvalidate } from './cache';
export type { CacheProvider, CacheEntry, TagExtractor } from './cache';

// Types
export type {
  Constructor,
  ModelMetadata,
  StoreEntity,
  Predicate,
  QueryResult,
} from './store/types';
