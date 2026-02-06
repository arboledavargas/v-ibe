import { Constructor } from '../DI/types';

/**
 * Representa un candidato de ruta (un componente con su configuración)
 */
export interface RouteCandidate {
  /** ID único de la ruta (UUID generado en build time) */
  id: string;
  /** Path original de la ruta (ej: '/store/:storeId') */
  path: string;
  loader: (signal?: AbortSignal) => Promise<any>;
  metadata?: Record<string, any>;
  policies?: Constructor<any>[];
  /** Nombre del slot donde se renderizará este componente (@main, @sidebar, etc.) */
  slot?: string;
}

export interface RouteNode {
  /** Hijos con rutas estáticas. La clave es el segmento de la ruta (ej: 'users'). */
  staticChildren: Map<string, RouteNode>;

  /** Nodo hijo para rutas dinámicas (ej: ':id'). Solo puede haber uno por nivel. */
  dynamicChild?: RouteNode;

  /** Nodo hijo para rutas wildcard (ej: '*'). */
  wildcardChild?: RouteNode;

  /** Si el nodo es dinámico, almacena el nombre del parámetro (ej: 'id'). */
  paramName?: string;

  /** Array de candidatos para este nodo (múltiples componentes pueden compartir el mismo path) */
  candidates?: RouteCandidate[];
}

/**
 * Resultado de la búsqueda en el Trie.
 * Los candidatos están agrupados por nivel de anidamiento.
 */
export interface FindResult {
  /** Candidatos agrupados por nivel: candidatesByLevel[0] = candidatos del nivel raíz, etc. */
  candidatesByLevel: RouteCandidate[][];
  params: Record<string, string>;
}
