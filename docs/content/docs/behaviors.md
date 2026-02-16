---
title: "Behaviors"
weight: 8
---

Behaviors let you attach reusable functionality to any element through props — no wrapper components, no HOCs, no mixins.

## What you can do

Add a tooltip to any element:

```html
<button tooltip tooltipText="Save changes">Save</button>
```

Make any element draggable:

```html
<div draggable onDragEnd={(pos) => console.log(pos)}>Drag me</div>
```

Validate inputs with a regexp:

```html
<input regexp pattern="^[a-z]+$" onInvalid={() => setError(true)} />
```

Auto-resize a textarea:

```html
<textarea autoResize maxHeight={300} />
```

Lazy-load images:

```html
<img lazyLoad src="/heavy-image.png" placeholder="/blur.png" />
```

These are all behaviors. They activate by prop name and extend elements with new capabilities.

## Creating a behavior

A behavior is a class decorated with `@Behavior`. Here's a tooltip:

```typescript
@Behavior
export class Tooltip {
  @Host el!: HTMLElement;
  @Prop tooltip: boolean = true;
  @Prop tooltipText: string = '';

  private popup!: HTMLElement;

  onInit() {
    this.popup = document.createElement('div');
    this.popup.className = 'tooltip';
    this.popup.textContent = this.tooltipText;

    this.el.addEventListener('mouseenter', () => {
      document.body.appendChild(this.popup);
    });

    this.el.addEventListener('mouseleave', () => {
      this.popup.remove();
    });
  }

  onDestroy() {
    this.popup.remove();
  }
}
```

Now any element with the `tooltip` prop gets tooltip functionality:

```html
<span tooltip tooltipText="More info">Hover me</span>
```

## How activation works

The framework matches prop names against registered behaviors. When you write:

```html
<button tooltip tooltipText="Save">Save</button>
```

The framework sees `tooltip` in the props, finds the `Tooltip` behavior registered with that prop name, and attaches it to the element. All other props belonging to that behavior (`tooltipText`) are passed as configuration.

No boolean "activator" is needed — the presence of the prop name is enough.

## Dependency injection

Behaviors can inject services just like components:

```typescript
@Behavior
export class Link {
  @Host el!: HTMLAnchorElement;
  @Inject(Router) router!: Router;

  @Prop link: boolean = true;
  @Prop href: string = '';

  onInit() {
    this.el.addEventListener('click', (e) => {
      e.preventDefault();
      this.router.navigate(this.href);
    });
  }
}
```

## Lifecycle

| Hook | When |
|---|---|
| `onInit()` | After the behavior is attached and all props are set |
| `onDestroy()` | When the host element is removed from the DOM |
