# v-ibe

Modern framework for single page applications.

---

## What is this?

**v-ibe** is an opinionated front-end framework for building **SPA applications** using **persistent class-based components**, **signals**, and **direct DOM updates**.

Most frameworks treat UI as `UI = f(state)` — a pure function that re-executes on every change. v-ibe treats UI as a long-lived system made of objects that react to change. There is no virtual DOM, no component re-execution, no hooks, and no immutable state gymnastics. Components are real objects that live for the lifetime of the UI and update themselves incrementally when their state changes.

- Components instantiate once, not on every render
- State is mutable and tracked automatically
- Updates are granular — only affected DOM nodes change
- No virtual DOM, no diffing, no reconciliation

If you believe the UI should behave like a long-lived system instead of a pure function, this framework is for you.

---

## Hello World

```typescript
@Component()
export class HelloWorld extends BaseComponent {
  @State name = 'World';

  view() {
    return (
      <h1 onClick={() => this.name = 'Signals'}>
        Hello {this.name}
      </h1>
    );
  }
}
```

- This component is instantiated **once**
- `view()` is executed **once**
- Clicking mutates state directly
- Only the text node updates — no re-render

---

## Installation

```bash
npm install v-ibe
```

---

## What's included

Everything needed for production SPAs:

| System | What it does |
|--------|--------------|
| **Components** | Class-based, persistent, with lifecycle hooks |
| **Signals** | Granular reactivity with automatic dependency tracking |
| **Router** | Declarative routes with lazy loading and policies |
| **DI** | Hierarchical dependency injection |
| **Data** | Normalized entity store with reactive queries |
| **Cache** | Declarative caching with TTL and tag-based invalidation |
| **Styles** | Reactive CSS-in-JS with media queries and animations |
| **Behaviors** | Reusable DOM logic (like Angular directives) |
| **Events** | Type-safe event bus for component communication |

Zero external dependencies. ~27KB min+gzip.

---

## Architecture principles

1. **Standards first** — Use Web Components, native DOM APIs
2. **Incremental computation** — Update only what changed
3. **Multi-paradigm** — OOP for structure, FRP for reactivity
4. **Integrated system** — Everything designed to work together
5. **Zero config** — Sensible defaults, escape hatches where needed

[Read full philosophy →](./docs/filosofia.md)

---

## Documentation

**Start here:**
- [Quick Start](./docs/README.md)
- [Core Concepts](./docs/README.md#core-concepts)

**Core systems:**
- [Components](./docs/base-component.md) — Lifecycle, props, hooks
- [State](./docs/state.md) — Reactive state with `@State`
- [Computed](./docs/computed.md) — Derived values with `@Computed`
- [Effects](./docs/effect.md) — Side effects with `@Effect`
- [Resources](./docs/resource.md) — Async data with `@Resource`

**Application architecture:**
- [Router](./docs/router.md) — Routes, params, policies
- [Dependency Injection](./docs/di.md) — Services and `@Inject`
- [Data Management](./docs/data-management.md) — Normalized store, caching
- [Styling](./docs/base-style-sheet.md) — Reactive CSS-in-JS
- [Behaviors](./docs/behaviors.md) — Reusable DOM logic

**Reference:**
- [API Index](./docs/README.md#índice-de-features) — All decorators and APIs

---

## Project status

**Alpha** — Core is stable, ecosystem is young.

- ✅ Reactivity system stable
- ✅ Router with policies working
- ✅ DI and services stable
- ✅ Tree-shaking optimized
- ⏳ SSR planned (not implemented)
- ⏳ DevTools planned
- ⏳ Community ecosystem needed

**Current limitation:** SPA-only (no SSR yet).

**Bundle size:** ~27KB min+gzip for full framework with tree-shaking.

---

## When to use

**Good fit:**
- Building SPAs with complex state
- Want granular reactivity without mental overhead
- Prefer classes over functions
- Need batteries-included solution
- Want zero runtime dependencies

**Not a fit:**
- Need SSR (coming later)
- Want large ecosystem now
- Prefer functional style
- Need framework with years of production usage

---

## FAQ

**Why classes instead of functions?**

Because objects have identity and lifecycle. Components that exist over time are better modeled as objects than as functions that re-execute.

**Why decorators?**

Stage 3 decorators are standard JavaScript. They provide better ergonomics than HOCs or wrapper functions while being TypeScript-first.

**How is this different from Solid?**

Solid has great reactivity but is minimal by design. v-ibe is opinionated and complete — router, DI, normalized store, caching, and styles all designed to work together.

**Why no SSR yet?**

We're focusing on getting the client-side experience perfect first. SSR is planned but not the current priority.

**Can I use this in production?**

The core is stable, but we're alpha. Use for side projects first. API may change before 1.0.

**Bundle size?**

~27KB min+gzip with everything. Solid is smaller (~7KB) but doesn't include router, DI, store, cache, or styles.

---

## Contributing

We welcome:
- Bug reports and fixes
- Documentation improvements
- Real-world usage feedback
- Performance benchmarks

Not ready for: Major API changes until patterns stabilize.

---

## License

MIT
