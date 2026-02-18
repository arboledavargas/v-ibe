---
title: "Components"
weight: 2
---

Components are classes that extend `BaseComponent` and register as Custom Elements. They render once, hold real state, and update the DOM surgically.

## Defining a component

```typescript
import { Component, BaseComponent, State } from 'v-ibe';

@Component()
class Counter extends BaseComponent {
  @State count = 0;

  view() {
    return (
      <div>
        <p>Count: {this.count}</p>
        <button onClick={() => this.count++}>
          Increment
        </button>
      </div>
    );
  }
}
```

`@Component()` converts the class name to a Custom Element tag (`Counter` → `use-counter`) and registers it with the browser.

## Using a component

Use it as a JSX tag inside any other component's `view()`:

```typescript
<Counter />
```

Or as a native Custom Element in HTML:

```html
<use-counter></use-counter>
```

## Configuration

```typescript
@Component({
  styles: [CounterStyles],     // local stylesheet classes
  useShadowDOM: true,          // default: true
  services: [CounterService],  // DI providers for this subtree
})
```

## view()

The `view()` method returns JSX. It runs **once** — reactivity handles updates:

```typescript
view() {
  return (
    <div>
      <h1>{this.title}</h1>
      <p class={this.isActive && 'active'}>Content</p>
      <For each={this.items}>
        {(item) => <TodoItem todo={item} />}
      </For>
    </div>
  );
}
```

`@State` creates a signal — when its value changes, only the DOM nodes that reference it update. `<For>` renders lists with the same granularity — only changed items re-render.

## Props

`@Prop` declares inputs that parent components can pass:

```typescript
@Component()
class UserCard extends BaseComponent {
  @Prop name: string = '';
  @Prop avatar: string = '';
  @Prop onSelect?: () => void;

  view() {
    return (
      <div onClick={this.onSelect}>
        <img src={this.avatar} />
        <span>{this.name}</span>
      </div>
    );
  }
}
```

Usage:

```typescript
<UserCard name={this.user.name} avatar={this.user.avatar} />
```

Props bound to `@State` values stay in sync. Event handlers (`on*`) are passed as callbacks.

## Lifecycle

Three optional hooks:

```typescript
@Component()
class Dashboard extends BaseComponent {
  onInit() {
    // after state/effects initialized, before view
  }

  onConnected() {
    // after view rendered and attached to DOM
  }

  onDisconnected() {
    // cleanup on removal
  }
}
```

## Web Components

Every component is a standard Custom Element. This means native browser APIs work out of the box.

### Shadow DOM

Enabled by default. Styles and DOM are fully encapsulated:

```typescript
@Component({ useShadowDOM: false })
class InlineWidget extends BaseComponent {
  // renders directly into the element, no shadow root
}
```

### Slots

Use `<slot>` to project children into your component's template:

```typescript
@Component()
class Card extends BaseComponent {
  @Prop cardTitle: string = '';

  view() {
    return (
      <div class="card">
        <h2>{this.cardTitle}</h2>
        <slot />
      </div>
    );
  }
}
```

```typescript
<Card cardTitle="Profile">
  <p>This content goes into the slot.</p>
  <button>Edit</button>
</Card>
```

Named slots for multiple insertion points:

```typescript
@Component()
class PageLayout extends BaseComponent {
  view() {
    return (
      <div class="layout">
        <header><slot name="header" /></header>
        <main><slot /></main>
        <footer><slot name="footer" /></footer>
      </div>
    );
  }
}
```

```typescript
<PageLayout>
  <nav slot="header">Navigation</nav>
  <p>Main content</p>
  <span slot="footer">© 2025</span>
</PageLayout>
```

### Composition

Components compose naturally through JSX:

```typescript
@Component()
class App extends BaseComponent {
  view() {
    return (
      <Layout>
        <Sidebar />
        <main>
          <Router />
        </main>
      </Layout>
    );
  }
}
```
