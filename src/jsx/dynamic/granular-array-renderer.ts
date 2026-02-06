import { effect } from "../../reactivity/signals/effect";
import { ChildValue } from "../types.js";
import { isDOMNode, replaceNode } from "./dom-utils.js";
import { unwrapReactiveArray, ReactiveArray } from "../../reactivity/signals/reactive-array.js";
import { CompositeSignal } from "../../reactivity/signals/composite.js";

interface ReactiveEntry {
  anchor: Comment;
  currentNode: Node | null;
  cleanup?: () => void;
}

interface ArrayState {
  keyMap: Map<string, Node>;
  nodeOrder: string[];
  reactiveEntries: Map<string, ReactiveEntry>;
}

/**
 * GRANULAR ARRAY RENDERER - Acceso por índice en lugar de iteración
 * 
 * La clave es NO iterar con for...of sino acceder a elementos por índice.
 * Esto permite que cada elemento tenga su propio effect que solo se suscribe
 * a cambios en ese índice específico.
 * 
 * Reconciliación:
 * 1. Leer length (se suscribe a cambios de longitud)
 * 2. Para cada índice 0..length-1, crear/reutilizar un effect individual
 * 3. Cada effect accede a array.at(i), suscribiéndose solo a ese índice
 * 4. Cuando array[i] cambia, solo ese effect se re-ejecuta
 * 
 * IMPORTANTE: Requiere que el array sea un ReactiveArray real, no un array plano.
 */
export function renderArrayChildGranular(
  parent: Element | ShadowRoot,
  arrayLike: any,
): void {
  const anchor = document.createComment("array-child-granular");
  parent.appendChild(anchor);

  // Unwrap si es un proxy que contiene un ReactiveArray
  const reactiveArray = unwrapReactiveArray(arrayLike);
  
  if (!reactiveArray) {
    console.warn('[Granular Renderer] Value is not a ReactiveArray, cannot use granular rendering');
    return;
  }
  
  // Estado persistente del array
  let arrayState: ArrayState = {
    keyMap: new Map(),
    nodeOrder: [],
    reactiveEntries: new Map(),
  };
  
  // Map para trackear effects por key
  const effectCleanups = new Map<string, () => void>();

  // Effect ESTRUCTURAL: solo se re-ejecuta cuando cambia la longitud
  effect(
    () => {
      // CLAVE: Acceder a .length reactivamente
      // Esto se suscribe SOLO a cambios de 'length', no a 'mutation'
      const currentLength = reactiveArray.length;
      
      // console.log('[Granular Renderer] Structural effect running, length:', currentLength);
      
      const newNodeOrder: string[] = [];
      const keysToCreate = new Set<string>();
      const existingKeys = new Set(arrayState.nodeOrder);

      // Primera pasada: determinar qué keys necesitamos
      // IMPORTANTE: NO leemos los elementos aquí, solo generamos keys por índice
      for (let i = 0; i < currentLength; i++) {
        const key = `__index_${i}`;
        newNodeOrder.push(key);
        
        if (!existingKeys.has(key)) {
          keysToCreate.add(key);
        }
      }
      
      // Remover keys que ya no existen
      for (const oldKey of existingKeys) {
        if (!newNodeOrder.includes(oldKey)) {
          removeKey(arrayState, effectCleanups, oldKey);
        }
      }
      
      // Crear effects para nuevos keys
      for (const key of keysToCreate) {
        const index = newNodeOrder.indexOf(key);
        // Solo crear si no existe ya (prevenir duplicados)
        if (!arrayState.reactiveEntries.has(key)) {
          createKeyEffect(
            parent,
            arrayState,
            effectCleanups,
            key,
            index,
            reactiveArray
          );
        }
      }

      // Reordenar nodos según newNodeOrder
      reorderNodes(anchor, arrayState.keyMap, newNodeOrder);
      arrayState.nodeOrder = newNodeOrder;
    },
    { priority: "Frame" },
  );
}

/**
 * Crea un effect individual para un key específico
 * Este effect se suscribe SOLO al índice de ese elemento
 */
function createKeyEffect(
  parent: Element | ShadowRoot,
  arrayState: ArrayState,
  effectCleanups: Map<string, () => void>,
  key: string,
  index: number,
  reactiveArray: ReactiveArray<any>,
): void {
  // console.log('[Granular Renderer] Creating effect for key:', key, 'index:', index);
  
  // Crear anchor para este elemento y agregarlo al DOM
  const anchor = document.createComment(`reactive-array-child-${key}`);
  parent.appendChild(anchor); // IMPORTANTE: Agregar el anchor al DOM primero
  
  const entry: ReactiveEntry = { anchor, currentNode: null };
  arrayState.reactiveEntries.set(key, entry);
  arrayState.keyMap.set(key, anchor);
  
  // Effect GRANULAR: solo se re-ejecuta cuando cambia reactiveArray.at(index)
  const effectHandle = effect(() => {
    // console.log('[Granular Renderer] Element effect running for key:', key, 'index:', index);
    
    // CLAVE: Acceder por .at(index), no iterar
    // Si es ReactiveArray, esto se suscribe al índice específico
    let item = reactiveArray.at(index);
    
    // Unwrap CompositeSignal if it wraps a DOM node
    if (item instanceof CompositeSignal) {
      const plainValue = item.getPlainValue();
      if (isDOMNode(plainValue)) {
        item = plainValue as Node;
      }
    }
    
    if (item == null || typeof item === "boolean") {
      if (entry.currentNode) {
        entry.currentNode.parentNode?.removeChild(entry.currentNode);
        entry.currentNode = null;
      }
      return;
    }

    // Handle functions (reactive children)
    if (typeof item === "function") {
      const value = item();
      
      if (value == null || typeof value === "boolean") {
        if (entry.currentNode) {
          entry.currentNode.parentNode?.removeChild(entry.currentNode);
          entry.currentNode = null;
        }
        return;
      }
      
      if (isDOMNode(value)) {
        const newNode = value as Node;
        if (entry.currentNode !== newNode) {
          replaceNode(anchor, entry.currentNode, newNode);
          entry.currentNode = newNode;
        }
        return;
      }
      
      const text = String(value);
      if (entry.currentNode && entry.currentNode.nodeType === Node.TEXT_NODE) {
        (entry.currentNode as Text).nodeValue = text;
      } else {
        const newNode = document.createTextNode(text);
        replaceNode(anchor, entry.currentNode, newNode);
        entry.currentNode = newNode;
      }
      return;
    }

    // Handle DOM nodes
    if (isDOMNode(item)) {
      const newNode = item as Node;
      if (entry.currentNode !== newNode) {
        replaceNode(anchor, entry.currentNode, newNode);
        entry.currentNode = newNode;
      }
      return;
    }

    // Handle text/numbers
    const text = String(item);
    if (entry.currentNode && entry.currentNode.nodeType === Node.TEXT_NODE) {
      (entry.currentNode as Text).nodeValue = text;
    } else {
      const newNode = document.createTextNode(text);
      replaceNode(anchor, entry.currentNode, newNode);
      entry.currentNode = newNode;
    }
  }, { priority: "Frame" });
  
  // Guardar la función dispose para limpieza posterior
  effectCleanups.set(key, effectHandle.dispose);
}

/**
 * Remueve un key y su effect asociado
 */
function removeKey(
  arrayState: ArrayState,
  effectCleanups: Map<string, () => void>,
  key: string,
): void {
  // console.log('[Granular Renderer] Removing key:', key);
  
  // Cleanup effect
  const cleanup = effectCleanups.get(key);
  if (cleanup) {
    cleanup();
    effectCleanups.delete(key);
  }
  
  // Remove entry and its nodes
  const entry = arrayState.reactiveEntries.get(key);
  if (entry) {
    // Remove current node if exists
    if (entry.currentNode) {
      entry.currentNode.parentNode?.removeChild(entry.currentNode);
    }
    // Remove anchor
    if (entry.anchor && entry.anchor.parentNode) {
      entry.anchor.parentNode.removeChild(entry.anchor);
    }
    arrayState.reactiveEntries.delete(key);
  }
  
  // Remove from keyMap
  arrayState.keyMap.delete(key);
}

function reorderNodes(
  anchor: Comment,
  keyMap: Map<string, Node>,
  newOrder: string[],
): void {
  let previousNode: Node = anchor;

  newOrder.forEach((key) => {
    const node = keyMap.get(key);
    if (!node) return;

    if (previousNode.nextSibling !== node) {
      previousNode.parentNode?.insertBefore(node, previousNode.nextSibling);
    }

    previousNode = node;
  });
}
