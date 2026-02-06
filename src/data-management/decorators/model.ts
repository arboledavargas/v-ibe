/**
 * @Model DECORATOR
 *
 * Decorador de clase que registra un modelo en el Store.
 * Se ejecuta DESPUÉS de @Id y @Prop, por lo que puede leer
 * la metadata que estos decoradores dejaron.
 *
 * USO:
 * @Model
 * class User {
 *   @Id id: string;
 *   @Prop name: string;
 *   @Prop email: string;
 *
 *   // Métodos de dominio
 *   changeName(newName: string) {
 *     this.name = newName;
 *   }
 * }
 *
 * RESPONSABILIDADES:
 * 1. Leer metadata de @Id y @Prop
 * 2. Validar que hay exactamente un @Id
 * 3. Registrar metadata en el Store
 * 4. Retornar la clase sin modificarla
 */

import { registerModelMetadata } from '../store/store';
import type { ModelMetadata } from '../store/types';

/**
 * @Model - Decorador de clase para modelos de datos
 *
 * @example
 * @Model
 * class User {
 *   @Id id: string;
 *   @Prop name: string;
 *
 *   constructor(id: string, name: string) {
 *     this.id = id;
 *     this.name = name;
 *   }
 * }
 *
 * // Ahora el Store sabe sobre User
 * const user = new User("1", "Julian");
 * store.set(User, user);
 */
export function Model<T extends { new(...args: any[]): {} }>(
  target: T,
  context: ClassDecoratorContext<T>
): T {
  // Validar que se aplica a una clase
  if (context.kind !== "class") {
    throw new Error("@Model can only be applied to classes");
  }

  // Leer metadata que @Id y @Prop dejaron
  const metadata = context.metadata as any;

  // Validar que hay un campo @Id
  const idField = metadata.idField;
  if (!idField) {
    throw new Error(
      `@Model class ${target.name} must have exactly one field decorated with @Id`
    );
  }

  // Obtener los campos @Prop (puede ser vacío si no hay ninguno)
  const propFields = metadata.propFields || [];

  // Crear objeto de metadata completo
  const modelMetadata: ModelMetadata = {
    modelClass: target,
    idField: idField,
    propFields: propFields,
  };

  // Registrar en el Store
  registerModelMetadata(modelMetadata);

  // Retornar la clase sin modificarla
  // Los decoradores de clase en TS5 pueden retornar una nueva clase,
  // pero en nuestro caso no necesitamos modificarla
  return target;
}
