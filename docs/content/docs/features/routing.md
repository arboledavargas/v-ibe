---
title: "Routing"
weight: 1
---

Signals Framework includes a declarative router with lazy loading, parameter extraction, and policy-based guards.

## Defining routes

Use the `@Route` decorator on a component:

```typescript
@Route('/')
@Component()
class HomePage extends BaseComponent {
  view() {
    return <h1>Home</h1>;
  }
}

@Route('/about')
@Component()
class AboutPage extends BaseComponent {
  view() {
    return <h1>About</h1>;
  }
}
```

## Route parameters

Dynamic segments are defined with `:param` syntax:

```typescript
@Route('/users/:id')
@Component()
class UserPage extends BaseComponent {
  @Param('id') userId!: string;

  view() {
    return <h1>User {this.userId}</h1>;
  }
}
```

You can also access query parameters:

```typescript
@Route('/search')
@Component()
class SearchPage extends BaseComponent {
  @Query('q') searchQuery!: string;

  view() {
    return <p>Searching for: {this.searchQuery}</p>;
  }
}
```

## Route View

The `<RouteView />` component renders the matched route. Nest them for layout patterns:

```typescript
@Route('/')
@Component({ services: [...core] })
class App extends BaseComponent {
  view() {
    return (
      <div>
        <nav>
          <a link href="/">Home</a>
          <a link href="/about">About</a>
        </nav>
        <RouteView />
      </div>
    );
  }
}
```

## Navigation

The `link` behavior enables SPA navigation on anchor tags:

```typescript
<a link href="/users/123">View User</a>
<a link href="/settings" activeClass="active">Settings</a>
```

## Policy guards

Control access to routes with policies:

```typescript
@Service
class AuthPolicy {
  @Inject(AuthService) auth!: AuthService;

  @Allow()
  isAuthenticated() {
    return this.auth.isLoggedIn;
  }

  @Redirect()
  toLogin() {
    return !this.auth.isLoggedIn ? '/login' : undefined;
  }
}

@Route('/dashboard', { policies: [AuthPolicy] })
@Component()
class Dashboard extends BaseComponent {
  // Only accessible if AuthPolicy allows it
}
```
