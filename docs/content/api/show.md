---
title: "Show"
weight: 5
---

## Import

```typescript
import { Show } from '@v-ibe/core';
```

## Description

`Show` renders content conditionally. The `when` condition is tracked reactively — when it changes, the content is swapped. Children are rendered without tracking to prevent infinite loops.

## Type

```typescript
function Show(props: {
  when: () => boolean;
  children: () => JSX.Element;
  fallback?: () => JSX.Element;
}): DocumentFragment
```

## Examples

### Basic conditional

```tsx
<Show when={() => this.isLoggedIn}>
  {() => <Dashboard />}
</Show>
```

### With fallback

```tsx
<Show when={() => this.isLoggedIn} fallback={() => <LoginPage />}>
  {() => <Dashboard />}
</Show>
```

### Loading state

```tsx
@Component()
class DataView extends BaseComponent {
  @Resource(...) data!: IResource<Item[]>;

  view() {
    return (
      <>
        <Show when={() => this.data.state === 'pending'}>
          {() => <Spinner />}
        </Show>

        <Show when={() => this.data.state === 'ready'}>
          {() => <DataTable data={this.data.get()} />}
        </Show>
      </>
    );
  }
}
```

> Both `children` and `fallback` must be functions. They are executed without reactive tracking to prevent infinite loops when the rendered content creates dependencies that would re-trigger the condition.
