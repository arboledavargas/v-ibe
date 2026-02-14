import { EventListenerMetadata } from './event-types';
import type { Constructor } from '../DI/types.ts';
import { Service } from '../DI/decorators/service';

/**
 * Custom event class that extends the native Event
 */
class CustomEvent extends Event {
  public readonly eventData: any;

  constructor(eventType: string, eventData: any) {
    super(eventType);
    this.eventData = eventData;
  }
}

/**
 * EventEmitter service that uses native EventTarget for event handling
 * This service manages event emission only. Registration is handled by the DI container.
 */
@Service
export class EventEmitter {
  private eventTarget: EventTarget;
  private registeredHandlers = new Set<string>();

  constructor() {
    this.eventTarget = new EventTarget();
  }

  /**
   * Register an event listener for a class and set up the handler immediately
   */
  registerEventListener(target: Constructor, metadata: EventListenerMetadata): void {

    // Setup the event handler immediately
    const handlerId = `${target.name}-${metadata.eventType}-${String(metadata.methodName)}`;

    // Avoid duplicate registrations
    if (this.registeredHandlers.has(handlerId)) {
      return;
    }

    this.eventTarget.addEventListener(metadata.eventType, async (event: Event) => {
      if (event instanceof CustomEvent) {
        try {
          // Get the service instance from hierarchical DI container
          const serviceInstance = (this as any).__container.get(target);
          const handler = (serviceInstance as any)[metadata.methodName];

          if (typeof handler === 'function') {
            await handler.call(serviceInstance, event.eventData);
          }
        } catch (error) {
          console.error(`Error executing event handler ${handlerId}:`, error);
        }
      }
    });

    this.registeredHandlers.add(handlerId);
  }



  /**
   * Emit an event to all registered listeners
   * @param eventType - The type of event to emit
   * @param eventData - The event data (can be any type)
   */
  emit<T = any>(eventType: string, eventData: T): void {
    const customEvent = new CustomEvent(eventType, eventData);
    this.eventTarget.dispatchEvent(customEvent);
  }

}
