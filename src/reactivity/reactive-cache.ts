import { CompositeSignal } from './signals/composite.js';
import { ReactiveArray } from './signals/reactive-array.js';

/**
 * Caché global compartido entre CompositeSignal y ReactiveArray
 * 
 * Garantiza que:
 * - El mismo objeto siempre devuelve el mismo CompositeSignal
 * - El mismo array siempre devuelve el mismo ReactiveArray
 * 
 * Esto es crítico para mantener consistencia en la reactividad:
 * Si user.todos y project.todos apuntan al mismo array,
 * ambos deben devolver la MISMA instancia de ReactiveArray.
 */
const reactiveCache = new WeakMap<object, CompositeSignal<any> | ReactiveArray<any>>();

/**
 * Obtiene o crea una versión reactiva de un valor
 * 
 * REGLAS:
 * - Valores primitivos → se devuelven tal cual
 * - Objetos → se envuelven en CompositeSignal
 * - Arrays → se envuelven en ReactiveArray
 * - Objetos especiales (Date, RegExp, etc.) → se devuelven tal cual
 * - Instancias ya reactivas → se devuelven tal cual
 * 
 * Usa un caché global para garantizar que el mismo objeto/array
 * siempre devuelve la misma instancia reactiva.
 */
export function getOrCreateReactive<T>(value: T): T {
  // Si ya es reactivo, devolverlo tal cual
  if (value instanceof CompositeSignal || value instanceof ReactiveArray) {
    return value;
  }
  
  // Si no es un objeto ni array, devolver el valor primitivo
  if (value === null || typeof value !== 'object') {
    return value;
  }
  
  // Verificar si ya existe en caché
  const cached = reactiveCache.get(value);
  if (cached) {
    return cached as T;
  }
  
  // Crear la versión reactiva apropiada
  let reactive: CompositeSignal<any> | ReactiveArray<any>;
  
  if (Array.isArray(value)) {
    reactive = new ReactiveArray(value);
  } else if (isWrappableObject(value)) {
    reactive = new CompositeSignal(value);
  } else {
    // Casos especiales: Date, RegExp, Map, Set, etc.
    return value;
  }
  
  // Guardar en caché
  reactiveCache.set(value, reactive);
  return reactive as T;
}

/**
 * Verifica si un valor es un objeto envolvible (wrappable)
 * 
 * Excluye:
 * - null
 * - Arrays (se manejan con ReactiveArray)
 * - Date, RegExp, Map, Set (objetos especiales de JS)
 * - Instancias ya reactivas
 */
function isWrappableObject(value: any): value is object {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp) &&
    !(value instanceof Map) &&
    !(value instanceof Set) &&
    !(value instanceof CompositeSignal) &&
    !(value instanceof ReactiveArray)
  );
}

/**
 * Limpia el caché (útil para testing)
 * Nota: WeakMap no tiene método clear(), así que esta función
 * es principalmente documentativa. El GC limpiará automáticamente
 * las entradas cuando los objetos originales sean recolectados.
 */
export function clearReactiveCache(): void {
  // WeakMap se limpia automáticamente por el GC
  // Esta función existe para consistencia de API y testing
}
