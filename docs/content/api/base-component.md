---
title: "BaseComponent"
weight: 1
---

## Import

```typescript
import { BaseComponent } from '@v-ibe/core';
```

## Description

`BaseComponent` is the base class for all v-ibe components. It extends `HTMLElement` and provides the core rendering pipeline, lifecycle hooks, reactivity integration, style adoption, and dependency injection wiring.

Every component you create must extend `BaseComponent` and implement a `view()` method that returns JSX.

By default, components render into a Shadow DOM. This can be disabled via `@Component({ useShadowDOM: false })`.

## Type

```typescript
class BaseComponent extends HTMLElement {
  // Lifecycle hooks (override in your component)
  onInit(): void
  onConnected(): void
  onDisconnected(): void

  // Must be implemented in your component
  view(): JSX.Element
}
```

## Lifecycle Hooks

| Hook | When it runs |
|------|-------------|
| `onInit()` | After styles and contexts are initialized, before effects run |
| `onConnected()` | Every time the component is connected to the DOM |
| `onDisconnected()` | When the component is removed from the DOM |

## Examples

### Basic component

```typescript
import { Component, BaseComponent } from '@v-ibe/core';

@Component()
class MyButton extends BaseComponent {
  view() {
    return <button>Click me</button>;
  }
}
```

### With lifecycle hooks

```typescript
import { Component, BaseComponent } from '@v-ibe/core';

@Component()
class MyComponent extends BaseComponent {
  onInit() {
    console.log('Component initialized');
  }

  onConnected() {
    console.log('Component connected to DOM');
  }

  onDisconnected() {
    console.log('Component removed from DOM');
  }

  view() {
    return <div>Hello</div>;
  }
}
```

### Without Shadow DOM

```typescript
import { Component, BaseComponent } from '@v-ibe/core';

@Component({ useShadowDOM: false })
class MyComponent extends BaseComponent {
  view() {
    return <div>Rendered in Light DOM</div>;
  }
}
```
