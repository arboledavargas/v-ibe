import { isSignal } from "../../reactivity/signals/signal";
import { effect } from "../../reactivity/signals/effect";
import { isValidChild, isDOMNode, replaceNode } from "./dom-utils.js";
import { renderArrayChild } from "./array-renderer.js";
import { isReactiveArrayLike } from "../../reactivity/signals/reactive-array.js";
import { renderArrayChildGranular } from "./granular-array-renderer.js";

/**
 * Verifica si un valor es iterable como array (array nativo, ReactiveArray, o cualquier iterable con length)
 */
function isIterable(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  return typeof value[Symbol.iterator] === 'function' && typeof value.length === 'number';
}

export function renderChild(parent: Element | ShadowRoot, child: any): void {
  if (!isValidChild(child)) return;

  // NUEVO: Detectar ReactiveArray y usar renderer granular
  if (isReactiveArrayLike(child)) {
    renderArrayChildGranular(parent, child);
    return;
  }

  if (isIterable(child)) {
    // Array normal, no reactivo
    renderArrayChild(parent, child);
  } else if (isDOMNode(child)) {
    parent.appendChild(child as Node);
  } else if (isSignal(child)) {
    renderSignalChild(parent, child);
  } else if (typeof child === "function") {
    renderReactiveChild(parent, child);
  } else {
    // Static text/number
    const textNode = document.createTextNode(String(child));
    parent.appendChild(textNode);
  }
}

function renderSignalChild(parent: Element | ShadowRoot, signal: any): void {
  const anchor = document.createComment("signal-child");
  parent.appendChild(anchor);

  let currentNode: Node | null = null;

  effect(
    () => {
      const value = signal.get(); // Explicit .get() call for auto-tracking

      if (value == null || typeof value === "boolean") {
        if (currentNode) {
          currentNode.parentNode?.removeChild(currentNode);
          currentNode = null;
        }
        return;
      }

      const text = String(value);
      if (currentNode && currentNode.nodeType === Node.TEXT_NODE) {
        (currentNode as Text).nodeValue = text;
      } else {
        const newNode = document.createTextNode(text);
        replaceNode(anchor, currentNode, newNode);
        currentNode = newNode;
      }
    },
    { priority: "Frame" },
  );
}

function renderReactiveChild(
  parent: Element | ShadowRoot,
  child: Function,
): void {
  const anchor = document.createComment("reactive-child");
  parent.appendChild(anchor);

  let currentNode: Node | null = null;
  let currentType: "text" | "node" | "array" | "empty" = "empty";

  // Contador para identificar cada effect único
  const effectId = Math.random().toString(36).substring(7);
  let executionCount = 0;

  effect(() => {
    executionCount++;
    const value = child(); // Execute function inside effect for auto-tracking

    // Handle null/undefined/boolean
    if (value == null || typeof value === "boolean") {
      if (currentNode) {
        currentNode.parentNode?.removeChild(currentNode);
        currentNode = null;
        currentType = "empty";
      }
      return;
    }

    // Handle iterables (arrays, ReactiveArrays, etc.)
    if (isIterable(value)) {
      // Si había otro tipo de nodo, limpiarlo
      if (currentType !== "array" && currentNode) {
        currentNode.parentNode?.removeChild(currentNode);
        currentNode = null;
      }
      
      // Reconciliar con los nodos existentes (no clear + re-insert)
      reconcileArrayNodes(anchor, value);
      currentType = "array";
      return;
    }

    // Handle functions (factories that return nodes)
    if (typeof value === 'function') {
      const result = value(); // Execute the factory
      
      // Handle the result recursively
      if (isDOMNode(result)) {
        const newNode = result as Node;
        if (currentType !== "node" || currentNode !== newNode) {
          replaceNode(anchor, currentNode, newNode);
          currentNode = newNode;
          currentType = "node";
        }
        return;
      }
      
      // If result is also a function, execute it (nested factories)
      if (typeof result === 'function') {
        const finalResult = result();
        if (isDOMNode(finalResult)) {
          const newNode = finalResult as Node;
          if (currentType !== "node" || currentNode !== newNode) {
            replaceNode(anchor, currentNode, newNode);
            currentNode = newNode;
            currentType = "node";
          }
          return;
        }
      }
    }

    // Handle DOM nodes
    if (isDOMNode(value)) {
      const newNode = value as Node;
      if (currentType !== "node" || currentNode !== newNode) {
        replaceNode(anchor, currentNode, newNode);
        currentNode = newNode;
        currentType = "node";
      }
      return;
    }

    // Handle text/numbers
    const text = String(value);
    if (currentType === "text" && currentNode) {
      (currentNode as Text).nodeValue = text;
    } else {
      const newNode = document.createTextNode(text);
      replaceNode(anchor, currentNode, newNode);
      currentNode = newNode;
      currentType = "text";
    }
  });
}

// Map to track array end markers for each anchor
const arrayEndMarkers = new WeakMap<Comment, Comment>();

// Helper to clear array nodes between anchor and end marker
function clearArrayNodes(anchor: Comment): void {
  const endMarker = arrayEndMarkers.get(anchor);
  if (!endMarker) return;
  
  const parent = anchor.parentNode;
  if (!parent) return;
  
  // Remove all nodes between anchor and endMarker
  let node = anchor.nextSibling;
  while (node && node !== endMarker) {
    const next = node.nextSibling;
    parent.removeChild(node);
    node = next;
  }
}

// Reconcile array nodes - only update what changed
function reconcileArrayNodes(anchor: Comment, items: Iterable<any>): void {
  const parent = anchor.parentNode;
  if (!parent) return;

  // Create or get end marker
  let endMarker = arrayEndMarkers.get(anchor);
  if (!endMarker) {
    endMarker = document.createComment("array-end");
    parent.insertBefore(endMarker, anchor.nextSibling);
    arrayEndMarkers.set(anchor, endMarker);
  }

  // Collect existing nodes between anchor and endMarker
  const existingNodes: Node[] = [];
  let node = anchor.nextSibling;
  while (node && node !== endMarker) {
    existingNodes.push(node);
    node = node.nextSibling;
  }

  // Collect new nodes from the iterable
  const newNodes: Node[] = [];
  for (const item of items) {
    if (item == null || typeof item === "boolean") {
      continue;
    }

    if (isDOMNode(item)) {
      newNodes.push(item as Node);
    } else if (typeof item === "function") {
      // For functions, we need special handling - create anchor for reactive child
      // For now, treat function results - but this is a simplified path
      const result = item();
      if (result != null && typeof result !== "boolean") {
        if (isDOMNode(result)) {
          newNodes.push(result as Node);
        } else {
          newNodes.push(document.createTextNode(String(result)));
        }
      }
    } else {
      newNodes.push(document.createTextNode(String(item)));
    }
  }

  // Reconcile: compare existing vs new nodes
  const maxLen = Math.max(existingNodes.length, newNodes.length);
  let insertionPoint: Node = anchor;

  for (let i = 0; i < maxLen; i++) {
    const existingNode = existingNodes[i];
    const newNode = newNodes[i];

    if (i < existingNodes.length && i < newNodes.length) {
      // Both exist - check if same node
      if (existingNode === newNode) {
        // Same node, no DOM operation needed
        insertionPoint = existingNode;
      } else {
        // Different node - replace
        parent.replaceChild(newNode, existingNode);
        insertionPoint = newNode;
      }
    } else if (i >= existingNodes.length) {
      // New node to add
      parent.insertBefore(newNode, endMarker);
      insertionPoint = newNode;
    } else {
      // Extra existing node to remove
      parent.removeChild(existingNode);
    }
  }
}

// Helper for rendering iterables in reactive context
function renderArrayInPlace(anchor: Comment, items: Iterable<any>): void {
  const parent = anchor.parentNode;
  if (!parent) return;

  // Create or get end marker
  let endMarker = arrayEndMarkers.get(anchor);
  if (!endMarker) {
    endMarker = document.createComment("array-end");
    parent.insertBefore(endMarker, anchor.nextSibling);
    arrayEndMarkers.set(anchor, endMarker);
  }

  let insertionPoint: Node = anchor;
  let index = 0;

  for (const item of items) {
    if (item == null || typeof item === "boolean") {
      index++;
      continue;
    }

    // Handle functions (nested arrow functions)
    if (typeof item === "function") {
      const childAnchor = document.createComment(`array-reactive-${index}`);
      parent.insertBefore(childAnchor, insertionPoint.nextSibling);
      insertionPoint = childAnchor;

      let currentNode: Node | null = null;

      effect(() => {
        const value = item();

        if (value == null || typeof value === "boolean") {
          if (currentNode) {
            currentNode.parentNode?.removeChild(currentNode);
            currentNode = null;
          }
          return;
        }

        if (isDOMNode(value)) {
          const newNode = value as Node;
          if (currentNode !== newNode) {
            replaceNode(childAnchor, currentNode, newNode);
            currentNode = newNode;
          }
          return;
        }

        const text = String(value);
        if (currentNode && currentNode.nodeType === Node.TEXT_NODE) {
          (currentNode as Text).nodeValue = text;
        } else {
          const newNode = document.createTextNode(text);
          replaceNode(childAnchor, currentNode, newNode);
          currentNode = newNode;
        }
      }, { priority: "Frame" });

      index++;
      continue;
    }

    let node: Node;
    if (isDOMNode(item)) {
      node = item as Node;
    } else {
      node = document.createTextNode(String(item));
    }

    parent.insertBefore(node, insertionPoint.nextSibling);
    insertionPoint = node;
    index++;
  }
}
