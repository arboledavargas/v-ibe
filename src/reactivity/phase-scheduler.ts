import { Subscriber } from "./types";

/**
 * Fases de ejecución del scheduler reactivo
 */
export enum Phase {
  IDLE = 0,       // No hay actualizaciones pendientes
  COLLECT = 1,    // Recolectando cambios (señales marcadas como dirty)
  EXECUTE = 2,    // Ejecutando effects
  COMMIT = 3      // Commit final
}

/**
 * PhaseScheduler Simplificado - Sistema reactivo basado en fases
 * 
 * FILOSOFÍA:
 * - Effects NO tienen dependencias entre sí
 * - Effects solo LEEN signals y producen side effects
 * - Transformaciones de datos se hacen con Computed signals
 * 
 * Si parece que un effect depende de otro effect, falta un Computed signal intermedio.
 * 
 * Ventajas sobre sistema de prioridades:
 * - Elimina glitches mediante batching
 * - Orden de ejecución predecible (insertion order)
 * - Más simple y rápido (sin grafos ni ordenamiento topológico)
 * - No hay "starvation" de procesos
 * 
 * Ejemplo CORRECTO:
 * ```typescript
 * const a = new Signal(1);
 * const b = computed(() => a.get() * 2);     // Computed, no effect
 * const c = computed(() => b.get() + 10);    // Computed, no effect
 * effect(() => console.log(c.get()));         // Effect solo lee
 * ```
 * 
 * Ejemplo INCORRECTO (anti-pattern):
 * ```typescript
 * effect(() => b.set(a.get() * 2));    // ❌ Effect modificando signal
 * effect(() => c.set(b.get() + 10));   // ❌ Otro effect leyendo
 * ```
 */
class PhaseScheduler {
  private currentPhase: Phase = Phase.IDLE;
  
  // Set de effects que necesitan ejecutarse
  // Usamos Set para evitar duplicados y mantener insertion order
  private dirtyEffects = new Set<Subscriber>();
  
  // Flag para evitar múltiples schedules del mismo ciclo
  private isFlushScheduled = false;

  /**
   * Marca un effect como dirty (necesita re-ejecutarse)
   * FASE: COLLECT
   */
  public schedule(effect: Subscriber): void {
    this.dirtyEffects.add(effect);
    this.scheduleFlush();
  }

  /**
   * Agenda la ejecución del ciclo de fases
   */
  private scheduleFlush(): void {
    if (!this.isFlushScheduled) {
      this.isFlushScheduled = true;
      queueMicrotask(() => this.flush());
    }
  }

  /**
   * Ejecuta el ciclo completo de fases
   * 
   * Simple y directo:
   * 1. COLLECT: Marcar effects como dirty (ya hecho en schedule())
   * 2. EXECUTE: Ejecutar todos los effects dirty en orden
   * 3. COMMIT: Limpiar
   */
  public flush(): void {
    this.isFlushScheduled = false;

    if (this.dirtyEffects.size === 0) {
      this.currentPhase = Phase.IDLE;
      return;
    }

    // FASE 1: COLLECT - Ya hecho en schedule()
    this.currentPhase = Phase.COLLECT;

    // Capturar los effects a ejecutar
    const effectsToRun = Array.from(this.dirtyEffects);
    this.dirtyEffects.clear();

    // FASE 2: EXECUTE - Ejecutar en orden de inserción
    this.currentPhase = Phase.EXECUTE;
    effectsToRun.forEach(effect => {
      try {
        effect();
      } catch (error) {
        console.error('Error executing effect:', error);
      }
    });

    // FASE 3: COMMIT
    this.currentPhase = Phase.COMMIT;

    // Si durante la ejecución se agregaron más effects, ejecutarlos
    // (esto maneja el caso edge donde un effect agrega otro effect)
    if (this.dirtyEffects.size > 0) {
      // Re-agendar para el próximo microtask
      this.scheduleFlush();
    }

    // Volver a IDLE
    this.currentPhase = Phase.IDLE;
  }

  /**
   * Ejecuta un effect inmediatamente si está scheduled
   * Útil para evitar lecturas de valores viejos (glitch-free reads)
   */
  public runIfScheduled(effect: Subscriber): void {
    if (this.dirtyEffects.has(effect)) {
      this.dirtyEffects.delete(effect);
      
      try {
        effect();
      } catch (error) {
        console.error('Error executing effect:', error);
      }
    }
  }

  /**
   * Obtiene la fase actual (útil para debugging)
   */
  public getCurrentPhase(): Phase {
    return this.currentPhase;
  }

  /**
   * Obtiene información del scheduler (útil para debugging)
   */
  public getInfo(): {
    dirtyEffects: number;
    currentPhase: Phase;
  } {
    return {
      dirtyEffects: this.dirtyEffects.size,
      currentPhase: this.currentPhase
    };
  }
}

export const phaseScheduler = new PhaseScheduler();
