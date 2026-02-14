---
title: "Styles"
weight: 2
---

Signals Framework provides reactive CSS-in-JS through stylesheet classes. Styles are scoped to components via Shadow DOM and can react to state changes.

## Defining a stylesheet

```typescript
import { BaseStyleSheet, Rule, Keyframes } from 'signalsframework';

class ButtonStyles extends BaseStyleSheet {
  @Rule(':host')
  get host() {
    return {
      display: 'inline-block',
    };
  }

  @Rule('button')
  get button() {
    return {
      padding: '8px 16px',
      border: 'none',
      borderRadius: '4px',
      backgroundColor: '#7c6ef0',
      color: 'white',
      cursor: 'pointer',
    };
  }

  @Rule('button:hover')
  get buttonHover() {
    return {
      backgroundColor: '#9182f5',
    };
  }
}
```

## Attaching styles to components

```typescript
@Component({ styles: [ButtonStyles] })
class MyButton extends BaseComponent {
  view() {
    return <button><slot /></button>;
  }
}
```

## Reactive styles

Since getters are used, styles can depend on reactive state:

```typescript
class ThemeStyles extends BaseStyleSheet {
  @Host host!: BaseComponent;

  @Rule(':host')
  get hostStyle() {
    return {
      backgroundColor: this.host.darkMode ? '#1a1a2e' : '#ffffff',
      color: this.host.darkMode ? '#e2e2e6' : '#1a1a2e',
      transition: 'all 0.3s ease',
    };
  }
}
```

When `this.host.darkMode` changes, the CSS rule updates automatically.

## Keyframes

```typescript
class AnimationStyles extends BaseStyleSheet {
  @Keyframes('fadeIn')
  get fadeIn() {
    return {
      '0%': { opacity: 0 },
      '100%': { opacity: 1 },
    };
  }

  @Rule('.animated')
  get animated() {
    return {
      animation: 'fadeIn 0.3s ease-in',
    };
  }
}
```
