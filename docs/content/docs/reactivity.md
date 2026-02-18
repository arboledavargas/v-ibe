---
title: "Reactivity"
weight: 1
---

v-ibe uses a fine-grained reactive system. Instead of re-rendering entire component trees, it tracks exactly which DOM nodes depend on which values and updates them directly.

## State

`@State` creates a reactive value. The framework auto-detects the type and wraps it accordingly:

```typescript
@State count = 0;           // primitive → Signal
@State user = { name: '' }; // object → CompositeSignal (deep proxy)
@State items: string[] = [];// array → ReactiveArray
```

When you assign a new value or mutate a property, any dependent computations and DOM bindings update automatically.

## CompositeSignal

When `@State` wraps an object, it creates a deep reactive proxy. Nested properties are tracked individually:

```typescript
@State user = { name: 'John', address: { city: 'NYC' } };

// In view — only this <span> updates when name changes
<span>{this.user.name}</span>

// Mutations trigger granular updates
this.user.name = 'Jane';           // updates only subscribers of .name
this.user.address.city = 'LA';     // updates only subscribers of .address.city
```

Nested objects and arrays are automatically wrapped — no extra setup needed.

## ReactiveArray

When `@State` wraps an array, it creates a ReactiveArray with granular index tracking:

```typescript
@State todos: Todo[] = [];
```

Standard array methods work as expected:

```typescript
this.todos.push({ text: 'New todo' });
this.todos.splice(1, 1);
this.todos[0] = { text: 'Updated' };
```

Use `.map()` and `.filter()` to derive new reactive arrays:

```typescript
// Derived array — updates only when source changes
@Computed
get completed() {
  return this.todos.filter(t => t.done);
}
```

Render lists with `<For>` for fine-grained updates — only the changed index re-renders:

```typescript
<For each={this.todos}>
  {(todo) => <TodoItem todo={todo} />}
</For>
```

## Computed

`@Computed` creates a memoized derived value. It only recalculates when its dependencies change:

```typescript
@State firstName = 'John';
@State lastName = 'Doe';

@Computed
get fullName() {
  return `${this.firstName} ${this.lastName}`;
}
```

Accessing `this.fullName` multiple times without changing `firstName` or `lastName` returns the cached value.

## Effect

`@Effect` runs a side effect whenever its tracked dependencies change:

```typescript
@State query = '';

@Effect
searchOnChange() {
  console.log('Searching for:', this.query);
  // This runs every time this.query changes
}
```

Effects are automatically disposed when the component is disconnected.

## Resource

`@Resource` handles async data fetching with built-in loading and error states. It executes when the component mounts:

```typescript
@Resource(async (signal) => {
  const res = await fetch('/api/users', { signal });
  return res.json();
})
users!: IResource<User[]>;
```

In the template, use `<Show>` for conditional rendering based on the resource state:

```typescript
view() {
  return (
    <div>
      <Show when={this.users.loading}>
        {() => <p>Loading...</p>}
      </Show>
      <Show when={this.users.error}>
        {() => <p>Error: {this.users.error.message}</p>}
      </Show>
      <Show when={this.users.data}>
        {() => <UserList users={this.users()} />}
      </Show>
    </div>
  );
}
```

