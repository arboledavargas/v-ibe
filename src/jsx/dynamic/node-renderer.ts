import { effect } from "../../reactivity/signals/effect";
import { ChildValue } from "../types.js";
import { isDOMNode, replaceNode } from "./dom-utils.js";

export function renderNodeChild(parent: Element, child: ChildValue): void {
  if (isDOMNode(child)) {
    parent.appendChild(child as Node);
    return;
  }

  const anchor = document.createComment("node-child");
  parent.appendChild(anchor);

  const getter =
    typeof child === "function" ? (child as () => any) : () => child;
  let currentNode: Node | null = null;

  effect(
    () => {
      const value = getter();

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
          replaceNode(anchor, currentNode, newNode);
          currentNode = newNode;
        }
      }
    },
    { priority: "Frame" },
  );
}
