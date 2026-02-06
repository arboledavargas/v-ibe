import { Constructor } from '../../DI/types';

/**
 * Configuración para el decorador @Route
 */
export interface RouteConfig {
  /**
   * Metadata arbitraria que se puede acceder desde políticas
   * a través del decorador @RouteMetadata
   */
  metadata?: Record<string, any>;

  /**
   * Array de clases de políticas que deben estar decoradas con @Service.
   * Las políticas se evalúan en orden antes de cargar el componente.
   * Si alguna política redirige, la navegación actual se cancela.
   *
   * @example
   * ```typescript
   * @Route('/admin', {
   *   metadata: { requiresAuth: true },
   *   policies: [AuthPolicy, AdminRolePolicy]
   * })
   * ```
   */
  policies?: Constructor<any>[];

  /**
   * Nombre del slot donde se renderizará este componente.
   * Permite renderizar múltiples componentes en paralelo para la misma ruta.
   *
   * @example
   * ```typescript
   * @Route('/dashboard', {
   *   slot: '@main',
   *   policies: [AuthPolicy]
   * })
   * ```
   */
  slot?: string;
}

// route.ts - Decorador de clase

export function Route(path: string, config?: RouteConfig) {
  return function (target: any, context: ClassDecoratorContext) {
  };
}
