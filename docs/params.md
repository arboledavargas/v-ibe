# @Params

[← Volver al índice](../README.md)

```typescript
@Route('/store/:storeId/products/:productId')
@Component()
export class StoreProduct extends BaseComponent {
  @Params
  params!: Record<string, string>;
  
  view() {
    return (
      <div>
        <p>Store: {this.params.storeId}</p>
        <p>Product: {this.params.productId}</p>
      </div>
    );
  }
}
```

Decorador que inyecta todos los parámetros de ruta como un objeto reactivo.

## Cuándo usar

Acceder a múltiples parámetros. Pasar parámetros completos a otros componentes.

## API

### Decorador `@Params`

Aplica a campos de clase. Inyecta objeto con todos los parámetros.

```typescript
@Route('/users/:userId/posts/:postId')
@Component()
export class UserPost extends BaseComponent {
  @Params
  params!: Record<string, string>;
  
  view() {
    return (
      <div>
        <p>User: {this.params.userId}</p>
        <p>Post: {this.params.postId}</p>
      </div>
    );
  }
}
```

## Ejemplos

### Acceso dinámico

```typescript
@Route('/api/:version/:endpoint')
@Component()
export class ApiExplorer extends BaseComponent {
  @Params
  params!: Record<string, string>;
  
  view() {
    return (
      <div>
        <h1>API Explorer</h1>
        <ul>
          {Object.entries(this.params).map(([key, value]) => (
            <li>{key}: {value}</li>
          ))}
        </ul>
      </div>
    );
  }
}
```

### Con @Computed

```typescript
@Route('/compare/:id1/:id2')
@Component()
export class Compare extends BaseComponent {
  @Params
  params!: Record<string, string>;
  
  @Computed
  get ids() {
    return [this.params.id1, this.params.id2].filter(Boolean);
  }
  
  view() {
    return (
      <div>
        <h1>Comparing {this.ids.length} items</h1>
        <ul>
          {this.ids.map(id => <li key={id}>Item {id}</li>)}
        </ul>
      </div>
    );
  }
}
```

### Pasando a componentes hijos

```typescript
@Route('/dashboard/:section/:subsection')
@Component()
export class Dashboard extends BaseComponent {
  @Params
  params!: Record<string, string>;
  
  view() {
    return (
      <div>
        <Breadcrumb params={this.params} />
        <Content params={this.params} />
      </div>
    );
  }
}
```

### Con @Effect

```typescript
@Route('/analytics/:metric/:period')
@Component()
export class Analytics extends BaseComponent {
  @Params
  params!: Record<string, string>;
  
  @State
  data: any = null;
  
  @Effect
  async loadData() {
    console.log('Loading analytics:', this.params);
    const response = await fetch(
      `/api/analytics?metric=${this.params.metric}&period=${this.params.period}`
    );
    this.data = await response.json();
  }
  
  view() {
    return (
      <div>
        <h1>Analytics: {this.params.metric}</h1>
        <p>Period: {this.params.period}</p>
        {this.data && <pre>{JSON.stringify(this.data, null, 2)}</pre>}
      </div>
    );
  }
}
```

### Validación de parámetros

```typescript
@Route('/user/:userId/settings/:tab')
@Component()
export class UserSettings extends BaseComponent {
  @Params
  params!: Record<string, string>;
  
  @Computed
  get validTabs() {
    return ['profile', 'security', 'notifications'];
  }
  
  @Computed
  get currentTab() {
    const tab = this.params.tab;
    return this.validTabs.includes(tab) ? tab : 'profile';
  }
  
  @Computed
  get isValidUser() {
    return /^\d+$/.test(this.params.userId);
  }
  
  view() {
    return (
      <div>
        {this.isValidUser ? (
          <div>
            <h1>Settings for User {this.params.userId}</h1>
            <nav>
              {this.validTabs.map(tab => (
                <a 
                  link 
                  href={`/user/${this.params.userId}/settings/${tab}`}
                  activeClass="active"
                >
                  {tab}
                </a>
              ))}
            </nav>
            <div>Current tab: {this.currentTab}</div>
          </div>
        ) : (
          <p>Invalid user ID</p>
        )}
      </div>
    );
  }
}
```

## Notas

- Objeto reactivo con todos los parámetros de la ruta
- Útil cuando el número de parámetros es variable o desconocido
- Para parámetros específicos, considera usar `@Param` individual
- Los valores son siempre strings
