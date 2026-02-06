import { reactiveContext } from "../reactive-context";
import { phaseScheduler } from "../phase-scheduler";

interface Computation extends Function {
  // Removemos priority ya que el sistema de fases no lo necesita
}

/**
 * Crea un effect reactivo que se re-ejecuta cuando sus dependencias cambian
 * 
 * Sistema basado en fases:
 * - Elimina glitches garantizando orden de ejecución consistente
 * - Batching automático de actualizaciones
 * - Ordenamiento topológico de dependencias
 * 
 * IMPORTANTE (Stack Unificado):
 * - Cada effect usa reactiveContext.enter() para crear su propio frame
 * - Esto garantiza que el effect tenga su propio contexto incluso si
 *   se crea dentro de un untrack() del padre
 * - Resuelve el bug de suscripciones perdidas en effects anidados
 * 
 * @param fn - Función a ejecutar. Recibe onCleanup para registrar limpieza
 * @param options - Opciones (deprecado: priority ya no se usa)
 * @returns Objeto con métodos run y dispose
 */
export function effect(
  fn: (onCleanup: (cb: () => void) => void) => void | Promise<void>,
  options?: { priority?: string }, // Mantenemos por compatibilidad pero lo ignoramos
): { run: Computation; dispose: () => void } {
  let cleanupFn: (() => void) | null = null;
  let isDisposed = false;

  const onCleanup = (cb: () => void) => {
    cleanupFn = cb;
  };

  const computation: Computation = () => {
    // No ejecutar si ya fue disposed
    if (isDisposed) {
      return;
    }

    // Ejecutar cleanup de la ejecución anterior
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = null;
    }

    // Establecer contexto reactivo usando el stack unificado
    // Esto garantiza que este effect tenga su propio contexto,
    // incluso si estamos dentro de un untrack() del padre
    const exitContext = reactiveContext.enter(computation, true, 'effect');

    try {
      const result = fn(onCleanup);
      if (result && typeof result.then === "function") {
        // Si es async, limpiar el contexto cuando la Promise se resuelva
        result.finally(exitContext);
      } else {
        // Si es sync, limpiar el contexto inmediatamente
        exitContext();
      }
    } catch (error) {
      // En caso de error, asegurar que el contexto se limpia
      exitContext();
      throw error;
    }
  };

  // Ejecutar inmediatamente la primera vez
  computation();

  return {
    run: computation,
    dispose: () => {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      
      if (cleanupFn) {
        cleanupFn();
        cleanupFn = null;
      }
      // Nota: En el sistema unificado, no necesitamos llamar a removeComputation
      // porque el contexto se limpia automáticamente via exitContext()
    },
  };
}
