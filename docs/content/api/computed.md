---
title: "@Computed"
weight: 8
---

## Import

```typescript
import { Computed } from '@v-ibe/core';
```

## Description

`@Computed` is a class getter decorator that turns a getter into a computed signal. The value is computed on first access and memoized. It recomputes only when its dependencies (e.g. `@State` fields or other signals read inside the getter) change. Computed values are read-only — you cannot assign to them.

The decorator can only be applied to **getters**. Applying it to a field or method will throw.

## Type

```typescript
function Computed<This extends object, Value>(
  target: (this: This) => Value,
  context: ClassGetterDecoratorContext<This, Value>,
): (this: This) => Value
```

## Examples

### Derived value from state

```tsx
@Component()
class Counter extends BaseComponent {
  @State count = 0;

  @Computed
  get double() {
    return this.count * 2;
  }

  view() {
    return (
      <div>
        <span>{this.count} × 2 = {this.double}</span>
        <button onClick={() => this.count++}>+</button>
      </div>
    );
  }
}
```

### Nested computed

```tsx
@Component()
class Calculator extends BaseComponent {
  @State a = 1;
  @State b = 2;

  @Computed
  get sum() {
    return this.a + this.b;
  }

  @Computed
  get doubledSum() {
    return this.sum * 2;
  }

  view() {
    return <span>Sum: {this.sum}, doubled: {this.doubledSum}</span>;
  }
}
```

### Filtered or derived list

```tsx
@Component()
class TodoList extends BaseComponent {
  @State todos = ['Buy milk', 'Walk dog', 'Code'];
  @State filter = '';

  @Computed
  get filtered() {
    const q = this.filter.toLowerCase();
    return this.todos.filter((t) => t.toLowerCase().includes(q));
  }

  view() {
    return (
      <>
        <input
          value={this.filter}
          onInput={(e) => (this.filter = e.target.value)}
        />
        <ul>
          <For each={this.filtered}>
            {(todo) => <li>{todo}</li>}
          </For>
        </ul>
      </>
    );
  }
}
```

### Read-only

Accessing the computed property returns the current value. Assigning to it is not supported and would require using a separate `@State` field and updating it in a method or `@Effect`.

## Behaviour notes

- **Lazy** — the getter runs only when the computed property is read for the first time, and again only when a dependency has changed and the value is read.
- **Automatic dependencies** — any `@State` (or signal) read inside the getter is tracked; when any of them change, the computed is marked dirty and will recompute on the next read.
- **Read-only** — computed values cannot be set or updated; they are derived from other state.
- **Getter only** — applying `@Computed` to a class field or method throws an error.
