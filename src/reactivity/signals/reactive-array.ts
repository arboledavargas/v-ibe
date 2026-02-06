import { Subscriber } from '../types.js';
import { reactiveContext } from '../reactive-context.js';
import { phaseScheduler } from '../phase-scheduler.js';
import { getOrCreateReactive } from '../reactive-cache.js';
import { ArrayStrategy, OwnedArrayStrategy, DerivedArrayStrategy, FilteredArrayStrategy } from './array-strategies.js';

export type { Subscriber };

/**
 * ReactiveArray - Array reactivo con tracking granular y soporte para derivación
 *
 * MODOS DE OPERACIÓN:
 * 1. Modo Normal: Array con datos propios (mutable)
 * 2. Modo Derivado: Array que deriva sus valores de otro ReactiveArray (read-only)
 *
 * Tracking granular por tipo de operación:
 * - 'mutation': Cualquier operación que modifique el array (push, pop, splice, etc.)
 * - 'length': Específicamente cuando cambia la longitud
 * - Índices numéricos: Acceso a elementos específicos (ej: array[0])
 *
 * Esto permite que effects reaccionen solo a los cambios relevantes:
 * - Un effect que solo lee `length` no se re-ejecuta cuando cambias array[5]
 * - Un effect que lee array[0] solo se re-ejecuta si ese índice específico cambia
 *
 * DERIVACIÓN CON MEMOIZACIÓN GRANULAR:
 * - map() y filter() retornan ReactiveArray derivados
 * - Cada elemento tiene su propio tracking de dependencias
 * - Solo se invalidan los elementos cuyos inputs específicos cambiaron
 */
// Cache entry para map() memoizado
interface MapCacheEntry<U> {
  derived: ReactiveArray<U>;
  externalDeps: Set<any>;  // Signals externas que el callback leyó
  depsValues: any[];       // Valores de esas signals al momento de crear el derived
}

export class ReactiveArray<T> {
  private strategy: ArrayStrategy<T>;
  private ownedStrategy?: OwnedArrayStrategy<T>;
  private subscribers = new Map<string | number, Set<Subscriber>>();
  private onChangeCallback?: (operation: string, ...args: any[]) => void;

  // Cache para map() - permite reutilizar el mismo array derivado
  private mapCache = new Map<string, MapCacheEntry<any>>();

  constructor(itemsOrConfig?: T[] | { source: ReactiveArray<any>, transform: (value: any, index: number) => T } | { source: ReactiveArray<T>, predicate: (value: T, index: number, array: T[]) => boolean }) {
    if (Array.isArray(itemsOrConfig) || itemsOrConfig === undefined) {
      // Modo normal: array con datos propios
      const items = itemsOrConfig || [];
      this.ownedStrategy = new OwnedArrayStrategy([...items]);
      this.strategy = this.ownedStrategy;
    } else {
      // Modo derivado: array que deriva de otro
      const { source } = itemsOrConfig;

      if ('transform' in itemsOrConfig) {
        // Derived array con transform
        this.strategy = new DerivedArrayStrategy(
          source,
          itemsOrConfig.transform,
          () => this._notifyMutation()
        );
      } else if ('predicate' in itemsOrConfig) {
        // Filtered array con predicate
        this.strategy = new FilteredArrayStrategy(
          source,
          itemsOrConfig.predicate,
          () => this._notifyMutation()
        );
      } else {
        throw new Error('Config must contain either transform or predicate');
      }
    }
  }

  /**
   * Registra un callback que se llama síncronamente antes de notificar subscribers
   */
  onChange(callback: (operation: string, ...args: any[]) => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * Retorna el array plano subyacente (sin reactividad)
   * Útil para serialización o interoperación con código no reactivo
   */
  getPlainValue(): T[] {
    return this.strategy.getItems();
  }

  /**
   * Getter reactivo para la longitud del array
   */
  get length(): number {
    // Registrar tracking si hay un computation activo
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('length', reactiveContext.currentComputation);
    }
    return this.strategy.getLength();
  }

  /**
   * Método at() reactivo que soporta índices negativos
   * Similar a array.at() pero con tracking granular por índice
   */
  at(index: number): T | undefined {
    const normalizedIndex = index < 0 ? this.strategy.getLength() + index : index;

    // Registrar tracking si hay un computation activo
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe(normalizedIndex, reactiveContext.currentComputation);
    }

    const value = this.strategy.getAt(index);

    // Auto-wrapping de objetos/arrays
    if (value !== null && value !== undefined && (typeof value === 'object' || Array.isArray(value))) {
      const wrapped = getOrCreateReactive(value) as T;
      return wrapped;
    }

    return value;
  }

  /**
   * Asegura que el array esté en modo owned (tiene datos propios)
   * Lanza error si se intenta mutar un array derivado
   */
  private ensureOwned(): OwnedArrayStrategy<T> {
    if (!this.ownedStrategy) {
      throw new Error('Cannot mutate a derived array. Derived arrays are read-only.');
    }
    return this.ownedStrategy;
  }

  // --- MÉTODOS MUTADORES ---

  push(...items: T[]): number {
    const owned = this.ensureOwned();
    const oldLength = this.strategy.getLength();
    const result = owned.push(...items);

    if (this.onChangeCallback) {
      this.onChangeCallback('push', items);
    }

    // Notificar: hubo una mutación Y cambió la longitud
    this._notifyMutation();
    if (result !== oldLength) {
      this._notifyLength();
    }

    return result;
  }

  pop(): T | undefined {
    const owned = this.ensureOwned();
    const oldLength = this.strategy.getLength();
    const result = owned.pop();

    if (this.onChangeCallback) {
      this.onChangeCallback('pop', result);
    }

    if (oldLength !== this.strategy.getLength()) {
      this._notifyLength();
      // Notificar el índice que fue eliminado
      this._notify(oldLength - 1);
    }
    this._notifyMutation();

    return result;
  }

  shift(): T | undefined {
    const owned = this.ensureOwned();
    const oldLength = this.strategy.getLength();
    const result = owned.shift();

    if (this.onChangeCallback) {
      this.onChangeCallback('shift');
    }

    if (oldLength !== this.strategy.getLength()) {
      this._notifyLength();
    }
    // shift mueve todos los índices, así que notificamos todos
    this._notifyAllIndices();
    this._notifyMutation();

    return result;
  }

  unshift(...items: T[]): number {
    const owned = this.ensureOwned();
    const oldLength = this.strategy.getLength();
    const result = owned.unshift(...items);

    if (this.onChangeCallback) {
      this.onChangeCallback('unshift', items);
    }

    // Notificar mutación y longitud
    this._notifyMutation();
    if (result !== oldLength) {
      this._notifyLength();
    }
    // unshift mueve todos los índices existentes, así que notificamos todos
    this._notifyAllIndices();

    return result;
  }

  splice(start: number, deleteCount?: number, ...items: T[]): T[] {
    const owned = this.ensureOwned();
    const oldLength = this.strategy.getLength();
    const actualDeleteCount = deleteCount ?? oldLength - start;
    const result = owned.splice(start, actualDeleteCount, ...items);

    if (this.onChangeCallback) {
      this.onChangeCallback('splice', start, actualDeleteCount, ...items);
    }

    const itemsAdded = items.length;

    // Notificar mutación
    this._notifyMutation();

    // Notificar longitud si cambió
    if (oldLength !== this.strategy.getLength()) {
      this._notifyLength();
    }

    // Notificar índices afectados
    if (actualDeleteCount > 0 || itemsAdded > 0) {
      const startIndex = Math.max(0, start);
      // Si no hay desplazamiento (mismo número de items eliminados e insertados),
      // solo notificar los índices directamente modificados
      if (actualDeleteCount === itemsAdded) {
        // Notificar solo los índices del rango modificado
        for (let i = startIndex; i < startIndex + itemsAdded; i++) {
          this._notify(i);
        }
      } else {
        // Si hay desplazamiento, notificar todos los índices desde start
        this._notifyIndicesFrom(startIndex);
      }
    }

    return result;
  }

  sort(compareFn?: (a: T, b: T) => number): this {
    const owned = this.ensureOwned();

    if (this.onChangeCallback) {
      this.onChangeCallback('sort', compareFn);
    }

    owned.sort(compareFn);
    this._notifyMutation();
    this._notifyAllIndices(); // sort afecta potencialmente todos los elementos
    return this;
  }

  reverse(): this {
    const owned = this.ensureOwned();

    if (this.onChangeCallback) {
      this.onChangeCallback('reverse');
    }

    owned.reverse();
    this._notifyMutation();
    this._notifyAllIndices(); // reverse afecta todos los elementos
    return this;
  }

  fill(value: T, start?: number, end?: number): this {
    const owned = this.ensureOwned();

    if (this.onChangeCallback) {
      this.onChangeCallback('fill', value, start, end);
    }

    owned.fill(value, start, end);
    this._notifyMutation();

    // Notificar índices afectados por fill
    const actualStart = start ?? 0;
    const actualEnd = end ?? this.strategy.getLength();
    if (actualStart < actualEnd) {
      this._notifyIndicesFrom(actualStart);
    }
    return this;
  }

  // --- MÉTODOS NO-MUTADORES (LECTURA) ---

  /**
   * map() ahora retorna un ReactiveArray derivado, no un array plano
   * Este es el corazón de tu insight: mantener la reactividad en la cadena
   *
   * MEMOIZACIÓN INTELIGENTE:
   * - Cachea el array derivado por toString() del callback
   * - Captura dependencias externas (signals que el callback lee)
   * - Si las dependencias no cambiaron, retorna el MISMO array derivado
   * - Esto permite granularidad: push/pop solo afectan nuevos elementos
   */
  map<U>(callback: (value: T, index: number, array: T[]) => U): ReactiveArray<U> {
    // Registrar tracking si hay un computation activo
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }

    const callbackStr = callback.toString();

    // Verificar si ya tenemos un derived cacheado
    if (this.mapCache.has(callbackStr)) {
      const cached = this.mapCache.get(callbackStr)!;

      // Verificar si las dependencias externas cambiaron
      const currentDepsValues = Array.from(cached.externalDeps).map(dep => {
        try {
          return dep.get ? dep.get() : dep;
        } catch {
          return dep;
        }
      });

      const depsChanged = cached.depsValues.length !== currentDepsValues.length ||
        cached.depsValues.some((v, i) => v !== currentDepsValues[i]);

      if (!depsChanged) {
        // Las dependencias no cambiaron, retornar el mismo derived
        return cached.derived as ReactiveArray<U>;
      }

      // Las dependencias cambiaron, eliminar del cache para crear uno nuevo
      this.mapCache.delete(callbackStr);
    }

    // Capturar dependencias externas durante la primera ejecución del callback
    const externalDeps = new Set<any>();
    const prevOnTrack = reactiveContext.onTrack;

    // Wrapper que captura dependencias
    const wrappedCallback = (value: T, index: number) => {
      // Configurar tracking para capturar signals leídas
      const originalOnTrack = reactiveContext.onTrack;
      reactiveContext.onTrack = (signal) => {
        // Solo capturar signals que NO son parte del source array
        externalDeps.add(signal);
        if (originalOnTrack) originalOnTrack(signal);
      };

      try {
        return callback(value, index, this.strategy.getItems());
      } finally {
        reactiveContext.onTrack = originalOnTrack;
      }
    };

    // Crear nuevo ReactiveArray derivado
    const derived = new ReactiveArray<U>({
      source: this,
      transform: wrappedCallback
    });

    // Ejecutar una vez para capturar dependencias (si hay elementos)
    if (this.length > 0) {
      const prevTracking = reactiveContext.isTracking;
      reactiveContext.setTracking(true);
      try {
        derived.at(0); // Esto ejecuta el callback y captura deps
      } finally {
        reactiveContext.setTracking(prevTracking);
      }
    }

    // Guardar en cache
    const depsValues = Array.from(externalDeps).map(dep => {
      try {
        return dep.get ? dep.get() : dep;
      } catch {
        return dep;
      }
    });

    this.mapCache.set(callbackStr, {
      derived,
      externalDeps,
      depsValues
    });

    return derived;
  }

  /**
   * filter() también retorna un ReactiveArray derivado
   * Implementación especial que necesita manejar índices no lineales
   */
  filter(callback: (value: T, index: number, array: T[]) => boolean): ReactiveArray<T> {
    // Registrar tracking si hay un computation activo
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }

    // Retornar un nuevo ReactiveArray en modo derivado usando FilteredArrayStrategy
    return new ReactiveArray<T>({
      source: this,
      predicate: callback
    });
  }

  slice(start?: number, end?: number): T[] {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    // Retornar un array plano con los elementos sliceados
    return this.strategy.getItems().slice(start, end);
  }

  concat(...items: (T | T[])[]): T[] {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }

    const base = this.strategy.getItems();
    const result = [...base];

    for (const item of items) {
      if (Array.isArray(item)) {
        result.push(...item);
      } else {
        result.push(item);
      }
    }

    return result;
  }

  find(callback: (value: T, index: number, array: T[]) => boolean): T | undefined {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().find(callback);
  }

  findIndex(callback: (value: T, index: number, array: T[]) => boolean): number {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().findIndex(callback);
  }

  indexOf(searchElement: T, fromIndex?: number): number {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().indexOf(searchElement, fromIndex);
  }

  includes(searchElement: T, fromIndex?: number): boolean {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().includes(searchElement, fromIndex);
  }

  forEach(callback: (value: T, index: number, array: T[]) => void): void {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    this.strategy.getItems().forEach(callback);
  }

  some(callback: (value: T, index: number, array: T[]) => boolean): boolean {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().some(callback);
  }

  every(callback: (value: T, index: number, array: T[]) => boolean): boolean {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().every(callback);
  }

  reduce<U>(callback: (accumulator: U, value: T, index: number, array: T[]) => U, initialValue: U): U {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().reduce(callback, initialValue);
  }

  reduceRight<U>(callback: (accumulator: U, value: T, index: number, array: T[]) => U, initialValue: U): U {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().reduceRight(callback, initialValue);
  }

  // --- MÉTODOS DE CONVERSIÓN ---

  join(separator?: string): string {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().join(separator);
  }

  toString(): string {
    return this.strategy.getItems().toString();
  }

  toLocaleString(): string {
    return this.strategy.getItems().toLocaleString();
  }

  // --- ITERADORES ---

  [Symbol.iterator](): IterableIterator<T> {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems()[Symbol.iterator]();
  }

  entries(): IterableIterator<[number, T]> {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().entries();
  }

  keys(): IterableIterator<number> {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().keys();
  }

  values(): IterableIterator<T> {
    if (reactiveContext.currentComputation && reactiveContext.isTracking) {
      this._subscribe('mutation', reactiveContext.currentComputation);
    }
    return this.strategy.getItems().values();
  }

  // --- GESTIÓN INTERNA DE SUBSCRIPTIONS ---

  /**
   * Registra un subscriber para un tipo específico de cambio
   */
  private _subscribe(key: string | number, subscriber: Subscriber): void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(subscriber);
  }

  /**
   * Notifica a subscribers de un tipo específico de cambio
   */
  private _notify(key: string | number): void {
    const subs = this.subscribers.get(key);
    if (subs && subs.size > 0) {
      subs.forEach((subscriber) => {
        if (subscriber._isComputation) {
          subscriber();
        } else {
          phaseScheduler.schedule(subscriber);
        }
      });
    }
  }

  /**
   * Notifica que el array mutó (cualquier cambio en contenido)
   */
  private _notifyMutation(): void {
    this._notify('mutation');
  }

  /**
   * Notifica que la longitud cambió
   */
  private _notifyLength(): void {
    this._notify('length');
  }

  /**
   * Notifica a todos los índices numéricos suscritos
   * Se usa cuando operaciones como shift/unshift/splice afectan múltiples índices
   */
  private _notifyAllIndices(): void {
    for (const key of this.subscribers.keys()) {
      if (typeof key === 'number') {
        this._notify(key);
      }
    }
  }

  /**
   * Notifica todos los índices desde start hacia adelante
   * Útil cuando splice/insert afecta índices posteriores
   */
  private _notifyIndicesFrom(start: number): void {
    for (const key of this.subscribers.keys()) {
      if (typeof key === 'number' && key >= start) {
        this._notify(key);
      }
    }
  }

  // --- MÉTODOS DE DEBUG/INSPECCIÓN ---

  getSubscribers(key: string | number): Set<Subscriber> | undefined {
    return this.subscribers.get(key);
  }

  getSubscribedKeys(): (string | number)[] {
    return Array.from(this.subscribers.keys());
  }
}

// Aliases and helper functions for backwards compatibility
export type ObservableArray<T> = ReactiveArray<T>;
export type Collection<T> = ReactiveArray<T>;

/**
 * Factory function to create a new ReactiveArray
 */
export function collection<T>(items?: T[]): ReactiveArray<T> {
  return new ReactiveArray(items);
}

/**
 * Type guard to check if a value is a ReactiveArray
 */
export function isObservableArray(value: any): value is ReactiveArray<any> {
  return value instanceof ReactiveArray;
}

/**
 * Type guard to check if a value is a Collection (same as ObservableArray)
 */
export function isCollection(value: any): value is ReactiveArray<any> {
  return value instanceof ReactiveArray;
}

/**
 * Type guard to check if a value is a ReactiveArray OR a proxy wrapping a ReactiveArray
 * This is useful in JSX rendering where arrays might be wrapped in proxies
 */
export function isReactiveArrayLike(value: any): boolean {
  // Direct ReactiveArray instance
  if (value instanceof ReactiveArray) return true;
  // Proxy wrapping a ReactiveArray (has __isReactive and __getReactiveArray)
  if (value && typeof value === 'object' && value.__isReactive && value.__getReactiveArray) {
    return true;
  }
  return false;
}

/**
 * Unwraps a ReactiveArray from a proxy if necessary
 * Returns the underlying ReactiveArray or null if the value is not a ReactiveArray
 */
export function unwrapReactiveArray<T = any>(value: any): ReactiveArray<T> | null {
  // Direct ReactiveArray instance
  if (value instanceof ReactiveArray) return value;
  // Proxy wrapping a ReactiveArray
  if (value && typeof value === 'object' && value.__isReactive && value.__getReactiveArray) {
    return value.__getReactiveArray;
  }
  return null;
}
