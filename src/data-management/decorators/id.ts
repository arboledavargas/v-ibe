/**
 * @Id DECORATOR
 *
 * Marca un campo como el identificador único de la entidad.
 * Cada @Model debe tener exactamente un campo con @Id.
 *
 * USO:
 * @Model
 * class User {
 *   @Id id: string;
 *   @Prop name: string;
 * }
 *
 * IMPLEMENTACIÓN:
 * Este decorador se ejecuta ANTES que @Model (los field decorators van primero).
 * Por eso, almacenamos la información en context.metadata, que @Model podrá leer después.
 */

/**
 * @Id - Decorador para marcar el campo identificador
 *
 * @example
 * class User {
 *   @Id id: string;           // Campo ID
 *   @Id userId: string;       // También funciona con otros nombres
 *   @Id _id: string;          // MongoDB style
 * }
 */
export function Id<This extends object, Value extends string | number>(
  target: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
): (this: This, initialValue: Value) => Value {
  // Validar que solo se aplica a fields
  if (context.kind !== "field") {
    throw new Error("@Id can only be applied to class fields");
  }

  // Obtener el nombre del campo (ej: 'id', 'userId', '_id')
  const fieldName = String(context.name);

  // Usar metadata para comunicar con @Model
  // Los decoradores de field se ejecutan antes que los de clase,
  // así que @Model podrá leer esto después
  const metadata = context.metadata as any;

  // Validar que no hay múltiples @Id en la misma clase
  if (metadata.idField) {
    throw new Error(
      `Cannot have multiple @Id decorators in the same class. ` +
      `Found @Id on '${metadata.idField}' and '${fieldName}'.`
    );
  }

  // Registrar el campo ID en metadata
  metadata.idField = fieldName;

  // El decorador debe retornar una función inicializadora
  // En este caso, solo pasamos el valor inicial sin modificarlo
  return function (this: This, initialValue: Value): Value {
    // No necesitamos hacer nada especial con el valor
    // Solo lo retornamos tal cual
    return initialValue;
  };
}
