import { BEHAVIOR_PROPS } from './constants';

type Constructor = new (...args: any[]) => any;

/**
 * BehaviorRegistry manages the mapping between prop names and Behavior classes.
 * 
 * When a @Behavior class is registered, all its @Prop decorated fields are indexed.
 * This allows the system to resolve which behaviors to instantiate based on JSX props.
 * 
 * @example
 * @Behavior
 * class Link {
 *   @Prop() link: boolean = true;      // Activator prop
 *   @Prop() href: string = '';         // Config prop
 *   @Prop() activeClass?: string;      // Optional config prop
 * }
 * 
 * // In JSX: <a link href="/home" activeClass="active">
 * // BehaviorRegistry.resolve({link: true, href: '/home', activeClass: 'active'})
 * // Returns: Map { Link -> {link: true, href: '/home', activeClass: 'active'} }
 */
export class BehaviorRegistry {
  // Map: propName -> BehaviorClass
  // Example: "link" -> Link, "activeClass" -> Link, "draggable" -> Draggable
  private static propIndex = new Map<string, Constructor>();
  
  // Set of all props that belong to behaviors (for quick lookup in bindProps)
  private static allBehaviorProps = new Set<string>();

  /**
   * Registers a class as a Behavior.
   * Called from the @Behavior decorator.
   * 
   * @throws Error if a prop name is already registered by another behavior
   */
  static register(cls: Constructor): void {
    const props = (cls as any)[BEHAVIOR_PROPS] as Set<string> | undefined;
    
    if (!props || props.size === 0) {
      console.warn(`[Behavior] ${cls.name} registered without @Props. Did you forget to decorate the properties?`);
    }

    // Register each prop as an entry to this behavior
    props?.forEach(propName => {
      if (this.propIndex.has(propName)) {
        const existing = this.propIndex.get(propName)!.name;
        throw new Error(
          `[Behavior Conflict] Property "${propName}" is already registered ` +
          `by behavior "${existing}". Cannot be used in "${cls.name}".`
        );
      }
      
      this.propIndex.set(propName, cls);
      this.allBehaviorProps.add(propName);
    });
  }

  /**
   * Resolves which behaviors to apply and with what configuration.
   * 
   * Groups all props by their registered Behavior class.
   * 
   * @param props - Props from JSX (e.g., {link: true, href: '/', activeClass: 'active'})
   * @returns Map<BehaviorClass, config>
   */
  static resolve(props: Record<string, any>): Map<Constructor, Record<string, any>> {
    const behaviors = new Map<Constructor, Record<string, any>>();

    for (const [key, value] of Object.entries(props)) {
      const BehaviorClass = this.propIndex.get(key);
      if (BehaviorClass) {
        if (!behaviors.has(BehaviorClass)) {
          behaviors.set(BehaviorClass, {});
        }
        behaviors.get(BehaviorClass)![key] = value;
      }
    }

    return behaviors;
  }

  /**
   * Checks if a prop name belongs to any registered behavior.
   */
  static isBehaviorProp(name: string): boolean {
    return this.allBehaviorProps.has(name);
  }

  /**
   * Gets the behavior class for a given prop name.
   */
  static getBehaviorForProp(propName: string): Constructor | undefined {
    return this.propIndex.get(propName);
  }

  /**
   * Gets all prop names registered for a behavior class.
   */
  static getPropsForBehavior(cls: Constructor): Set<string> {
    const props = (cls as any)[BEHAVIOR_PROPS] as Set<string> | undefined;
    return props ? new Set(props) : new Set();
  }

  /**
   * Unregisters a behavior (useful for testing).
   */
  static unregister(cls: Constructor): void {
    const props = (cls as any)[BEHAVIOR_PROPS] as Set<string> | undefined;
    props?.forEach(propName => {
      if (this.propIndex.get(propName) === cls) {
        this.propIndex.delete(propName);
        this.allBehaviorProps.delete(propName);
      }
    });
  }

  /**
   * Clears all registered behaviors (useful for testing).
   */
  static clear(): void {
    this.propIndex.clear();
    this.allBehaviorProps.clear();
  }

  /**
   * Gets all registered prop names (useful for debugging).
   */
  static getRegisteredProps(): string[] {
    return Array.from(this.propIndex.keys());
  }

  /**
   * Debug output of all registered behaviors and their props.
   */
  static debug(): void {
    console.log('[BehaviorRegistry] Registered props:', 
      Array.from(this.propIndex.entries()).map(([k, v]) => `${k} -> ${v.name}`)
    );
  }
}
