---
title: "For"
weight: 4
---

## Import

```typescript
import { For } from '@v-ibe/core';
```

## Description

`For` renders a list of items reactively. When the source array is a `@State` field, it uses fine-grained reactivity — each item gets its own tracking effect, so only the items that actually change are re-rendered. For plain arrays it falls back to standard rendering that re-evaluates the entire list.

Items are automatically keyed using common ID properties (`id`, `key`, `_id`, `uuid`). You can override this with a custom `getKey` function.

## Type

```typescript
function For<T>(props: {
  each: T[] | (() => T[]) | Signal<T[]> | ReactiveArray<T>;
  children: (item: T, index: number) => JSX.Element;
  fallback?: JSX.Element;
  getKey?: (item: T, index: number) => string | number;
}): DocumentFragment
```

## Examples

### Basic list

```tsx
@Component()
class TodoList extends BaseComponent {
  @State todos = ['Buy milk', 'Walk dog'];

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

### With fallback

```tsx
@Component()
class ItemList extends BaseComponent {
  @State items: Item[] = [];

  view() {
    return (
      <For each={this.items} fallback={<p>No items yet.</p>}>
        {(item) => <ItemCard item={item} />}
      </For>
    );
  }
}
```

### With custom key

```tsx
<For each={this.users} getKey={(user) => user.id}>
  {(user, index) => <UserRow user={user} position={index} />}
</For>
```

### Fine-grained updates

```tsx
@Component()
class ScoreBoard extends BaseComponent {
  @State players = [
    { id: 1, name: 'Alice', score: 0 },
    { id: 2, name: 'Bob', score: 0 },
  ];

  increment(index: number) {
    this.players[index].score++;
    // Only the row for this player re-renders
  }

  view() {
    return (
      <For each={this.players}>
        {(player) => (
          <div>
            {player.name}: {player.score}
          </div>
        )}
      </For>
    );
  }
}
```

> When `each` is a `@State` array, `For` uses fine-grained reactivity: each item has its own effect and only re-renders when that specific item changes.
