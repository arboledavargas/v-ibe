import { BehaviorRegistry } from './behavior-registry';
import { HOST_KEY, BEHAVIOR_PROPS, COMPONENT_HOST_KEY } from './constants';

type Constructor = new (...args: any[]) => any;

/**
 * BehaviorManager manages the lifecycle of Behavior instances attached to elements.
 * 
 * Each component has its own BehaviorManager instance to track and manage
 * behaviors attached to native elements within that component.
 * 
 * Lifecycle:
 * 1. attachBehaviors() - Called from bindProps, resolves and attaches behaviors
 * 2. onInit() - Called on each behavior after props are assigned
 * 3. onDestroy() - Called when disconnectAll() or disconnectElement() is called
 */
export class BehaviorManager {
  // Map: Element -> Map<BehaviorClassName, Instance>
  // Example: <a> -> Map { "Link" -> LinkInstance, "Tooltip" -> TooltipInstance }
  private instances = new Map<Element, Map<string, any>>();
  
  // Reference to the parent component (for context/DI integration if needed)
  private hostComponent: any;

  constructor(hostComponent?: any) {
    this.hostComponent = hostComponent;
  }

  /**
   * Main entry point. Analyzes all props for an element,
   * instantiates corresponding behaviors, and returns which props were consumed.
   * 
   * @param el - The element to attach behaviors to
   * @param props - All props from JSX
   * @returns Set<string> with names of all props that were handled by behaviors
   */
  attachBehaviors(el: Element, props: Record<string, any>): Set<string> {
    const behaviorMap = BehaviorRegistry.resolve(props);
    const consumedProps = new Set<string>();

    for (const [BehaviorClass, config] of behaviorMap) {
      const behaviorName = BehaviorClass.name;
      
      this.attach(el, BehaviorClass, behaviorName, config);
      
      // Mark as consumed: the behavior name (e.g., 'link') + its props
      const behaviorProps = this.getBehaviorPropNames(BehaviorClass);
      behaviorProps.forEach(prop => {
        if (prop in props) {
          consumedProps.add(prop);
        }
      });
    }

    return consumedProps;
  }

  /**
   * Attaches a specific behavior to an element.
   */
  private attach(
    el: Element, 
    BehaviorClass: Constructor, 
    behaviorName: string,
    config: Record<string, any>
  ): void {
    // 1. Instantiate
    const instance = new BehaviorClass();

    // 2. Inject Host (@Host decorator)
    const hostPropName = (BehaviorClass as any)[HOST_KEY] as string | undefined;
    if (hostPropName) {
      instance[hostPropName] = el;
    }

    // 2.5. Inject ComponentHost (@ComponentHost decorator)
    const componentHostPropName = (BehaviorClass as any)[COMPONENT_HOST_KEY] as string | undefined;
    if (componentHostPropName && this.hostComponent) {
      instance[componentHostPropName] = this.hostComponent;
    }

    // 2.6. Propagate DI container from host component to behavior
    // Behaviors that use @Inject need access to the same container as the host component
    if (this.hostComponent?.__container) {
      instance.__container = this.hostComponent.__container;
    }

    // 3. Assign configuration (JSX props for this behavior)
    // Object.assign will trigger @Prop setters
    Object.assign(instance, config);

    // 4. Save for later cleanup
    if (!this.instances.has(el)) {
      this.instances.set(el, new Map());
    }
    this.instances.get(el)!.set(behaviorName, instance);

    // 5. Initialize
    if (typeof instance.onInit === 'function') {
      instance.onInit();
    }

    // Note: @Effect decorators in the behavior will activate automatically
    // when they access signals, thanks to the reactivity system.
  }

  /**
   * Gets the names of all @Prop decorated fields in a behavior class.
   */
  private getBehaviorPropNames(BehaviorClass: Constructor): Set<string> {
    const props = (BehaviorClass as any)[BEHAVIOR_PROPS] as Set<string> | undefined;
    return props ? new Set(props) : new Set();
  }

  /**
   * Gets a specific behavior instance from an element.
   * Useful for debugging or programmatic interaction.
   */
  get<T>(el: Element, behaviorName: string): T | undefined {
    return this.instances.get(el)?.get(behaviorName);
  }

  /**
   * Gets all behaviors attached to an element.
   */
  getAll(el: Element): Map<string, any> | undefined {
    return this.instances.get(el);
  }

  /**
   * Disconnects all behaviors from all elements.
   * Called from disconnectedCallback of the parent component.
   */
  disconnectAll(): void {
    for (const [el, behaviors] of this.instances) {
      for (const [name, instance] of behaviors) {
        if (typeof instance.onDestroy === 'function') {
          try {
            instance.onDestroy();
          } catch (e) {
            console.error(`[Behavior ${name}] Error in onDestroy:`, e);
          }
        }
      }
    }
    this.instances.clear();
  }

  /**
   * Disconnects behaviors from a specific element.
   * Useful if an element is removed from DOM but the component is still alive.
   */
  disconnectElement(el: Element): void {
    const behaviors = this.instances.get(el);
    if (!behaviors) return;

    for (const [name, instance] of behaviors) {
      if (typeof instance.onDestroy === 'function') {
        try {
          instance.onDestroy();
        } catch (e) {
          console.error(`[Behavior ${name}] Error in onDestroy:`, e);
        }
      }
    }
    
    this.instances.delete(el);
  }

  /**
   * Gets the total number of elements that have behaviors attached.
   */
  get elementCount(): number {
    return this.instances.size;
  }

  /**
   * Gets the total number of behavior instances managed.
   */
  get behaviorCount(): number {
    let count = 0;
    for (const [, behaviors] of this.instances) {
      count += behaviors.size;
    }
    return count;
  }
}
