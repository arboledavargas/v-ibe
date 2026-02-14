---
title: "Reactivity"
weight: 1
---

Signals Framework uses a fine-grained reactive system. Instead of re-rendering entire component trees, it tracks exactly which DOM nodes depend on which values and updates them directly.

## State

`@State` creates a reactive value. The framework auto-detects the type and wraps it accordingly:

```typescript
@State count = 0;           // primitive → Signal
@State user = { name: '' }; // object → CompositeSignal (deep proxy)
@State items: string[] = [];// array → ReactiveArray
```

When you assign a new value or mutate a property, any dependent computations and DOM bindings update automatically.

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

`@Resource` handles async data fetching with built-in loading and error states:

```typescript
@Resource(async (signal) => {
  const res = await fetch('/api/users', { signal });
  return res.json();
})
users!: IResource<User[]>;
```

In the template:

```typescript
view() {
  return (
    <div>
      {this.users.loading && <p>Loading...</p>}
      {this.users.error && <p>Error: {this.users.error.message}</p>}
      {this.users() && <UserList users={this.users()} />}
    </div>
  );
}
```

## Context

`@Ctx` allows child components to inherit reactive values from ancestors without explicit prop passing:

```typescript
// Parent
@Component()
class App extends BaseComponent {
  @State theme = 'dark';
  // ...
}

// Any descendant
@Component()
class DeepChild extends BaseComponent {
  @Ctx((app: App) => app.theme) theme!: string;

  view() {
    return <p>Current theme: {this.theme}</p>;
  }
}
```
