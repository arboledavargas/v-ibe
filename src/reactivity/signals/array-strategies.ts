import { Subscriber } from '../types.js';
import { reactiveContext } from '../reactive-context.js';
import { withContext } from '../context-scope.js';
import type { ReactiveArray } from './reactive-array.js';
import { getOrCreateReactive } from '../reactive-cache.js';

/**
 * Estrategia interna para manejar el acceso a elementos
 * Permite que ReactiveArray funcione tanto con datos propios como derivados
 */
export interface ArrayStrategy<T> {
  getLength(): number;
  getAt(index: number): T | undefined;
  getItems(): T[];
  isOwned(): boolean;
}

/**
 * Estrategia normal: array con datos propios que pueden ser mutados
 * Envuelve automáticamente objetos y arrays con getOrCreateReactive para composición bidireccional
 */
export class OwnedArrayStrategy<T> implements ArrayStrategy<T> {
  constructor(private items: T[]) {
    // CLAVE: Envolver automáticamente cada elemento al construir
    this.items = items.map(item => getOrCreateReactive(item) as T);
  }
  
  getLength(): number {
    return this.items.length;
  }
  
  getAt(index: number): T | undefined {
    const normalized = index < 0 ? this.items.length + index : index;
    return this.items[normalized];
  }
  
  getItems(): T[] {
    return this.items;
  }
  
  isOwned(): boolean {
    return true;
  }
  
  // CLAVE: Envolver elementos automáticamente en todas las mutaciones
  
  push(...items: T[]): number {
    // Envolver cada elemento antes de agregarlo
    const wrappedItems = items.map(item => getOrCreateReactive(item) as T);
    return this.items.push(...wrappedItems);
  }
  
  pop(): T | undefined {
    return this.items.pop();
  }
  
  shift(): T | undefined {
    return this.items.shift();
  }
  
  unshift(...items: T[]): number {
    const wrappedItems = items.map(item => getOrCreateReactive(item) as T);
    return this.items.unshift(...wrappedItems);
  }
  
  splice(start: number, deleteCount?: number, ...items: T[]): T[] {
    const wrappedItems = items.map(item => getOrCreateReactive(item) as T);
    return this.items.splice(start, deleteCount ?? this.items.length - start, ...wrappedItems);
  }
  
  sort(compareFn?: (a: T, b: T) => number): void {
    this.items.sort(compareFn);
  }
  
  reverse(): void {
    this.items.reverse();
  }
  
  fill(value: T, start?: number, end?: number): void {
    const wrappedValue = getOrCreateReactive(value) as T;
    this.items.fill(wrappedValue, start, end);
  }
}

/**
 * Estrategia derivada: array que computa sus valores desde otro array
 * Implementa memoización granular por elemento
 * 
 * El truco clave aquí es que cada elemento tiene su propio subscriber,
 * entonces cuando se transforma un elemento, registramos qué propiedades
 * del objeto fuente se leyeron. Solo invalidamos el caché del elemento
 * si esas propiedades específicas cambian.
 * 
 * OPTIMIZACIÓN DE CACHÉ:
 * - push: NO limpia el caché, solo marca que hay nuevos elementos
 * - pop: Solo remueve el último elemento del caché
 * - Otras operaciones: Comportamiento conservador (limpia caché afectado)
 */
export class DerivedArrayStrategy<TSource, TResult> implements ArrayStrategy<TResult> {
  private sourceArray: ReactiveArray<TSource>;
  private transformFn: (value: TSource, index: number) => TResult;
  
  // Caché de resultados por índice
  private cache = new Map<number, TResult>();
  
  // Subscribers por elemento para detectar cambios granulares
  private elementSubscribers = new Map<number, Subscriber>();
  
  // Flag de invalidación estructural (longitud o reordenamiento)
  private structurallyInvalid = true;
  
  // Longitud conocida del source (para detectar cambios en pop)
  private knownSourceLength = 0;

  constructor(
    sourceArray: ReactiveArray<TSource>,
    transformFn: (value: TSource, index: number) => TResult,
    private notifyChange: () => void // Callback para notificar al ReactiveArray padre
  ) {
    this.sourceArray = sourceArray;
    this.transformFn = transformFn;
    this.setupSourceTracking();
  }

  /**
   * Configura el tracking para cambios estructurales (longitud y mutation)
   * 
   * Usa DOS mecanismos:
   * 1. onChange() para saber qué tipo de operación y optimizar el caché
   * 2. Suscripción reactiva a 'mutation' para disparar re-ejecución de effects externos
   */
  private setupSourceTracking(): void {
    // 1. Usar onChange para detectar qué operación específica ocurrió
    // Esto permite optimizar el caché según el tipo de operación
    this.sourceArray.onChange((operation: string, ...args: any[]) => {
      this.handleSourceChange(operation, args);
    });
    
    // 2. Suscribirse reactivamente a 'mutation' del source para que effects externos se re-ejecuten
    // Este subscriber dispara notifyChange() que a su vez notifica a los subscribers del derived
    const reactiveSubscriber: Subscriber = () => {
      // Este subscriber se ejecuta cuando el source muta
      // Solo necesita llamar a notifyChange para que effects externos se re-ejecuten
      this.notifyChange();
    };
    reactiveSubscriber._isComputation = true;
    
    // Suscribirse a mutation del source array
    // @ts-ignore - accessing private method for internal use
    this.sourceArray._subscribe('mutation', reactiveSubscriber);
    
    // Inicializar la longitud conocida
    this.knownSourceLength = this.sourceArray.length;
  }
  
  /**
   * Maneja cambios del array fuente de forma inteligente según la operación
   */
  private handleSourceChange(operation: string, args: any[]): void {
    const newLength = this.sourceArray.length;
    
    switch (operation) {
      case 'push':
        // OPTIMIZACIÓN: push solo agrega al final, NO invalida elementos existentes
        // Solo actualizamos la longitud conocida
        this.knownSourceLength = newLength;
        // NO limpiamos el caché - los elementos existentes siguen válidos
        // structurallyInvalid se mantiene false si ya estaba false
        break;
        
      case 'pop':
        // OPTIMIZACIÓN: pop solo remueve del final
        // Remover el último elemento del caché si existe
        const removedIndex = this.knownSourceLength - 1;
        if (removedIndex >= 0) {
          this.cache.delete(removedIndex);
          this.elementSubscribers.delete(removedIndex);
        }
        this.knownSourceLength = newLength;
        // NO limpiamos todo el caché - los elementos restantes siguen válidos
        break;
        
      case 'shift':
      case 'unshift':
      case 'splice':
      case 'sort':
      case 'reverse':
      case 'fill':
        // Estas operaciones pueden afectar múltiples índices
        // Por seguridad, limpiamos todo el caché
        this.invalidateAll();
        this.knownSourceLength = newLength;
        break;
        
      default:
        // Operación desconocida - comportamiento conservador
        this.invalidateAll();
        this.knownSourceLength = newLength;
        break;
    }
    // NOTA: No llamamos notifyChange() aquí porque el reactiveSubscriber ya lo hace
    // cuando detecta la mutación del source array
  }
  
  /**
   * Invalida todo el caché (comportamiento conservador)
   */
  private invalidateAll(): void {
    this.structurallyInvalid = true;
    this.cache.clear();
    this.elementSubscribers.clear();
  }

  getLength(): number {
    return this.sourceArray.length;
  }

  /**
   * Este es el método más importante: obtiene un elemento con memoización granular
   * 
   * La magia sucede aquí:
   * 1. Si el elemento está en caché y no hay invalidación estructural, lo devuelve
   * 2. Si no, ejecuta la transformación en un contexto de tracking
   * 3. Las propiedades accedidas durante la transformación se registran
   * 4. Solo si esas propiedades específicas cambian, se invalida el caché
   */
  getAt(index: number): TResult | undefined {
    const normalized = index < 0 ? this.getLength() + index : index;
    
    // Si el índice está fuera de rango, retornar undefined
    if (normalized < 0 || normalized >= this.getLength()) {
      return undefined;
    }
    
    // Verificar caché
    if (!this.structurallyInvalid && this.cache.has(normalized)) {
      return this.cache.get(normalized)!;
    }
    
    // Crear o reusar subscriber para este elemento
    if (!this.elementSubscribers.has(normalized)) {
      const elementSubscriber: Subscriber = () => {
        // Cuando una dependencia de este elemento cambia,
        // invalidar solo este elemento específico
        this.cache.delete(normalized);
        this.notifyChange();
      };
      elementSubscriber._isComputation = true;
      this.elementSubscribers.set(normalized, elementSubscriber);
    }
    
    // Ejecutar transformación con tracking
    // Esto registrará qué propiedades se acceden durante la transformación
    // Usando ContextScope (RAII) para garantizar cleanup automático
    return withContext(this.elementSubscribers.get(normalized)!, true, () => {
      const sourceElement = this.sourceArray.at(normalized);
      const result = this.transformFn(sourceElement, normalized);
      
      // Cachear resultado
      this.cache.set(normalized, result);
      this.structurallyInvalid = false;
      
      return result;
    });
  }

  getItems(): TResult[] {
    const length = this.getLength();
    const result: TResult[] = [];
    
    for (let i = 0; i < length; i++) {
      const item = this.getAt(i);
      result.push(item as TResult);
    }
    
    return result;
  }
  
  isOwned(): boolean {
    return false;
  }
}

/**
 * Estrategia derivada para arrays filtrados
 * Mantiene una relación entre índices filtrados y fuente
 * 
 * La complejidad aquí es que los índices no son lineales:
 * - filtered[0] podría corresponder a source[2]
 * - filtered[1] podría corresponder a source[4]
 * 
 * Esta estrategia mantiene dos mapeos:
 * 1. sourceIndex -> filteredIndex (o -1 si no pasa el filtro)
 * 2. filteredIndex -> sourceIndex
 */
export class FilteredArrayStrategy<T> implements ArrayStrategy<T> {
  private sourceArray: ReactiveArray<T>;
  private predicateFn: (value: T, index: number, array: T[]) => boolean;
  
  // Caché de elementos filtrados
  private filteredCache: T[] = [];
  
  // Mapeos entre índices
  private sourceToFiltered = new Map<number, number>(); // sourceIndex -> filteredIndex (o -1)
  private filteredToSource = new Map<number, number>(); // filteredIndex -> sourceIndex
  
  // Subscribers para elementos filtrados individuales
  private elementSubscribers = new Map<number, Subscriber>();
  
  // Flag de invalidación estructural
  private structurallyInvalid = true;
  
  // Subscriber para cambios estructurales
  private structuralSubscriber?: Subscriber;

  constructor(
    sourceArray: ReactiveArray<T>,
    predicateFn: (value: T, index: number, array: T[]) => boolean,
    private notifyChange: () => void // Callback para notificar al ReactiveArray padre
  ) {
    this.sourceArray = sourceArray;
    this.predicateFn = predicateFn;
    this.setupSourceTracking();
  }

  /**
   * Configura tracking para cambios estructurales y mutation
   */
  private setupSourceTracking(): void {
    const structuralSubscriber: Subscriber = () => {
      this.structurallyInvalid = true;
      this.filteredCache = [];
      this.sourceToFiltered.clear();
      this.filteredToSource.clear();
      this.elementSubscribers.clear();
      this.notifyChange();
    };
    structuralSubscriber._isComputation = true;
    this.structuralSubscriber = structuralSubscriber;
    
    // Suscribirse a cambios de longitud y mutation del array fuente
    // Usando ContextScope (RAII) para garantizar cleanup automático
    withContext(structuralSubscriber, true, () => {
      // Acceder a length para registrar el subscriber
      void this.sourceArray.length;
      
      // Suscribirse manualmente a mutation
      // @ts-ignore - accessing private method for internal use
      this.sourceArray._subscribe('mutation', structuralSubscriber);
    });
  }

  /**
   * Recalcula los mapeos y cache si es necesario
   */
  private recalculateIfNeeded(): void {
    if (!this.structurallyInvalid && this.filteredCache.length > 0) {
      return;
    }
    
    this.filteredCache = [];
    this.sourceToFiltered.clear();
    this.filteredToSource.clear();
    
    const sourceLength = this.sourceArray.length;
    let filteredIndex = 0;
    
    for (let sourceIndex = 0; sourceIndex < sourceLength; sourceIndex++) {
      // Crear o reusar subscriber para este elemento fuente
      if (!this.elementSubscribers.has(sourceIndex)) {
        const elementSubscriber: Subscriber = () => {
          // Cuando este elemento fuente cambia, invalidar toda la estructura
          // porque podría cambiar si pasa o no el filtro
          this.structurallyInvalid = true;
          this.notifyChange();
        };
        elementSubscriber._isComputation = true;
        this.elementSubscribers.set(sourceIndex, elementSubscriber);
      }
      
      // Ejecutar predicado con tracking
      // Usando ContextScope (RAII) para garantizar cleanup automático
      withContext(this.elementSubscribers.get(sourceIndex)!, true, () => {
        const sourceElement = this.sourceArray.at(sourceIndex);
        const sourceItems = this.sourceArray.getPlainValue();
        const passesFilter = this.predicateFn(sourceElement, sourceIndex, sourceItems);
        
        if (passesFilter) {
          this.filteredCache.push(sourceElement);
          this.sourceToFiltered.set(sourceIndex, filteredIndex);
          this.filteredToSource.set(filteredIndex, sourceIndex);
          filteredIndex++;
        } else {
          this.sourceToFiltered.set(sourceIndex, -1); // No pasa el filtro
        }
      });
    }
    
    this.structurallyInvalid = false;
  }

  getLength(): number {
    this.recalculateIfNeeded();
    return this.filteredCache.length;
  }

  getAt(index: number): T | undefined {
    this.recalculateIfNeeded();
    
    const normalized = index < 0 ? this.filteredCache.length + index : index;
    if (normalized < 0 || normalized >= this.filteredCache.length) {
      return undefined;
    }
    
    return this.filteredCache[normalized];
  }

  getItems(): T[] {
    this.recalculateIfNeeded();
    return [...this.filteredCache];
  }
  
  isOwned(): boolean {
    return false;
  }
}
