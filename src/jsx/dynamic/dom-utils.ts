import { ChildValue } from "../types";

export function isCustomElement(el: Element): boolean {
  return el.tagName.includes("-");
}

export function isValidChild(child: any): child is ChildValue {
  return child != null && typeof child !== "boolean";
}

export function isDOMNode(value: any): value is Node {
  return value && (value as any).nodeType;
}

export function replaceNode(
  anchor: Comment,
  oldNode: Node | null,
  newNode: Node,
): void {
  if (oldNode) {
    oldNode.parentNode?.replaceChild(newNode, oldNode);
  } else {
    anchor.parentNode?.insertBefore(newNode, anchor.nextSibling);
  }
}
