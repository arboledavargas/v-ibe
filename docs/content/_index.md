---
title: "Signals Framework"
---

A modern framework for building SPAs with persistent class-based components and fine-grained reactivity. No virtual DOM, no hooks, no re-renders. ~27KB min+gzip.

## Why Signals Framework?

Most frameworks treat UI as `UI = f(state)` — a pure function that re-executes on every change. Every state update means re-running components, diffing virtual trees, and reconciling the DOM.

Signals Framework takes a different approach: your components are **long-lived objects** that react to change. They instantiate once, they hold real state, and they update the DOM surgically when something changes.

## At a glance

```typescript
@Component({ styles: [CounterStyles] })
class Counter extends BaseComponent {
  @State count = 0;

  @Computed
  get doubled() {
    return this.count * 2;
  }

  @Effect
  logCount() {
    console.log('Count changed:', this.count);
  }

  view() {
    return (
      <button onClick={() => this.count++}>
        {this.count} (doubled: {this.doubled})
      </button>
    );
  }
}
```

## Batteries included

- **Reactivity** — `@State`, `@Computed`, `@Effect`, `@Resource` with automatic dependency tracking
- **Components** — Class-based, Shadow DOM, lifecycle hooks, instantiated once
- **Dependency Injection** — Hierarchical containers with `@Service` and `@Inject`
- **Router** — File-based routing with lazy loading, params, and policy guards
- **Data Management** — Normalized entity store with reactive queries
- **Caching** — Declarative `@Cache`, `@TTL`, tag-based invalidation
- **Styles** — Reactive CSS-in-JS with `@Rule` and `@Keyframes`
- **Behaviors** — Reusable DOM logic attachable to any element
- **Events** — Global event bus with `@Emit`
