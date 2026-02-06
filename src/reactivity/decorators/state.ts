import { Signal } from "../signals/signal";
import { CompositeSignal } from "../signals/composite";
import { ReactiveArray } from "../signals/reactive-array";
import { createObjectProxy, createArrayProxy } from "../signals/reactive-proxy";

/**
 * @State es un decorador para campos de clase que los convierte en señales reactivas.
 * Automáticamente detecta el tipo de valor y crea la señal apropiada:
 * - Primitivos (string, number, boolean, etc.) → Signal
 * - Objetos → CompositeSignal con Proxy para sintaxis nativa
 * - Arrays → ReactiveArray con Proxy para sintaxis nativa
 */
export function State<This extends object, Value>(
  target: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
): (this: This, initialValue: Value) => Value {
  if (context.kind !== "field") {
    throw new Error("@State solo se puede aplicar a campos de clase.");
  }

  const signalKey = Symbol(`signal_${String(context.name)}`);
  const signalPropName = `\$${String(context.name)}`;

  return function (this: any, initialValue: any) {
    let signal: Signal<any> | CompositeSignal<any> | ReactiveArray<any>;
    let shouldUseProxy = false;

    // Detectar el tipo de valor y crear la señal apropiada
    if (Array.isArray(initialValue)) {
      // Array → ReactiveArray con Proxy
      signal = new ReactiveArray(initialValue);
      shouldUseProxy = true;
    } else if (initialValue !== null && typeof initialValue === 'object') {
      // Objeto → CompositeSignal con Proxy
      signal = new CompositeSignal(initialValue);
      shouldUseProxy = true;
    } else {
      // Primitivo → Signal normal
      signal = new Signal(initialValue);
    }

    this[signalKey] = signal;

    // Define la propiedad original - siempre dinámica para soportar cambios de tipo
    Object.defineProperty(this, context.name, {
      get: () => {
        const sig = this[signalKey];
        // Devolver proxy para objetos/arrays, valor directo para primitivos
        if (sig instanceof ReactiveArray) {
          return createArrayProxy(sig);
        } else if (sig instanceof CompositeSignal) {
          return createObjectProxy(sig);
        } else if (sig instanceof Signal) {
          return sig.get();
        }
        return sig;
      },
      set: (newValue: any) => {
        const currentSig = this[signalKey];
        
        // Detectar el tipo del nuevo valor y crear/actualizar la señal apropiada
        if (Array.isArray(newValue)) {
          // Nuevo valor es array
          if (currentSig instanceof ReactiveArray) {
            // Ya es ReactiveArray, reemplazarlo
            this[signalKey] = new ReactiveArray(newValue);
          } else {
            // Convertir a ReactiveArray
            this[signalKey] = new ReactiveArray(newValue);
          }
        } else if (newValue !== null && typeof newValue === 'object') {
          // Nuevo valor es objeto
          if (currentSig instanceof CompositeSignal) {
            // Ya es CompositeSignal, reemplazarlo
            this[signalKey] = new CompositeSignal(newValue);
          } else {
            // Convertir a CompositeSignal
            this[signalKey] = new CompositeSignal(newValue);
          }
        } else {
          // Nuevo valor es primitivo
          if (currentSig instanceof Signal && !(currentSig instanceof CompositeSignal) && !(currentSig instanceof ReactiveArray)) {
            // Ya es Signal básico, actualizar valor
            currentSig.set(newValue);
          } else {
            // Convertir a Signal básico
            this[signalKey] = new Signal(newValue);
          }
        }
      },
      enumerable: true,
      configurable: true,
    });

    // Define la propiedad con '$' que devuelve la SEÑAL completa
    Object.defineProperty(this, signalPropName, {
      get: () => this[signalKey],
      enumerable: false,
      configurable: true,
    });

    return initialValue;
  };
}
