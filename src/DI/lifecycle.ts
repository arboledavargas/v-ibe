/**
 * Interfaz para servicios que requieren inicialización asíncrona
 * 
 * Los servicios que implementan esta interfaz tendrán su método onBootstrap
 * llamado automáticamente cuando el componente que los provee se monte.
 * 
 * @example
 * ```typescript
 * class Router implements LifeCycle {
 *   async onBootstrap() {
 *     await this.loadRoutes();
 *     console.log('Router initialized');
 *   }
 * }
 * ```
 */
export interface LifeCycle {
  /**
   * Método llamado automáticamente durante el bootstrap del componente
   * Permite inicialización asíncrona como cargar configuración, conectar a APIs, etc.
   */
  onBootstrap(): Promise<void>;
}

/**
 * Type guard para verificar si un objeto implementa la interfaz LifeCycle
 * 
 * @param obj - Objeto a verificar
 * @returns true si el objeto tiene un método onBootstrap que es una función
 * 
 * @example
 * ```typescript
 * if (hasLifecycle(service)) {
 *   await service.onBootstrap();
 * }
 * ```
 */
export function hasLifecycle(obj: any): obj is LifeCycle {
  return obj != null && typeof obj.onBootstrap === 'function';
}