# BaseComponent

[← Volver al índice](../README.md)

```typescript
import { BaseComponent, Component, Prop } from 'signalsframework';
import { FilledButtonStyles } from './filled-button.styles';

@Component({ styles: FilledButtonStyles })
export class FilledButton extends BaseComponent {

  @Prop
  onClick!: () => void;

  view() {
    return (
      <button class="filled-button" onClick={this.onClick}>
        <slot></slot>
      </button>
    );
  }
}
```

`BaseComponent` es la clase base que todos los componentes de Signals Framework deben extender. Extiende `HTMLElement` y proporciona la infraestructura necesaria para crear Web Components funcionales: gestiona el Shadow DOM, el ciclo de vida del componente (inicialización, conexión, desconexión), la integración con el sistema de estilos, signals y el renderizado JSX.

## Índice

### Renderizado
- [Método `view()`](#)

### Ciclo de vida y hooks
- [Hook `onInit()`](#)
- [Hook `onConnected()`](#)
- [Hook `onDisconnected()`](#)

### Props
- [Decorador `@Prop`](#)

### Estilos
- [Decorador `@Component` con estilos](#)
- [Estilos locales](#)
- [Estilos compartidos `@Shared`](#)
- [Estilos de documento `@ForDocument TODO not tested`](#)