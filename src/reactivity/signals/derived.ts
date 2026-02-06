import { ISignal } from "./signal";
import { computed } from "./computed";

export class Derived<T> implements ISignal<T> {
  readonly isSignal = true;
  private _inner: ISignal<T>;

  constructor(
    source: ISignal<T>,
    mapper?: (value: T) => T, // mapper no puede cambiar el tipo
  ) {
    const safeMapper = mapper ?? ((v: T) => v);
    this._inner = computed(() => safeMapper(source.get()));
  }

  get(): T {
    return this._inner.get();
  }

  set(_: T): void {
    throw new Error("Cannot set a ContextSignal.");
  }

  update(_: (currentValue: T) => T): void {
    throw new Error("Cannot update a ContextSignal.");
  }
}

export function derived<T>(
  source: ISignal<T>,
  mapper?: (value: T) => T,
): ISignal<T> {
  return new Derived(source, mapper);
}
