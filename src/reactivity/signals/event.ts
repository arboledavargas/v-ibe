import { Signal } from "./signal";

export function eventListener<T, K extends keyof HTMLElementEventMap>(
  eventTarget: EventTarget,
  eventType: K,
  valueGetter: (e: HTMLElementEventMap[K]) => T,
  initialValueGetter?: () => T,
): { signal: Signal<T>; cleanup: () => void };

export function eventListener<T>(
  eventTarget: EventTarget,
  eventType: string,
  valueGetter: (e: Event) => T,
  initialValueGetter?: () => T,
): { signal: Signal<T>; cleanup: () => void };

export function eventListener<T>(
  eventTarget: EventTarget,
  eventType: string,
  valueGetter: (e: any) => T,
  initialValueGetter?: () => T,
): { signal: Signal<T>; cleanup: () => void } {
  const signal = new Signal<T>(
    initialValueGetter ? initialValueGetter() : valueGetter(null as any),
  );
  const updateSignal = (e: Event) => signal.set(valueGetter(e));

  eventTarget.addEventListener(eventType, updateSignal);

  const cleanup = () => {
    eventTarget.removeEventListener(eventType, updateSignal);
  };

  return { signal, cleanup };
}
