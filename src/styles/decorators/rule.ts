import type { CSSProperties } from "../css-properties";

export type { CSSProperties };

/**
 * Symbol to store rule definitions in class metadata.
 * Each @Rule registers { selector, getterName, getter } in metadata[RULES_KEY].
 */
export const RULES_KEY = Symbol('stylesheet:rules');

export interface RuleDefinition {
  selector: string;
  getterName: string;
  getter: (this: any) => CSSProperties | undefined;
}

/**
 * Helper Functions for CSS Processing
 */

/**
 * Converts camelCase to kebab-case
 * Example: backgroundColor → background-color
 */
export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * Properties that don't need units when provided as numbers
 */
const unitlessProperties = new Set([
  'opacity',
  'z-index',
  'font-weight',
  'line-height',
  'flex-grow',
  'flex-shrink',
  'flex',
  'order',
  'zoom',
  'grid-column',
  'grid-row',
  'grid-column-start',
  'grid-column-end',
  'grid-row-start',
  'grid-row-end',
  'animation-iteration-count',
]);

/**
 * Formats a CSS value, adding units where necessary
 * Example: ('width', 100) → '100px'
 *          ('opacity', 0.5) → '0.5'
 */
export function formatCSSValue(property: string, value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  // If it's a number and the property needs units, add 'px'
  if (typeof value === 'number' && !unitlessProperties.has(property)) {
    return `${value}px`;
  }

  return String(value);
}

/**
 * Converts a CSSProperties object to a CSS string
 * Example: { width: 100, display: 'grid' } → 'width: 100px; display: grid'
 */
export function cssObjectToString(styles: CSSProperties): string {
  return Object.entries(styles)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([property, value]) => {
      const cssProperty = camelToKebab(property);
      const cssValue = formatCSSValue(cssProperty, value);
      return `${cssProperty}: ${cssValue}`;
    })
    .join('; ');
}

/**
 * @Rule Decorator - Metadata-only marker for reactive CSS rules.
 *
 * Registers the getter and its CSS selector in class metadata.
 * The actual reactive effects are created later by BaseStyleSheet
 * when getStyleSheet() is called, ensuring @Host and all other
 * fields are fully initialized before any effect runs.
 *
 * Usage:
 * ```typescript
 * class MyStyles extends BaseStyleSheet {
 *   @State width = 100;
 *
 *   @Rule(':host')
 *   get hostStyles(): CSSProperties {
 *     return {
 *       display: 'grid',
 *       width: this.width,  // Reactive!
 *     };
 *   }
 * }
 * ```
 */
export function Rule(selector: string) {
  return function <This extends object, Value extends CSSProperties | undefined>(
    target: (this: This) => Value,
    context: ClassGetterDecoratorContext<This, Value>,
  ): (this: This) => Value {
    if (context.kind !== 'getter') {
      throw new Error('@Rule can only be applied to getters');
    }

    const getterName = String(context.name);

    // Store rule definition in class metadata at decoration time.
    const metadata = context.metadata as Record<symbol, any>;
    if (!metadata[RULES_KEY]) {
      metadata[RULES_KEY] = [];
    }
    (metadata[RULES_KEY] as RuleDefinition[]).push({
      selector,
      getterName,
      getter: target as (this: any) => CSSProperties | undefined,
    });

    // Copy rules to the constructor at instance creation time
    // (Symbol.metadata is not available in all runtimes)
    context.addInitializer(function (this: any) {
      if (!(this.constructor as any)[RULES_KEY]) {
        (this.constructor as any)[RULES_KEY] = metadata[RULES_KEY];
      }
    });

    // Return the original getter unchanged
    return target;
  };
}
