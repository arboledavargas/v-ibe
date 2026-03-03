---
title: "@Prop"
weight: 3
---

## Import

```typescript
import { Prop } from '@v-ibe/core';
```

## Description

Decorator for component fields that receive values from a parent. Use it on any field that will be set from outside the component.

Event handlers (props starting with `on`) are passed as-is and never treated as reactive values.

## Examples

```typescript
// Defining props
@Component()
class UserCard extends BaseComponent {
  @Prop name = '';
  @Prop age = 0;

  view() {
    return <div>{this.name} ({this.age})</div>;
  }
}
```

```typescript
// Using UserCard from a parent
@Component()
class Parent extends BaseComponent {
  @State user = { name: 'Alice', age: 30 };

  view() {
    return <UserCard name={this.user.name} age={this.user.age} />;
  }
}
```

> When the parent's signal changes, only the DOM nodes bound to that prop are updated.
