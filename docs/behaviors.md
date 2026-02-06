# Behaviors

[← Volver al índice](../README.md)

```typescript
@Behavior
export class Link {
  @Host el!: HTMLAnchorElement;
  @Prop link: boolean = true;
  @Prop href: string = '';
  @Prop activeClass?: string;
  
  onInit() {
    this.el.href = this.href;
  }
}

// Uso en JSX:
<a link href="/home" activeClass="active">Home</a>
```

Sistema para extender elementos nativos con lógica reutilizable.

## Cuándo usar

Extender elementos HTML nativos. Lógica reutilizable. Evitar componentes wrapper innecesarios.

## API

### `@Behavior`

Decorador de clase que registra un Behavior en el sistema.

```typescript
@Behavior
export class Tooltip {
  @Host el!: HTMLElement;
  @Prop tooltip: boolean = true;
  @Prop text: string = '';
  
  onInit() {
    // Lógica del tooltip
  }
}
```

### `@Host`

Decorador de campo que marca dónde inyectar el elemento DOM.

```typescript
@Behavior
export class Draggable {
  @Host el!: HTMLElement;  // El elemento será inyectado aquí
  @Prop draggable: boolean = true;
  
  onInit() {
    this.el.draggable = true;
  }
}
```

### `@Prop` (en Behaviors)

Decorador de campo para propiedades del Behavior.

```typescript
@Behavior
export class Link {
  @Prop link: boolean = true;
  @Prop href: string = '';
  @Prop target?: string;
}
```

### Hook `onInit()`

Se ejecuta después de inyectar el elemento y asignar las props.

```typescript
@Behavior
export class AutoFocus {
  @Host el!: HTMLInputElement;
  @Prop autofocus: boolean = true;
  
  onInit() {
    this.el.focus();
  }
}
```

### Hook `onDestroy()`

Se ejecuta cuando el elemento se desconecta del DOM.

```typescript
@Behavior
export class EventLogger {
  @Host el!: HTMLElement;
  @Prop logger: boolean = true;
  
  private handler = () => console.log('clicked');
  
  onInit() {
    this.el.addEventListener('click', this.handler);
  }
  
  onDestroy() {
    this.el.removeEventListener('click', this.handler);
  }
}
```

## Ejemplos

### Link behavior

```typescript
@Behavior
export class Link {
  @Host el!: HTMLAnchorElement;
  
  @Prop link: boolean = true;
  @Prop href: string = '';
  @Prop activeClass?: string;
  
  onInit() {
    this.el.href = this.href;
    
    if (this.activeClass && this.el.href === window.location.href) {
      this.el.classList.add(this.activeClass);
    }
  }
}

// Uso:
<a link href="/home" activeClass="active">Home</a>
<a link href="/about">About</a>
```

### Tooltip behavior

```typescript
@Behavior
export class Tooltip {
  @Host el!: HTMLElement;
  
  @Prop tooltip: boolean = true;
  @Prop text: string = '';
  @Prop position: 'top' | 'bottom' = 'top';
  
  private tooltipEl?: HTMLDivElement;
  
  onInit() {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.textContent = this.text;
    this.tooltipEl.className = `tooltip tooltip-${this.position}`;
    
    this.el.addEventListener('mouseenter', () => {
      document.body.appendChild(this.tooltipEl!);
    });
    
    this.el.addEventListener('mouseleave', () => {
      this.tooltipEl?.remove();
    });
  }
  
  onDestroy() {
    this.tooltipEl?.remove();
  }
}

// Uso:
<button tooltip text="Click me!" position="top">
  Hover
</button>
```

### Draggable behavior

```typescript
@Behavior
export class Draggable {
  @Host el!: HTMLElement;
  
  @Prop draggable: boolean = true;
  @Prop onDragStart?: (e: DragEvent) => void;
  @Prop dragData?: any;
  
  onInit() {
    this.el.draggable = true;
    
    this.el.addEventListener('dragstart', (e) => {
      if (this.dragData) {
        e.dataTransfer?.setData('application/json', JSON.stringify(this.dragData));
      }
      this.onDragStart?.(e);
    });
  }
}

// Uso:
<div draggable dragData={{ id: 1, name: 'Item' }}>
  Drag me
</div>
```

### AutoFocus behavior

```typescript
@Behavior
export class AutoFocus {
  @Host el!: HTMLInputElement;
  
  @Prop autofocus: boolean = true;
  @Prop selectText?: boolean;
  
  onInit() {
    this.el.focus();
    
    if (this.selectText) {
      this.el.select();
    }
  }
}

// Uso:
<input autofocus selectText placeholder="Focus on load" />
```

### ClickOutside behavior

```typescript
@Behavior
export class ClickOutside {
  @Host el!: HTMLElement;
  
  @Prop clickOutside: boolean = true;
  @Prop onClickOutside?: () => void;
  
  private handler = (e: MouseEvent) => {
    if (!this.el.contains(e.target as Node)) {
      this.onClickOutside?.();
    }
  };
  
  onInit() {
    document.addEventListener('click', this.handler);
  }
  
  onDestroy() {
    document.removeEventListener('click', this.handler);
  }
}

// Uso:
<div clickOutside onClickOutside={() => console.log('Clicked outside')}>
  Click outside me
</div>
```

### IntersectionObserver behavior

```typescript
@Behavior
export class LazyLoad {
  @Host el!: HTMLImageElement;
  
  @Prop lazyLoad: boolean = true;
  @Prop src: string = '';
  @Prop threshold?: number = 0.1;
  
  private observer?: IntersectionObserver;
  
  onInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.el.src = this.src;
            this.observer?.disconnect();
          }
        });
      },
      { threshold: this.threshold }
    );
    
    this.observer.observe(this.el);
  }
  
  onDestroy() {
    this.observer?.disconnect();
  }
}

// Uso:
<img lazyLoad src="/image.jpg" alt="Lazy loaded" />
```

### Múltiples behaviors

```typescript
// Un elemento puede tener múltiples behaviors:
<div
  tooltip
  text="Click me"
  clickOutside
  onClickOutside={() => console.log('Outside')}
  draggable
  dragData={{ id: 1 }}
>
  Element with multiple behaviors
</div>
```

## Funcionamiento

Cuando pasas props a un elemento, el sistema agrupa automáticamente las props que pertenecen a behaviors registrados:

```typescript
<button tooltip text="Click me" class="btn">
  Click
</button>

// Props de Tooltip: tooltip, text
// Props del DOM: class
// Resultado en DOM: <button class="btn">Click</button>
```

## Integración con componentes

Los Behaviors funcionan automáticamente en elementos nativos renderizados por componentes:

```typescript
@Component()
export class MyComponent extends BaseComponent {
  view() {
    return (
      <div>
        <a link href="/home">Home</a>
        <button tooltip text="Save">Save</button>
        <img lazyLoad src="/image.jpg" />
      </div>
    );
  }
}
```

## Ventajas

### Sin wrapper components

```typescript
// ❌ Antes: Wrapper component
<LinkComponent href="/home" activeClass="active">
  Home
</LinkComponent>

// ✅ Ahora: Behavior
<a link href="/home" activeClass="active">
  Home
</a>
```

### Composición

```typescript
// Múltiples behaviors en un elemento:
<button
  tooltip
  text="Info"
  clickOutside
  onClickOutside={() => console.log('Outside')}
>
  Click
</button>
```

### Reutilización

```typescript
// Un Behavior se puede usar en múltiples elementos:
<a link href="/home">Home</a>
<a link href="/about">About</a>
<a link href="/contact">Contact</a>
```

### Limpieza automática

El hook `onDestroy()` se ejecuta automáticamente cuando el elemento se desconecta:

```typescript
@Behavior
export class Timer {
  @Host el!: HTMLElement;
  @Prop timer: boolean = true;
  
  private interval?: number;
  
  onInit() {
    this.interval = setInterval(() => {
      console.log('tick');
    }, 1000);
  }
  
  onDestroy() {
    clearInterval(this.interval);
  }
}
```
