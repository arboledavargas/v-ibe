import { EventListenerMetadata } from './event-types';
import type { Constructor } from '../DI/types';
import { EventEmitter } from './event-emitter.service';

export function On(eventType: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    if (context.kind !== "method") {
      throw new Error("@On can only be used on methods");
    }

    context.addInitializer(function (this: any) {
      const ctor = this.constructor as Constructor;

      const metadata: EventListenerMetadata = {
        eventType,
        methodName: context.name,
        target: ctor
      };

      try {
        // Get EventEmitter from DI container and register the listener
        const eventEmitter = (this as any).__container?.get(EventEmitter);
        eventEmitter.registerEventListener(ctor, metadata);
      } catch (error) {
        console.warn(`EventEmitter not available yet for registering ${ctor.name}.${String(context.name)}`);
      }
    });

    return originalMethod;
  };
}
