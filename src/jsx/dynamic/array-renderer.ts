import { effect } from "../../reactivity/signals/effect";
import { ChildValue } from "../types.js";
import { isDOMNode, replaceNode } from "./dom-utils.js";

interface ReactiveEntry {
  anchor: Comment;
  currentNode: Node | null;
}

interface ArrayState {
  keyMap: Map<string, Node>;
  nodeOrder: string[];
  reactiveEntries: Map<string, ReactiveEntry>;
}

export function renderArrayChild(
  parent: Element | ShadowRoot,
  children: ChildValue[],
): void {
  const anchor = document.createComment("array-child");
  parent.appendChild(anchor);

  const getter =
    typeof children === "function" ? (children as () => any[]) : () => children;
  
  let arrayState: ArrayState = {
    keyMap: new Map(),
    nodeOrder: [],
    reactiveEntries: new Map(),
  };

  effect(
    () => {
      const items = getter();
      
      // Si no es iterable, salir
      if (!items || typeof items[Symbol.iterator] !== 'function') return;

      const newNodeOrder: string[] = [];
      const usedNodes = new Set<Node>();

      // Iterar directamente - funciona con arrays, ReactiveArrays, y cualquier iterable
      let index = 0;
      for (const item of items) {
        if (item == null || typeof item === "boolean") {
          index++;
          continue;
        }

        const key = extractKey(item, index);
        newNodeOrder.push(key);

        const node = reuseOrCreateNode(parent, arrayState, key, item);
        usedNodes.add(node);
        index++;
      }

      // Remove unused nodes
      removeUnusedNodes(arrayState, usedNodes);

      // Reorder nodes
      reorderNodes(anchor, arrayState.keyMap, newNodeOrder);

      arrayState.nodeOrder = newNodeOrder;
    },
    { priority: "Frame" },
  );
}

function extractKey(item: any, index: number): string {
  // Try different key extraction strategies
  if (item?.getAttribute?.("key")) {
    return String(item.getAttribute("key"));
  }
  if (item?.props?.key != null) {
    return String(item.props.key);
  }
  if (item?.key != null) {
    return String(item.key);
  }
  return `__index_${index}`;
}

function reuseOrCreateNode(
  parent: Element | ShadowRoot,
  arrayState: ArrayState,
  key: string,
  item: any,
): Node {
  const { keyMap, reactiveEntries } = arrayState;

  // Handle functions (reactive children)
  if (typeof item === "function") {
    return reuseOrCreateReactiveNode(parent, arrayState, key, item);
  }

  if (keyMap.has(key)) {
    const existingNode = keyMap.get(key)!;

    // If it's a different DOM node, replace it
    if (isDOMNode(item) && existingNode !== item) {
      const newNode = item as Node;
      existingNode.parentNode?.replaceChild(newNode, existingNode);
      keyMap.set(key, newNode);
      return newNode;
    }

    return existingNode;
  }

  // Create new node
  const node = isDOMNode(item)
    ? (item as Node)
    : document.createTextNode(String(item));

  keyMap.set(key, node);
  return node;
}

function reuseOrCreateReactiveNode(
  parent: Element | ShadowRoot,
  arrayState: ArrayState,
  key: string,
  fn: Function,
): Node {
  const { keyMap, reactiveEntries } = arrayState;

  // If we already have a reactive entry for this key, reuse the anchor
  if (reactiveEntries.has(key)) {
    const entry = reactiveEntries.get(key)!;
    // The effect is already running, just return the anchor
    return entry.anchor;
  }

  // Create a new anchor for this reactive child
  const anchor = document.createComment(`reactive-array-child-${key}`);
  const entry: ReactiveEntry = { anchor, currentNode: null };
  reactiveEntries.set(key, entry);
  keyMap.set(key, anchor);

  // Set up effect for this reactive child
  effect(() => {
    const value = fn();

    // Handle null/undefined/boolean
    if (value == null || typeof value === "boolean") {
      if (entry.currentNode) {
        entry.currentNode.parentNode?.removeChild(entry.currentNode);
        entry.currentNode = null;
      }
      return;
    }

    // Handle DOM nodes
    if (isDOMNode(value)) {
      const newNode = value as Node;
      if (entry.currentNode !== newNode) {
        replaceNode(anchor, entry.currentNode, newNode);
        entry.currentNode = newNode;
      }
      return;
    }

    // Handle text/numbers
    const text = String(value);
    if (entry.currentNode && entry.currentNode.nodeType === Node.TEXT_NODE) {
      (entry.currentNode as Text).nodeValue = text;
    } else {
      const newNode = document.createTextNode(text);
      replaceNode(anchor, entry.currentNode, newNode);
      entry.currentNode = newNode;
    }
  }, { priority: "Frame" });

  return anchor;
}

function removeUnusedNodes(
  arrayState: ArrayState,
  usedNodes: Set<Node>,
): void {
  const { keyMap, reactiveEntries } = arrayState;

  for (const [key, node] of keyMap.entries()) {
    if (!usedNodes.has(node)) {
      node.parentNode?.removeChild(node);
      keyMap.delete(key);

      // Also clean up reactive entry if exists
      if (reactiveEntries.has(key)) {
        const entry = reactiveEntries.get(key)!;
        if (entry.currentNode) {
          entry.currentNode.parentNode?.removeChild(entry.currentNode);
        }
        reactiveEntries.delete(key);
      }
    }
  }
}

function reorderNodes(
  anchor: Comment,
  keyMap: Map<string, Node>,
  newOrder: string[],
): void {
  let previousNode: Node = anchor;

  newOrder.forEach((key) => {
    const node = keyMap.get(key)!;

    if (previousNode.nextSibling !== node) {
      previousNode.parentNode?.insertBefore(node, previousNode.nextSibling);
    }

    previousNode = node;
  });
}
