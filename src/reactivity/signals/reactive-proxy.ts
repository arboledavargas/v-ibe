import { CompositeSignal } from './composite.js';
import { ReactiveArray } from './reactive-array.js';
import { getOrCreateReactive } from '../reactive-cache.js';

// Import for type checking in console.log
import { CompositeSignal as CompositeSignalType } from './composite.js';

/**
 * Caché compartido de Proxies para mantener identidad consistente
 * Esto asegura que el mismo objeto reactivo siempre devuelva el mismo Proxy
 */
const proxyCache = new WeakMap<object, any>();

/**
 * Crea un Proxy para un CompositeSignal que permite acceso y modificación
 * usando sintaxis nativa de JavaScript.
 * 
 * Características:
 * - Lectura de propiedades: proxy.name accede a composite.get('name')
 * - Escritura de propiedades: proxy.name = 'value' ejecuta composite.set('name', 'value')
 * - Composición automática: valores nested son automáticamente envueltos en Proxies
 * - Propiedades especiales: __isReactive, __getCompositeSignal
 * 
 * @param composite - El CompositeSignal a envolver
 * @returns Un Proxy que se comporta como un objeto plano pero mantiene reactividad
 */
export function createObjectProxy<T extends Record<string, any>>(
  composite: CompositeSignal<T>
): T {
  // Verificar caché primero
  if (proxyCache.has(composite)) {
    return proxyCache.get(composite);
  }

  const proxy = new Proxy(composite as any, {
    get(target: CompositeSignal<T>, prop: string | symbol): any {
      // Propiedades especiales para introspección
      if (prop === '__isReactive') return true;
      if (prop === '__getCompositeSignal') return composite;

      // Ignorar símbolos internos
      if (typeof prop === 'symbol') {
        return (target as any)[prop];
      }

      // Obtener el valor del CompositeSignal
      const value = composite.get(prop as keyof T);

      // Si el valor es un CompositeSignal o ReactiveArray, envolverlo en Proxy
      if (value instanceof CompositeSignal) {
        return createObjectProxy(value);
      }
      if (value instanceof ReactiveArray) {
        return createArrayProxy(value);
      }

      // Valores primitivos se devuelven directamente
      return value;
    },

    set(target: CompositeSignal<T>, prop: string | symbol, value: any): boolean {
      // Ignorar símbolos
      if (typeof prop === 'symbol') {
        (target as any)[prop] = value;
        return true;
      }

      // Si el valor ya es reactivo (CompositeSignal o ReactiveArray), usarlo directamente
      // Si no, getOrCreateReactive lo envolverá automáticamente si es necesario
      const reactiveValue = getOrCreateReactive(value);
      composite.set(prop as keyof T, reactiveValue as any);
      return true;
    },

    has(target: CompositeSignal<T>, prop: string | symbol): boolean {
      if (prop === '__isReactive' || prop === '__getCompositeSignal') return true;
      if (typeof prop === 'symbol') return prop in target;
      return composite.get(prop as keyof T) !== undefined;
    },

    ownKeys(target: CompositeSignal<T>): (string | symbol)[] {
      // ✅ NUEVO: Trackear shallow cuando se itera sobre keys
      // Esto hace que Object.keys(), for...in, etc. tracken el objeto completo
      composite.trackShallow();
      
      const plainValue = composite.getPlainValue();
      return Reflect.ownKeys(plainValue);
    },

    getOwnPropertyDescriptor(target: CompositeSignal<T>, prop: string | symbol): PropertyDescriptor | undefined {
      if (prop === '__isReactive' || prop === '__getCompositeSignal') {
        return {
          configurable: true,
          enumerable: false,
          value: prop === '__isReactive' ? true : composite,
          writable: false,
        };
      }
      
      if (typeof prop === 'symbol') {
        return Object.getOwnPropertyDescriptor(target, prop);
      }

      const plainValue = composite.getPlainValue();
      if (!(prop in plainValue)) return undefined;

      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value: this.get!(target, prop, proxy),
      };
    },

    deleteProperty(target: CompositeSignal<T>, prop: string | symbol): boolean {
      // Ignorar símbolos
      if (typeof prop === 'symbol') {
        return delete (target as any)[prop];
      }

      const plainValue = composite.getPlainValue();
      if (!(prop in plainValue)) {
        return true; // Property doesn't exist, delete is successful
      }

      // Eliminar la propiedad del objeto interno
      const deleted = delete (plainValue as any)[prop];
      
      if (deleted) {
        // Notificar a los subscribers de esta propiedad usando set con undefined
        // Esto asegura que los effects se ejecuten
        composite.set(prop as keyof T, undefined as any);
      }
      
      return deleted;
    },
  });

  // Guardar en caché
  proxyCache.set(composite, proxy);
  return proxy;
}

/**
 * Crea un Proxy para un ReactiveArray que permite acceso y modificación
 * usando sintaxis nativa de Arrays de JavaScript.
 * 
 * Características:
 * - Acceso por índice: proxy[0] accede a reactiveArray.at(0)
 * - Métodos nativos: push, pop, map, filter, etc. funcionan como en arrays normales
 * - Iteración: for...of, forEach, etc. funcionan nativamente
 * - Composición automática: elementos nested son automáticamente envueltos en Proxies
 * - Propiedades especiales: __isReactive, __getReactiveArray
 * 
 * @param reactiveArray - El ReactiveArray a envolver
 * @returns Un Proxy que se comporta como un Array plano pero mantiene reactividad
 */
export function createArrayProxy<T>(reactiveArray: ReactiveArray<T>): T[] {
  // Verificar caché primero
  if (proxyCache.has(reactiveArray)) {
    return proxyCache.get(reactiveArray);
  }

  const proxy = new Proxy(reactiveArray as any, {
    get(target: ReactiveArray<T>, prop: string | symbol): any {
      // Propiedades especiales para introspección
      if (prop === '__isReactive') return true;
      if (prop === '__getReactiveArray') return reactiveArray;

      // Símbolos especiales de Array (iteradores, etc.)
      if (typeof prop === 'symbol') {
        // Special handling for Symbol.iterator to wrap values
        if (prop === Symbol.iterator) {
          // IMPORTANTE: Trackear el array derivado cuando se itera
          // Esto asegura que el effect se suscriba a cambios en el array derivado
          const iterator = reactiveArray[Symbol.iterator]();
          
          return function* () {
            for (const value of iterator) {
              // Wrap reactive values in proxies
              if (value instanceof CompositeSignal) {
                yield createObjectProxy(value);
              } else if (value instanceof ReactiveArray) {
                yield createArrayProxy(value);
              } else {
                yield value;
              }
            }
          };
        }
        
        const value = (target as any)[prop];
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      }

      // Propiedad 'length'
      if (prop === 'length') {
        return reactiveArray.length;
      }

      // Métodos de Array - necesitamos bindearlos correctamente
      const methodNames = [
        'push', 'pop', 'shift', 'unshift', 'splice',
        'sort', 'reverse', 'fill',
        'map', 'filter', 'reduce', 'reduceRight',
        'find', 'findIndex', 'indexOf', 'lastIndexOf',
        'some', 'every', 'forEach',
        'slice', 'concat', 'join',
        'includes', 'at', 'entries', 'keys', 'values'
      ];

      if (methodNames.includes(prop as string)) {
        const method = (target as any)[prop];
        if (typeof method === 'function') {
          return function(this: any, ...args: any[]) {
            // Para métodos que reciben callbacks (map, filter, etc.), 
            // necesitamos envolver el callback para pasar elementos proxiados
            const callbackMethods = ['map', 'filter', 'find', 'findIndex', 'some', 'every', 'forEach', 'reduce', 'reduceRight'];
            
            if (callbackMethods.includes(prop as string) && typeof args[0] === 'function') {
              const originalCallback = args[0];
              const wrappedCallback = function(...callbackArgs: any[]) {
                // Envolver el primer argumento (el elemento) si es reactivo
                const wrappedArgs = callbackArgs.map((arg, index) => {
                  if (index === 0) { // El elemento
                    if (arg instanceof CompositeSignal) {
                      return createObjectProxy(arg);
                    }
                    if (arg instanceof ReactiveArray) {
                      return createArrayProxy(arg);
                    }
                  }
                  return arg;
                });
                
                return originalCallback.apply(this, wrappedArgs);
              };
              args = [wrappedCallback, ...args.slice(1)];
            }
            
            const result = method.apply(target, args);
            
            // Para métodos que devuelven ReactiveArray, envolver en Proxy
            if (result instanceof ReactiveArray) {
              return createArrayProxy(result);
            }
            
            // Para métodos que devuelven arrays de elementos, envolver elementos si son reactivos
            if (Array.isArray(result)) {
              return result.map(item => {
                if (item instanceof CompositeSignal) {
                  return createObjectProxy(item);
                }
                if (item instanceof ReactiveArray) {
                  return createArrayProxy(item);
                }
                return item;
              });
            }
            
            // Para métodos que devuelven elementos individuales, envolver si es reactivo
            if (result instanceof CompositeSignal) {
              return createObjectProxy(result);
            }
            if (result instanceof ReactiveArray) {
              return createArrayProxy(result);
            }
            
            return result;
          };
        }
      }

      // Acceso por índice numérico
      const index = Number(prop);
      if (!isNaN(index) && index >= 0 && Number.isInteger(index)) {
        const value = reactiveArray.at(index);
        
        // Envolver valores reactivos en Proxies
        if (value instanceof CompositeSignal) {
          return createObjectProxy(value);
        }
        if (value instanceof ReactiveArray) {
          return createArrayProxy(value);
        }
        
        return value;
      }

      // Otras propiedades
      return (target as any)[prop];
    },

    set(target: ReactiveArray<T>, prop: string | symbol, value: any): boolean {
      // Ignorar símbolos
      if (typeof prop === 'symbol') {
        (target as any)[prop] = value;
        return true;
      }

      // Propiedad 'length' - modificar el tamaño del array
      if (prop === 'length') {
        const newLength = Number(value);
        if (!isNaN(newLength) && newLength >= 0 && Number.isInteger(newLength)) {
          const currentLength = reactiveArray.length;
          if (newLength < currentLength) {
            // Truncar el array
            reactiveArray.splice(newLength, currentLength - newLength);
          }
          // Si newLength > currentLength, JavaScript normalmente añade undefined
          // pero ReactiveArray no soporta esto directamente, así que lo ignoramos
        }
        return true;
      }

      // Asignación por índice
      const index = Number(prop);
      if (!isNaN(index) && index >= 0 && Number.isInteger(index)) {
        const reactiveValue = getOrCreateReactive(value);
        
        // Si el índice está dentro del rango, usar splice para reemplazar
        if (index < reactiveArray.length) {
          reactiveArray.splice(index, 1, reactiveValue as T);
        } else {
          // Si está fuera del rango, llenar con undefined hasta el índice
          // y luego añadir el valor
          const currentLength = reactiveArray.length;
          for (let i = currentLength; i < index; i++) {
            reactiveArray.push(undefined as T);
          }
          reactiveArray.push(reactiveValue as T);
        }
        return true;
      }

      // Otras propiedades
      (target as any)[prop] = value;
      return true;
    },

    has(target: ReactiveArray<T>, prop: string | symbol): boolean {
      if (prop === '__isReactive' || prop === '__getReactiveArray') return true;
      if (typeof prop === 'symbol') return prop in target;
      if (prop === 'length') return true;
      
      const index = Number(prop);
      if (!isNaN(index) && index >= 0 && Number.isInteger(index)) {
        return index < reactiveArray.length;
      }
      
      return prop in target;
    },

    ownKeys(target: ReactiveArray<T>): (string | symbol)[] {
      const keys: (string | symbol)[] = ['length'];
      for (let i = 0; i < reactiveArray.length; i++) {
        keys.push(String(i));
      }
      return keys;
    },

    getOwnPropertyDescriptor(target: ReactiveArray<T>, prop: string | symbol): PropertyDescriptor | undefined {
      if (prop === '__isReactive' || prop === '__getReactiveArray') {
        return {
          configurable: true,
          enumerable: false,
          value: prop === '__isReactive' ? true : reactiveArray,
          writable: false,
        };
      }

      if (prop === 'length') {
        return {
          configurable: true,
          enumerable: false,
          writable: true,
          value: reactiveArray.length,
        };
      }

      const index = Number(prop);
      if (!isNaN(index) && index >= 0 && Number.isInteger(index) && index < reactiveArray.length) {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: this.get!(target, prop, proxy),
        };
      }

      return Object.getOwnPropertyDescriptor(target, prop);
    },
  });

  // Guardar en caché
  proxyCache.set(reactiveArray, proxy);
  return proxy as T[];
}

/**
 * API principal para crear stores reactivos con sintaxis nativa de JavaScript.
 * 
 * Esta función es el punto de entrada recomendado para usuarios del framework.
 * Automáticamente detecta si el estado inicial es un objeto o array y crea
 * el tipo de Proxy apropiado.
 * 
 * Ejemplos:
 * ```typescript
 * // Objeto reactivo
 * const app = createStore({ user: { name: 'Julian' } });
 * app.user.name = 'Julián'; // Sintaxis nativa con reactividad completa
 * 
 * // Array reactivo
 * const items = createStore([1, 2, 3]);
 * items.push(4); // Métodos nativos de Array
 * items[0] = 10; // Asignación por índice
 * ```
 * 
 * @param initialState - El estado inicial (objeto o array)
 * @returns Un Proxy que permite sintaxis nativa con reactividad completa
 */
export function createStore<T extends Record<string, any> | any[]>(initialState: T): T {
  // Detectar si es array o objeto
  if (Array.isArray(initialState)) {
    const reactiveArray = new ReactiveArray(initialState);
    return createArrayProxy(reactiveArray) as T;
  } else {
    const composite = new CompositeSignal(initialState);
    return createObjectProxy(composite) as T;
  }
}
