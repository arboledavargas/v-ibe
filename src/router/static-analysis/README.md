# Análisis Estático de Rutas

## 🎯 Progreso

- ✅ **Checkpoint 1.1**: Parser Básico de Decoradores
- ✅ **Checkpoint 1.2**: Scanner de Directorios
- ⏳ **Checkpoint 1.3**: Generador de Manifest
- ⏳ **Checkpoint 2.0**: Plugin de Vite

---

## Checkpoint 1.1: Parser Básico de Decoradores

### Objetivo

Crear un **parser básico de decoradores** que lea archivos TypeScript y detecte decoradores `@Route`, extrayendo información sobre:
</text>

<old_text line=25>
static-analysis/
├── README.md              # Este archivo
├── parser.ts              # Parser principal usando TypeScript Compiler API
├── test-component.ts      # Archivo de prueba con varios casos de @Route
└── test.ts                # Script para ejecutar el test
```

- Path de la ruta
- Nombre de la clase
- Metadata (si existe)
- Middlewares (si existen)
- Parámetros dinámicos (`:id`, `:userId`, etc.)

Este es el primer paso para transformar el router de un sistema basado en **runtime decorators** a un sistema de **análisis estático** con un plugin de Vite.

---

## 📁 Estructura de Archivos

```
static-analysis/
├── README.md              # Este archivo
├── parser.ts              # Parser principal usando TypeScript Compiler API
├── scanner.ts             # Scanner de directorios recursivo
└── index.ts               # Exports principales
```

---

## 🔍 ¿Qué hace el Parser?

El parser (`parser.ts`) utiliza la **TypeScript Compiler API** para:

1. **Leer archivos TypeScript** de forma programática
2. **Recorrer el AST (Abstract Syntax Tree)** buscando clases decoradas
3. **Identificar decoradores `@Route`** en las clases
4. **Extraer información**:
   - Path de la ruta (ej: `/products/:id`)
   - Configuración (metadata, middleware)
   - Nombre de la clase

### Ejemplo de lo que detecta:

```typescript
@Route('/products/:id', {
  metadata: { requiresAuth: true },
  middleware: [AuthMiddleware]
})
class ProductDetailPage {}
```

**Output del parser:**
```typescript
{
  path: '/products/:id',
  className: 'ProductDetailPage',
  filePath: '...',
  metadata: { requiresAuth: true },
  middleware: ['AuthMiddleware'],
  raw: '@Route(...)'
}
```

---

## 🚀 Uso

El análisis estático se ejecuta automáticamente a través del plugin de Vite durante el build. No es necesario ejecutar scripts manualmente.

---

## ✅ Criterios de Éxito

El Checkpoint 1.1 está completo cuando:

- [x] El script lee correctamente archivos TypeScript
- [x] Detecta todos los decoradores `@Route` en el archivo
- [x] Extrae el path de cada ruta
- [x] Extrae el nombre de la clase decorada
- [x] Identifica middleware (si existe)
- [x] Identifica metadata (si existe)
- [x] No crashea con archivos TypeScript válidos
- [x] Imprime resultados legibles en consola

### Output Esperado:

```
🔍 Starting Route Decorator Parser Test

============================================================

✅ Successfully parsed 7 routes:

📍 Route 1:
   Path: /products
   Class: ProductsPage
   ...

📍 Route 2:
   Path: /products/:id
   Class: ProductDetailPage
   ...

============================================================

✨ Test completed successfully!

Summary:
  - Total routes found: 7
  - Routes with metadata: 2
  - Routes with middleware: 3
  - Dynamic routes (with params): 4
```

---

## 🧪 Casos Soportados

El parser soporta los siguientes casos de uso:

1. ✅ **Ruta simple**: `@Route('/products')`
2. ✅ **Ruta con parámetro**: `@Route('/products/:id')`
3. ✅ **Ruta con metadata**: `@Route('/admin', { metadata: {...} })`
4. ✅ **Ruta con middleware**: `@Route('/dashboard', { middleware: [...] })`
5. ✅ **Ruta con ambos**: metadata + middleware
6. ✅ **Ruta raíz**: `@Route('/')`
7. ✅ **Ruta anidada profunda**: `@Route('/users/:userId/posts/:postId/comments')`

---

## 🔧 API del Parser

### `parseRouteDecorators(filePath: string): ParsedRoute[]`

Parsea un archivo TypeScript y retorna todas las rutas encontradas.

**Parámetros:**
- `filePath`: Ruta absoluta o relativa al archivo TypeScript

**Retorna:**
```typescript
interface ParsedRoute {
  path: string;           // Ej: '/products/:id'
  className: string;      // Ej: 'ProductDetailPage'
  filePath: string;       // Ruta del archivo
  metadata?: Record<string, any>;
  middleware?: string[];  // Nombres de los middlewares
  raw: string;            // Texto completo del decorador
}
```

---

---

## Checkpoint 1.2: Scanner de Directorios ✅

### Objetivo

Escanear recursivamente directorios y encontrar **todos los archivos con rutas**, sin importar dónde los coloque el desarrollador.

### Características

```typescript
const result = await scanDirectory('./src/pages', {
  extensions: ['.ts', '.tsx'],
  exclude: ['node_modules', 'dist'],
  verbose: true
});

console.log(result);
// {
//   routes: ParsedRoute[],
//   filesScanned: 5,
//   filesWithRoutes: 4,
//   totalRoutes: 8
// }
```

### Funciones Principales

- **`scanDirectory()`** - Escanea recursivamente
- **`getAllTypeScriptFiles()`** - Obtiene archivos TS
- **`traverseDirectory()`** - Recorre directorios
- **`quickCheckForRouteDecorator()`** - Optimización: check rápido antes de parsear
- **`extractRoutesFromFiles()`** - Extrae rutas de múltiples archivos

### Principios de Código

✅ **Declarativo sobre imperativo**  
✅ **Funciones cortas y descriptivas**  
✅ **Separación de responsabilidades**  
✅ **Código legible y mantenible**

### Ejecución

El scanner se ejecuta automáticamente a través del plugin de Vite durante el build.

---

## 🔄 Próximos Pasos

### Checkpoint 1.3: Generador de Manifest
- Crear manifest JSON con todas las rutas
- Estructura optimizada para el Trie
- Type-safe route definitions

### Checkpoint 2.0: Plugin de Vite
- Crear plugin que se ejecute durante el build
- Detectar todos los archivos con `@Route`
- Generar archivo de rutas estáticas

### Checkpoint 2: Generación de Código
- Generar importaciones dinámicas
- Crear manifest de rutas
- Integrar con el router existente

---

## 📚 Recursos

- [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [AST Explorer](https://astexplorer.net/) - Para explorar el AST de TypeScript
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html)

---

## 🐛 Debugging

Si el parser no encuentra rutas:

1. **Verifica la ruta del archivo**: Debe ser correcta (absoluta o relativa)
2. **Revisa el formato del decorador**: Debe ser exactamente `@Route(...)`
3. **Chequea que TypeScript pueda compilar el archivo**: Sin errores de sintaxis
4. **Activa logs de debug**: Agrega `console.log` en la función `visit()` del parser

### Ver el AST de un archivo:

```typescript
import * as ts from 'typescript';

const sourceFile = ts.createSourceFile(
  'test.ts',
  fileContent,
  ts.ScriptTarget.ESNext
);

console.log(JSON.stringify(sourceFile, null, 2));
```

---

## 📝 Notas Técnicas

### ¿Por qué usar análisis estático?

**Ventajas:**
- ✅ Rutas conocidas en build-time
- ✅ Tree-shaking más eficiente
- ✅ Type-safety mejorado
- ✅ Menos runtime overhead
- ✅ Mejor DX con auto-completado

**Desventajas:**
- ❌ Más complejidad en el build
- ❌ No permite rutas 100% dinámicas

### TypeScript Compiler API vs Babel

Usamos TypeScript Compiler API porque:
- Ya tenemos TypeScript en el proyecto
- Mejor type-awareness
- AST más completo para decorators
- Integración nativa con el sistema de tipos

---

## 🎉 Estado Actual

**Checkpoint 1.1**: ✅ **COMPLETO**  
**Checkpoint 1.2**: ✅ **COMPLETO**

Ambos checkpoints funcionan correctamente. El sistema puede:
- Parsear decoradores @Route de archivos individuales
- Escanear directorios recursivamente encontrando todas las rutas
- Optimizar performance con quick-checks
- Manejar errores gracefully

**Listo para Checkpoint 1.3: Generador de Manifest**