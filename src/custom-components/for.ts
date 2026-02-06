/**
 * FOR COMPONENT - Fine-Grained Reactivity with ReactiveArray
 * 
 * Este componente aprovecha la granularidad fina de ReactiveArray para actualizar
 * SOLO los elementos específicos que cambian, sin re-renderizar todo el array.
 * 
 * Características clave:
 * - Tracking por índice: cada elemento tiene su propio effect
 * - Solo el índice modificado dispara un cambio
 * - Reconciliación estructural separada de cambios de contenido
 * - Compatible con signals, arrays planos, y funciones
 * 
 * Transformación JSX:
 *   <For each={array}>{(item, index) => ...}</For>
 * 
 * Compila a:
 *   For({ each: array, children: (item, index) => ... })
 */

import { effect } from '../reactivity/signals/effect';
import { ISignal } from '../reactivity/signals/signal';
import { ReactiveArray } from '../reactivity/signals/reactive-array';
import { CompositeSignal } from '../reactivity/signals/composite';

/**
 * Tipo para el handle del effect
 */
type EffectHandle = ReturnType<typeof effect>;

/**
 * Props del componente For
 */
export interface ForProps<T> {
  /**
   * Array de items a renderizar.
   * Para granularidad fina óptima, debe ser un ReactiveArray (via @State).
   * También acepta: Signal<T[]>, función, o array plano.
   */
  each: T[] | (() => T[]) | ISignal<T[]> | ReactiveArray<T>;
  
  /**
   * Función de render para cada item.
   * IMPORTANTE: Esta función se ejecuta DENTRO de un effect individual por item.
   * Cambios en array[i] solo re-ejecutan el effect del índice i.
   */
  children: (item: T, index: number) => any;
  
  /**
   * Elemento a mostrar cuando el array está vacío.
   */
  fallback?: any;
  
  /**
   * Función para extraer key única de cada item.
   * Si no se provee, usa auto-keying (id, key, _id, uuid).
   * Para granularidad óptima, es mejor que los items tengan IDs estables.
   */
  getKey?: (item: T, index: number) => string | number;
}

/**
 * Información de un elemento individual en el DOM
 */
interface ReactiveEntry {
  anchor: Comment;
  currentNode: Node | null;
  effectHandle: EffectHandle | null;
}

/**
 * Estado persistente del array renderizado
 */
interface ArrayState {
  keyMap: Map<string, Node>;
  nodeOrder: string[];
  reactiveEntries: Map<string, ReactiveEntry>;
}

/**
 * For - Helper con granularidad fina para listas
 * 
 * @example Granularidad fina con @State
 * ```tsx
 * @Component
 * class TodoList extends BaseComponent {
 *   @State todos: Todo[] = [...];
 *   
 *   view() {
 *     return (
 *       <For each={this.todos}>
 *         {(todo) => <TodoItem key={todo.id} todo={todo} />}
 *       </For>
 *     );
 *   }
 * }
 * // Solo los TodoItem que cambian se re-renderizan
 * ```
 * 
 * @example Con array plano (sin granularidad fina)
 * ```tsx
 * <For each={[1, 2, 3]}>
 *   {(n) => <div>{n}</div>}
 * </For>
 * // Funciona, pero re-renderiza todo cuando cambia
 * ```
 */
export function For<T>(props: ForProps<T>): DocumentFragment {
  const container = document.createDocumentFragment();
  const mainAnchor = document.createComment('for-list');
  container.appendChild(mainAnchor);
    
    // Estado persistente
    const arrayState: ArrayState = {
      keyMap: new Map(),
      nodeOrder: [],
      reactiveEntries: new Map(),
    };
    
    const effectCleanups = new Map<string, () => void>();
    
    // Detectar si el array es un ReactiveArray para granularidad fina
    const reactiveArray = unwrapReactiveArray(props.each);
    
    if (reactiveArray) {
      // ============================================================
      // RUTA OPTIMIZADA: Granularidad fina con ReactiveArray
      // ============================================================
      renderGranular(
        mainAnchor,
        reactiveArray,
        props.children,
        props.getKey,
        props.fallback,
        arrayState,
        effectCleanups
      );
    } else {
      // ============================================================
      // RUTA ESTÁNDAR: Re-render completo para arrays no reactivos
      // ============================================================
      renderStandard(
        mainAnchor,
        props.each,
        props.children,
        props.getKey,
        props.fallback,
        arrayState,
        effectCleanups
      );
  }
  
  return container;
}

/**
 * GRANULAR RENDERING: Para ReactiveArray
 * 
 * Estrategia:
 * 1. Effect estructural: Solo se re-ejecuta cuando cambia array.length
 * 2. Effects individuales: Uno por elemento, se re-ejecuta cuando cambia array[i]
 * 3. Reconciliación: Solo agrega/remueve elementos cuando cambia la estructura
 */
function renderGranular<T>(
  mainAnchor: Comment,
  reactiveArray: ReactiveArray<T>,
  renderFn: (item: T, index: number) => any,
  getKey: ((item: T, index: number) => string | number) | undefined,
  fallback: any,
  arrayState: ArrayState,
  effectCleanups: Map<string, () => void>
): void {
  console.log('[For] Using GRANULAR rendering (ReactiveArray detected)');
  
  // Effect ESTRUCTURAL: solo se ejecuta cuando cambia length
  effect(() => {
    // CLAVE: Acceder a .length reactivamente
    // Esto solo trackea cambios de longitud, NO de contenido
    const currentLength = reactiveArray.length;
    
    console.log(`[For] Structural effect - length: ${currentLength}`);
    
    // Empty state
    if (currentLength === 0 && fallback) {
      renderFallback(mainAnchor, arrayState, effectCleanups, fallback);
      return;
    }
    
    // Si había fallback pero ahora hay items, limpiarlo
    if (currentLength > 0 && arrayState.nodeOrder.includes('__fallback__')) {
      removeKey(arrayState, effectCleanups, '__fallback__');
    }
    
    const newNodeOrder: string[] = [];
    const existingKeys = new Set(arrayState.nodeOrder);
    
    // Primera pasada: determinar qué keys necesitamos
    // NO leemos los elementos, solo generamos keys por índice
    for (let i = 0; i < currentLength; i++) {
      const key = `__index_${i}`;
      newNodeOrder.push(key);
      
      if (!existingKeys.has(key)) {
        // Crear effect individual para este índice
        createItemEffect(
          mainAnchor,
          arrayState,
          effectCleanups,
          key,
          i,
          reactiveArray,
          renderFn,
          getKey
        );
      }
    }
    
    // Remover keys que ya no existen
    for (const oldKey of existingKeys) {
      if (!newNodeOrder.includes(oldKey)) {
        removeKey(arrayState, effectCleanups, oldKey);
      }
    }
    
    // Reordenar nodos según newNodeOrder
    reorderNodes(mainAnchor, arrayState.keyMap, newNodeOrder);
    arrayState.nodeOrder = newNodeOrder;
    
  });
}

/**
 * STANDARD RENDERING: Para arrays planos, signals, o funciones
 * 
 * Estrategia:
 * 1. Un solo effect que monitorea todo el array
 * 2. Re-renderiza completamente cuando cambia cualquier cosa
 * 3. Reconciliación con keying para reutilizar nodos
 */
function renderStandard<T>(
  mainAnchor: Comment,
  arraySource: T[] | (() => T[]) | ISignal<T[]> | ReactiveArray<T>,
  renderFn: (item: T, index: number) => any,
  getKey: ((item: T, index: number) => string | number) | undefined,
  fallback: any,
  arrayState: ArrayState,
  effectCleanups: Map<string, () => void>
): void {
  console.log('[For] Using STANDARD rendering (non-ReactiveArray)');
  
  effect(() => {
    // Resolver el array completo
    const items = resolveArray(arraySource);
    
    console.log(`[For] Standard effect - ${items.length} items`);
    
    // Empty state
    if (items.length === 0 && fallback) {
      renderFallback(mainAnchor, arrayState, effectCleanups, fallback);
      return;
    }
    
    // Si había fallback pero ahora hay items, limpiarlo
    if (items.length > 0 && arrayState.nodeOrder.includes('__fallback__')) {
      removeKey(arrayState, effectCleanups, '__fallback__');
    }
    
    const newNodeOrder: string[] = [];
    const usedNodes = new Set<Node>();
    
    // Renderizar cada item
    items.forEach((item, index) => {
      // Extraer o generar key
      const key = extractKey(item, index, getKey);
      newNodeOrder.push(key);
      
      // Renderizar el elemento
      const renderedElement = renderFn(item, index);
      
      // Reutilizar o crear nodo
      let node = reuseOrCreateNode(
        arrayState.keyMap,
        key,
        renderedElement
      );
      
      usedNodes.add(node);
    });
    
    // Remover nodos no usados
    removeUnusedNodes(arrayState.keyMap, usedNodes);
    
    // Reordenar
    reorderNodes(mainAnchor, arrayState.keyMap, newNodeOrder);
    arrayState.nodeOrder = newNodeOrder;
    
  });
}

/**
 * Crea un effect individual para un elemento específico del array
 * Este effect SOLO se re-ejecuta cuando cambia reactiveArray[index]
 */
function createItemEffect<T>(
  mainAnchor: Comment,
  arrayState: ArrayState,
  effectCleanups: Map<string, () => void>,
  key: string,
  index: number,
  reactiveArray: ReactiveArray<T>,
  renderFn: (item: T, index: number) => any,
  getKey: ((item: T, index: number) => string | number) | undefined
): void {
  console.log(`[For] Creating item effect for index ${index}`);
  
  // Crear anchor para este elemento
  const anchor = document.createComment(`for-item-${key}`);
  mainAnchor.parentNode?.appendChild(anchor);
  
  const entry: ReactiveEntry = {
    anchor,
    currentNode: null,
    effectHandle: null
  };
  
  arrayState.reactiveEntries.set(key, entry);
  
  // Effect GRANULAR: solo se ejecuta cuando cambia reactiveArray[index]
  const effectHandle = effect(() => {
    console.log(`[For] Item effect running for index ${index}`);
    
    // CLAVE: Acceder por .at(index)
    // Esto trackea SOLO cambios en este índice específico
    let item = reactiveArray.at(index);
    
    // Unwrap CompositeSignal si es necesario
    if (item && typeof item === 'object' && (item as any).isSignal) {
      if (item instanceof CompositeSignal) {
        item = (item as any).getPlainValue();
      }
    }
    
    // Null/undefined/boolean - remover nodo
    if (item == null || typeof item === 'boolean') {
      if (entry.currentNode) {
        entry.currentNode.parentNode?.removeChild(entry.currentNode);
        entry.currentNode = null;
        // Update keyMap to point to anchor when there's no node
        arrayState.keyMap.set(key, anchor);
      }
      return;
    }
    
    // Renderizar el elemento usando la función del usuario
    const renderedElement = renderFn(item as T, index);
    
    // Convertir elemento renderizado a nodo DOM
    const newNode = elementToNode(renderedElement);
    
    // Actualizar el DOM
    if (entry.currentNode !== newNode) {
      replaceNode(anchor, entry.currentNode, newNode);
      entry.currentNode = newNode;
      // CRITICAL: Update keyMap to point to the actual element node, not the anchor
      arrayState.keyMap.set(key, newNode);
    }
    
  });
  
  // Guardar el handle para cleanup
  entry.effectHandle = effectHandle;
  effectCleanups.set(key, effectHandle.dispose);
}

/**
 * Renderiza el fallback cuando el array está vacío
 */
function renderFallback(
  mainAnchor: Comment,
  arrayState: ArrayState,
  effectCleanups: Map<string, () => void>,
  fallback: any
): void {
  // Si ya existe el fallback, no hacer nada
  if (arrayState.nodeOrder.includes('__fallback__')) {
    return;
  }
  
  // Limpiar todo lo demás
  for (const key of arrayState.nodeOrder) {
    removeKey(arrayState, effectCleanups, key);
  }
  
  // Renderizar fallback
  const fallbackNode = elementToNode(fallback);
  mainAnchor.parentNode?.insertBefore(fallbackNode, mainAnchor.nextSibling);
  
  arrayState.keyMap.set('__fallback__', fallbackNode);
  arrayState.nodeOrder = ['__fallback__'];
}

/**
 * Remueve un key y su effect asociado
 */
function removeKey(
  arrayState: ArrayState,
  effectCleanups: Map<string, () => void>,
  key: string
): void {
  console.log(`[For] Removing key: ${key}`);
  
  // Cleanup effect
  const cleanup = effectCleanups.get(key);
  if (cleanup) {
    cleanup();
    effectCleanups.delete(key);
  }
  
  // Remove entry
  const entry = arrayState.reactiveEntries.get(key);
  if (entry) {
    if (entry.currentNode) {
      entry.currentNode.parentNode?.removeChild(entry.currentNode);
    }
    if (entry.anchor && entry.anchor.parentNode) {
      entry.anchor.parentNode.removeChild(entry.anchor);
    }
    arrayState.reactiveEntries.delete(key);
  }
  
  // Remove from keyMap
  const node = arrayState.keyMap.get(key);
  if (node && node.parentNode) {
    node.parentNode.removeChild(node);
  }
  arrayState.keyMap.delete(key);
}

/**
 * Reordena nodos en el DOM según el orden especificado
 */
function reorderNodes(
  anchor: Comment,
  keyMap: Map<string, Node>,
  newOrder: string[]
): void {
  let previousNode: Node = anchor;
  
  newOrder.forEach((key) => {
    const node = keyMap.get(key);
    if (!node) return;
    
    // Si el nodo no tiene parent, insertarlo
    if (!node.parentNode) {
      anchor.parentNode?.insertBefore(node, previousNode.nextSibling);
    } else if (previousNode.nextSibling !== node) {
      // Si ya está en el DOM pero en posición incorrecta, reordenar
      previousNode.parentNode?.insertBefore(node, previousNode.nextSibling);
    }
    
    previousNode = node;
  });
}

/**
 * Intenta unwrap un ReactiveArray de un proxy o signal
 */
function unwrapReactiveArray<T>(source: any): ReactiveArray<T> | null {
  // Si ya es ReactiveArray
  if (source instanceof ReactiveArray) {
    return source;
  }
  
  // Si es función, ejecutarla primero y procesar recursivamente
  if (typeof source === 'function') {
    const value = source();
    return unwrapReactiveArray(value);
  }
  
  // Si es un proxy que contiene un ReactiveArray
  if (source && typeof source === 'object') {
    // IMPORTANTE: Usar __getReactiveArray (propiedad del proxy creado por @State)
    const getReactive = (source as any).__getReactiveArray;
    if (getReactive instanceof ReactiveArray) {
      return getReactive;
    }
    
    // Fallback: intentar acceder a la propiedad interna
    const internal = (source as any).__reactiveArray__;
    if (internal instanceof ReactiveArray) {
      return internal;
    }
    
    // Intentar Symbol.for('reactiveArray')
    const symbolKey = Symbol.for('reactiveArray');
    const viaSymbol = (source as any)[symbolKey];
    if (viaSymbol instanceof ReactiveArray) {
      return viaSymbol;
    }
  }
  
  // Si es una signal que contiene un ReactiveArray
  if (source && typeof source === 'object' && (source as any).isSignal) {
    const value = (source as ISignal<any>).get();
    return unwrapReactiveArray(value);
  }
  
  return null;
}

/**
 * Resuelve el array desde diferentes tipos de sources
 */
function resolveArray<T>(source: any): T[] {
  // Signal
  if (source && typeof source === 'object' && (source as any).isSignal) {
    const value = (source as ISignal<any>).get();
    return Array.isArray(value) ? value : [];
  }
  
  // Función
  if (typeof source === 'function') {
    const value = source();
    return Array.isArray(value) ? value : [];
  }
  
  // Array directo o ReactiveArray
  if (Array.isArray(source)) {
    return source;
  }
  
  return [];
}

/**
 * Extrae la key de un item
 */
function extractKey<T>(
  item: T,
  index: number,
  getKey?: (item: T, index: number) => string | number
): string {
  // 1. getKey explícito
  if (getKey) {
    return String(getKey(item, index));
  }
  
  // 2. Auto-key de propiedades comunes
  if (item && typeof item === 'object') {
    const obj = item as any;
    
    if (obj.id != null) return String(obj.id);
    if (obj.key != null) return String(obj.key);
    if (obj._id != null) return String(obj._id);
    if (obj.uuid != null) return String(obj.uuid);
  }
  
  // 3. Fallback a index
  return `__index_${index}`;
}

/**
 * Reutiliza o crea un nodo DOM
 */
function reuseOrCreateNode(
  keyMap: Map<string, Node>,
  key: string,
  element: any
): Node {
  const existingNode = keyMap.get(key);
  const newNode = elementToNode(element);
  
  // Si existe y es el mismo tipo, reutilizar
  if (existingNode && existingNode.nodeName === newNode.nodeName) {
    // Actualizar contenido si es texto
    if (existingNode.nodeType === Node.TEXT_NODE && newNode.nodeType === Node.TEXT_NODE) {
      existingNode.textContent = newNode.textContent;
      return existingNode;
    }
    // Para elementos, crear nuevo
    existingNode.parentNode?.replaceChild(newNode, existingNode);
    keyMap.set(key, newNode);
    return newNode;
  }
  
  keyMap.set(key, newNode);
  return newNode;
}

/**
 * Remueve nodos no usados
 */
function removeUnusedNodes(
  keyMap: Map<string, Node>,
  usedNodes: Set<Node>
): void {
  for (const [key, node] of keyMap.entries()) {
    if (!usedNodes.has(node)) {
      node.parentNode?.removeChild(node);
      keyMap.delete(key);
    }
  }
}

/**
 * Convierte un elemento JSX a nodo DOM
 */
function elementToNode(element: any): Node {
  if (element == null || typeof element === 'boolean') {
    return document.createTextNode('');
  }
  
  if (typeof element === 'string' || typeof element === 'number') {
    return document.createTextNode(String(element));
  }
  
  if (element instanceof Node) {
    return element;
  }
  
  // Si es una función (factory), ejecutarla
  if (typeof element === 'function') {
    const result = element();
    return elementToNode(result); // Recursivo
  }
  
  // DocumentFragment
  if (element instanceof DocumentFragment) {
    // Si el fragment tiene un solo hijo, retornar ese hijo directamente
    if (element.childNodes.length === 1) {
      const child = element.firstChild!;
      // Remover del fragment para evitar que se pierda
      element.removeChild(child);
      return child;
    }
    
    // Si tiene múltiples hijos, crear un wrapper
    const wrapper = document.createElement('span');
    wrapper.style.display = 'contents'; // El wrapper no afecta el layout
    // Mover todos los nodos del fragment al wrapper
    while (element.firstChild) {
      wrapper.appendChild(element.firstChild);
    }
    return wrapper;
  }
  
  // JSX element object - debería tener props y type
  if (element && typeof element === 'object') {
    console.warn('[For] Received unknown object type:', element);
    return document.createTextNode(JSON.stringify(element));
  }
  
  return document.createTextNode('');
}

/**
 * Reemplaza un nodo en el DOM
 */
function replaceNode(
  anchor: Comment,
  oldNode: Node | null,
  newNode: Node
): void {
  if (oldNode) {
    anchor.parentNode?.replaceChild(newNode, oldNode);
  } else {
    anchor.parentNode?.insertBefore(newNode, anchor.nextSibling);
  }
}
