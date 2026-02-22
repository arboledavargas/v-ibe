---
title: "@Component"
weight: 2
---

## Import

```typescript
import { Component } from '@v-ibe/core';
```

## Description

Decorator that registers a class as a v-ibe component. It converts the class name to a kebab-case custom element tag (e.g. `MyButton` → `use-my-button`) and registers it with the browser's custom elements registry.

Every component class must be decorated with `@Component()`.

## Type

```typescript
function Component(config?: {
  styles?: StyleClass | StyleClass[];
  useShadowDOM?: boolean;
  services?: ServiceClass[];
}): ClassDecorator
```

## Examples

```typescript
// Minimal
@Component()
class MyButton extends BaseComponent {
  view() {
    return <button>Click</button>;
  }
}
```

```typescript
// With styles
@Component({ styles: MyButtonStyles })
class MyButton extends BaseComponent {
  view() {
    return <button>Click</button>;
  }
}
```

```typescript
// Without Shadow DOM
@Component({ useShadowDOM: false })
class MyLink extends BaseComponent {
  view() {
    return <a href="#">Link</a>;
  }
}
```

```typescript
// With scoped services
@Component({ services: [AuthService, UserService] })
class UserProfile extends BaseComponent {
  @Inject(AuthService) auth!: AuthService;

  view() {
    return <div>{this.auth.currentUser}</div>;
  }
}
```
