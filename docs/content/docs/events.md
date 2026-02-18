---
title: "Events"
weight: 4
---

Components communicate through Custom Events — the browser's native event system. v-ibe provides two decorators: `@Emit` to dispatch events and `@On` to listen.

## Emitting events

`@Emit` turns a method's return value into a Custom Event dispatched from the component:

```typescript
@Component()
class ConfirmButton extends BaseComponent {
  @Emit()
  onConfirm() {
    return { confirmed: true };
  }

  view() {
    return <button onClick={() => this.onConfirm()}>Confirm</button>;
  }
}
```

The event name is inferred from the method: `onConfirm` → `confirm`. The return value becomes `event.detail`.

## Listening to events

Parents listen through JSX props:

```typescript
<ConfirmButton onConfirm={(e) => console.log(e.detail)} />
```

Services listen with `@On`:

```typescript
@Service
class NotificationService {
  @On('confirm')
  handleConfirm(data: { confirmed: boolean }) {
    // reacts to any 'confirm' event in the app
  }
}
```

## Event configuration

```typescript
@Emit({
  eventName: 'custom-name',  // override inferred name
  bubbles: true,              // default: true
  cancelable: true,           // default: true
})
```

## Name inference

The event name is derived from the method name:

| Method | Event name |
|---|---|
| `onUserSelect` | `userselect` |
| `onClose` | `close` |
| `onClick` | `click` |
| `submitForm` | `submitform` |
