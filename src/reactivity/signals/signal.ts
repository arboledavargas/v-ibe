import { reactiveContext } from "../reactive-context.js";
import { phaseScheduler } from "../phase-scheduler.js";
import { Subscriber } from '../types.js';

export interface ISignal<T> {
  readonly isSignal: true;
  get(): T;
  set(newValue: T): void;
  update(updater: (currentValue: T) => T): void;
}

/**
 * Signal con sistema de fases
 * 
 * Diferencias clave vs sistema de prioridades:
 * - notify() marca subscribers como dirty en lugar de ejecutarlos
 * - El phase-scheduler maneja el ordenamiento topológico
 * - Garantiza consistencia eliminando glitches
 */
export class Signal<T> implements ISignal<T> {
  readonly isSignal = true;

  private _value: T;
  private _subscribers = new Set<Subscriber>();
  
  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get(): T {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribers.add(reactiveContext.currentComputation);
      
      // Notificar al contexto que esta signal fue trackeada
      // Esto permite que Computed la agregue a su lista de _sources
      reactiveContext.onTrack?.(this);
    }
    return this._value;
  }

  set(newValue: T): void {
    if (!Object.is(this._value, newValue)) {
      this._value = newValue;
      this._notify();
    }
  }

  update(updater: (currentValue: T) => T): void {
    const currentValue = this.get(); // Importante: usar get() para trackear
    const newValue = updater(currentValue);
    this.set(newValue);
  }

  private _notify(): void {
    // SISTEMA DE FASES:
    // 
    // En lugar de ejecutar subscribers inmediatamente o agendarlos por prioridad,
    // simplemente marcamos todos los subscribers como "dirty" y dejamos que
    // el phase-scheduler maneje el ordenamiento topológico.
    //
    // Ventajas:
    // 1. Elimina glitches - garantiza que cada computation vea estado consistente
    // 2. Batching automático - múltiples cambios se procesan en un solo ciclo
    // 3. Orden predecible - basado en dependencias, no en prioridades arbitrarias
    //
    // Los Computed siguen ejecutándose síncronamente para evitar lecturas stale,
    // pero los Effects se marcan como dirty y se ejecutan en el ciclo de fases.
    
    this._subscribers.forEach((subscriber) => {
      if (subscriber._isComputation) {
        // Computed: Ejecutar síncronamente para mantener consistencia en lecturas
        subscriber();
      } else {
        // Effect: Marcar como dirty y agendar en phase-scheduler
        phaseScheduler.schedule(subscriber);
      }
    });
  }

  /**
   * Permite que un computed se des-suscriba de esta signal.
   * Usado cuando el computed hace cleanup de sus dependencias.
   */
  _unsubscribe(subscriber: Subscriber): void {
    this._subscribers.delete(subscriber);
  }

  /**
   * Método interno para obtener todos los subscribers (útil para debugging)
   */
  _getSubscribers(): Set<Subscriber> {
    return this._subscribers;
  }
}

/**
 * Helper para verificar si algo implementa ISignal
 * Verifica la propiedad pública isSignal y el método get()
 */
export function isSignal<T>(value: unknown): value is ISignal<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    'isSignal' in value &&
    (value as any).isSignal === true &&
    typeof (value as any).get === 'function'
  );
}
