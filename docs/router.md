# Router

[← Volver al índice](../README.md)

El sistema de routing de Signals Framework proporciona navegación declarativa basada en decoradores, con soporte para rutas anidadas, parámetros dinámicos, políticas de acceso y renderizado multi-slot.

## @Route

```typescript
@Route('/articles')
@Component()
export class Articles extends BaseComponent {
  view() {
    return <div>Articles Page</div>;
  }
}
```

Decorador que asocia un componente con una ruta específica.

### Cuándo usar

Definir rutas de navegación. Asociar componentes a URLs. Configurar acceso y metadata.

### API

#### Decorador `@Route(path, config?)`

Aplica a clases de componentes. Define la ruta y configuración.

**Parámetros:**
- `path: string` - Ruta de la URL (ej: `/articles`, `/store/:id`)
- `config?: RouteConfig` - Configuración opcional

```typescript
@Route('/articles')
@Component()
export class Articles extends BaseComponent {
  view() {
    return <div>Articles</div>;
  }
}
```

### Rutas simples

```typescript
@Route('/')
@Component()
export class Home extends BaseComponent {
  view() {
    return <h1>Home Page</h1>;
  }
}

@Route('/about')
@Component()
export class About extends BaseComponent {
  view() {
    return <h1>About Page</h1>;
  }
}

@Route('/contact')
@Component()
export class Contact extends BaseComponent {
  view() {
    return <h1>Contact Page</h1>;
  }
}
```

### Rutas con parámetros

```typescript
@Route('/articles/:id')
@Component()
export class ArticleDetail extends BaseComponent {
  @Inject(Router)
  router!: Router;
  
  @Computed
  get articleId() {
    return this.router.$params['id'];
  }
  
  view() {
    return <h1>Article #{this.articleId}</h1>;
  }
}

@Route('/store/:storeId/products/:productId')
@Component()
export class ProductDetail extends BaseComponent {
  @Inject(Router)
  router!: Router;
  
  @Computed
  get storeId() {
    return this.router.$params['storeId'];
  }
  
  @Computed
  get productId() {
    return this.router.$params['productId'];
  }
  
  view() {
    return (
      <div>
        <p>Store: {this.storeId}</p>
        <p>Product: {this.productId}</p>
      </div>
    );
  }
}
```

### Rutas anidadas

Las rutas se definen por su path completo, no por segmentos. El sistema detecta automáticamente la jerarquía.

```typescript
@Route('/dashboard')
@Component()
export class Dashboard extends BaseComponent {
  view() {
    return (
      <div>
        <h1>Dashboard</h1>
        <RouteView />
      </div>
    );
  }
}

@Route('/dashboard/settings')
@Component()
export class DashboardSettings extends BaseComponent {
  view() {
    return <h2>Settings</h2>;
  }
}

@Route('/dashboard/analytics')
@Component()
export class DashboardAnalytics extends BaseComponent {
  view() {
    return <h2>Analytics</h2>;
  }
}
```

Cuando navegas a `/dashboard/settings`, se renderizan tanto `Dashboard` (nivel 1) como `DashboardSettings` (nivel 2).

### Configuración de rutas

#### Metadata

```typescript
@Route('/admin', {
  metadata: { 
    requiresAuth: true,
    role: 'admin'
  }
})
@Component()
export class AdminPanel extends BaseComponent {
  view() {
    return <h1>Admin Panel</h1>;
  }
}
```

Metadata arbitraria accesible desde políticas mediante `@RouteMetadata`.

#### Policies

```typescript
@Route('/articles', {
  policies: [AuthPolicy]
})
@Component()
export class Articles extends BaseComponent {
  view() {
    return <h1>Articles</h1>;
  }
}

@Route('/articles/:id', {
  policies: [AuthPolicy, NumericIdPolicy]
})
@Component()
export class ArticleDetail extends BaseComponent {
  view() {
    return <h1>Article Detail</h1>;
  }
}
```

Array de clases de políticas (decoradas con `@Service`) que se evalúan en orden antes de cargar el componente.

#### Slots

```typescript
@Route('/dashboard')
@Component()
export class Dashboard extends BaseComponent {
  view() {
    return (
      <div>
        <aside>
          <RouteView routeSlot="@sidebar" />
        </aside>
        <main>
          <RouteView routeSlot="@main" />
        </main>
      </div>
    );
  }
}

@Route('/dashboard', {
  slot: '@sidebar'
})
@Component()
export class DashboardSidebar extends BaseComponent {
  view() {
    return <nav>Sidebar Navigation</nav>;
  }
}

@Route('/dashboard', {
  slot: '@main'
})
@Component()
export class DashboardMain extends BaseComponent {
  view() {
    return <div>Main Content</div>;
  }
}
```

Permite renderizar múltiples componentes en paralelo para la misma ruta.

### Ejemplos completos

#### Blog con rutas anidadas

```typescript
@Route('/blog')
@Component()
export class Blog extends BaseComponent {
  view() {
    return (
      <div>
        <h1>Blog</h1>
        <nav>
          <a link href="/blog">All Posts</a>
          <a link href="/blog/featured">Featured</a>
        </nav>
        <RouteView />
      </div>
    );
  }
}

@Route('/blog/featured')
@Component()
export class BlogFeatured extends BaseComponent {
  view() {
    return <h2>Featured Posts</h2>;
  }
}

@Route('/blog/:slug')
@Component()
export class BlogPost extends BaseComponent {
  @Inject(Router)
  router!: Router;
  
  @Computed
  get slug() {
    return this.router.$params['slug'];
  }
  
  view() {
    return <article>Post: {this.slug}</article>;
  }
}
```

#### E-commerce con políticas

```typescript
@Route('/products')
@Component()
export class Products extends BaseComponent {
  view() {
    return <h1>Products</h1>;
  }
}

@Route('/products/:id')
@Component()
export class ProductDetail extends BaseComponent {
  @Inject(Router)
  router!: Router;
  
  @Computed
  get productId() {
    return this.router.$params['id'];
  }
  
  view() {
    return <h1>Product {this.productId}</h1>;
  }
}

@Route('/checkout', {
  policies: [AuthPolicy, HasItemsInCartPolicy]
})
@Component()
export class Checkout extends BaseComponent {
  view() {
    return <h1>Checkout</h1>;
  }
}

@Route('/admin', {
  metadata: { role: 'admin' },
  policies: [AuthPolicy, AdminRolePolicy]
})
@Component()
export class Admin extends BaseComponent {
  view() {
    return <h1>Admin Dashboard</h1>;
  }
}
```

#### Dashboard multi-slot

```typescript
@Route('/app')
@Component()
export class AppLayout extends BaseComponent {
  view() {
    return (
      <div class="layout">
        <header>
          <RouteView routeSlot="@header" />
        </header>
        <aside>
          <RouteView routeSlot="@sidebar" />
        </aside>
        <main>
          <RouteView />
        </main>
      </div>
    );
  }
}

@Route('/app', {
  slot: '@header'
})
@Component()
export class AppHeader extends BaseComponent {
  view() {
    return <h1>App Header</h1>;
  }
}

@Route('/app', {
  slot: '@sidebar'
})
@Component()
export class AppSidebar extends BaseComponent {
  view() {
    return <nav>Navigation</nav>;
  }
}

@Route('/app')
@Component()
export class AppHome extends BaseComponent {
  view() {
    return <div>Main Content</div>;
  }
}

@Route('/app/settings', {
  slot: '@sidebar'
})
@Component()
export class SettingsSidebar extends BaseComponent {
  view() {
    return <nav>Settings Nav</nav>;
  }
}

@Route('/app/settings')
@Component()
export class Settings extends BaseComponent {
  view() {
    return <div>Settings Content</div>;
  }
}
```

Cuando navegas a `/app/settings`:
- `@header` muestra `AppHeader`
- `@sidebar` muestra `SettingsSidebar`
- Slot por defecto muestra `Settings`

### Notas

- Las rutas se registran automáticamente en build time
- El sistema detecta jerarquías basándose en los paths
- Múltiples componentes pueden compartir la misma ruta usando slots
- Los parámetros se acceden desde `router.$params`
- Las políticas se evalúan en el orden especificado

---

## @Param

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

### Cuándo usar

Acceder a parámetros de ruta específicos. Sintaxis declarativa. Reactividad automática.

### API

#### Decorador `@Param(paramName)`

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

### Ejemplos

#### Parámetro simple

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

#### Múltiples parámetros

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

#### Con @Computed

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

#### Con @Resource

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

#### Con @Effect

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

### Notas

- Los parámetros son siempre strings
- Son reactivos: los @Computed y @Effect reaccionan a sus cambios
- Si el parámetro no existe, el valor será `null`
- Para conversiones de tipo, usa @Computed

---

## @Params

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

### Cuándo usar

Acceder a múltiples parámetros. Pasar parámetros completos a otros componentes.

### API

#### Decorador `@Params`

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

### Ejemplos

#### Acceso dinámico

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

#### Con @Computed

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

#### Pasando a componentes hijos

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

### Notas

- Objeto reactivo con todos los parámetros de la ruta
- Útil cuando el número de parámetros es variable o desconocido
- Para parámetros específicos, considera usar `@Param` individual
