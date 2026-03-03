---
title: "@State"
weight: 6
---

## Import

```typescript
import { State } from '@v-ibe/core';
```

## Description

`@State` is a class field decorator that turns a field into a reactive signal. It automatically detects the type of the initial value and creates the appropriate signal underneath:

| Value type | Signal created |
|------------|---------------|
| `string`, `number`, `boolean`, `null`, `undefined` | `Signal<T>` |
| Plain object | `CompositeSignal<T>` |
| Array | `ReactiveArray<T>` |

The field keeps its normal JavaScript syntax — you read and write it as a plain property — but every access and mutation is tracked reactively. Any `Effect` or `Computed` that reads the field will automatically re-run when it changes.

For every `@State` field named `foo`, a companion property `$foo` is also created that exposes the raw signal instance directly.

## Type

```typescript
function State<This extends object, Value>(
  target: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
): (this: This, initialValue: Value) => Value
```

## Examples

### Primitive value

```tsx
@Component()
class Counter extends BaseComponent {
  @State count = 0;

  increment() {
    this.count++;
  }

  view() {
    return (
      <div>
        <span>{this.count}</span>
        <button onClick={() => this.increment()}>+</button>
      </div>
    );
  }
}
```

### Object

```tsx
@Component()
class UserProfile extends BaseComponent {
  @State user = { name: 'Alice', age: 30 };

  rename(name: string) {
    this.user.name = name; // Only components reading `user.name` re-render
  }

  view() {
    return <p>{this.user.name} ({this.user.age})</p>;
  }
}
```

### Array

```tsx
@Component()
class TodoList extends BaseComponent {
  @State todos = ['Buy milk', 'Walk dog'];

  add(item: string) {
    this.todos.push(item);
  }

  view() {
    return (
      <ul>
        <For each={this.todos}>
          {(todo) => <li>{todo}</li>}
        </For>
      </ul>
    );
  }
}
```

### Raw signal access via `$`

```tsx
@Component()
class Timer extends BaseComponent {
  @State elapsed = 0;

  onConnected() {
    // Access the raw Signal instance directly
    const interval = setInterval(() => {
      this.$elapsed.update((v) => v + 1);
    }, 1000);

    this.onDisconnected = () => clearInterval(interval);
  }

  view() {
    return <span>{this.elapsed}s</span>;
  }
}
```

### Type change on reassignment

```tsx
@Component()
class FlexState extends BaseComponent {
  @State value: number | number[] = 0;

  makeList() {
    this.value = [1, 2, 3]; // Automatically creates a ReactiveArray
  }

  view() {
    return <span>{JSON.stringify(this.value)}</span>;
  }
}
```

> Reassigning a `@State` field with a value of a different type (e.g. from a primitive to an array) automatically replaces the underlying signal with the appropriate one. Note that any `Effect` or `Computed` that was tracking the field before the type change will **not** re-subscribe to the new signal automatically — this pattern is intended for initialization-time flexibility, not for reactive type switching at runtime.
