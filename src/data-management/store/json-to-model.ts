/**
 * JSON-TO-MODEL CONVERTER
 *
 * Utilidad para convertir objetos JSON planos en instancias de modelos.
 * Usado por el decorador @Consume para transformar respuestas de APIs.
 *
 * PROBLEMA:
 * Las APIs retornan JSON plano: { id: "1", name: "Julian" }
 * Necesitamos instancias de modelos: new User("1", "Julian")
 *
 * SOLUCIÓN:
 * Esta función crea instancias correctamente usando el constructor del modelo.
 */

import { Constructor, ModelMetadata } from './types';
import { getModelMetadata } from './store';

/**
 * Convierte un objeto JSON plano en una instancia de modelo.
 *
 * @param modelClass - La clase del modelo (ej: User)
 * @param data - Objeto JSON plano con los datos
 * @returns Instancia del modelo con propiedades reactivas
 *
 * @example
 * const json = { id: "1", name: "Julian", email: "j@example.com" };
 * const user = jsonToModel(User, json);
 * // user es una instancia de User con propiedades reactivas
 */
export function jsonToModel<T>(
  modelClass: Constructor<T>,
  data: Record<string, any>
): T {
  // Obtener metadata del modelo
  const metadata = getModelMetadata(modelClass);

  if (!metadata) {
    throw new Error(
      `Cannot convert to model: ${modelClass.name} is not decorated with @Model`
    );
  }

  // ESTRATEGIA DE CONVERSIÓN:
  //
  // Opción 1: Constructor sin parámetros
  // Si el modelo tiene constructor(), creamos instancia vacía
  // y asignamos propiedades directamente.
  //
  // Opción 2: Constructor con parámetros
  // Intentamos inferir los parámetros del constructor
  // y pasarlos en orden.
  //
  // Para v1, usamos Opción 1 (más simple y robusto)

  // Crear instancia usando el constructor
  // Esto inicializa las Signals de @Prop correctamente
  const instance = new modelClass();

  // Asignar todas las propiedades del JSON a la instancia
  // Esto usa los setters de @Prop, que actualizan las Signals
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined && data[key] !== null) {
      (instance as any)[key] = data[key];
    }
  });

  return instance;
}

/**
 * Convierte un array de JSON en un array de instancias de modelo.
 *
 * @param modelClass - La clase del modelo
 * @param dataArray - Array de objetos JSON
 * @returns Array de instancias del modelo
 *
 * @example
 * const jsonArray = [
 *   { id: "1", name: "Julian" },
 *   { id: "2", name: "Alice" }
 * ];
 * const users = jsonArrayToModels(User, jsonArray);
 * // [User instance, User instance]
 */
export function jsonArrayToModels<T>(
  modelClass: Constructor<T>,
  dataArray: Record<string, any>[]
): T[] {
  return dataArray.map(data => jsonToModel(modelClass, data));
}

/**
 * Convierte cualquier respuesta (objeto o array) a modelo(s).
 *
 * @param modelClass - La clase del modelo
 * @param response - Puede ser un objeto o un array
 * @returns Instancia o array de instancias
 *
 * @example
 * // Objeto único
 * const user = convertResponse(User, { id: "1", name: "Julian" });
 *
 * // Array
 * const users = convertResponse(User, [{ id: "1" }, { id: "2" }]);
 */
export function convertResponse<T>(
  modelClass: Constructor<T>,
  response: any
): T | T[] {
  // Si es null o undefined, retornar tal cual
  if (response === null || response === undefined) {
    return response;
  }

  // Si es un array, convertir cada elemento
  if (Array.isArray(response)) {
    return jsonArrayToModels(modelClass, response);
  }

  // Si es un objeto, convertir a instancia única
  if (typeof response === 'object') {
    return jsonToModel(modelClass, response);
  }

  // Si es un valor primitivo, retornar tal cual
  // (Aunque esto sería raro en una API REST)
  return response;
}
