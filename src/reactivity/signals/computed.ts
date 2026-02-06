import { ISignal } from "./signal";
import { reactiveContext } from "../reactive-context";
import { Subscriber } from '../types';
import { phaseScheduler } from "../phase-scheduler";

/**
 * Computed Signal - Lazy evaluation with dirty flag (like Solid.js, Vue 3)
 *
 * Características:
 * - Solo recalcula cuando se lee (lazy/pull-based)
 * - Usa un flag "_isDirty" para saber si necesita recalcular
 * - Recalcula SÍNCRONAMENTE cuando se lee y está dirty
 * - NO usa scheduler asíncrono para recalcular (no hay glitches)
 * - Trackea sus dependencias automáticamente
 * 
 * STACK UNIFICADO:
 * - Usa reactiveContext.enter() para crear su contexto de tracking
 * - Garantiza limpieza correcta del contexto
 */
export class Computed<T> implements ISignal<T> {
  readonly isSignal = true;

  private _value: T;
  private _subscribers = new Set<Subscriber>();
  private _getter: () => T;
  private _isDirty = true; // Empieza dirty (no tiene valor calculado)

  // Función que se ejecuta cuando una dependencia cambia
  private _computation: Subscriber;

  // Sources: Las signals de las que este computed depende
  // Esto es clave para hacer cleanup cuando las dependencias cambien
  private _sources = new Set<any>();

  constructor(getter: () => T) {
    this._getter = getter;
    this._value = undefined as any;

    // Crear la computación que se ejecuta cuando una dependencia cambia
    const self = this;
    this._computation = () => {
      // Cuando una dependencia cambia, solo marcar como dirty
      // NO recalcular aquí - lo haremos en get()
      self._isDirty = true;

      // Notificar a nuestros subscribers (otros computed o effects)
      // que nosotros cambiamos (potencialmente)
      self._notify();
    };

    // Configurar prioridad para el computation
    this._computation.priority = "Sync";
    
    // IMPORTANTE: Marcar como computación para ejecución síncrona
    // Esto evita glitches al garantizar que los Computed se recalculan
    // inmediatamente cuando sus dependencias cambian
    this._computation._isComputation = true;
  }

  get(): T {
    // Si está dirty, recalcular AHORA (síncronamente)
    if (this._isDirty) {
      this._recompute();
    }

    // Trackear este computed como dependencia del contexto actual
    // (para que otros computed o effects que nos lean se suscriban a nosotros)
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribers.add(reactiveContext.currentComputation);
    }

    return this._value;
  }

  /**
   * Recalcula el valor del computed síncronamente.
   * Se ejecuta cuando:
   * 1. Se lee el computed (get) y está dirty
   * 2. Es la primera vez que se lee
   */
  private _recompute(): void {
    // Marcar como no-dirty ANTES de recalcular
    // (para evitar loops infinitos si el getter lee este mismo computed)
    this._isDirty = false;

    // IMPORTANTE: Hacer cleanup de dependencias anteriores
    // Esto es clave para el patrón Solid/Vue de bi-directional tracking
    this._cleanup();

    // Guardar el estado anterior del callback onTrack
    const previousOnTrack = reactiveContext.onTrack;

    // Configurar el callback onTrack para capturar las signals que leemos
    reactiveContext.onTrack = (signal) => {
      this._sources.add(signal);
    };

    // Ejecutar el getter en contexto reactivo para trackear dependencias
    // IMPORTANTE: Usar enter/exit del stack unificado
    const exitContext = reactiveContext.enter(this._computation, true, 'computed');

    try {
      const newValue = this._getter();

      // Actualizar el valor (siempre, para mantener la referencia actualizada)
      this._value = newValue;
    } finally {
      // Restaurar el contexto y el callback
      exitContext();
      reactiveContext.onTrack = previousOnTrack;
    }
  }

  /**
   * Notifica a los subscribers que este computed cambió.
   *
   * FIX: Distingue entre Computed y Effect:
   * - Computed: Ejecutar síncronamente
   * - Effect: Agendar en el scheduler
   */
  private _notify(): void {
    
    this._subscribers.forEach((subscriber) => {
      if (subscriber._isComputation) {
        // Otro Computed: ejecutar síncronamente para propagar dirty
        subscriber();
      } else {
        // Effect: agendar para evitar loops
        phaseScheduler.schedule(subscriber);
      }
    });
  }

  /**
   * Limpia las suscripciones a las signals anteriores.
   * Este es el patrón Solid/Vue de bi-directional tracking:
   * - Signal sabe quién depende de ella (_subscribers)
   * - Computed sabe de qué signals depende (_sources)
   *
   * Cuando recalculamos, necesitamos:
   * 1. Des-suscribirnos de las signals viejas
   * 2. Re-trackear las nuevas signals que leemos
   *
   * Esto permite dependencias dinámicas/condicionales.
   */
  private _cleanup(): void {
    this._sources.forEach((source) => {
      // Cada source (Signal) debe tener un método _unsubscribe
      if (source._unsubscribe) {
        source._unsubscribe(this._computation);
      }
    });
    this._sources.clear();
  }

  // Las signals computadas son de solo lectura
  set(newValue: T): void {
    throw new Error("Cannot set a computed signal.");
  }

  update(updater: (currentValue: T) => T): void {
    throw new Error("Cannot update a computed signal.");
  }

  /**
   * Limpia los recursos del computed.
   */
  dispose(): void {
    this._cleanup(); // Des-suscribirse de todas las sources
    this._subscribers.clear();
  }
}

export function computed<T>(getter: () => T): ISignal<T> {
  return new Computed(getter);
}
