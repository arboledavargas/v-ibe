import { computed } from "../signals/computed";

/**
 * @Computed es un decorador para getters que los convierte en señales computadas.
 * El valor se calcula la primera vez que se accede y se memoriza.
 * Se recalcula automáticamente solo cuando sus dependencias (@State) cambian.
 */
export function Computed<This extends object, Value>(
  target: (this: This) => Value,
  context: ClassGetterDecoratorContext<This, Value>,
): (this: This) => Value {
  if (context.kind !== "getter") {
    throw new Error("@Computed solo se puede aplicar a getters de clase.");
  }

  const signalKey = Symbol(`computed_signal_${String(context.name)}`);

  return function (this: any): Value {
    // Se crea la señal computada de forma perezosa (lazy) en el primer acceso.
    if (!this[signalKey]) {
      const getter = target.bind(this);
      this[signalKey] = computed(getter);
    }

    // En todos los accesos, se retorna el valor de la señal computada.
    return this[signalKey].get();
  };
}
