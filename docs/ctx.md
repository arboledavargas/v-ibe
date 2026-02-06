# @Ctx

[← Volver al índice](../README.md)

```typescript
// Padre
@Component()
export class Parent extends BaseComponent {
  @Ctx theme = 'light';
  
  view() {
    return <Child />;
  }
}

// Hijo - hereda automáticamente
@Component()
export class Child extends BaseComponent {
  @Ctx theme!: string;
  
  view() {
    return <div>Theme: {this.theme}</div>;
  }
}
```

Contexto reactivo entre componentes. Herencia automática padre-hijo.

## Cuándo usar

Compartir valores entre padre-hijo. Evitar prop drilling. Comunicación contextual.

## API

### `@Ctx`

Aplica a campos de clase. Hereda valor del padre o usa valor inicial.

```typescript
@Component()
export class Parent extends BaseComponent {
  @Ctx level = 0;
  
  view() {
    return <Child />;
  }
}

@Component()
export class Child extends BaseComponent {
  @Ctx level!: number;  // Hereda de padre
  
  view() {
    return <div>Level: {this.level}</div>;
  }
}
```

### Mapper opcional

Transforma el valor heredado del padre.

```typescript
@Component()
export class RouteView extends BaseComponent {
  @Ctx(v => (v === undefined ? 0 : v + 1))
  navigationLevel!: number;
  
  view() {
    return (
      <>
        <p>Level: {this.navigationLevel}</p>
        <Child />
      </>
    );
  }
}
```

## Ejemplos

### Tema compartido

```typescript
@Component()
export class App extends BaseComponent {
  @Ctx theme = 'light';
  
  view() {
    return (
      <>
        <button onClick={() => this.theme = 'dark'}>
          Toggle Theme
        </button>
        <Header />
      </>
    );
  }
}

@Component()
export class Header extends BaseComponent {
  @Ctx theme!: string;  // Hereda de App
  
  view() {
    return <div className={this.theme}>Header</div>;
  }
}
```

### Niveles anidados

```typescript
@Component()
export class Layout extends BaseComponent {
  @Ctx depth = 0;
  
  view() {
    return (
      <>
        <p>Depth: {this.depth}</p>
        <NestedLayout />
      </>
    );
  }
}

@Component()
export class NestedLayout extends BaseComponent {
  @Ctx(v => (v ?? 0) + 1)
  depth!: number;  // Incrementa el depth del padre
  
  view() {
    return (
      <>
        <p>Nested Depth: {this.depth}</p>
        <NestedLayout />  // Puede anidarse infinitamente
      </>
    );
  }
}
```

### Configuración compartida

```typescript
@Component()
export class Dashboard extends BaseComponent {
  @Ctx config = { language: 'es', currency: 'USD' };
  
  view() {
    return (
      <>
        <Settings />
        <Content />
      </>
    );
  }
}

@Component()
export class Settings extends BaseComponent {
  @Ctx config!: { language: string; currency: string };
  
  view() {
    return (
      <div>
        <select 
          value={this.config.language}
          onChange={(e) => this.config.language = e.target.value}
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>
    );
  }
}

@Component()
export class Content extends BaseComponent {
  @Ctx config!: { language: string; currency: string };
  
  view() {
    return <div>Language: {this.config.language}</div>;
  }
}
```

## ✅ Hacer

Usar para comunicación padre-hijo. Mismo nombre en padre e hijo. Usar mapper para transformar.

## ❌ No hacer

Crear dependencias circulares. Abusar de contextos.
