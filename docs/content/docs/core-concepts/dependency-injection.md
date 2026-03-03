---
title: "Dependency Injection"
weight: 2
---

v-ibe includes a hierarchical DI system. Services are instantiated eagerly in topological order and resolved through a parent chain of scoped containers.

## Defining a service

```typescript
import { Service, Inject } from '@v-ibe/core';

@Service
class AuthService {
  private token: string | null = null;

  async login(email: string, password: string) {
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    this.token = data.token;
  }

  get isLoggedIn() {
    return this.token !== null;
  }
}
```

## Injecting dependencies

Use `@Inject` to request a service in a component or another service:

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

## Registering services in components

Services are registered at the component level. Each component creates a scoped container that inherits from its parent:

```typescript
@Component({
  services: [AuthService, UserRepository]
})
class App extends BaseComponent {
  @Inject(AuthService) auth!: AuthService;

  view() {
    return <div>Logged in: {this.auth.isLoggedIn}</div>;
  }
}
```

## Lifecycle hooks

Services support lifecycle hooks:

```typescript
@Service
class DatabaseService {
  async onBootstrap() {
    // Called after instantiation and injection
    await this.connect();
  }

  onDestroy() {
    // Called when the owning component is disconnected
    this.disconnect();
  }
}
```

## Hierarchical resolution

When a component requests a service via `@Inject`, the DI system looks up the container chain:

1. Check the component's own scoped container
2. Check the parent component's container
3. Continue up until reaching the root

This means a service registered in `App` is available to every descendant component.
