/**
 * TYPES.TS - Tipos fundamentales del Data Management System
 *
 * Este archivo define los tipos core que todo el sistema usará.
 */

/**
 * Constructor type - cualquier clase que pueda ser instanciada
 */
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Metadata que cada @Model class tendrá
 * Esta metadata se registra cuando usas el decorador @Model
 */
export interface ModelMetadata {
  /**
   * La clase del modelo (ej: User, Article)
   */
  modelClass: Constructor;

  /**
   * El nombre del campo que es el ID (ej: 'id', 'userId', '_id')
   * Se determina por el decorador @Id
   */
  idField: string;

  /**
   * Nombres de los campos que son propiedades reactivas
   * Se determinan por el decorador @Prop
   */
  propFields: string[];
}

/**
 * Una entidad almacenada en el Store
 * Cada instancia de un @Model es una StoreEntity
 */
export interface StoreEntity {
  /**
   * El ID único de esta entidad
   * Extraído del campo marcado con @Id
   */
  [id: string]: any;
}

/**
 * Función predicado para queries
 * Ejemplos:
 *   - u => u.id === '123'
 *   - u => u.name.startsWith('A')
 *   - u => u.age > 18
 */
export type Predicate<T> = (item: T) => boolean;

/**
 * El resultado de una query al Store
 * Por ahora es solo un array, pero eventualmente será reactivo
 */
export type QueryResult<T> = T[];
