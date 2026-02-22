---
title: "Reactive Components"
weight: 11
---

v-ibe ships two built-in helpers for common reactive rendering patterns: `For` for lists and `Show` for conditional rendering.

## For

Renders a list reactively. When the source is a `@State` array, only the items that actually changed are updated — not the whole list.

```typescript
import { For } from '@v-ibe/core';
```

### Examples

```tsx
// Basic list
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

```tsx
// With fallback
<For each={this.items} fallback={<p>No items yet.</p>}>
  {(item) => <ItemCard item={item} />}
</For>
```

```tsx
// With custom key
<For each={this.users} getKey={(user) => user.id}>
  {(user) => <UserRow user={user} />}
</For>
```

> When `each` is a `@State` array, `For` uses fine-grained reactivity: each item has its own effect and only re-renders when that specific item changes.

---

## Show

Renders content conditionally. The `when` condition is tracked reactively — when it changes, the content is swapped. The children are rendered without tracking to prevent infinite loops.

```typescript
import { Show } from '@v-ibe/core';
```

### Examples

```tsx
// Basic conditional
<Show when={() => this.isLoggedIn}>
  {() => <Dashboard />}
</Show>
```

```tsx
// With fallback
<Show when={() => this.isLoggedIn} fallback={() => <LoginPage />}>
  {() => <Dashboard />}
</Show>
```

```tsx
// Loading state
<Show when={() => this.data.state === 'pending'}>
  {() => <Spinner />}
</Show>

<Show when={() => this.data.state === 'ready'}>
  {() => <DataTable data={this.data.get()} />}
</Show>
```
