---
title: "Cache"
weight: 10
---

Network calls are expensive. The cache system lets you build complex cache strategies declaratively — define tags on your methods and the framework handles invalidation, updates, and storage automatically. You never touch the cache manually.

## How it works

Cache entries are connected through **tags**. When you cache a method's result, you tag it with identifiers that describe the data it contains. Other methods can then update or invalidate entries by targeting those tags — and every cache entry that shares those tags is affected automatically.

This means deleting a single product invalidates the entire product list cache — because the list contained that product and no longer reflects reality.

## Basic usage

```typescript
@Service
class ProductRepository {
  @TTL(30000)
  async getProducts() {
    const res = await fetch('/api/products');
    return await res.json();
  }
}
```

The first call fetches from the API. Any call within the next 30 seconds returns the cached result. After 30 seconds, the next call fetches again.

## Cache providers

By default, cache lives in memory. Use `@Cache` to switch to persistent storage:

```typescript
@Cache(LocalStorageCache)
@TTL(3600000)
async getUserPreferences() {
  return await fetch('/api/preferences').then(r => r.json());
}

@Cache(SessionStorageCache)
@TTL(60000)
async getSessionData() {
  return await fetch('/api/session').then(r => r.json());
}
```

| Provider | Persistence |
|---|---|
| `MemoryCache` | Lost on page refresh (default) |
| `LocalStorageCache` | Persists across sessions |
| `SessionStorageCache` | Persists until tab closes |

## Cache tags

Tags identify cache entries so they can be updated or invalidated by other methods — without knowing their exact keys:

```typescript
@Cache(LocalStorageCache)
@TTL(60000)
@CacheTags((result) => result.map((p: any) => `product:${p.id}`))
async getProducts() {
  return await fetch('/api/products').then(r => r.json());
}
```

## Updating and invalidating

`@CacheUpdate` replaces cached values that match certain tags. `@CacheInvalidate` removes them:

```typescript
@CacheUpdate(
  LocalStorageCache,
  (result) => [`product:${result.id}`]
)
async updateProduct(id: string, data: any) {
  const res = await fetch(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return await res.json();
}

@CacheInvalidate(
  LocalStorageCache,
  (_, args) => [`product:${args[0]}`]
)
async deleteProduct(id: string) {
  await fetch(`/api/products/${id}`, { method: 'DELETE' });
}
```

Tags connect entries across methods. If `getProducts()` caches its result with tags `["product:1", "product:2", "product:3"]`, and `deleteProduct("2")` invalidates the tag `"product:2"`, the entire `getProducts()` cache entry is removed — because it contained that tag. The next call to `getProducts()` fetches fresh data from the API.
