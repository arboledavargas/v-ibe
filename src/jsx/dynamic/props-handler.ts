import { isSignal, Signal, ISignal } from "../../reactivity/signals/signal";
import { effect } from "../../reactivity/signals/effect";

import { PropValue, ClassNameProp, StyleProp } from "../types";
import { isCustomElement } from "./dom-utils";
import { BehaviorManager } from "../../behaviors/behavior-manager";

export function bindProps(
  el: Element, 
  props: Record<string, PropValue>,
  behaviorManager?: BehaviorManager
): void {
  // STEP 1: Process Behaviors first (if BehaviorManager is provided)
  let domProps = props;
  
  if (behaviorManager) {
    // attachBehaviors returns which props were consumed by behaviors
    const consumed = behaviorManager.attachBehaviors(el, props);
    
    // Filter out consumed props so they don't get passed to DOM
    if (consumed.size > 0) {
      domProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !consumed.has(key))
      ) as Record<string, PropValue>;
    }
  }

  // STEP 2: Process DOM props (those not handled by behaviors)
  Object.entries(domProps).forEach(([key, value]) => {
    bindSingleProp(el, key, value);
  });
}

function bindSingleProp(
  el: Element, 
  key: string, 
  value: PropValue
): void {
  // Special handling for ref prop - highest priority
  if (key === "ref") {
    bindRefProp(el, value);
    return;
  }

  // Event handlers get priority - check first
  if (isEventProp(key)) {
    bindEventProp(el, key, value);
    return;
  }

  // Special handling for className and style props
  if (key === "className") {
    bindClassNameProp(el, value as ClassNameProp);
    return;
  }

  if (key === "style") {
    bindStyleProp(el, value as StyleProp);
    return;
  }

  // Regular prop binding logic (unchanged from original)
  if (isSignal(value)) {
    bindSignalProp(el, key, value as Signal<any>);
  } else if (typeof value === "function") {
    bindComputedProp(el, key, value as Function);
  } else {
    bindStaticProp(el, key, value);
  }
}

// NEW: Handle ref prop
function bindRefProp(el: Element, value: any): void {
  if (typeof value === "function") {
    // Callback ref: call immediately with the element
    value(el);
  } else if (isSignal(value)) {
    // Signal ref: set the element as the signal value
    value.set(el);
  } else if (value && typeof value === "object" && "current" in value) {
    // Object ref: set the current property
    value.current = el;
  }
}

// Enhanced event detection - now supports custom events
function isEventProp(key: string): boolean {
  return key.startsWith("on") && key.length > 2;
}

function bindEventProp(el: Element, key: string, value: any): void {
  // Extract event name (onClick -> click, onUserSelected -> userselected)
  const eventName = key.substring(2).toLowerCase();
  if (typeof value === "function") {
    el.addEventListener(eventName, value);
  }
}

// NEW: Specialized className binding
function bindClassNameProp(el: Element, value: ClassNameProp): void {
  if (isSignal(value)) {
    // Signal className - use effect for reactivity
    effect(
      () => {
        const currentValue = getSignalValue(value);
        applyClassName(el, currentValue);
      },
      { priority: "Frame" },
    );
  } else if (typeof value === "function") {
    // Computed className (from vite plugin transformation)
    effect(
      () => {
        const resolvedValue = value();
        applyClassName(el, resolvedValue);
      },
      { priority: "Frame" },
    );
  } else {
    // Static className
    applyClassName(el, value);
  }
}

// NEW: Specialized style binding
function bindStyleProp(el: Element, value: StyleProp): void {
  if (isSignal(value)) {
    // Signal style - use effect for reactivity
    effect(
      () => {
        const currentValue = getSignalValue(value);
        applyStyle(el, currentValue);
      },
      { priority: "Frame" },
    );
  } else if (typeof value === "function") {
    // Computed style (from vite plugin transformation)
    effect(
      () => {
        const resolvedValue = value();
        applyStyle(el, resolvedValue);
      },
      { priority: "Frame" },
    );
  } else {
    // Static style
    applyStyle(el, value);
  }
}

// Unchanged from original - for signals
function bindSignalProp(el: Element, key: string, signal: Signal<any>): void {
  if (isCustomElement(el)) {
    // Custom element: pass the signal directly
    (el as any)[key] = signal;
  } else {
    // Native element: set current value reactively
    effect(
      () => {
        const currentValue = getSignalValue(signal);
        setElementProperty(el, key, currentValue);
      },
      { priority: "Frame" },
    );
  }
}

// Unchanged from original - for computed props
function bindComputedProp(el: Element, key: string, fn: Function): void {
  effect(
    () => {
      const resolvedValue = fn();
      if (isCustomElement(el)) {
        (el as any)[key] = resolvedValue;
      } else {
        setElementProperty(el, key, resolvedValue);
      }
    },
    { priority: "Frame" },
  );
}

// Unchanged from original - for static values
function bindStaticProp(el: Element, key: string, value: any): void {
  if (isCustomElement(el)) {
    (el as any)[key] = value;
  } else {
    setElementProperty(el, key, value);
  }
}

// Unchanged from original - helper for signal value extraction
function getSignalValue(signal: ISignal<any>): any {
  try {
    return typeof signal.get === "function"
      ? signal.get()
      : ((signal as any).valueOf?.() ?? signal);
  } catch {
    return String(signal);
  }
}

// NEW: Smart className application
function applyClassName(el: Element, value: any): void {
  let classString = "";

  if (typeof value === "string") {
    classString = value;
  } else if (Array.isArray(value)) {
    // Handle array of classes: ['btn', 'primary', null, 'active']
    classString = value
      .filter((cls) => cls != null && cls !== false && cls !== "")
      .join(" ");
  } else if (typeof value === "object" && value !== null) {
    // Handle conditional object: { btn: true, active: isActive, disabled: false }
    classString = Object.entries(value)
      .filter(([className, condition]) => {
        if (typeof condition === "function") {
          return condition(); // Execute function conditions
        }
        if (isSignal(condition)) {
          return getSignalValue(condition); // Get signal value
        }
        return Boolean(condition); // Regular boolean check
      })
      .map(([className]) => className)
      .join(" ");
  }

  // Apply the final class string
  if (classString.trim()) {
    el.setAttribute("class", classString.trim());
  } else {
    el.removeAttribute("class");
  }
}

// NEW: Smart style application
function applyStyle(el: Element, value: any): void {
  const htmlEl = el as HTMLElement;

  if (typeof value === "string") {
    // String style: "color: red; font-size: 16px"
    htmlEl.style.cssText = value;
  } else if (typeof value === "object" && value !== null) {
    // Object style: { color: 'red', fontSize: 16, marginTop: null }

    // Clear existing inline styles to avoid conflicts
    htmlEl.style.cssText = "";

    Object.entries(value).forEach(([property, propValue]) => {
      if (propValue == null || propValue === "") {
        // Remove property if null/undefined/empty
        htmlEl.style.removeProperty(kebabCase(property));
      } else {
        // Set property value
        const cssProperty = kebabCase(property);
        const cssValue =
          typeof propValue === "number"
            ? addUnitIfNeeded(property, propValue)
            : String(propValue);

        htmlEl.style.setProperty(cssProperty, cssValue);
      }
    });
  } else if (value == null) {
    // Clear all styles if null/undefined
    htmlEl.style.cssText = "";
  }
}

// Helper: Convert camelCase to kebab-case for CSS properties
function kebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

// Helper: Add 'px' unit to numeric values for certain CSS properties
function addUnitIfNeeded(property: string, value: number): string {
  // Properties that typically need 'px' when given a number
  const pxProperties = new Set([
    "width",
    "height",
    "top",
    "left",
    "right",
    "bottom",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontSize",
    "lineHeight",
    "borderWidth",
    "borderRadius",
    "maxWidth",
    "maxHeight",
    "minWidth",
    "minHeight",
  ]);

  return pxProperties.has(property) ? `${value}px` : String(value);
}

// Enhanced setElementProperty (keeping most of original logic)
// Lista de atributos booleanos estándar de HTML
const BOOLEAN_ATTRIBUTES = new Set([
  "autofocus",
  "checked",
  "defaultchecked",
  "defer",
  "disabled",
  "hidden",
  "loop",
  "multiple",
  "muted",
  "open",
  "readonly",
  "required",
  "reversed",
  "selected",
  "autoplay",
  "controls",
  "draggable",
  "contenteditable",
  "spellcheck",
  "translate",
]);

// Lista de propiedades que deben establecerse como properties en lugar de attributes
const PROPERTY_NAMES = new Set([
  "value",
  "checked",
  "selected",
  "disabled",
  "readOnly",
  "multiple",
  "draggable",
  "hidden",
  "innerHTML",
  "textContent",
  "className",
]);

function setElementProperty(el: Element, key: string, value: any): void {
  const htmlEl = el as HTMLElement;

  // Manejar casos especiales
  if (key === "class") {
    key = "className";
  }

  // Si es un atributo booleano
  if (BOOLEAN_ATTRIBUTES.has(key.toLowerCase())) {
    if (value === false || value == null || value === "") {
      // Remover el atributo completamente para false/null/undefined/''
      el.removeAttribute(key);
      // También establecer la propiedad a false si existe
      if (key in htmlEl) {
        (htmlEl as any)[key] = false;
      }
    } else {
      // Para valores truthy, establecer el atributo sin valor o con el nombre del atributo
      el.setAttribute(key, key);
      // También establecer la propiedad a true si existe
      if (key in htmlEl) {
        (htmlEl as any)[key] = true;
      }
    }
    return;
  }

  // Si es una propiedad que debe establecerse como property
  if (PROPERTY_NAMES.has(key) || key in htmlEl) {
    try {
      (htmlEl as any)[key] = value;
    } catch (e) {
      // Fallback a setAttribute si falla
      el.setAttribute(key, String(value));
    }
    return;
  }

  // Para todo lo demás, usar setAttribute
  if (value == null || value === false) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, String(value));
  }
}
