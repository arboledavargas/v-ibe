# 🚀 Route Generator Plugin - Vite

Plugin de Vite para análisis estático y generación automática de rutas a partir de decoradores `@Route`.

---

## 🎯 ¿Qué Hace?

1. **Escanea** tu proyecto buscando decoradores `@Route`
2. **Genera** un archivo TypeScript con todas las rutas
3. **Actualiza** automáticamente en desarrollo (HMR)
4. **Optimiza** el bundle con tree-shaking

---

## 📦 Instalación

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { routeGeneratorPlugin } from 'v-ibe/vite-plugins';

export default defineConfig({
  plugins: [
    routeGeneratorPlugin({
      srcDir: 'src',
      outputPath: 'src/router/generated-routes.ts',
      verbose: true // Logs detallados en desarrollo
    })
  ]
});
```

---

## ⚙️ Opciones de Configuración

```typescript
interface RouteGeneratorPluginOptions {
  /**
   * Directorio raíz donde buscar @Route
   * @default 'src'
   */
  srcDir?: string;
  
  /**
   * Dónde generar el archivo de rutas
   * @default 'src/router/generated-routes.ts'
   */
  outputPath?: string;
  
  /**
   * Extensiones de archivo a escanear
   * @default ['.ts', '.tsx']
   */
  extensions?: string[];
  
  /**
   * Directorios a excluir
   * @default ['node_modules', 'dist', 'build', '.git']
   */
  exclude?: string[];
  
  /**
   * Logs detallados
   * @default false
   */
  verbose?: boolean;
}
```

---

## 🏗️ Uso Completo

### 1. Define tus Rutas

```typescript
// src/pages/home.ts
import { Route } from 'v-ibe/router';

@Route('/')
export class HomePage {
  render() {
    return <h1>Home</h1>;
  }
}
```

```typescript
// src/pages/products/list.ts
@Route('/products')
export class ProductsPage {}

@Route('/products/:id')
export class ProductDetailPage {}
```

### 2. El Plugin Genera Automáticamente

```typescript
// src/router/generated-routes.ts (AUTO-GENERADO)
/**
 * 🚀 Auto-generated routes file
 * Do not edit manually!
 */

import * as Component0 from '../pages/home';
import * as Component1 from '../pages/products/list';
import * as Component2 from '../pages/products/list';

export const generatedRoutes = [
  {
    path: '/',
    className: 'HomePage',
    loader: () => Component0.HomePage,
    metadata: undefined,
    middleware: undefined,
  },
  {
    path: '/products',
    className: 'ProductsPage',
    loader: () => Component1.ProductsPage,
    metadata: undefined,
    middleware: undefined,
  },
  {
    path: '/products/:id',
    className: 'ProductDetailPage',
    loader: () => Component2.ProductDetailPage,
    metadata: undefined,
    middleware: undefined,
  }
];
```

### 3. Registra las Rutas en tu App

```typescript
// src/main.ts
import { services } from 'v-ibe/di';
import { Router } from 'v-ibe/router';
import { generatedRoutes } from './router/generated-routes';

// Obtener el router
const router = services.get(Router);

// Registrar rutas generadas
router.registerGeneratedRoutes(generatedRoutes);

// Inicializar
router.initialize();
```

---

## 🔄 Hot Module Replacement

El plugin detecta automáticamente cambios en archivos con `@Route`:

```bash
# Agregas una nueva ruta
📝 File changed: products.ts
🔍 Scanning for routes...
✅ Found 8 routes in 4 files
✅ Routes file generated: src/router/generated-routes.ts
🔄 Hot reload triggered
```

---

## 📊 Estructura Generada

El archivo generado incluye:

### 1. Array de Rutas
```typescript
export const generatedRoutes: GeneratedRoute[]
```

### 2. Mapa por Path
```typescript
export const routesByPath: Map<string, GeneratedRoute>
```

### 3. Helpers
```typescript
// Obtener ruta por path
getRouteByPath('/products')

// Buscar por patrón
getRoutesByPattern(/^\/admin/)
```

---

## 🎓 Ejemplos Avanzados

### Con Metadata

```typescript
@Route('/admin/dashboard', {
  metadata: { requiresAuth: true, role: 'admin' }
})
export class AdminDashboard {}
```

Genera:
```typescript
{
  path: '/admin/dashboard',
  metadata: { requiresAuth: true, role: 'admin' },
  ...
}
```

### Con Middleware

```typescript
@Route('/profile', {
  middleware: [AuthMiddleware, LoggingMiddleware]
})
export class ProfilePage {}
```

Genera:
```typescript
{
  path: '/profile',
  middleware: [AuthMiddleware, LoggingMiddleware],
  ...
}
```

---

## 🔧 Integración con Router

```typescript
// src/app.ts
import { Router } from 'v-ibe/router';
import { generatedRoutes } from './router/generated-routes';
import { services } from 'v-ibe/di';

export function setupRouter() {
  const router = services.get(Router);
  
  // Registrar rutas automáticamente encontradas
  router.registerGeneratedRoutes(generatedRoutes);
  
  // Inicializar navegación
  router.initialize();
  
  return router;
}
```

---

## 📁 Estructura de Proyecto Recomendada

```
src/
├── main.ts                      # Entry point
├── router/
│   └── generated-routes.ts     # ← Auto-generado por el plugin
├── pages/
│   ├── home.ts                 # @Route('/')
│   ├── about.ts                # @Route('/about')
│   ├── products/
│   │   ├── list.ts             # @Route('/products')
│   │   └── detail.ts           # @Route('/products/:id')
│   └── admin/
│       ├── dashboard.ts        # @Route('/admin')
│       └── users.ts            # @Route('/admin/users')
└── vite.config.ts              # Plugin configurado aquí
```

---

## ⚡ Performance

- **Build Time**: Escanea una vez al inicio
- **Dev Mode**: Solo re-escanea archivos modificados
- **Tree Shaking**: Vite elimina rutas no utilizadas
- **Code Splitting**: Cada ruta es un chunk separado

---

## 🐛 Troubleshooting

### El archivo no se genera

✅ Verifica que el plugin esté en `vite.config.ts`
✅ Asegúrate que `srcDir` apunte a la carpeta correcta
✅ Revisa los logs con `verbose: true`

### Las rutas no se detectan

✅ Los decoradores deben ser `@Route(...)` exactamente
✅ Las clases deben estar en archivos `.ts` o `.tsx`
✅ Verifica que no estén en carpetas excluidas

### Hot reload no funciona

✅ El archivo debe estar en modo dev (`npm run dev`)
✅ Verifica que el servidor de Vite esté corriendo

---

## ✅ Checklist de Integración

- [ ] Agregar plugin a `vite.config.ts`
- [ ] Definir rutas con decorador `@Route`
- [ ] Importar `generatedRoutes` en tu app
- [ ] Llamar a `router.registerGeneratedRoutes()`
- [ ] Inicializar el router con `router.initialize()`
- [ ] Probar navegación

---

## 🎉 Beneficios

✅ **Cero configuración manual** de rutas  
✅ **Type-safe** rutas con TypeScript  
✅ **Hot reload** instantáneo en desarrollo  
✅ **Tree shaking** automático  
✅ **Code splitting** por ruta  
✅ **Análisis estático** en build time  

---

## 📝 Notas

- El archivo generado está en `.gitignore` (opcional)
- Se regenera en cada build
- Compatible con TypeScript strict mode
- Funciona con decoradores legacy y stage 3

---

*Framework Mocca Admin Signals - Route Generator Plugin v1.0*