import { BehaviorRegistry } from './behavior-registry';
import { BEHAVIOR_PROPS, HOST_KEY, COMPONENT_HOST_KEY } from './constants';

/**
 * @Behavior class decorator.
 * 
 * Marks a class as a Behavior and registers it in the BehaviorRegistry.
 * The class should have at least one @Prop decorated field that serves as
 * the activator (a boolean prop that enables the behavior).
 * 
 * @example
 * @Behavior
 * export class Link {
 *   @Host
 *   el!: HTMLAnchorElement;
 *   
 *   @Prop link: boolean = true;      // Activator
 *   @Prop href: string = '';         // Config
 *   @Prop activeClass?: string;      // Optional config
 *   
 *   onInit() {
 *     this.el.href = this.href;
 *   }
 * }
 * 
 * // Usage in JSX:
 * <a link href="/home" activeClass="active">Home</a>
 */
export function Behavior<T extends new (...args: any[]) => any>(
  target: T,
  context: ClassDecoratorContext
): T {
  // Extract props and host field from metadata (populated by @Prop and @Host decorators)
  const metadata = context.metadata as Record<symbol, any>;
  const props = metadata[BEHAVIOR_PROPS] as Set<string> | undefined;
  const hostField = metadata[HOST_KEY] as string | symbol | undefined;
  
  // Copy props to the class for later access by BehaviorRegistry
  if (props) {
    (target as any)[BEHAVIOR_PROPS] = props;
  }
  
  // Copy host field name to the class for later access by BehaviorManager
  if (hostField) {
    (target as any)[HOST_KEY] = hostField;
  }
  
  // Register in the global behavior system
  BehaviorRegistry.register(target);
  
  // Return the class unchanged
  return target;
}

/**
 * @Host field decorator.
 * 
 * Marks a field to receive the host element. Works with both:
 * - Behaviors: BehaviorManager injects the DOM element before calling onInit()
 * - StyleSheets: BaseStyleSheet injects the component via setHost()
 * 
 * @example
 * // In a Behavior:
 * @Behavior
 * class Tooltip {
 *   @Host
 *   el!: HTMLElement;
 *   
 *   onInit() {
 *     console.log('Attached to:', this.el.tagName);
 *   }
 * }
 * 
 * @example
 * // In a StyleSheet:
 * class MyStyles extends BaseStyleSheet {
 *   @Host
 *   host!: BaseComponent;
 *   
 *   @Rule(':host')
 *   get hostRule() {
 *     return { display: 'block' };
 *   }
 * }
 */
export function Host<T = Element>(
  target: undefined,
  context: ClassFieldDecoratorContext<any, T>
): (this: any, initialValue: T) => T {
  if (context.kind !== 'field') {
    throw new Error('@Host can only be applied to class fields.');
  }

  // Store in metadata for @Behavior decorator (available at class definition time)
  const metadata = context.metadata as Record<symbol, string | symbol>;
  metadata[HOST_KEY] = context.name;

  // Also store directly on constructor for classes without @Behavior (e.g., StyleSheets)
  // This runs at instance creation time
  context.addInitializer(function(this: any) {
    (this.constructor as any)[HOST_KEY] = context.name;
  });

  return function(this: any, initialValue: T): T {
    return initialValue;
  };
}

/**
 * @ComponentHost field decorator.
 *
 * Marks a field to receive the host component that contains this behavior.
 * Allows behaviors to access the context (@Ctx) of the component.
 *
 * @example
 * @Behavior
 * class Link {
 *   @Host
 *   el!: HTMLAnchorElement;  // DOM element
 *
 *   @ComponentHost
 *   hostComponent?: BaseComponent;  // Component container
 *
 *   @Inject(Router)
 *   router!: Router;
 *
 *   onInit() {
 *     // Access component context
 *     const basePath = (this.hostComponent as any).routeBasePath;
 *     // Use basePath for route resolution...
 *   }
 * }
 *
 * // Usage in JSX (no changes needed):
 * <a link href="sales" activeClass="active">Sales</a>
 */
export function ComponentHost<T = any>(
  target: undefined,
  context: ClassFieldDecoratorContext<any, T>
): (this: any, initialValue: T) => T {
  if (context.kind !== 'field') {
    throw new Error('@ComponentHost can only be applied to class fields.');
  }

  // Store in metadata for BehaviorManager (available at class definition time)
  const metadata = context.metadata as Record<symbol, string | symbol>;
  metadata[COMPONENT_HOST_KEY] = context.name;

  // Also store directly on constructor
  // This runs at instance creation time
  context.addInitializer(function(this: any) {
    (this.constructor as any)[COMPONENT_HOST_KEY] = context.name;
  });

  return function(this: any, initialValue: T): T {
    return initialValue;
  };
}
