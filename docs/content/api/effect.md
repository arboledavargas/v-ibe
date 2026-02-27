---
title: "@Effect"
weight: 7
---

## Import

```typescript
import { Effect } from '@v-ibe/core';
```

## Description

`@Effect` is a method decorator that turns a class method into a reactive effect. The method runs once after the component initializes, automatically tracks every signal it reads, and re-runs whenever any of those signals change. If multiple signals change at once, the method runs only once.

## Type

```typescript
function Effect<This extends object>(
  target: (this: This, onCleanup: (cb: () => void) => void) => void,
  context: ClassMethodDecoratorContext,
): void
```

The decorated method receives an `onCleanup` callback that can be used to register teardown logic.

## Examples

### Basic reactive method

```tsx
@Component()
class SearchBox extends BaseComponent {
  @State query = '';

  @Effect
  syncTitle() {
    document.title = `Results for: ${this.query}`;
  }

  view() {
    return (
      <input
        value={this.query}
        onInput={(e) => (this.query = e.target.value)}
      />
    );
  }
}
```

### With cleanup

Use the `onCleanup` parameter to teardown subscriptions, timers, or listeners before the next run.

```tsx
@Component()
class MouseTracker extends BaseComponent {
  @State active = false;

  @Effect
  trackMouse(onCleanup: (cb: () => void) => void) {
    if (!this.active) return;

    const handler = (e: MouseEvent) => console.log(e.clientX, e.clientY);
    window.addEventListener('mousemove', handler);

    onCleanup(() => {
      window.removeEventListener('mousemove', handler);
    });
  }

  view() {
    return (
      <button onClick={() => (this.active = !this.active)}>
        {this.active ? 'Stop' : 'Start'} tracking
      </button>
    );
  }
}
```

### Multiple effects in one component

```tsx
@Component()
class Router extends BaseComponent {
  @State pathname = '';
  @State search = '';

  @Effect
  syncRouteParams() {
    // Re-runs only when `pathname` changes
    const match = this.routeTrie.find(this.pathname);
    // …update params
  }

  @Effect
  syncQueryParams() {
    // Re-runs only when `search` changes
    const searchParams = new URLSearchParams(this.search);
    // …update queryParams
  }

  view() { /* … */ }
}
```

## Behaviour notes

- **Deferred start** — the effect does not run at construction time. For `BaseComponent` subclasses it waits until after dependency injection is complete; for plain classes it defers via `queueMicrotask`. This ensures injected services are available when the effect first runs.
- **Runs immediately** — after the deferred start, the first execution is synchronous.
- **Automatic tracking** — any `@State` field or signal read inside the method becomes a dependency.
- **Batched updates** — multiple signal changes at once produce a single re-run.
- **No re-run on equal values** — if a signal is set to the same value it already holds, no re-run is triggered.
- **`onCleanup` is optional** — only use it when your effect needs to release resources between runs.
