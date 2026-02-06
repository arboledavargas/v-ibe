import { Signal } from "../signals/signal";

export function createEventDecorator<TParams extends any[], TValue>(
  eventSignalFactory: (...params: TParams) => {
    signal: Signal<TValue>;
    cleanup: () => void;
  },
) {
  return function (...params: TParams) {
    return function <This extends object>(
      target: undefined,
      context: ClassFieldDecoratorContext<This, TValue>,
    ): (this: This, initialValue: TValue) => TValue {
      if (context.kind !== "field") {
        throw new Error("Solo se puede aplicar a campos de clase.");
      }

      const signalKey = Symbol(`event_signal_${String(context.name)}`);

      return function (this: any, initialValue: TValue): TValue {
        if (!this[signalKey]) {
          const eventSignal = eventSignalFactory(...params);
          this[signalKey] = eventSignal.signal;
          this.registerCleanup(eventSignal.cleanup);
        }

        Object.defineProperty(this, context.name, {
          get: () => this[signalKey].get(),
          set: () => {},
          enumerable: true,
          configurable: false,
        });

        return this[signalKey].get();
      };
    };
  };
}
