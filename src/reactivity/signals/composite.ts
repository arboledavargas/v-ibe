import { Subscriber } from '../types.js';
import { reactiveContext } from '../reactive-context.js';
import { phaseScheduler } from '../phase-scheduler.js';
import { getOrCreateReactive } from '../reactive-cache.js';

// Re-exportar Subscriber para que los tests puedan importarlo
export type { Subscriber };

// Símbolo para shallow tracking (trackea cualquier cambio en el objeto)
const SHALLOW_KEY = Symbol.for('__composite_shallow__');

/**
 * CompositeSignal - Con caché compartido y composición automática
 * 
 * Soporta reactividad profunda con composición automática:
 * - Objetos anidados se envuelven automáticamente en CompositeSignal
 * - Arrays anidados se envuelven automáticamente en ReactiveArray
 * - Usa caché compartido global para garantizar consistencia
 * - El tracking funciona en cualquier nivel de profundidad
 * 
 * IMPORTANTE: Usa el mismo tipo Subscriber que Signal, que es una función.
 * Esto permite integración completa con el sistema de reactividad existente.
 */
export class CompositeSignal<T extends object> {
  private value: T;
  private propertySubscribers = new Map<string | symbol, Set<Subscriber>>();
  // Caché local para referencias reactivas anidadas (pueden ser CompositeSignal o ReactiveArray)
  private nestedReactives = new Map<string | symbol, any>();
  private onChangeCallback?: (property: string | symbol, oldValue: any, newValue: any) => void;

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  /**
   * Registra un callback que se llamará cada vez que cualquier propiedad cambie
   * El callback se llama síncronamente antes de cualquier notificación a subscribers
   * 
   * @param callback - Función que recibe (property, oldValue, newValue)
   */
  onChange(callback: (property: string | symbol, oldValue: any, newValue: any) => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * Obtiene el objeto JavaScript plano subyacente, sin envolver en CompositeSignal
   * 
   * @returns El objeto plano original
   */
  getPlainValue(): T {
    return this.value;
  }

  /**
   * Obtiene el valor de una propiedad del objeto almacenado
   * Si hay un efecto activo en reactiveContext, lo registra automáticamente
   * como subscriber de esta propiedad
   * 
   * COMPOSICIÓN AUTOMÁTICA:
   * - Si el valor es un objeto → devuelve CompositeSignal
   * - Si el valor es un array → devuelve ReactiveArray
   * - Si el valor es primitivo → devuelve el valor directo
   * 
   * Usa caché compartido para garantizar consistencia
   * 
   * @param property - La clave de la propiedad a leer
   * @returns El valor de la propiedad (envuelto si es objeto/array)
   */
  get(property: string | symbol): any {
    // Si hay un computation activo que está trackeando, registrarlo automáticamente
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this.subscribeToProperty(property, reactiveContext.currentComputation);
    }
    
    const value = (this.value as any)[property];
    
    // Si es null, undefined, o primitivo, devolverlo directo
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    // Verificar caché local primero
    if (!this.nestedReactives.has(property)) {
      // getOrCreateReactive maneja tanto objetos como arrays
      // y usa el caché global compartido
      const reactive = getOrCreateReactive(value);
      this.nestedReactives.set(property, reactive);
    }
    
    return this.nestedReactives.get(property);
  }

  /**
   * Actualiza el valor de una propiedad en el objeto almacenado y notifica a los subscribers
   * Solo notifica si el valor realmente cambió (usa Object.is para comparación)
   * 
   * IMPORTANTE: Si se reemplaza un objeto, invalida el caché del CompositeSignal anidado
   * 
   * @param property - La clave de la propiedad a actualizar
   * @param newValue - El nuevo valor para la propiedad
   */
  set(property: string | symbol, newValue: any): void {
    const oldValue = (this.value as any)[property];
    
    // Solo actualizar y notificar si el valor cambió
    // Object.is() maneja correctamente NaN, +0/-0, null, undefined
    if (!Object.is(oldValue, newValue)) {
      (this.value as any)[property] = newValue;
      
      // Notificar al callback si existe (síncronamente, antes de cualquier batching)
      if (this.onChangeCallback) {
        this.onChangeCallback(property, oldValue, newValue);
      }
      
      // Si había un reactivo anidado cacheado para esta propiedad, invalidarlo
      // porque el objeto/array ha sido reemplazado
      if (this.nestedReactives.has(property)) {
        this.nestedReactives.delete(property);
      }
      
      this._notifyProperty(property);
    }
  }

  /**
   * Notifica a todos los subscribers de una propiedad específica
   * Distingue entre Computed (síncrono) y Effect (agendado en scheduler)
   * @param property - La propiedad cuyos subscribers deben ser notificados
   */
  private _notifyProperty(property: string | symbol): void {
    const subscribers = this.propertySubscribers.get(property);
    if (subscribers) {
      // IMPORTANTE: Distinguir entre Computed (síncrono) y Effect (asíncrono)
      //
      // - Computed: Ejecutar INMEDIATAMENTE para evitar glitches
      // - Effect: Agendar en el scheduler según su prioridad
      //
      // Los Sets en JavaScript mantienen el orden de inserción
      subscribers.forEach((subscriber) => {
        if (subscriber._isComputation) {
          // Es un Computed → ejecutar síncronamente
          subscriber();
        } else {
          // Es un Effect → agendar en el scheduler
          phaseScheduler.schedule(subscriber);
        }
      });
    }

    // ✅ NUEVO: Notificar también a los shallow subscribers
    // Estos se subscribieron al objeto completo (ej: Object.keys, iteración)
    const shallowSubscribers = this.propertySubscribers.get(SHALLOW_KEY);
    if (shallowSubscribers) {
      shallowSubscribers.forEach((subscriber) => {
        if (subscriber._isComputation) {
          subscriber();
        } else {
          phaseScheduler.schedule(subscriber);
        }
      });
    }
  }

  /**
   * Registra un subscriber para una propiedad específica
   * @param property - La propiedad a observar
   * @param subscriber - El subscriber que se ejecutará cuando la propiedad cambie
   */
  subscribeToProperty(property: string | symbol, subscriber: Subscriber): void {
    if (!this.propertySubscribers.has(property)) {
      this.propertySubscribers.set(property, new Set());
    }
    this.propertySubscribers.get(property)!.add(subscriber);
  }

  /**
   * Método helper para inspeccionar los subscribers registrados (útil para testing)
   * @param property - La propiedad a inspeccionar
   * @returns El Set de subscribers para esa propiedad, o undefined si no hay
   */
  getSubscribers(property: string | symbol): Set<Subscriber> | undefined {
    return this.propertySubscribers.get(property);
  }

  /**
   * Método helper para obtener todas las propiedades que tienen subscribers
   * @returns Array de propiedades que tienen al menos un subscriber
   */
  getSubscribedProperties(): (string | symbol)[] {
    return Array.from(this.propertySubscribers.keys());
  }

  /**
   * ✅ NUEVO: Trackea shallow (cualquier cambio en el objeto)
   * Se llama cuando se itera sobre el objeto (Object.keys, for...in, etc.)
   * El effect se ejecutará cuando CUALQUIER propiedad cambie
   */
  trackShallow(): void {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this.subscribeToProperty(SHALLOW_KEY, reactiveContext.currentComputation);
    }
  }
}
