import { effect } from "../../reactivity/signals/effect";
import { ChildValue } from "../types.js";
import { replaceNode } from "./dom-utils.js";

export function renderTextChild(parent: Element, child: ChildValue): void {
  const anchor = document.createComment("text-child");
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
