# @Computed

[← Volver al índice](../README.md)

```typescript
@Component()
export class Counter extends BaseComponent {
  @State count = 10;
  
  @Computed get doubled() {
    return this.count * 2;
  }
  
  view() {
    return <div>{this.doubled}</div>;
  }
}
```

Valor derivado reactivo. Se recalcula cuando cambian sus dependencias.

## Cuándo usar

Transformaciones de datos. Cálculos basados en @State. Propiedades derivadas.

## API

### `@Computed`

Aplica a getters de clase. Recalcula cuando cambian @State leídos.

```typescript
@Component()
export class Calculator extends BaseComponent {
  @State a = 5;
  @State b = 10;
  
  @Computed get sum() {
    return this.a + this.b;
  }
  
  @Computed get product() {
    return this.a * this.b;
  }
  
  view() {
    return (
      <div>
        <p>Sum: {this.sum}</p>
        <p>Product: {this.product}</p>
      </div>
    );
  }
}
```

## Ejemplos

### Cálculos simples

```typescript
@Component()
export class Price extends BaseComponent {
  @State base = 100;
  @State tax = 0.16;
  
  @Computed get total() {
    return this.base * (1 + this.tax);
  }
  
  view() {
    return (
      <div>
        <p>Base: {this.base}</p>
        <p>Total: {this.total}</p>
      </div>
    );
  }
}
```

### Transformaciones de objetos

```typescript
@Component()
export class User extends BaseComponent {
  @State user = { firstName: 'John', lastName: 'Doe' };
  
  @Computed get fullName() {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
  
  view() {
    return <div>{this.fullName}</div>;
  }
}
```

### Filtrado de arrays

```typescript
@Component()
export class TodoList extends BaseComponent {
  @State todos = [
    { id: 1, done: false },
    { id: 2, done: true }
  ];
  
  @Computed get activeTodos() {
    return this.todos.filter(t => !t.done);
  }
  
  view() {
    return (
      <div>
        <p>Active: {this.activeTodos.length}</p>
        <ul>
          {this.activeTodos.map(todo => (
            <li key={todo.id}>{todo.id}</li>
          ))}
        </ul>
      </div>
    );
  }
}
```

## ✅ Hacer

Solo leer @State. Retornar valores puros. Transformaciones simples.

## ❌ No hacer

Modificar @State. Hacer side effects. Usar async. Crear loops.
