---
title: "Routing"
weight: 7
---

The router gives you declarative, policy-driven navigation with lazy-loading, nested routes, and slots — all through decorators.

## Defining routes

Routes are defined with the `@Route` class decorator on page components:

```typescript
@Route('/home')
@Component()
export class HomePage {
  view() {
    return <h1>Welcome</h1>;
  }
}

@Route('/products')
@Component()
export class ProductsPage {
  view() {
    return <h1>Products</h1>;
  }
}
```

Each component is lazy-loaded — the browser only downloads the bundle for the route it needs.

## Navigation

Use `Router.navigate` for programmatic navigation:

```typescript
@Component()
export class Header {
  @Inject(Router) router!: Router;

  goToProducts() {
    this.router.navigate('/products');
  }

  view() {
    return <button onClick={() => this.goToProducts()}>Products</button>;
  }
}
```

Or use the `link` behavior on anchor elements for SPA navigation:

```html
<a link href="/home" activeClass="active">Home</a>
<a link href="/products" activeClass="active">Products</a>
<a link href="/about" activeClass="active font-bold">About</a>
```

The `link` behavior intercepts clicks, navigates via the router, and applies `activeClass` when the current route matches.

## Route parameters

Use `@Param` to extract individual parameters, or `@Params` for all of them:

```typescript
@Route('/users/:id')
@Component()
export class UserProfile {
  @Param('id') userId!: string;

  view() {
    return <h1>User {this.userId}</h1>;
  }
}

@Route('/store/:storeId/product/:productId')
@Component()
export class ProductDetail {
  @Params() params!: Record<string, string>;

  view() {
    return <p>Store {this.params.storeId}, Product {this.params.productId}</p>;
  }
}
```

## Query parameters

Use `@Query` to extract individual query parameters, or `@QueryParams` for all of them:

```typescript
@Route('/search')
@Component()
export class SearchPage {
  @Query('q') searchQuery!: string;
  @Query('page') currentPage!: string;

  view() {
    return <p>Searching: {this.searchQuery}, page {this.currentPage}</p>;
  }
}
```

URL `/search?q=signals&page=2` gives you `searchQuery = "signals"` and `currentPage = "2"`.

## Nested routes

Routes nest naturally. Each `RouteView` renders the component for its nesting level:

```typescript
@Route('/dashboard')
@Component()
export class Dashboard {
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
export class DashboardSettings {
  view() {
    return <h2>Settings</h2>;
  }
}
```

The inner `RouteView` inside Dashboard renders `DashboardSettings` when the URL is `/dashboard/settings`.

## Route policies

Policies control who can access a route. They are service classes with decorated methods:

```typescript
@Service
export class AuthPolicy {
  @Inject(AuthService) auth!: AuthService;
  @Inject(Router) router!: Router;

  @Allow()
  publicRoute() {
    return this.route.meta?.public === true;
  }

  @Redirect()
  redirectToLogin() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate('/login');
      return true;
    }
    return false;
  }
}
```

Attach policies to routes through the config:

```typescript
@Route('/admin', {
  policies: [AuthPolicy, AdminRolePolicy]
})
@Component()
export class AdminPage { }
```

| Decorator | When it returns `true` |
|---|---|
| `@Allow` | Navigation is permitted |
| `@Block` | Navigation is denied |
| `@Redirect` | Navigation is redirected (must call `router.navigate` before returning) |
| `@Skip` | This policy abstains — pass to the next policy |

Policies evaluate in order. The first decisive result wins. If all policies skip, navigation is allowed by default.

## Competing routes

Two components can share the same URL. Policies decide which one renders:

```typescript
@Route('/dashboard', {
  policies: [AdminPolicy]
})
@Component()
export class AdminDashboard { }

@Route('/dashboard', {
  policies: [UserPolicy]
})
@Component()
export class UserDashboard { }
```

An admin sees `AdminDashboard`. A regular user sees `UserDashboard`. Components are lazy-loaded, so a regular user never downloads the admin bundle.

## Route metadata

Attach arbitrary metadata to a route and access it from the component or from policies:

```typescript
@Route('/admin', {
  metadata: { requiresAuth: true, role: 'admin' }
})
@Component()
export class AdminPage {
  @RouteMetadata('role') role!: string;
  @RouteMetadata() allMeta!: Record<string, any>;
}
```

## Slots

Slots let you render multiple components in parallel for the same route:

```typescript
@Route('/dashboard', { slot: '@main' })
@Component()
export class DashboardMain { }

@Route('/dashboard', { slot: '@sidebar' })
@Component()
export class DashboardSidebar { }
```

```typescript
@Component()
export class AppLayout {
  view() {
    return (
      <div class="layout">
        <RouteView routeSlot="@main" />
        <aside>
          <RouteView routeSlot="@sidebar" />
        </aside>
      </div>
    );
  }
}
```

Each `RouteView` independently renders the candidate that matches its slot.
