# @State

[← Volver al índice](../README.md)

```typescript
@Component()
export class Counter extends BaseComponent {
  @State count = 0;
  @State user = { name: '' };
  @State items = [];
  
  view() {
    return <div>{this.count}</div>;
  }
}
```

Decorador que crea estado reactivo en componentes. Sintaxis nativa con reactividad granular.

## Cuándo usar

Estado local en componentes. Propiedades reactivas.

## API

### `@State`

Aplica a campos de clase. Detecta tipo automáticamente y crea reactividad.

```typescript
@Component()
export class MyComponent extends BaseComponent {
  @State count = 0;
  @State user = { name: '' };
  @State items = [];
  
  view() {
    return <div>{this.count}</div>;
  }
}
```

## Reactividad granular

@State detecta el tipo y crea reactividad apropiada. Usa sintaxis nativa de JavaScript.

### Valores primitivos

```typescript
@Component()
export class Counter extends BaseComponent {
  @State count = 0;
  @State name = 'John';
  @State active = true;
  
  view() {
    return (
      <div>
        <p>Count: {this.count}</p>
        <p>Name: {this.name}</p>
        <button onClick={() => this.count++}>Increment</button>
        <button onClick={() => this.name = 'Jane'}>Change Name</button>
      </div>
    );
  }
}
```

### Objetos

```typescript
@Component()
export class UserProfile extends BaseComponent {
  @State user = {
    name: 'Julian',
    age: 30
  };
  
  view() {
    return (
      <div>
        <p>{this.user.name} - {this.user.age}</p>
        <button onClick={() => this.user.name = 'María'}>
          Change Name
        </button>
        <button onClick={() => this.user.age = 25}>
          Change Age
        </button>
      </div>
    );
  }
}
```

### Objetos anidados

```typescript
@Component()
export class App extends BaseComponent {
  @State app = {
    user: {
      name: 'Julian',
      profile: {
        bio: 'Developer'
      }
    }
  };
  
  view() {
    return (
      <div>
        <h1>{this.app.user.name}</h1>
        <p>{this.app.user.profile.bio}</p>
        <button onClick={() => this.app.user.name = 'María'}>
          Change Name
        </button>
        <button onClick={() => this.app.user.profile.bio = 'Designer'}>
          Change Bio
        </button>
      </div>
    );
  }
}
```

### Arrays

```typescript
@Component()
export class TodoList extends BaseComponent {
  @State items = [1, 2, 3];
  
  view() {
    return (
      <div>
        <ul>
          {this.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <button onClick={() => this.items.push(this.items.length + 1)}>
          Add Item
        </button>
        <button onClick={() => this.items.pop()}>
          Remove Last
        </button>
        <button onClick={() => this.items[0] = 10}>
          Change First
        </button>
      </div>
    );
  }
}
```

### Arrays de objetos

```typescript
@Component()
export class UsersList extends BaseComponent {
  @State users = [
    { name: 'Julian', age: 30 },
    { name: 'María', age: 25 }
  ];
  
  view() {
    return (
      <div>
        <ul>
          {this.users.map((user, i) => (
            <li key={i}>
              {user.name} - {user.age}
            </li>
          ))}
        </ul>
        <button onClick={() => this.users[0].name = 'Julián'}>
          Change First Name
        </button>
        <button onClick={() => this.users.push({ name: 'Pedro', age: 35 })}>
          Add User
        </button>
      </div>
    );
  }
}
```

## Ejemplos

### Contador simple

```typescript
@Component()
export class Counter extends BaseComponent {
  @State count = 0;
  
  view() {
    return (
      <div>
        <p>Count: {this.count}</p>
        <button onClick={() => this.count++}>+</button>
        <button onClick={() => this.count--}>-</button>
      </div>
    );
  }
}
```

### Usuario con perfil

```typescript
@Component()
export class UserProfile extends BaseComponent {
  @State user = {
    name: '',
    email: '',
    preferences: {
      theme: 'light',
      notifications: true
    }
  };
  
  view() {
    return (
      <div>
        <input 
          value={this.user.name} 
          onInput={(e) => this.user.name = e.target.value}
        />
        <input 
          value={this.user.email} 
          onInput={(e) => this.user.email = e.target.value}
        />
        <button onClick={() => {
          this.user.preferences.theme = 
            this.user.preferences.theme === 'light' ? 'dark' : 'light';
        }}>
          Toggle Theme
        </button>
      </div>
    );
  }
}
```

### Lista de tareas

```typescript
@Component()
export class TodoList extends BaseComponent {
  @State todos = [
    { id: 1, text: 'Task 1', done: false },
    { id: 2, text: 'Task 2', done: true }
  ];
  
  view() {
    return (
      <div>
        <ul>
          {this.todos.map(todo => (
            <li key={todo.id}>
              <input 
                type="checkbox" 
                checked={todo.done}
                onChange={() => todo.done = !todo.done}
              />
              {todo.text}
            </li>
          ))}
        </ul>
        <button onClick={() => {
          this.todos.push({ 
            id: Date.now(), 
            text: 'New Task', 
            done: false 
          });
        }}>
          Add Todo
        </button>
      </div>
    );
  }
}
```

### Estructuras complejas

```typescript
@Component()
export class App extends BaseComponent {
  @State app = {
    user: {
      name: 'Julian',
      preferences: { theme: 'dark' }
    },
    items: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' }
    ],
    count: 0
  };
  
  view() {
    return (
      <div>
        <h1>{this.app.user.name}</h1>
        <p>Theme: {this.app.user.preferences.theme}</p>
        <p>Count: {this.app.count}</p>
        <ul>
          {this.app.items.map(item => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
        <button onClick={() => this.app.user.name = 'María'}>
          Change Name
        </button>
        <button onClick={() => this.app.items[0].name = 'Updated'}>
          Update Item
        </button>
        <button onClick={() => this.app.count++}>
          Increment
        </button>
      </div>
    );
  }
}
```

### Métodos de array en JSX

```typescript
@Component()
export class ShoppingCart extends BaseComponent {
  @State items = [1, 2, 3];
  
  view() {
    return (
      <div>
        <ul>
          {this.items.map((item, i) => (
            <li key={i}>
              Item {item}
              <button onClick={() => this.items.splice(i, 1)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button onClick={() => this.items.push(this.items.length + 1)}>
          Add Item
        </button>
        <button onClick={() => this.items.length = 0}>
          Clear
        </button>
      </div>
    );
  }
}
```

## Reactividad con @Effect

Los cambios se detectan automáticamente en effects:

```typescript
@Component()
export class UserComponent extends BaseComponent {
  @State user = { name: 'John', age: 30 };
  
  @Effect onUserChange() {
    console.log(`User changed: ${this.user.name}`);
    // Se ejecuta cuando cambia user.name o user.age
  }
  
  view() {
    return (
      <div>
        <input 
          value={this.user.name}
          onInput={(e) => this.user.name = e.target.value}
        />
      </div>
    );
  }
}
```

## Reactividad con @Computed

Los computed reaccionan a cambios granulares:

```typescript
@Component()
export class TodoList extends BaseComponent {
  @State todos = [
    { id: 1, done: false },
    { id: 2, done: true }
  ];
  
  @Computed get activeCount() {
    return this.todos.filter(t => !t.done).length;
    // Se recalcula cuando cambia cualquier todo.done
  }
  
  view() {
    return (
      <div>
        <p>Active: {this.activeCount}</p>
        <ul>
          {this.todos.map(todo => (
            <li key={todo.id}>
              <input 
                type="checkbox"
                checked={todo.done}
                onChange={() => todo.done = !todo.done}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }
}
```

