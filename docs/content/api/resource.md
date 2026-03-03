---
title: "@Resource"
weight: 9
---

## Import

```typescript
import { Resource, IResource } from '@v-ibe/core';
```

## Description

`@Resource` is a class field decorator that creates a reactive async data source. You pass a **source** function that receives an `AbortSignal` and returns a `Promise<T>`. The framework creates an `IResource<T>` and assigns it to the field. The source runs when the component initializes and again whenever any reactive dependency (e.g. `@State` or other signals) read inside the source changes. When dependencies change, any in-flight request is cancelled via the `AbortSignal` so you can pass it to `fetch` or other cancelable APIs.

The decorated field must be typed as `IResource<T>`. The decorator can only be applied to **fields**; applying it to a getter or method throws.

## Type

```typescript
type ResourceSourceFn<Ctx extends object, T> = (
  this: Ctx,
  signal: AbortSignal
) => Promise<T>;

function Resource<Ctx extends object, T>(
  source: ResourceSourceFn<Ctx, T>
): (
  target: undefined,
  context: ClassFieldDecoratorContext<Ctx, IResource<T>>,
) => void
```

### IResource&lt;T&gt;

The type of the decorated field.

| Member   | Type                    | Description |
|----------|-------------------------|-------------|
| `isSignal` | `true`                | Marks the value as signal-like. |
| `get()`  | `() => T \| undefined`  | Returns the loaded data, or `undefined` while pending or on error. |
| `state`  | `'pending' \| 'ready' \| 'error'` | Current loading state. |
| `error`  | `Error \| undefined`    | Set when `state === 'error'`. |

## Examples

### Fetch with AbortSignal

```tsx
@Component()
class UserProfile extends BaseComponent {
  @State userId = 1;

  @Resource(function (signal) {
    return fetch(`/api/users/${this.userId}`, { signal }).then((r) => r.json());
  })
  user!: IResource<{ name: string; email: string }>;

  view() {
    if (this.user.state === 'pending') return <span>Loading…</span>;
    if (this.user.state === 'error') return <span>Error: {this.user.error?.message}</span>;
    const u = this.user.get()!;
    return <p>{u.name} — {u.email}</p>;
  }
}
```

### With Show for pending / ready / error

```tsx
@Component()
class ArticlePage extends BaseComponent {
  @State slug = 'hello-world';

  @Resource(function (signal) {
    return fetch(`/api/articles/${this.slug}`, { signal }).then((r) => r.json());
  })
  article!: IResource<{ title: string; body: string }>;

  view() {
    return (
      <>
        <Show when={() => this.article.state === 'pending'}>
          {() => <div>Loading…</div>}
        </Show>
        <Show when={() => this.article.state === 'ready'}>
          {() => {
            const a = this.article.get()!;
            return <article><h1>{a.title}</h1><p>{a.body}</p></article>;
          }}
        </Show>
        <Show when={() => this.article.state === 'error'}>
          {() => <div>Error: {this.article.error?.message}</div>}
        </Show>
      </>
    );
  }
}
```

### Custom async logic and cancellation

Use the `AbortSignal` inside your own async logic so the framework can cancel it when dependencies change.

```tsx
@Component()
class DataView extends BaseComponent {
  @Resource(function (signal) {
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
      loadDataFromSomewhere()
        .then(resolve)
        .catch(reject);
    });
  })
  data!: IResource<MyData>;

  view() {
    if (this.data.state === 'ready') {
      return <pre>{JSON.stringify(this.data.get(), null, 2)}</pre>;
    }
    return <span>Loading…</span>;
  }
}
```

## Behaviour notes

- **Field only** — the decorator can only be applied to class fields. Using it on a getter or method throws.
- **Reactive source** — the source function runs inside a reactive effect. Any `@State` or signal read inside it is tracked; when any of them change, the effect re-runs, the previous `AbortController` is aborted, and the source is called again with a new `AbortSignal`.
- **AbortSignal** — pass the given `signal` to `fetch(..., { signal })` or use it in custom async code. When the request is superseded by a new one (or the component is torn down), the signal is aborted so you can cancel the operation and avoid updating state from an obsolete request.
- **States** — `state` is `'pending'` initially and after any dependency change; it becomes `'ready'` when the Promise resolves or `'error'` when it rejects. `AbortError` is not treated as an error and does not set `state` to `'error'`.
- **Read-only** — you do not set the resource value yourself; it is driven by the source Promise. The field is assigned the `IResource<T>` instance by the framework.
