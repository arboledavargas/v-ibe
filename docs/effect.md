# @Effect

[← Volver al índice](../README.md)

```typescript
@Component()
export class Counter extends BaseComponent {
  @State count = 0;
  
  @Effect onCountChange(onCleanup) {
    console.log(this.count);
    onCleanup(() => {
      // Limpiar recursos
    });
  }
  
  view() {
    return (
      <div>
        <p>{this.count}</p>
        <button onClick={() => this.count++}>+</button>
      </div>
    );
  }
}
```

Efecto secundario reactivo. Se ejecuta cuando cambian dependencias.

## Cuándo usar

Logging. Actualizar DOM. Llamadas API. Cleanup de recursos.

## API

### `@Effect`

Aplica a métodos de clase. Se ejecuta cuando cambian @State leídos.

```typescript
@Component()
export class Timer extends BaseComponent {
  @State seconds = 0;
  private intervalId?: number;
  
  @Effect onSecondsChange(onCleanup) {
    this.intervalId = setInterval(() => {
      this.seconds++;
    }, 1000);
    
    onCleanup(() => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
    });
  }
  
  view() {
    return <div>Seconds: {this.seconds}</div>;
  }
}
```

## Ejemplos

### Logging

```typescript
@Component()
export class User extends BaseComponent {
  @State name = '';
  
  @Effect onNameChange() {
    console.log(`Name changed to: ${this.name}`);
  }
  
  view() {
    return (
      <input 
        value={this.name}
        onInput={(e) => this.name = e.target.value}
      />
    );
  }
}
```

### Actualizar DOM externo

```typescript
@Component()
export class Theme extends BaseComponent {
  @State theme = 'light';
  
  @Effect onThemeChange() {
    document.body.className = this.theme;
  }
  
  view() {
    return (
      <button onClick={() => {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
      }}>
        Toggle Theme
      </button>
    );
  }
}
```

### Cleanup de suscripciones

```typescript
@Component()
export class Chat extends BaseComponent {
  @State roomId = '';
  private subscription?: () => void;
  
  @Effect onRoomChange(onCleanup) {
    this.subscription = subscribeToRoom(this.roomId);
    
    onCleanup(() => {
      this.subscription?.();
    });
  }
  
  view() {
    return (
      <div>
        <input 
          value={this.roomId}
          onInput={(e) => this.roomId = e.target.value}
        />
      </div>
    );
  }
}
```

## ✅ Hacer

Leer @State. Registrar cleanup. Hacer side effects. Cancelar operaciones.

## ❌ No hacer

Modificar @State directamente. Crear loops infinitos. Olvidar cleanup.
