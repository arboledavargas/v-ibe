# v-ibe

Modern framework for single page applications.

> **Alpha** — Core is stable but the API may change before 1.0. Not recommended for production yet.

---

**v-ibe** is an opinionated front-end framework for building SPAs using persistent class-based components, signals, and direct DOM updates. No virtual DOM, no hooks, no re-renders.

## Hello World

```typescript
@Component()
export class HelloWorld extends BaseComponent {
  @State name = 'World';

  view() {
    return (
      <h1 onClick={() => this.name = 'Signals'}>
        Hello {this.name}
      </h1>
    );
  }
}
```

## Installation

```bash
npm install @v-ibe/core
```

## Documentation

[https://v-ibe.com](https://v-ibe.com)

## License

MIT
