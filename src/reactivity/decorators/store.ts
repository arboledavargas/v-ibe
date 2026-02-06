import { createStore } from "../signals/reactive-proxy";

/**
 * @Store es un decorador para campos de clase que convierte un objeto o array
 * en un "store" reactivo profundo. Cada propiedad del objeto se vuelve
 * reactiva de forma granular.
 */
export function Store<This extends object, Value extends object>(
  target: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
): (this: This, initialValue: Value) => Value {
  if (context.kind !== "field") {
    throw new Error("@Store solo se puede aplicar a campos de clase.");
  }

  // Usamos un Symbol para almacenar de forma privada nuestro store reactivo.
  const storeKey = Symbol(`store_${String(context.name)}`);

  // El decorador devuelve una función inicializadora.
  // Esta función se ejecuta una vez por instancia de la clase.
  return function (this: any, initialValue: Value): Value {
    // 1. Creamos el store reactivo con el valor inicial de la propiedad.
    const store = createStore(initialValue);
    this[storeKey] = store;

    // 2. Redefinimos la propiedad en la instancia de la clase.
    Object.defineProperty(this, context.name, {
      // El getter devuelve el store reactivo (el Proxy).
      get: () => this[storeKey],
      // El setter permite reemplazar el store completo por un nuevo objeto/array.
      set: (newValue: Value) => {
        // Al asignar un nuevo objeto, también lo convertimos en un store.
        this[storeKey] = createStore(newValue);
      },
      enumerable: true,
      configurable: true,
    });

    // 3. Devolvemos el valor inicial, como requiere el estándar de decoradores.
    return initialValue;
  };
}
