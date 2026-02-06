# Dependency Injection

[← Volver al índice](../README.md)

```typescript
@Service
export class AuthService {
  @Inject(HttpClient) http!: HttpClient;
  
  async login(credentials: Credentials) {
    return this.http.post('/auth/login', credentials);
  }
}

// En main.ts
await bootstrap();
```

Sistema de inyección de dependencias. Singleton automático. Orden topológico.

## Cuándo usar

Servicios compartidos. Lógica de negocio. Comunicación entre componentes.

## Decorador @Service

Marca una clase como servicio. Singleton automático. Inyectable.

```typescript
@Service
export class UserService {
  getUsers() {
    return ['John', 'Jane'];
  }
}
```

### Ejemplo básico

```typescript
@Service
export class ApiService {
  async fetchData() {
    const response = await fetch('/api/data');
    return response.json();
  }
}
```

### Servicio con dependencias

```typescript
@Service
export class AuthService {
  @Inject(ApiService) api!: ApiService;
  
  async login(email: string, password: string) {
    return this.api.fetchData();
  }
}
```

## Decorador @Inject

Inyecta dependencia en servicio o componente. Lazy access. Cached.

```typescript
@Service
export class OrderService {
  @Inject(AuthService) auth!: AuthService;
  @Inject(ApiService) api!: ApiService;
  
  async createOrder() {
    const user = this.auth.currentUser;
    return this.api.post('/orders', { userId: user.id });
  }
}
```

### En componentes

```typescript
@Component()
export class UserProfile extends BaseComponent {
  @Inject(UserService) userService!: UserService;
  
  view() {
    return (
      <>
        <div>{this.userService.getUsers().join(', ')}</div>
      </>
    );
  }
}
```

### Múltiples dependencias

```typescript
@Component()
export class Dashboard extends BaseComponent {
  @Inject(AuthService) auth!: AuthService;
  @Inject(UserService) users!: UserService;
  @Inject(OrderService) orders!: OrderService;
  
  view() {
    return (
      <>
        <div>User: {this.auth.currentUser?.name}</div>
        <div>Orders: {this.orders.count}</div>
      </>
    );
  }
}
```

## Función bootstrap()

Inicializa todos los servicios. Orden topológico. Una vez al inicio.

```typescript
import { bootstrap } from 'signalsframework';

async function main() {
  await bootstrap();
  // Ahora todos los servicios están listos
}
```

### Uso típico

```typescript
// main.ts
import { bootstrap } from 'signalsframework';

await bootstrap();

// Renderizar app
document.body.innerHTML = '<my-app></my-app>';
```

## Interfaz LifeCycle

Servicios con inicialización asíncrona. Hook onBootstrap.

```typescript
@Service
export class Router implements LifeCycle {
  @Inject(Trie) routeTrie!: Trie;
  
  async onBootstrap() {
    await this.loadRoutes();
    console.log('Router initialized');
  }
}
```

### Ejemplo completo

```typescript
@Service
export class DatabaseService implements LifeCycle {
  private connection?: DatabaseConnection;
  
  async onBootstrap() {
    this.connection = await connectToDatabase();
    await this.migrate();
  }
  
  query(sql: string) {
    return this.connection?.execute(sql);
  }
}
```

## Orden de dependencias

Bootstrap resuelve dependencias automáticamente. Orden topológico.

```typescript
@Service
export class ConfigService {
  getApiUrl() {
    return 'https://api.example.com';
  }
}

@Service
export class HttpClient {
  @Inject(ConfigService) config!: ConfigService;
  
  get(url: string) {
    return fetch(this.config.getApiUrl() + url);
  }
}

@Service
export class UserService {
  @Inject(HttpClient) http!: HttpClient;
  // HttpClient se inicializa antes que UserService
}
```

## Ejemplos

### Servicio de autenticación

```typescript
@Service
export class AuthService {
  @Inject(ApiService) api!: ApiService;
  
  private currentUser: User | null = null;
  
  async login(email: string, password: string) {
    const user = await this.api.post('/auth/login', { email, password });
    this.currentUser = user;
    return user;
  }
  
  getCurrentUser() {
    return this.currentUser;
  }
}
```

### Servicio con estado

```typescript
@Service
export class CartService {
  @State items: CartItem[] = [];
  
  addItem(item: CartItem) {
    this.items.push(item);
  }
  
  getTotal() {
    return this.items.reduce((sum, item) => sum + item.price, 0);
  }
}
```

### Componente usando servicios

```typescript
@Component()
export class ShoppingCart extends BaseComponent {
  @Inject(CartService) cart!: CartService;
  
  view() {
    return (
      <>
        <h2>Cart</h2>
        <ul>
          {this.cart.items.map(item => (
            <li key={item.id}>{item.name} - ${item.price}</li>
          ))}
        </ul>
        <p>Total: ${this.cart.getTotal()}</p>
      </>
    );
  }
}
```

### Servicio con lifecycle

```typescript
@Service
export class CacheService implements LifeCycle {
  private cache = new Map();
  
  async onBootstrap() {
    // Cargar cache desde localStorage
    const stored = localStorage.getItem('cache');
    if (stored) {
      this.cache = new Map(JSON.parse(stored));
    }
  }
  
  get(key: string) {
    return this.cache.get(key);
  }
  
  set(key: string, value: any) {
    this.cache.set(key, value);
    localStorage.setItem('cache', JSON.stringify([...this.cache]));
  }
}
```

## ✅ Hacer

Llamar bootstrap() una vez al inicio. Usar @Service para servicios. Usar @Inject para dependencias.

## ❌ No hacer

Llamar bootstrap() múltiples veces. Crear servicios manualmente. Crear dependencias circulares.
