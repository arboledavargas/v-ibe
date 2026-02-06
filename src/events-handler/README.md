# Event System with Dependency Injection

This event system provides a powerful way to implement event-driven architecture using TypeScript decorators and a native EventTarget-based event emitter.

## Features

- ✅ **Decorator-based event handling** with `@on` (supports both sync and async)
- ✅ **Dependency injection** integration with `@Service` and `@UseService`
- ✅ **Type-safe events** with TypeScript interfaces
- ✅ **Native EventTarget** for optimal performance
- ✅ **Automatic event handler registration**
- ✅ **Async event handler support**
- ✅ **Event factory patterns**

## Quick Start

### 1. Define Your Event Data (Simple!)

```typescript
// No need to extend any base class - just define your data structure!
export interface UserAddedEvent {
  userId: string;
  username: string;
  email: string;
}
```

### 2. Create Event Handlers

```typescript
import { Service, on } from './DI';

@Service
export class NotificationService {
  @on('userAdded')
  onUserAdded = (event: UserAddedEvent): void => {
    console.log('New user registered:', event.username);
    // Send welcome email, create user profile, etc.
  }

  @on('userDeleted')
  onUserDeleted = async (event: UserDeletedEvent): Promise<void> => {
    // Async handler for cleanup operations
    await this.cleanupUserData(event.userId);
  }
}
```

### 3. Emit Events

```typescript
import { Service, UseService, EventEmitter } from './DI';

@Service
export class UserService {
  @UseService(EventEmitter)
  eventEmitter!: EventEmitter;

  addUser(userId: string, username: string, email: string): void {
    // Business logic for adding user
    this.saveUserToDatabase(userId, username, email);
    
    // Emit event - just pass your data directly!
    const eventData: UserAddedEvent = { userId, username, email };
    this.eventEmitter.emit('userAdded', eventData);
  }
}
```

### 4. Bootstrap and Use

```typescript
import { services } from './DI';

async function main() {
  // Bootstrap DI container
  await services.bootstrap();
  
  // Get service and use it
  const userService = services.get(UserService);
  userService.addUser('123', 'john_doe', 'john@example.com');
  
  // Events are automatically handled by decorated methods
}
```

## API Reference

### Decorators

#### `@Service`
Registers a class as a service in the DI container.

```typescript
@Service
export class MyService {
  // Service implementation
}
```

#### `@UseService(ServiceClass)`
Injects a service dependency into a class field.

```typescript
@Service
export class MyService {
  @UseService(EventEmitter)
  eventEmitter!: EventEmitter;
}
```

#### `@on(eventType: string)`
Registers a field as an event handler for the specified event type. Supports both synchronous and asynchronous handlers.

```typescript
@Service
export class MyService {
  // Synchronous handler
  @on('myEvent')
  handleMyEvent = (event: MyEvent): void => {
    // Handle event
  }
  
  // Asynchronous handler
  @on('myAsyncEvent')
  handleMyAsyncEvent = async (event: MyEvent): Promise<void> => {
    // Handle event asynchronously
    await this.processAsync(event);
  }
}
```

### EventEmitter

#### `emit<T = any>(eventType: string, eventData: T): void`
Emits an event to all registered listeners. `eventData` can be any object.

#### `on<T = any>(eventType: string, handler: EventHandler<T>): void`
Manually adds an event listener (alternative to `@on` decorator).

#### `off<T = any>(eventType: string, handler: EventHandler<T>): void`
Removes an event listener.

#### `refreshHandlers(): void`
Re-scans for new `@on` decorated methods (useful when services are registered dynamically).

### Event Types

No special base interfaces required! Just define your event data structures as plain TypeScript interfaces:

```typescript
export interface UserAddedEvent {
  userId: string;
  username: string;
  email: string;
}
```

## Best Practices

### 1. Event Naming Convention
Use descriptive, past-tense event names:
- ✅ `userAdded`, `orderCreated`, `paymentProcessed`
- ❌ `addUser`, `createOrder`, `processPayment`

### 2. Event Data Structure
Keep event data focused and immutable:

```typescript
export interface OrderCreatedEvent {
  readonly orderId: string;
  readonly userId: string;
  readonly total: number;
  readonly items: ReadonlyArray<OrderItem>;
}
```

### 3. Use Event Factories (Optional)
Create factory functions for consistent event creation:

```typescript
export class EventFactory {
  static createUserAddedEvent(userId: string, username: string, email: string): UserAddedEvent {
    return { userId, username, email };
  }
}

// Or just create the objects directly:
const eventData: UserAddedEvent = { userId, username, email };
this.eventEmitter.emit('userAdded', eventData);
```

### 4. Error Handling
Event handlers should handle their own errors:

```typescript
@Service
export class MyService {
  @on('myEvent')
  handleMyEvent = async (event: MyEvent): Promise<void> => {
    try {
      await this.processEvent(event);
    } catch (error) {
      console.error('Error handling myEvent:', error);
      // Log, report, or handle error appropriately
    }
  }
}
```

### 5. Testing
Mock the EventEmitter for unit tests:

```typescript
const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

// Inject mock in tests
```

## Advanced Usage

### Multiple Event Handlers
Multiple services can handle the same event:

```typescript
@Service
export class EmailService {
  @on('userAdded')
  sendWelcomeEmail = (event: UserAddedEvent): void => {
    // Send email
  }
}

@Service
export class AnalyticsService {
  @on('userAdded')
  trackUserRegistration = (event: UserAddedEvent): void => {
    // Track analytics
  }
}
```

### Event Chaining
Events can trigger other events:

```typescript
@Service
export class OrderService {
  @UseService(EventEmitter)
  eventEmitter!: EventEmitter;

  @on('orderCreated')
  processOrder = (event: OrderCreatedEvent): void => {
    // Process the order
    
    // Emit follow-up event
    this.eventEmitter.emit('orderProcessed', {
      orderId: event.orderId
    });
  }
}
```

## Examples

See the following files for complete examples:
- `example-events.ts` - Event type definitions
- `example-services.ts` - Service implementations with event handlers
- `usage-example.ts` - Complete usage demonstration

Run the example:
```bash
# If using Deno
deno run --allow-all src/pipelines/DI/usage-example.ts

# If using Node.js with ts-node
npx ts-node src/pipelines/DI/usage-example.ts
```
