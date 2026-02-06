import { BEHAVIOR_PROPS } from '../../behaviors/constants';

/**
 * @Prop decorator for component properties that may receive reactive expressions.
 *
 * When a prop receives a zero-argument function (a reactive getter from the parent),
 * this decorator automatically unwraps it on access, creating a direct reactive
 * subscription from the child to the parent's signals.
 *
 * For non-function values or callback functions (with parameters), the value is
 * returned as-is.
 * 
 * When used in a @Behavior class, this decorator also registers the prop name
 * in the behavior's metadata for the PropertyRegistry to resolve.
 */
export function Prop<This extends object, Value>(
  target: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
): (this: This, initialValue: Value) => Value {

  if (context.kind !== "field") {
    throw new Error("@Prop can only be applied to class fields.");
  }

  // Use a symbol to store the actual value privately
  const storageKey = Symbol(`prop_storage_${String(context.name)}`);
  
  // Register this prop in the shared metadata for Behaviors
  // context.metadata is shared across all decorators on the same class
  // and is available immediately (at class definition time)
  const metadata = context.metadata as Record<symbol, Set<string>>;
  if (!metadata[BEHAVIOR_PROPS]) {
    metadata[BEHAVIOR_PROPS] = new Set<string>();
  }
  metadata[BEHAVIOR_PROPS].add(String(context.name));

  return function(this: any, initialValue: Value): Value {
    // Initialize storage with the initial value
    this[storageKey] = initialValue;

    // Define the property with getter/setter
    Object.defineProperty(this, context.name, {
      get: () => {
        const storedValue = this[storageKey];
        const propName = String(context.name);

        // Don't unwrap event handlers (props that start with "on")
        // Event handlers should be passed as-is, not executed
        if (propName.startsWith('on') && propName.length > 2) {
          return storedValue;
        }

        // If the stored value is a zero-argument function (reactive getter),
        // call it to get the actual value. This call happens in the current
        // reactive context, allowing parent signals to subscribe child effects.
        if (typeof storedValue === 'function' && storedValue.length === 0) {
          return storedValue();
        }

        // Otherwise, return the value as-is (static values or callbacks)
        return storedValue;
      },

      set: (newValue: Value) => {
        // Store whatever is assigned (could be a value, function, etc.)
        this[storageKey] = newValue;
      },

      enumerable: true,
      configurable: true,
    });

    // Return the initial value as required by the decorator spec
    return initialValue;
  };
}
