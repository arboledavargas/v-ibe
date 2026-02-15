---
title: "Styles"
weight: 4
---

Styles are TypeScript classes. Instead of writing CSS in strings or separate files, you define rules as getters that return typed objects. Because rules live inside the reactive system, styles update automatically when state changes — no class toggling, no manual DOM manipulation.

## Defining a stylesheet

Extend `BaseStyleSheet` and use `@Rule` to declare CSS rules. Each rule is a getter that returns a `CSSProperties` object:

```typescript
class CardStyles extends BaseStyleSheet {
  @Rule(':host')
  get host() {
    return {
      display: 'block',
      padding: 16,
      borderRadius: 8,
    };
  }

  @Rule(':host button')
  get button() {
    return {
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
    };
  }
}
```

Numeric values are converted to `px` automatically. Unitless properties like `opacity`, `zIndex`, and `flexGrow` stay as numbers.

## Attaching to a component

Pass the stylesheet class in `@Component`. The styles apply to its Shadow DOM:

```typescript
@Component({ styles: CardStyles })
class Card extends BaseComponent {
  view() {
    return <div><slot /></div>;
  }
}
```

## Reactive styles

Rules are reactive. Reference any `@State` or `@Computed` value inside a getter and the CSS updates when it changes:

```typescript
class PanelStyles extends BaseStyleSheet {
  @Host host!: Panel;

  @Rule(':host')
  get hostStyles() {
    return {
      width: this.host.expanded ? '100%' : 300,
      transition: 'width 0.3s ease',
    };
  }
}
```

`@Host` gives the stylesheet access to the component instance, so rules can read component state directly.

## Keyframes

`@Keyframes` defines animations with the same reactive approach:

```typescript
class SpinnerStyles extends BaseStyleSheet {
  @Keyframes('spin')
  get spinAnimation() {
    return {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    };
  }

  @Rule('.spinner')
  get spinner() {
    return {
      animation: 'spin 1s linear infinite',
    };
  }
}
```

## Style scoping

By default, styles are local to the component's Shadow DOM. Two decorators change this:

**`@Shared`** — styles are adopted by every shadow root in the application. Useful for design tokens and shared themes:

```typescript
@Shared
class DesignTokens extends BaseStyleSheet {
  @Rule(':host')
  get tokens() {
    return {
      '--color-primary': '#007bff',
      '--color-text': '#212529',
      '--spacing-unit': '8px',
    };
  }
}
```

**`@ForDocument`** — styles are injected into the document `<head>`. Useful for global resets and styles that need to reach outside Shadow DOM:

```typescript
@ForDocument
class GlobalReset extends BaseStyleSheet {
  @Rule('*, *::before, *::after')
  get boxSizing() {
    return { boxSizing: 'border-box' };
  }

  @Rule('body')
  get body() {
    return { margin: 0, padding: 0 };
  }
}
```

The scope is determined by the decorator on each class. Pass them all through `styles` — the framework routes each one automatically:

```typescript
@Component({
  styles: [DesignTokens, GlobalReset, AppStyles]
})
class App extends BaseComponent { ... }
```

## Environment decorators

Reactive decorators that track browser and device state. Use them inside stylesheets or components to respond to environment changes:

```typescript
class ResponsiveStyles extends BaseStyleSheet {
  @MediaQuery('(max-width: 768px)') isMobile!: boolean;
  @DarkMode isDark!: boolean;

  @Rule(':host')
  get layout() {
    return {
      display: 'grid',
      gridTemplateColumns: this.isMobile ? '1fr' : '250px 1fr',
      backgroundColor: this.isDark ? '#1a1a1a' : '#ffffff',
    };
  }
}
```

### Available decorators

| Decorator | Type | Description |
|---|---|---|
| `@MediaQuery(query)` | `boolean` | Matches a CSS media query |
| `@WindowSize` | `{ width, height }` | Viewport dimensions |
| `@WindowWidth` | `number` | Viewport width |
| `@WindowHeight` | `number` | Viewport height |
| `@ScrollPosition` | `number` | Vertical scroll offset |
| `@ScrollXY` | `{ x, y }` | Scroll position |
| `@DarkMode` | `boolean` | Prefers dark color scheme |
| `@ReducedMotion` | `boolean` | Prefers reduced motion |
| `@NetworkStatus` | `boolean` | Online/offline |
| `@MousePosition` | `{ x, y }` | Cursor position |
| `@MouseX` | `number` | Cursor X |
| `@MouseY` | `number` | Cursor Y |
| `@KeyPressed(key)` | `boolean` | Key is held down |
| `@ModifierKeys` | `{ ctrl, shift, alt, meta }` | Active modifiers |
| `@DeviceOrientation` | `string` | Screen orientation |
| `@PageVisibility` | `boolean` | Tab is visible |
| `@WindowFocus` | `boolean` | Window has focus |
