/**
 * STORE.TS - El almacén central normalizado de entidades
 *
 * VERSION 1: Básico, sin reactividad
 *
 * El Store mantiene un mapa de entidades organizadas por tipo de modelo.
 * Cada tipo de modelo tiene su propio Map<ID, Entity>.
 *
 * Ejemplo de estructura interna:
 *
 * entities: {
 *   User -> Map {
 *     "123" -> User { id: "123", name: "Julian" },
 *     "456" -> User { id: "456", name: "Alice" }
 *   },
 *   Article -> Map {
 *     "789" -> Article { id: "789", title: "..." }
 *   }
 * }
 */

import type { Constructor, Predicate, QueryResult, ModelMetadata } from './types';
import { Signal, ISignal } from '../../reactivity/signals/signal';
import { computed } from '../../reactivity/signals/computed';
import { Service } from '../../DI/decorators/service';

/**
 * Registry global de metadata de modelos
 * Llenado por el decorador @Model
 */
const modelMetadataRegistry = new Map<Constructor, ModelMetadata>();

/**
 * Registra metadata para un modelo
 * Llamado por el decorador @Model
 */
export function registerModelMetadata(metadata: ModelMetadata): void {
  modelMetadataRegistry.set(metadata.modelClass, metadata);
}

/**
 * Obtiene metadata de un modelo
 */
export function getModelMetadata(modelClass: Constructor): ModelMetadata | undefined {
  return modelMetadataRegistry.get(modelClass);
}

/**
 * EntityStore - Almacén central normalizado de todas las entidades
 */
@Service
export class EntityStore {
  /**
   * Estructura de almacenamiento principal
   * Map<TipoDeModelo, Map<ID, Instancia>>
   *
   * Ejemplo:
   * entities.get(User) -> Map { "123" -> userInstance }
   */
  private entities = new Map<Constructor, Map<string, any>>();

  /**
   * Sistema de notificación para queries reactivas
   * Map<TipoDeModelo, Signal<number>>
   *
   * Cada tipo de modelo tiene una signal que se incrementa cuando hay cambios.
   * Las queries reactivas se suscriben a esta signal.
   */
  private changeNotifiers = new Map<Constructor, ISignal<number>>();

  /**
   * Obtiene entidades que coinciden con un predicado
   *
   * @param modelClass - La clase del modelo (ej: User, Article)
   * @param predicate - Función que retorna true para items que quieres
   * @returns Array de instancias que pasaron el predicado
   *
   * REACTIVIDAD:
   * Si se llama dentro de un contexto reactivo (ej: dentro de @Store),
   * el resultado se actualizará automáticamente cuando el Store cambie.
   *
   * @example
   * // Snapshot estático (no reactivo)
   * const users = store.get(User, u => u.isActive);
   *
   * @example
   * // Reactivo (cuando se usa con @Store)
   * @Store
   * activeUsers = store.get(User, u => u.isActive);
   */
  get<T>(modelClass: Constructor<T>, predicate: Predicate<T>): QueryResult<T> {
    // Obtener la signal de notificación para trackear cambios
    // Esto hace que si estamos dentro de un computed/effect,
    // nos suscribamos a cambios en este tipo de modelo
    const changeNotifier = this.getChangeNotifier(modelClass);

    // Acceder a la signal (esto crea la suscripción si estamos en un effect/computed)
    changeNotifier.get();

    // Obtener el Map de entidades para este tipo de modelo
    const entityMap = this.entities.get(modelClass);

    // Si no existe, retornar array vacío
    if (!entityMap) {
      return [];
    }

    // Convertir el Map a array y filtrar con el predicado
    const allEntities = Array.from(entityMap.values()) as T[];
    return allEntities.filter(predicate);
  }

  /**
   * Almacena una o más entidades en el Store
   * Si la entidad ya existe (mismo ID), se actualiza
   *
   * @param modelClass - La clase del modelo
   * @param data - Una entidad o array de entidades
   *
   * @example
   * // Almacenar un usuario
   * store.set(User, userInstance);
   *
   * @example
   * // Almacenar múltiples usuarios
   * store.set(User, [user1, user2, user3]);
   */
  set<T>(modelClass: Constructor<T>, data: T | T[]): void {
    // Obtener metadata del modelo para saber cuál es el campo ID
    const metadata = getModelMetadata(modelClass);

    if (!metadata) {
      throw new Error(
        `No metadata found for ${modelClass.name}. Did you forget @Model decorator?`
      );
    }

    // Normalizar a array
    const entities = Array.isArray(data) ? data : [data];

    // Obtener o crear el Map para este tipo de modelo
    if (!this.entities.has(modelClass)) {
      this.entities.set(modelClass, new Map());
    }

    const entityMap = this.entities.get(modelClass)!;

    // Almacenar cada entidad por su ID
    for (const entity of entities) {
      const id = (entity as any)[metadata.idField];

      if (id === undefined || id === null) {
        console.warn(
          `Entity of type ${modelClass.name} has no ID field '${metadata.idField}'. Skipping.`,
          entity
        );
        continue;
      }

      // Almacenar o actualizar
      entityMap.set(String(id), entity);
    }

    // NUEVO: Notificar que hubo cambios
    this.notifyChange(modelClass);
  }

  /**
   * Elimina una entidad del Store
   *
   * @param modelClass - La clase del modelo
   * @param id - El ID de la entidad a eliminar
   * @returns true si se eliminó, false si no existía
   */
  delete<T>(modelClass: Constructor<T>, id: string): boolean {
    const entityMap = this.entities.get(modelClass);

    if (!entityMap) {
      return false;
    }

    const result = entityMap.delete(id);

    // NUEVO: Solo notificar si realmente se eliminó algo
    if (result) {
      this.notifyChange(modelClass);
    }

    return result;
  }

  /**
   * Limpia todas las entidades de un tipo de modelo
   *
   * @param modelClass - La clase del modelo a limpiar
   */
  clear<T>(modelClass: Constructor<T>): void {
    const entityMap = this.entities.get(modelClass);

    // Solo notificar si había entidades que limpiar
    if (entityMap && entityMap.size > 0) {
      this.entities.delete(modelClass);
      this.notifyChange(modelClass);
    }
  }

  /**
   * Limpia TODO el Store
   */
  clearAll(): void {
    // Notificar cambios para cada tipo de modelo antes de limpiar
    for (const modelClass of this.entities.keys()) {
      this.notifyChange(modelClass);
    }

    this.entities.clear();
  }

  /**
   * Obtiene el conteo de entidades de un tipo
   */
  count<T>(modelClass: Constructor<T>): number {
    const entityMap = this.entities.get(modelClass);
    return entityMap ? entityMap.size : 0;
  }

  /**
   * Obtiene o crea la signal de notificación para un tipo de modelo.
   * Esta signal se incrementa cada vez que hay cambios en ese tipo.
   *
   * @private
   */
  private getChangeNotifier<T>(modelClass: Constructor<T>): ISignal<number> {
    if (!this.changeNotifiers.has(modelClass)) {
      this.changeNotifiers.set(modelClass, new Signal(0));
    }
    return this.changeNotifiers.get(modelClass)!;
  }

  /**
   * Notifica que hubo un cambio en un tipo de modelo.
   * Esto triggerea la re-evaluación de todas las queries reactivas de ese tipo.
   *
   * @private
   */
  private notifyChange<T>(modelClass: Constructor<T>): void {
    const notifier = this.getChangeNotifier(modelClass);
    notifier.update(n => n + 1);
  }

  /**
   * Debug: Muestra el estado actual del EntityStore
   */
  debug(): void {
    console.log('=== ENTITY STORE DEBUG ===');
    for (const [modelClass, entityMap] of this.entities) {
      console.log(`${modelClass.name}: ${entityMap.size} entities`);
      for (const [id, entity] of entityMap) {
        console.log(`  - ${id}:`, entity);
      }
    }
    console.log('=========================');
  }
}
