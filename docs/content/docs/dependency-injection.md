---
title: "Dependency Injection"
weight: 5
---

Components should focus on rendering. Business logic, API calls, and shared state belong in services. `@Service` and `@Inject` wire them together without tight coupling.

## Defining a service

```typescript
@Service
class AuthService {
  @State private token: string | null = null;

  async login(email: string, password: string) {
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.token = (await res.json()).token;
  }

  @Computed
  get isLoggedIn() {
    return this.token !== null;
  }
}
```

## Injecting into components

Register services in `@Component` and use `@Inject` to access them:

```typescript
@Component({
  services: [AuthService]
})
class App extends BaseComponent {
  @Inject(AuthService) auth!: AuthService;

  view() {
    return <div>Logged in: {this.auth.isLoggedIn}</div>;
  }
}
```

Every descendant of `App` can also inject `AuthService` — no need to re-register it.

## Service-to-service dependencies

Services can depend on other services:

```typescript
@Service
class UserRepository {
  @Inject(AuthService) auth!: AuthService;

  async fetchProfile() {
    if (!this.auth.isLoggedIn) throw new Error('Not authenticated');
    // ...
  }
}
```

## Scoping

Services registered in a component are available to that component and all its descendants. This creates natural boundaries:

```typescript
@Component({ services: [AuthService, UserRepository] })
class App extends BaseComponent { ... }
  // AuthService available here and everywhere below

  @Component({ services: [CartService] })
  class ShopPage extends BaseComponent { ... }
    // CartService available here and below
    // AuthService also available (inherited from App)

  @Component()
  class ProfilePage extends BaseComponent { ... }
    // AuthService available (inherited from App)
    // CartService NOT available (different subtree)
```

## Lifecycle hooks

```typescript
@Service
class WebSocketService {
  private socket!: WebSocket;

  async onBootstrap() {
    // runs after instantiation and injection
    this.socket = new WebSocket('wss://api.example.com');
  }

  onDestroy() {
    // runs when the owning component disconnects
    this.socket.close();
  }
}
```
