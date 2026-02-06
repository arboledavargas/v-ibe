# @Resource

[← Volver al índice](../README.md)

```typescript
@Component()
export class UserProfile extends BaseComponent {
  @Resource((signal) => 
    fetch('/api/user', { signal }).then(r => r.json())
  )
  userResource!: IResource<User>;
  
  view() {
    return (
      <>
        {() => this.userResource.state === 'pending' && <div>Loading...</div>}
        {() => this.userResource.state === 'error' && (
          <div>Error: {this.userResource.error?.message}</div>
        )}
        {() => this.userResource.state === 'ready' && (
          <div>{this.userResource.get()?.name}</div>
        )}
      </>
    );
  }
}
```

Recurso asíncrono reactivo. Maneja estados y cancelación automática.

## Cuándo usar

Fetch de datos. Operaciones async que dependen de @State. Carga reactiva.

## API

### `@Resource`

Aplica a campos de clase. Carga datos cuando cambian dependencias.

```typescript
@Component()
export class UserProfile extends BaseComponent {
  @State userId = 1;
  
  @Resource((signal) => 
    fetch(`/api/users/${this.userId}`, { signal })
      .then(r => r.json())
  )
  userResource!: IResource<User>;
  
  view() {
    return (
      <>
        <input 
          type="number"
          value={this.userId}
          onInput={(e) => this.userId = Number(e.target.value)}
        />
        {() => this.userResource.state === 'pending' && (
          <div>Loading user {this.userId}...</div>
        )}
        {() => this.userResource.state === 'error' && (
          <div>Error: {this.userResource.error?.message}</div>
        )}
        {() => this.userResource.state === 'ready' && (
          <div>{this.userResource.get()?.name}</div>
        )}
      </>
    );
  }
}
```

### `get(): T | undefined`

Lee los datos. Retorna undefined si está pending o error.

```typescript
const user = this.userResource.get();
```

### `state: 'pending' | 'ready' | 'error'`

Estado actual del resource. Reactivo.

```typescript
if (this.userResource.state === 'ready') {
  // usar datos
}
```

### `error?: Error`

Error si falló. Undefined si está pending o ready.

```typescript
if (this.userResource.error) {
  console.error(this.userResource.error);
}
```

## Ejemplos

### Carga básica

```typescript
@Component()
export class Posts extends BaseComponent {
  @Resource((signal) => 
    fetch('/api/posts', { signal }).then(r => r.json())
  )
  postsResource!: IResource<Post[]>;
  
  view() {
    return (
      <>
        {() => this.postsResource.state === 'pending' && <div>Loading...</div>}
        {() => this.postsResource.state === 'error' && (
          <div>Error: {this.postsResource.error?.message}</div>
        )}
        {() => this.postsResource.state === 'ready' && (
          <ul>
            {this.postsResource.get()?.map(post => (
              <li key={post.id}>{post.title}</li>
            ))}
          </ul>
        )}
      </>
    );
  }
}
```

### Carga dependiente de @State

```typescript
@Component()
export class UserDetails extends BaseComponent {
  @State userId = 1;
  
  @Resource((signal) => 
    fetch(`/api/users/${this.userId}`, { signal })
      .then(r => r.json())
  )
  userResource!: IResource<User>;
  
  view() {
    return (
      <>
        <input 
          type="number"
          value={this.userId}
          onInput={(e) => this.userId = Number(e.target.value)}
        />
        {() => this.userResource.state === 'pending' && <div>Loading...</div>}
        {() => this.userResource.state === 'ready' && (
          <div>{this.userResource.get()?.name}</div>
        )}
        {() => this.userResource.state === 'error' && (
          <div>Error: {this.userResource.error?.message}</div>
        )}
      </>
    );
  }
}
```

## ✅ Hacer

Usar AbortSignal para cancelación. Manejar errores. Verificar estados.

## ❌ No hacer

Ignorar el signal. Olvidar manejar estados. No cancelar operaciones.
