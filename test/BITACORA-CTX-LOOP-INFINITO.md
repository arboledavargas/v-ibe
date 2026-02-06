# BITÁCORA: Bug de Loop Infinito con @Ctx

## Fecha de inicio: 2024-01-30
## Estado: ✅ RESUELTO

## Síntoma reportado

Loop infinito que causa "JavaScript heap out of memory" cuando se usa el decorador `@Ctx` en RouteView. El bug ocurre apenas carga la página.

## Causa raíz identificada

**El bug estaba en `Computed._notify()`** (`framework/src/reactivity/signals/computed.ts`)

### El problema:
`Computed._notify()` ejecutaba **TODOS** sus subscribers síncronamente, incluyendo Effects. Esto causaba un loop infinito cuando:

1. `Signal.set()` notifica al Computed (del Derived)
2. `Computed._computation()` marca dirty y llama `_notify()`
3. `Computed._notify()` ejecuta el Effect **síncronamente**
4. El Effect lee el Derived → `get()` → `_recompute()`
5. `_recompute()` hace `_cleanup()` (des-suscribe del Signal)
6. `_recompute()` re-lee el Signal → se re-suscribe
7. Como el Effect se ejecutó síncronamente dentro de la notificación, se crea un ciclo

### Código problemático (ANTES):
```typescript
// computed.ts - _notify()
private _notify(): void {
  this._subscribers.forEach((callback) => {
    // ❌ Ejecutaba TODO síncronamente, incluyendo Effects
    callback();
  });
}
```

### Código corregido (DESPUÉS):
```typescript
// computed.ts - _notify()
private _notify(): void {
  this._subscribers.forEach((subscriber) => {
    if (subscriber._isComputation) {
      // Otro Computed: ejecutar síncronamente para propagar dirty
      subscriber();
    } else {
      // Effect: agendar para evitar loops
      phaseScheduler.schedule(subscriber);
    }
  });
}
```

## Solución implementada

**Archivo modificado**: `framework/src/reactivity/signals/computed.ts`

El fix hace que `Computed._notify()` distinga entre:
- **Computed subscribers**: Se ejecutan síncronamente (para propagar dirty flags inmediatamente)
- **Effect subscribers**: Se agendan en el `phaseScheduler` (evita loops infinitos)

Este comportamiento es **consistente** con cómo `Signal._notify()` ya manejaba la distinción.

## Tests que verifican el fix

- `framework/src/reactivity/decorators/__tests__/ctx-integration.test.ts` - 4 tests
- `framework/src/reactivity/decorators/__tests__/ctx-loop.test.ts` - 11 tests

### Test específico que reproducía el bug:
```typescript
it('TEST: Derived dentro de untrack mantiene reactividad', async () => {
  const parent = new Signal<number>(0);
  const derivedSignal = derived(parent, v => (v ?? 0) + 1);
  
  const eff = effect(() => {
    derivedSignal.get();
  });
  
  parent.set(5); // ← Esto causaba loop infinito ANTES del fix
  
  expect(derivedSignal.get()).toBe(6);
  eff.dispose();
});
```

## Verificación

- ✅ 686 tests de reactividad pasan
- ✅ No hay regresiones en el sistema reactivo
- ❌ **El escenario en el navegador SIGUE con loop infinito**

## ACTUALIZACIÓN: Análisis de logs del navegador (2024-01-30)

### Hallazgo clave del stack trace:

```
[Error] [Signal.get] LOOP DETECTADO: 51 gets
[Error] [Signal.get] Value: "pending"

Stack trace:
  get (signal.js:18)
  when (route-view.js:123)           ← Show lee componentClass.state
  (función anónima) (show.js:13)     ← Effect del Show
  computation (effect.js:18)
  effect (effect.js:29)
  Show (show.js:9)
  jsx (base-component.js:262)
  view (route-view.js:123)           ← RouteView L1 renderiza su view()
  createAndRenderComponent (base-component.js:317)
  view (articles.tsx:121)            ← Articles renderiza <RouteView />
  createAndRenderComponent (base-component.js:317)
  untrack (reactive-context.js:82)
  (función anónima) (show.js:23)     ← Show del padre renderiza children
  computation (effect.js:18)
  flush (phase-scheduler.js:42)      ← Scheduler ejecuta effects
```

### Patrón identificado:

1. `@Computed CREANDO NUEVO computed para levelCandidates` aparece **MÚLTIPLES VECES** para L1
2. Cada vez que el Show del padre renderiza su branch `ready`, **crea un NUEVO RouteView**
3. Cada nuevo RouteView crea un NUEVO `@Computed levelCandidates`
4. Esto sugiere que **el RouteView se está re-creando en cada render**, no reutilizándose

### Causa raíz probable:

El problema NO está en el sistema de signals. El problema es que:
1. Show renderiza `children` cada vez que cambia de branch
2. Los `children` crean NUEVAS instancias de componentes (RouteView)
3. Cada nueva instancia crea nuevos computed/effects
4. Esto causa un ciclo de creación infinita

### Evidencia:
- Se ve `@Computed CREANDO NUEVO computed para levelCandidates` repetidamente para L1
- El valor que causa el loop es `"pending"` (el state del Resource)
- El loop ocurre durante `flush` del scheduler, no durante la notificación inicial

### El flujo del bug:
1. Show (L0) detecta `state === 'ready'` → renderiza children
2. Children incluye `<RouteView />` (L1)
3. RouteView L1 se CREA (nuevo), crea @Computed, @Resource
4. Resource inicia con `state = 'pending'`
5. Show (L1) renderiza `state === 'pending'` → renderiza "Cargando..."
6. Resource cambia a `state = 'ready'`
7. Show (L1) cambia branch → **¿re-renderiza todo incluyendo crear nuevo RouteView?**
8. LOOP

## ANÁLISIS TÉCNICO PROFUNDO (2024-01-31)

### Investigación del componente Show

El componente `Show` en `framework/src/custom-components/show.ts` tiene el siguiente comportamiento:

```typescript
effect(() => {
  const condition = Boolean(props.when());
  
  if (shouldShowTruthy) {
    if (currentBranch === 'truthy') {
      return; // ← Intenta evitar re-render si ya está en este branch
    }
    
    // Limpiar nodo anterior
    if (currentNode) {
      anchor.parentNode?.removeChild(currentNode);
    }
    
    // PROBLEMA: Siempre ejecuta children() creando NUEVO contenido
    const content = reactiveContext.untrack(() => props.children());
    // ...
  }
});
```

### El problema real

El check `if (currentBranch === 'truthy') { return; }` **DEBERÍA** evitar re-creación, pero el loop ocurre **entre diferentes Show components**, no dentro del mismo Show.

### Flujo del loop infinito:

```
1. RouteView L0 carga → Resource = 'ready'
2. Show[ready] de L0 → crea RouteView L1
3. RouteView L1 → Resource = 'pending'
4. Show[pending] de L1 → renderiza "Cargando..."
5. Resource L1 cambia a 'ready'
6. Show[pending] de L1 detecta cambio → limpia su contenido
7. Show[ready] de L1 detecta cambio → ejecuta children()
8. children() = this.jsx(this.componentClass.get(), {})
9. this.componentClass.get() crea dependencia reactiva
10. jsx() crea RouteView L2 (si hay más niveles)
11. RouteView L2 → Resource = 'pending' → LOOP
```

### Hipótesis confirmada

El bug NO está en Show directamente. El problema es:

1. **`this.jsx(this.componentClass.get(), {})` siempre crea una NUEVA instancia**
2. Cada nueva instancia tiene un nuevo `@Computed` y `@Resource`
3. Cada nuevo `@Resource` empieza en `pending` y dispara el ciclo

### ¿Por qué se ve como loop infinito?

Porque los RouteViews anidados crean una cascada:
- L0 crea L1 cuando L0.resource es ready
- L1 crea L2 cuando L1.resource es ready
- Pero si algo invalida L0, se re-crea L1
- L1 re-crea L2
- Y así sucesivamente

### Investigación adicional necesaria

1. ¿Qué está causando que L0 se re-evalúe?
2. ¿El `@Ctx` está creando una dependencia circular?
3. ¿El `derived` signal del `@Ctx` se está re-creando?

## SOLUCIÓN PROPUESTA

### Opción 1: Cache de componentes en Show (como Solid.js)

Show debería cachear las instancias de componentes creadas para cada branch:

```typescript
let truthyCache: Node | null = null;
let falsyCache: Node | null = null;

effect(() => {
  const condition = Boolean(props.when());
  
  if (condition) {
    if (currentBranch === 'truthy' && truthyCache) {
      return; // Ya está mostrando, no hacer nada
    }
    
    // Ocultar el nodo actual
    if (currentNode) {
      anchor.parentNode?.removeChild(currentNode);
    }
    
    // Usar cache si existe, o crear nuevo
    if (!truthyCache) {
      truthyCache = elementToNode(reactiveContext.untrack(() => props.children()));
    }
    
    anchor.parentNode?.insertBefore(truthyCache, anchor.nextSibling);
    currentNode = truthyCache;
    currentBranch = 'truthy';
  }
  // ... similar para falsy
});
```

### Opción 2: Investigar la invalidación raíz

Antes de implementar cache, necesitamos entender POR QUÉ se está re-ejecutando el Show del padre. Agregar logs específicos para:
1. Cuándo el effect del Show se re-ejecuta
2. Qué dependencia cambió que causó la re-ejecución

## Lecciones aprendidas

1. **Consistencia es clave**: `Signal._notify()` ya distinguía entre Computed y Effect, pero `Computed._notify()` no. Esto creó una inconsistencia que causó el bug.

2. **Effects síncronos son peligrosos**: Ejecutar Effects síncronamente durante una notificación puede causar que el Effect lea y modifique el estado de tracking, creando loops.

3. **El scheduler existe por algo**: El `phaseScheduler` no solo es para batching, también previene loops al diferir la ejecución de Effects.

4. **Component caching es necesario**: Los frameworks como Solid.js cachean componentes en Show/Switch para evitar re-creación innecesaria.

## Archivos modificados

```
framework/src/reactivity/signals/computed.ts  # FIX parcial (Computed._notify)
```

## Tests agregados

```
framework/src/reactivity/decorators/__tests__/ctx-integration.test.ts
framework/src/reactivity/decorators/__tests__/ctx-loop.test.ts
```

## HALLAZGO CLAVE (2024-01-31)

**El problema NO es el cache de Show. Es la jerarquía del AppTree.**

Logs revelan:
```
[@Ctx] parentNode: "Articles"  ← SIEMPRE Articles, nunca RouteView
[@Ctx] sourceSignal valor=0    ← Siempre 0, nunca incrementa
[@Ctx] valor mapeado: 1        ← Siempre 1
```

**Problema**: Cada RouteView hijo se registra como hijo de `Articles`, no del RouteView padre.
- Esperado: `RouteView L0 → RouteView L1 → RouteView L2`
- Real: `Articles → RouteView`, `Articles → RouteView`, `Articles → RouteView`...

**Causa**: El Show crea componentes pero el `appNode.parent` apunta al componente que contiene el Show, no al componente que debería ser el padre lógico.

## SOLUCIÓN FINAL (2024-01-31)

### Bug encontrado: `Derived` no tenía `SIGNAL_MARK`

La función `isSignal()` usa un Symbol privado `SIGNAL_MARK` para verificar si un objeto es un Signal:

```typescript
export function isSignal<T>(value: unknown): value is Signal<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    SIGNAL_MARK in value &&
    value[SIGNAL_MARK] === true
  );
}
```

Pero la clase `Derived` solo tenía la propiedad pública `isSignal: true`, **no el Symbol**:

```typescript
// ANTES (broken)
export class Derived<T> implements ISignal<T> {
  readonly isSignal = true;  // ❌ Solo propiedad pública
  // ...
}
```

### Fix aplicado

Agregar `SIGNAL_MARK` a `Derived`:

```typescript
// DESPUÉS (fixed)
import { ISignal, SIGNAL_MARK } from "./signal";

export class Derived<T> implements ISignal<T> {
  [SIGNAL_MARK] = true;      // ✅ Symbol privado para isSignal()
  readonly isSignal = true;   // Propiedad pública
  // ...
}
```

### Archivos modificados

- `framework/src/reactivity/signals/signal.ts` - Exportar `SIGNAL_MARK`
- `framework/src/reactivity/signals/derived.ts` - Agregar `SIGNAL_MARK`
- `framework/src/reactivity/signals/__tests__/signal.test.ts` - Test para verificar

---

## ANÁLISIS POST-MORTEM: Los 5 Porqués

### ¿Por qué ocurrió el loop infinito?
**Porque** cada RouteView hijo obtenía `navigationLevel = 1` en lugar de incrementar (2, 3, etc.), causando que siempre encontrara candidatos y creara más RouteViews.

### ¿Por qué el navigationLevel no incrementaba?
**Porque** `findContextSignalFor()` no reconocía el `$navigationLevel` del RouteView padre (que era un `Derived`) y seguía buscando hasta encontrar el RouteView raíz (que era un `Signal` con valor 0).

### ¿Por qué no reconocía el Derived como Signal?
**Porque** la función `isSignal()` verificaba la existencia del Symbol `SIGNAL_MARK`, pero `Derived` no lo tenía.

### ¿Por qué Derived no tenía SIGNAL_MARK?
**Porque** cuando se creó la clase `Derived`, se asumió que tener `isSignal: true` como propiedad pública era suficiente para implementar la interfaz `ISignal`, sin considerar que `isSignal()` usa un mecanismo diferente (Symbol privado).

### ¿Por qué no había un test que verificara esto?
**Porque** no existía una práctica establecida de verificar que todas las implementaciones de `ISignal` sean reconocidas por `isSignal()`. La interfaz TypeScript (`ISignal`) y la función de verificación runtime (`isSignal()`) no estaban sincronizadas.

---

## CAUSA RAÍZ

**Falta de cohesión entre el contrato de tipos (TypeScript) y la verificación runtime.**

La interfaz `ISignal` define qué métodos debe tener un Signal, pero la función `isSignal()` usa un mecanismo completamente diferente (Symbol privado) para verificar identidad. Esto crea dos "contratos" desconectados:

1. **Contrato de tipos**: `implements ISignal<T>` 
2. **Contrato runtime**: `SIGNAL_MARK in value`

Cuando se crea una nueva clase que implementa `ISignal`, el desarrollador cumple el contrato de tipos pero puede olvidar el contrato runtime.

---

## ACCIONES PREVENTIVAS

1. **Documentar el requisito de SIGNAL_MARK** en la interfaz `ISignal` o cerca de ella
2. **Crear un test genérico** que verifique que todas las clases que implementan `ISignal` también tengan `SIGNAL_MARK`
3. **Considerar unificar los contratos**: Hacer que `isSignal()` también acepte objetos con `isSignal: true` como fallback, o eliminar uno de los dos mecanismos
