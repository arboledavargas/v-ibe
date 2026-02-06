import type { Constructor } from '../DI/types.ts';

/**
 * Event listener metadata stored by decorators
 */
export interface EventListenerMetadata {
  /** Event type to listen for */
  eventType: string;
  /** Method name that handles the event */
  methodName: string | symbol;
  /** Target class constructor */
  target: Constructor;
}


