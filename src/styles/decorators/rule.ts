import { effect } from "../../reactivity/signals/effect";

/**
 * Comprehensive CSS Properties Interface
 * Provides type safety and autocomplete for CSS declarations
 */
export interface CSSProperties {
  // Display & Visibility
  display?: 'block' | 'inline' | 'inline-block' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid' | 'none' | 'contents' | 'table' | 'table-row' | 'table-cell' | string;
  visibility?: 'visible' | 'hidden' | 'collapse';
  opacity?: number | string;

  // Position & Layout
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  inset?: number | string;
  zIndex?: number | string;

  // Flexbox Container
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly' | 'stretch';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  alignContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'stretch';
  gap?: number | string;
  rowGap?: number | string;
  columnGap?: number | string;

  // Flexbox Items
  flex?: number | string;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  order?: number;

  // Grid Container
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridTemplateAreas?: string;
  gridAutoColumns?: string;
  gridAutoRows?: string;
  gridAutoFlow?: 'row' | 'column' | 'dense' | 'row dense' | 'column dense';

  // Grid Items
  gridArea?: string;
  gridColumn?: string;
  gridRow?: string;
  gridColumnStart?: string | number;
  gridColumnEnd?: string | number;
  gridRowStart?: string | number;
  gridRowEnd?: string | number;

  // Sizing
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  boxSizing?: 'content-box' | 'border-box';

  // Spacing - Margin
  margin?: number | string;
  marginTop?: number | string;
  marginRight?: number | string;
  marginBottom?: number | string;
  marginLeft?: number | string;
  marginBlock?: number | string;
  marginInline?: number | string;

  // Spacing - Padding
  padding?: number | string;
  paddingTop?: number | string;
  paddingRight?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;
  paddingBlock?: number | string;
  paddingInline?: number | string;

  // Typography
  color?: string;
  fontSize?: number | string;
  fontFamily?: string;
  fontWeight?: number | 'normal' | 'bold' | 'lighter' | 'bolder' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  lineHeight?: number | string;
  letterSpacing?: number | string;
  textAlign?: 'left' | 'right' | 'center' | 'justify' | 'start' | 'end';
  textDecoration?: string;
  textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  textOverflow?: 'clip' | 'ellipsis' | string;
  whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line' | 'break-spaces';
  wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'break-word';
  wordWrap?: 'normal' | 'break-word';

  // Background
  background?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat' | 'space' | 'round';
  backgroundAttachment?: 'scroll' | 'fixed' | 'local';
  backgroundClip?: 'border-box' | 'padding-box' | 'content-box' | 'text';

  // Border
  border?: string;
  borderWidth?: number | string;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset';
  borderColor?: string;
  borderRadius?: number | string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderTopWidth?: number | string;
  borderRightWidth?: number | string;
  borderBottomWidth?: number | string;
  borderLeftWidth?: number | string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderTopLeftRadius?: number | string;
  borderTopRightRadius?: number | string;
  borderBottomLeftRadius?: number | string;
  borderBottomRightRadius?: number | string;

  // Outline
  outline?: string;
  outlineWidth?: number | string;
  outlineStyle?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
  outlineColor?: string;
  outlineOffset?: number | string;

  // Effects
  boxShadow?: string;
  textShadow?: string;
  filter?: string;
  backdropFilter?: string;

  // Transforms & Animations
  transform?: string;
  transformOrigin?: string;
  transition?: string;
  transitionProperty?: string;
  transitionDuration?: string;
  transitionTimingFunction?: string;
  transitionDelay?: string;
  animation?: string;
  animationName?: string;
  animationDuration?: string;
  animationTimingFunction?: string;
  animationDelay?: string;
  animationIterationCount?: number | 'infinite';
  animationDirection?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  animationFillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  animationPlayState?: 'running' | 'paused';

  // Overflow & Clipping
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto' | 'clip';
  overflowX?: 'visible' | 'hidden' | 'scroll' | 'auto' | 'clip';
  overflowY?: 'visible' | 'hidden' | 'scroll' | 'auto' | 'clip';
  clip?: string;
  clipPath?: string;

  // Cursor & User Interaction
  cursor?: 'auto' | 'default' | 'pointer' | 'wait' | 'text' | 'move' | 'not-allowed' | 'help' | 'grab' | 'grabbing' | string;
  pointerEvents?: 'auto' | 'none' | 'visiblePainted' | 'visibleFill' | 'visibleStroke' | 'visible' | 'painted' | 'fill' | 'stroke' | 'all';
  userSelect?: 'none' | 'auto' | 'text' | 'contain' | 'all';

  // Content & Lists
  content?: string;
  listStyle?: string;
  listStyleType?: string;
  listStylePosition?: 'inside' | 'outside';
  listStyleImage?: string;

  // Table
  tableLayout?: 'auto' | 'fixed';
  borderCollapse?: 'collapse' | 'separate';
  borderSpacing?: number | string;
  captionSide?: 'top' | 'bottom';
  emptyCells?: 'show' | 'hide';

  // Other
  verticalAlign?: 'baseline' | 'sub' | 'super' | 'top' | 'text-top' | 'middle' | 'bottom' | 'text-bottom' | number | string;
  objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';
  objectPosition?: string;
  float?: 'none' | 'left' | 'right';
  clear?: 'none' | 'left' | 'right' | 'both';
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';

  // CSS Variables & Custom Properties
  [key: `--${string}`]: string | number;

  // Allow any other CSS property (for vendor prefixes, etc.)
  [key: string]: any;
}

/**
 * Helper Functions for CSS Processing
 */

/**
 * Converts camelCase to kebab-case
 * Example: backgroundColor → background-color
 */
function camelToKebab(str: string): string {
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
function formatCSSValue(property: string, value: any): string {
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
function cssObjectToString(styles: CSSProperties): string {
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
 * @Rule Decorator - Type-safe reactive CSS rules
 *
 * Usage:
 * ```typescript
 * class MyStyles extends BaseStyleSheet {
 *   @State width = 100;
 *
 *   @Rule(':host')
 *   get hostStyles() {
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

    context.addInitializer(function (this: any) {
      // Create a unique symbol for this rule's index
      const indexSymbol = Symbol(`css_rule_${selector}_${getterName}`);

      // Create a reactive effect that updates the CSS when signals change
      const cleanup = effect(() => {
        // Call the getter to get the styles object (this tracks signals)
        const stylesObject = target.call(this);

        // Validate the return value
        if (!stylesObject || typeof stylesObject !== 'object') {
          console.warn(`@Rule('${selector}'): Getter '${getterName}' must return a CSSProperties object`);
          return;
        }

        // Convert the object to CSS string
        const cssContent = cssObjectToString(stylesObject as CSSProperties);
        const cssText = `${selector} { ${cssContent}; }`;

        // Update the rule in the stylesheet
        // This method exists in BaseStyleSheet
        if (typeof this.updateSpecificRule === 'function') {
          this.updateSpecificRule(selector, cssText, indexSymbol);
        } else {
          console.error(`@Rule decorator requires BaseStyleSheet.updateSpecificRule method`);
        }
      });

      // Register cleanup to prevent memory leaks
      if (typeof this.registerCleanup === 'function') {
        this.registerCleanup(cleanup.dispose);
      } else {
        console.error(`@Rule decorator requires BaseStyleSheet.registerCleanup method`);
      }
    });

    // Return the original getter
    return target;
  };
}
