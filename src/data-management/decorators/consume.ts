/**
 * @Consume DECORATOR
 *
 * Decorador para métodos de Repository que automáticamente:
 * 1. Convierte la respuesta JSON a instancias de modelo
 * 2. Almacena las instancias en el Store
 * 3. Retorna las instancias (no el JSON)
 *
 * USO:
 * @Service
 * class UserRepository {
 *   @Consume(User)
 *   async findAll() {
 *     const response = await fetch('/api/users');
 *     return await response.json();
 *   }
 * }
 *
 * FLUJO:
 * 1. Usuario llama: await repo.findAll()
 * 2. @Consume ejecuta el método original
 * 3. Obtiene el JSON: [{ id: "1", name: "Julian" }, ...]
 * 4. Convierte a modelos: [User instance, User instance, ...]
 * 5. Almacena en Store: store.set(User, instances)
 * 6. Retorna las instancias al usuario
 *
 * RESULTADO:
 * - El usuario recibe instancias de User (no JSON)
 * - Las instancias ya están en el Store
 * - Las instancias son reactivas (@Prop)
 * - Los métodos de dominio funcionan (user.changeName())
 */

import type { Constructor } from '../store/types';
import { EntityStore } from '../store/store';
import { convertResponse } from '../store/json-to-model';

/**
 * @Consume - Decorador para métodos de Repository
 *
 * @param modelClass - La clase del modelo (ej: User, Article)
 *
 * @example
 * @Service
 * class UserRepository {
 *   @Consume(User)
 *   async findAll() {
 *     const response = await fetch('/api/users');
 *     return await response.json();
 *   }
 *
 *   @Consume(User)
 *   async findById(id: string) {
 *     const response = await fetch(`/api/users/${id}`);
 *     return await response.json();
 *   }
 * }
 *
 * // Uso:
 * const users = await repo.findAll();
 * // users es User[], no JSON
 * // users ya están en el Store
 * users[0].changeName('New Name'); // Métodos de dominio funcionan
 */
export function Consume<T>(modelClass: Constructor<T>) {
  return function <This extends object, Args extends any[], Return>(
    originalMethod: (this: This, ...args: Args) => Promise<Return>,
    context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => Promise<Return>
    >
  ) {
    // Validar que solo se aplica a métodos
    if (context.kind !== "method") {
      throw new Error("@Consume can only be applied to methods");
    }

    const methodName = String(context.name);

    // Retornar el método interceptado
    return async function (this: This, ...args: Args): Promise<any> {
      try {
        // 1. Ejecutar el método original (hace el fetch)
        const result = await originalMethod.apply(this, args);

        // 2. Si el resultado es null/undefined, retornar tal cual
        if (result === null || result === undefined) {
          return result;
        }

        // 3. Convertir JSON a instancias de modelo
        const instances = convertResponse(modelClass, result);

        // 4. Obtener EntityStore del DI container jerárquico
        const entityStore = (this as any).__container.get(EntityStore);

        // 5. Almacenar en el EntityStore
        // Normaliza por ID automáticamente
        entityStore.set(modelClass, instances as any);

        // 6. Retornar las instancias (no el JSON)
        return instances;

      } catch (error) {
        console.error(`[Consume] Error en ${methodName}():`, error);
        throw error;
      }
    };
  };
}
