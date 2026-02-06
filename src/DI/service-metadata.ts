import { Constructor } from './types';

/**
 * Metadata for a service registered via decorators
 * This is stored globally and can be used to register services in any container
 */
export interface ServiceMetadata {
  constructor: Constructor;
  dependencies: Set<Constructor>;
}

/**
 * Global registry of service metadata
 * Decorators store metadata here instead of directly registering in containers
 */
const serviceMetadataRegistry = new Map<Constructor, ServiceMetadata>();

/**
 * Options for registering service metadata
 */
export interface ServiceMetadataOptions {
  dependencies?: Set<Constructor>;
}

/**
 * Register service metadata (called by decorators)
 */
export function registerServiceMetadata(
  ctor: Constructor,
  options: ServiceMetadataOptions
): void {
  const existing = serviceMetadataRegistry.get(ctor);

  if (existing) {
    // Merge with existing metadata
    if (options.dependencies) {
      for (const dep of options.dependencies) {
        existing.dependencies.add(dep);
      }
    }
  } else {
    // Create new metadata
    serviceMetadataRegistry.set(ctor, {
      constructor: ctor,
      dependencies: options.dependencies || new Set(),
    });
  }
}

/**
 * Get metadata for a service
 */
export function getServiceMetadata(ctor: Constructor): ServiceMetadata | undefined {
  return serviceMetadataRegistry.get(ctor);
}

/**
 * Get all registered service metadata
 * Useful for registering all services in a container
 */
export function getAllServiceMetadata(): Map<Constructor, ServiceMetadata> {
  return new Map(serviceMetadataRegistry);
}

/**
 * Clear all metadata (useful for testing)
 */
export function clearServiceMetadata(): void {
  serviceMetadataRegistry.clear();
}
