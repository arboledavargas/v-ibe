import { Subscriber } from "./types";
import { reactiveContext } from "./reactive-context";

/**
 * ContextScope - RAII wrapper para gestionar contextos reactivos
 * 
 * Garantiza que el contexto se restaure automáticamente cuando el scope
 * sale de su bloque, incluso si hay errores.
 * 
 * Usa el stack unificado de ReactiveContext internamente.
 * 
 * USO CON ES2024 (using statement):
 * ```typescript
 * {
 *   using scope = new ContextScope(subscriber, true);
 *   // ... código que usa el contexto ...
 * } // ← scope se limpia automáticamente aquí
 * ```
 * 
 * USO SIN ES2024 (helper function):
 * ```typescript
 * withContext(subscriber, true, () => {
 *   // ... código que usa el contexto ...
 * });
 * ```
 */
export class ContextScope {
  private exitFn: (() => void) | null;

  constructor(
    computation: Subscriber | null,
    tracking: boolean
  ) {
    // ADQUISICIÓN: Usar enter() del stack unificado
    this.exitFn = reactiveContext.enter(computation, tracking, 'legacy');
  }

  /**
   * Libera el contexto manualmente.
   * Idempotente: puede llamarse múltiples veces sin efecto.
   */
  dispose(): void {
    if (this.exitFn) {
      this.exitFn();
      this.exitFn = null;
    }
  }

  /**
   * ES2024: Auto-cleanup cuando el objeto sale de scope.
   * Se llama automáticamente cuando se usa con `using`.
   */
  [Symbol.dispose](): void {
    this.dispose();
  }
}

/**
 * Helper function para usar ContextScope sin ES2024.
 * 
 * Garantiza que el contexto se restaure automáticamente incluso si hay errores.
 * 
 * @param computation - La computación a establecer como contexto actual
 * @param tracking - Si el tracking está activo
 * @param fn - Función a ejecutar con el contexto establecido
 * @returns El resultado de la función
 * 
 * @example
 * ```typescript
 * withContext(structuralSubscriber, true, () => {
 *   void this.sourceArray.length;
 *   this.sourceArray._subscribe('mutation', structuralSubscriber);
 * });
 * ```
 */
export function withContext<T>(
  computation: Subscriber | null,
  tracking: boolean,
  fn: () => T
): T {
  const scope = new ContextScope(computation, tracking);
  try {
    return fn();
  } finally {
    scope.dispose();
  }
}
