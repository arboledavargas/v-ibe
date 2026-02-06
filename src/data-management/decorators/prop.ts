/**
 * @Prop DECORATOR
 *
 * Convierte un campo en una propiedad reactiva usando signals.
 * Similar a @State, pero también registra el campo en la metadata del modelo.
 *
 * USO:
 * @Model
 * class User {
 *   @Id id: string;
 *   @Prop name: string;      // Reactivo
 *   @Prop email: string;     // Reactivo
 * }
 *
 * IMPLEMENTACIÓN:
 * 1. Crea una Signal interna para almacenar el valor
 * 2. Define getter/setter que usan la Signal
 * 3. Define propiedad `$nombre` que expone la Signal
 * 4. Registra el campo en metadata para que @Model lo sepa
 *
 * DIFERENCIA CON @State:
 * @State es para componentes, @Prop es para entidades de datos.
 * Ambos usan el mismo mecanismo interno (Signals).
 */

import { Signal } from "../../reactivity/signals/signal";

/**
 * @Prop - Decorador para propiedades reactivas de modelos
 *
 * @example
 * @Model
 * class User {
 *   @Id id: string;
 *   @Prop name: string;
 *   @Prop email: string;
 *   @Prop age: number;
 * }
 *
 * // Uso:
 * const user = new User();
 * user.name = "Julian";        // Setter actualiza la signal
 * console.log(user.name);      // Getter lee de la signal
 * console.log(user.$name);     // Acceso directo a la signal
 */
export function Prop<This extends object, Value>(
  target: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
): (this: This, initialValue: Value) => Value {
  // Validar que solo se aplica a fields
  if (context.kind !== "field") {
    throw new Error("@Prop can only be applied to class fields");
  }

  const fieldName = String(context.name);

  // Symbol único para almacenar la signal internamente
  const signalKey = Symbol(`prop_signal_${fieldName}`);

  // Nombre de la propiedad que expone la signal (ej: $name)
  const signalPropName = `$${fieldName}`;

  // Registrar en metadata para que @Model lo sepa
  const metadata = context.metadata as any;
  metadata.propFields ??= [];
  metadata.propFields.push(fieldName);

  // Función inicializadora que se ejecuta por cada instancia
  return function (this: any, initialValue: Value): Value {
    // 1. Crear la Signal que almacenará el valor
    const signal = new Signal(initialValue);
    this[signalKey] = signal;

    // 2. Definir la propiedad normal (nombre sin $)
    //    Esta es la que el usuario usará normalmente: user.name
    Object.defineProperty(this, fieldName, {
      get: () => this[signalKey].get(),
      set: (newValue: Value) => this[signalKey].set(newValue),
      enumerable: true,
      configurable: true,
    });

    // 3. Definir la propiedad con $ que expone la Signal completa
    //    Para uso avanzado: user.$name
    Object.defineProperty(this, signalPropName, {
      get: () => this[signalKey],
      enumerable: false, // No aparece en Object.keys()
      configurable: true,
    });

    // 4. Retornar el valor inicial (requerido por el estándar)
    return initialValue;
  };
}
