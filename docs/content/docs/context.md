---
title: "Context"
weight: 3
---

`@Ctx` shares state between components through the tree — no prop drilling required. A parent defines a value, and any descendant can read it.

## Providing context

Define a `@Ctx` property with an initial value. This component becomes the provider for any descendant with the same property name:

```typescript
@Component()
class App extends BaseComponent {
  @Ctx() theme = 'dark';
  @Ctx() locale = 'en';

  view() {
    return (
      <Layout>
        <Sidebar />
        <Content />
      </Layout>
    );
  }
}
```

## Consuming context

Descendants declare a `@Ctx` property with the same name. The framework walks up the component tree and finds the nearest ancestor that provides it:

```typescript
@Component()
class ThemedButton extends BaseComponent {
  @Ctx() theme!: string;

  view() {
    return <button class={this.theme}>Click</button>;
  }
}
```

If no ancestor provides `theme`, the field's initial value is used as fallback.

## Transforming values

Pass a mapper function to derive a different value from the parent's context:

```typescript
@Component()
class InverseTheme extends BaseComponent {
  @Ctx((theme: string) => theme === 'dark' ? 'light' : 'dark')
  theme!: string;
}
```

## Provider and consumer pattern

Context flows one way — down the tree. Providers can update the value, consumers are read-only:

```typescript
// Provider (root) — can read and write
@Component()
class ThemeProvider extends BaseComponent {
  @Ctx() theme = 'dark';

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
  }
}

// Consumer (descendant) — read-only
@Component()
class ThemeConsumer extends BaseComponent {
  @Ctx() theme!: string;
  // this.theme reflects the provider's value
  // assigning to this.theme has no effect
}
```
