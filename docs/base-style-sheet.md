# BaseStyleSheet

[← Volver al índice](../README.md)

```typescript
import { BaseStyleSheet, Rule, CSSProperties } from 'signalsframework';

export class ButtonStyles extends BaseStyleSheet {
  @Rule(':host')
  get hostStyles(): CSSProperties {
    return {
      display: 'inline-block',
    };
  }

  @Rule(':host button')
  get buttonStyles(): CSSProperties {
    return {
      padding: '12px 24px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    };
  }
}
```

`BaseStyleSheet` es la clase base para definir estilos reactivos en Signals Framework. Extiende esta clase y usa el decorador `@Rule` con selectores CSS para definir reglas de estilo. Los estilos se aplican automáticamente al Shadow DOM del componente cuando se asocian mediante el decorador `@Component`.

## Índice

### Decoradores principales
- [Decorador `@Rule`](#)
- [Decorador `@Component` con estilos](#)
- [Decorador `@UseStyles`](#)

### Scopes de estilos
- [Estilos locales](#)
- [Decorador `@Shared`](#)
- [Decorador `@ForDocument`](#)

### Reactividad en estilos
- [Estilos reactivos con signals](#)
- [Decorador `@Host`](#)

### Decoradores de eventos y estado
- [Decorador `@MediaQuery`](#)
- [Decorador `@WindowSize` / `@WindowWidth` / `@WindowHeight`](#)
- [Decorador `@ScrollPosition` / `@ScrollXY`](#)
- [Decorador `@MousePosition` / `@MouseX` / `@MouseY`](#)
- [Decorador `@DarkMode`](#)
- [Decorador `@ReducedMotion`](#)
- [Decorador `@NetworkStatus`](#)
- [Decorador `@DeviceOrientation`](#)
- [Decorador `@PageVisibility`](#)
- [Decorador `@KeyPressed`](#)
- [Decorador `@ModifierKeys`](#)
- [Decorador `@WindowFocus`](#)
- [Decorador `@TextSelection`](#)
- [Decorador `@FrameRate`](#)

### Animaciones
- [Decorador `@Keyframes`](#)

### Tipos
- [Interface `CSSProperties`](#)
