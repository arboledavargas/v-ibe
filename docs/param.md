# @Param

[← Volver al índice](../README.md)

```typescript
@Route('/articles/:id')
@Component()
export class ArticleDetail extends BaseComponent {
  @Param('id')
  articleId!: string;
  
  view() {
    return <h1>Article {this.articleId}</h1>;
  }
}
```

Decorador que inyecta un parámetro de ruta individual de forma reactiva.

## Cuándo usar

Acceder a parámetros de ruta específicos. Sintaxis declarativa. Reactividad automática.

## API

### Decorador `@Param(paramName)`

Aplica a campos de clase. Inyecta el valor del parámetro reactivamente.

**Parámetros:**
- `paramName: string` - Nombre del parámetro definido en la ruta

```typescript
@Route('/users/:userId')
@Component()
export class UserProfile extends BaseComponent {
  @Param('userId')
  userId!: string;
  
  view() {
    return <div>User ID: {this.userId}</div>;
  }
}
```

## Ejemplos

### Parámetro simple

```typescript
@Route('/products/:id')
@Component()
export class ProductDetail extends BaseComponent {
  @Param('id')
  productId!: string;
  
  view() {
    return (
      <div>
        <h1>Product #{this.productId}</h1>
        <p>Viewing product with ID: {this.productId}</p>
      </div>
    );
  }
}
```

Navegando a `/products/123` → `productId` será `"123"`

### Múltiples parámetros

```typescript
@Route('/store/:storeId/products/:productId')
@Component()
export class StoreProduct extends BaseComponent {
  @Param('storeId')
  storeId!: string;
  
  @Param('productId')
  productId!: string;
  
  view() {
    return (
      <div>
        <h1>Store: {this.storeId}</h1>
        <h2>Product: {this.productId}</h2>
      </div>
    );
  }
}
```

Navegando a `/store/abc/products/456` → `storeId` será `"abc"`, `productId` será `"456"`

### Con @Computed

```typescript
@Route('/articles/:id')
@Component()
export class ArticleDetail extends BaseComponent {
  @Param('id')
  articleId!: string;
  
  @Computed
  get numericId() {
    return parseInt(this.articleId, 10);
  }
  
  @Computed
  get isValidId() {
    return !isNaN(this.numericId);
  }
  
  view() {
    return (
      <div>
        {this.isValidId ? (
          <h1>Article #{this.numericId}</h1>
        ) : (
          <p>Invalid article ID</p>
        )}
      </div>
    );
  }
}
```

### Con @Resource

```typescript
@Route('/users/:userId')
@Component()
export class UserProfile extends BaseComponent {
  @Param('userId')
  userId!: string;
  
  @Resource
  async user() {
    const response = await fetch(`/api/users/${this.userId}`);
    return response.json();
  }
  
  view() {
    return (
      <div>
        {this.user.loading && <p>Loading...</p>}
        {this.user.error && <p>Error: {this.user.error.message}</p>}
        {this.user.data && (
          <div>
            <h1>{this.user.data.name}</h1>
            <p>ID: {this.userId}</p>
          </div>
        )}
      </div>
    );
  }
}
```

El `@Resource` se vuelve a ejecutar automáticamente cuando cambia `userId`.

### Con @Effect

```typescript
@Route('/posts/:slug')
@Component()
export class PostDetail extends BaseComponent {
  @Param('slug')
  slug!: string;
  
  @State
  post: any = null;
  
  @Effect
  async loadPost() {
    console.log(`Loading post: ${this.slug}`);
    const response = await fetch(`/api/posts/${this.slug}`);
    this.post = await response.json();
  }
  
  view() {
    return (
      <div>
        {this.post ? (
          <article>
            <h1>{this.post.title}</h1>
            <p>{this.post.content}</p>
          </article>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    );
  }
}
```

El effect se ejecuta cada vez que cambia `slug`.

## Notas

- Los parámetros son siempre strings
- Son reactivos: los @Computed y @Effect reaccionan a sus cambios
- Si el parámetro no existe, el valor será `null`
- Para conversiones de tipo, usa @Computed
