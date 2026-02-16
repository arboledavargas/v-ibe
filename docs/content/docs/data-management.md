---
title: "Normalized Data Store"
weight: 9
---

The data store gives you a normalized, reactive entity layer — define models with decorators, store them once, and query them reactively across your app.

## Defining models

A model is a class with `@Model`, an `@Id` field, and `@Prop` fields:

```typescript
@Model
class User {
  @Id id!: string;
  @Prop name!: string;
  @Prop email!: string;
}

@Model
class Article {
  @Id id!: string;
  @Prop title!: string;
  @Prop authorId!: string;
}
```

Each `@Prop` field becomes a reactive signal internally. When you update `user.name`, anything reading it re-renders automatically.

## Storing and querying

Use `EntityStore` to store and retrieve entities:

```typescript
@Service
class UserService {
  @Inject(EntityStore) store!: EntityStore;

  addUsers(users: User[]) {
    this.store.set(User, users);
  }

  getActiveUsers() {
    return this.store.get(User, u => u.isActive);
  }

  removeUser(id: string) {
    this.store.delete(User, id);
  }
}
```

Entities are normalized by ID — each entity is stored once regardless of how many places reference it. Updating a user in the store updates it everywhere.

## Consuming APIs

`@Consume` connects your API methods to the store automatically. It converts JSON responses to model instances and stores them:

```typescript
@Service
class UserRepository {
  @Consume(User)
  async findAll() {
    const res = await fetch('/api/users');
    return await res.json();
  }

  @Consume(User)
  async findById(id: string) {
    const res = await fetch(`/api/users/${id}`);
    return await res.json();
  }
}
```

After calling `findAll()`, you get back `User` instances (not JSON) that are already in the store and fully reactive.
