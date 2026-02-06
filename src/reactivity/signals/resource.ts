import { Signal } from "./signal.js";
import { effect } from "./effect.js";

type ResourceState = "pending" | "ready" | "error";

export interface IResource<T> {
  readonly isSignal: true;
  get(): T | undefined;
  state: ResourceState;
  error?: Error;
}

class Resource<T> implements IResource<T> {
  readonly isSignal = true;
  private _dataSignal: Signal<T | undefined>;
  private _stateSignal: Signal<ResourceState>;
  private _errorSignal: Signal<Error | undefined>;
  private _currentAbortController: AbortController | null = null;

  constructor(source: (signal: AbortSignal) => Promise<T>) {
    this._dataSignal = new Signal<T | undefined>(undefined);
    this._stateSignal = new Signal<ResourceState>("pending");
    this._errorSignal = new Signal<Error | undefined>(undefined);

    effect((onCleanup) => {
      const abortController = new AbortController();

      if (this._currentAbortController) {
        this._currentAbortController.abort();
      }
      this._currentAbortController = abortController;

      // Poner en pending cuando se re-ejecuta el effect
      this._stateSignal.set("pending");

      let isStale = false;
      onCleanup(() => {
        isStale = true;
        abortController.abort();
      });

      const promise = source(abortController.signal);

      promise
        .then((data) => {
          if (!isStale) {
            this._dataSignal.set(data);
            this._stateSignal.set("ready");
            this._errorSignal.set(undefined);
          }
        })
        .catch((err) => {
          if (isStale) {
            return;
          }

          // Si el error es por abort, no lo tratamos como error real
          if (err.name === 'AbortError') {
            return;
          }

          const error = err instanceof Error ? err : new Error(String(err));
          this._dataSignal.set(undefined);
          this._stateSignal.set("error");
          this._errorSignal.set(error);
        });
    });
  }

  get(): T | undefined {
    return this._dataSignal.get();
  }

  get state(): ResourceState {
    return this._stateSignal.get();
  }

  get error(): Error | undefined {
    return this._errorSignal.get();
  }
}

export function createResource<T>(
  source: (signal: AbortSignal) => Promise<T>
): IResource<T> {
  return new Resource(source);
}
