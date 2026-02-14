---
title: "Installation"
weight: 1
---

## Prerequisites

- Node.js 18+
- TypeScript 5.0+
- Vite 7+

## Create a new project

```bash
npm create vite@latest my-app -- --template vanilla-ts
cd my-app
npm install signalsframework
```

## Configure TypeScript

Update your `tsconfig.json` to enable decorators and JSX:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "signalsframework/jsx",
    "experimentalDecorators": false,
    "useDefineForClassFields": true,
    "strict": true
  }
}
```

> Note: Signals Framework uses Stage 3 decorators, not legacy TypeScript decorators. Make sure `experimentalDecorators` is `false` or absent.

## Configure Vite

```typescript
import { defineConfig } from 'vite';
import { jsxSignalsPlugin } from 'signalsframework/vite-plugins';

export default defineConfig({
  plugins: [
    jsxSignalsPlugin()
  ]
});
```

## Verify

Create a minimal component to verify everything works:

```typescript
import { Component, BaseComponent, State } from 'signalsframework';

@Component()
class HelloWorld extends BaseComponent {
  @State name = 'World';

  view() {
    return <h1>Hello {this.name}!</h1>;
  }
}
```

If this compiles and renders without errors, you're ready to go.
