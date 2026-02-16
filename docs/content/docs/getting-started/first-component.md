---
title: "Your First Component"
weight: 2
---

Components in Signals Framework are classes that extend `BaseComponent`. They use the `@Component` decorator and define a `view()` method that returns JSX.

## A simple counter

```typescript
import { Component, BaseComponent, State } from '...';

@Component()
class Counter extends BaseComponent {
  @State count = 0;

  view() {
    return (
      <div>
        <p>Count: {this.count}</p>
        <button onClick={() => this.count++}>Increment</button>
      </div>
    );
  }
}
```

## What's happening here

- `@Component()` registers the class as a Custom Element
- `@State count = 0` creates a reactive signal. When `count` changes, only the DOM nodes that reference it update
- `view()` runs **once** to build the initial DOM. It does not re-run on state changes

This is the key difference from other frameworks: `view()` is a constructor, not a render function.

## Lifecycle hooks

Components have three lifecycle hooks:

```typescript
@Component()
class MyComponent extends BaseComponent {
  onInit() {
    // Called after the component is instantiated
    // and dependencies are injected
  }

  onConnected() {
    // Called when the element is added to the DOM
  }

  onDisconnected() {
    // Called when the element is removed from the DOM
  }

  view() {
    return <div>Hello</div>;
  }
}
```

## Props

Use `@Prop` to declare properties that can be set from the outside:

```typescript
@Component()
class Greeting extends BaseComponent {
  @Prop name: string = 'World';

  view() {
    return <h1>Hello {this.name}!</h1>;
  }
}
```

Usage:

```typescript
<Greeting name="Julian" />
```
