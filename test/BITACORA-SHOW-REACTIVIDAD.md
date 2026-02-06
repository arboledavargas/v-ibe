# BITÁCORA: Bug de Reactividad en Show Component

## Fecha de inicio: 2024-01-28
## Última actualización: 2024-01-28 (Sesión diagnóstico navegador)

## Síntoma reportado

Al navegar desde `/` a `/articles`, el RouteView muestra "Cargando..." y nunca cambia a mostrar el contenido cargado.

### Logs del navegador:
```
[Log] ReactiveArray._notify called with key: 1, subscribers: 1
[Log] [Show] Condition evaluated: – true
[Log] [Show] Already showing truthy branch, skipping render
[Log] [Show] Condition evaluated: – true
[Log] [Show] Already showing truthy branch, skipping render
```

### DOM renderizado:
```html
<use-route-view>
  ▼ Contenido oculto (Abierto)
    <!--show-->
    <div>Cargando...</div>
    <!--show-->
    ▼ <div>
        "Error al cargar la página:"
        <!--reactive-child-->
      </div>
    <!--show-->
</use-route-view>
```

**Problema visible**: Se renderizan AMBOS branches (pending Y error) simultáneamente, cuando solo uno debería estar visible.

---

## Contexto técnico

### Flujo de datos:
1. `RouteView` usa `@Resource` para cargar componentes dinámicamente
2. El Resource tiene estados: `pending` → `ready` | `error`
3. `view()` usa `<Show when={() => condition}>` para renderizado condicional
4. El plugin `jsx-signals` transforma las expresiones JSX

### Transformación del plugin jsx-signals:
```tsx
// Código escrito por el desarrollador:
<Show when={() => this.componentClass.state === 'pending'}>

// Código transformado por jsx-signals:
<Show when={() => () => this.componentClass.state === 'pending'}>
```

El plugin envuelve arrow functions existentes en OTRA arrow function, causando doble wrapping.

---

## Hipótesis investigadas

### Hipótesis 1: Doble wrapping causa que todas las condiciones sean truthy ✅ CONFIRMADA

**Teoría**: Cuando `props.when()` retorna una función en lugar de un booleano, `Boolean(function)` siempre es `true`.

**Prueba**:
```javascript
const fn = () => false;
Boolean(fn);  // true - porque fn es una función, no su resultado
```

**Solución implementada**: Función `unwrapCondition` que ejecuta funciones anidadas hasta llegar a un valor primitivo.

```typescript
function unwrapCondition(value: any): boolean {
  while (typeof value === 'function') {
    value = value();
  }
  return Boolean(value);
}
```

**Resultado**: El problema de "todos los branches visibles" se solucionó. Ahora solo se muestra un branch a la vez.

---

### Hipótesis 2: Recursión en unwrapCondition pierde tracking ❓ NO CONFIRMADA

**Teoría**: La versión recursiva de `unwrapCondition` podría perder el tracking del effect.

```typescript
// Versión recursiva (supuestamente buggy)
function unwrapCondition(value: any): boolean {
  if (typeof value === 'function') {
    return unwrapCondition(value());  // ¿Pierde tracking?
  }
  return Boolean(value);
}

// Versión con while (supuestamente correcta)
function unwrapCondition(value: any): boolean {
  while (typeof value === 'function') {
    value = value();  // Se ejecuta en el mismo stack frame
  }
  return Boolean(value);
}
```

**Prueba realizada**: Se crearon tests unitarios para ambas versiones.

**Resultado**: AMBAS versiones pasan los tests. La recursión NO parece perder el tracking en los tests unitarios.

**Conclusión**: El bug reportado en el navegador puede tener otra causa.

---

### Hipótesis 3: El Resource no está cambiando de estado ❓ PENDIENTE

**Teoría**: El Resource podría no estar actualizando su `state` de `pending` a `ready`.

**Pruebas a realizar**:
1. Verificar logs del Resource al navegar
2. Confirmar que `componentClass.state` cambia
3. Verificar si el effect del Show se re-ejecuta

---

### Hipótesis 4: El RouteView L1 (anidado) tiene problema diferente ❓ PENDIENTE

**Teoría**: El problema podría ser específico del RouteView anidado (nivel 1), no del nivel 0.

**Contexto**:
- RouteView L0 carga `App`
- App contiene RouteView L1
- RouteView L1 debería cargar `ArticlesPage`

**Pruebas a realizar**:
1. Verificar si L0 carga correctamente
2. Verificar si L1 se crea y su Resource se ejecuta
3. Verificar los candidates de L1

---

## Tests creados

### 1. Test de funciones anidadas (doble wrapping)
**Archivo**: `framework/src/custom-components/__tests__/show.test.ts`
**Nombre**: `debe manejar funciones anidadas en when (doble wrapping por jsx-signals)`
**Estado**: ✅ PASA

### 2. Test de múltiples Shows con mismo estado
**Archivo**: `framework/src/custom-components/__tests__/show.test.ts`
**Nombre**: `debe funcionar correctamente con múltiples Shows y mismo estado (simula RouteView)`
**Estado**: ✅ PASA

### 3. Test de regresión de tracking
**Archivo**: `framework/src/custom-components/__tests__/show.test.ts`
**Nombre**: `REGRESIÓN: debe mantener tracking reactivo con funciones anidadas (bug navegación)`
**Estado**: ✅ PASA (con ambas implementaciones de unwrapCondition)

### 4. Tests de integración RouteView con Show
**Archivo**: `framework/src/router/__tests__/routeview-integration.test.ts`
**Estado**: ✅ PASAN (6 tests)

---

## Estado actual del código

### Show component (`framework/src/custom-components/show.ts`):
- Implementa `unwrapCondition` con while loop
- Usa `effect()` para tracking reactivo
- Usa `untrack()` para ejecutar children sin crear dependencias

### RouteView (`framework/src/router/route-view.tsx`):
- Usa tres `<Show>` para pending, error, ready
- El plugin jsx-signals envuelve las condiciones en funciones adicionales

---

---

## Sesión 2024-01-28 (continuación)

### Nuevo hallazgo: El problema NO es el Show ni el Resource en aislamiento

**Prueba realizada**: Se crearon tests unitarios que simulan exactamente el escenario del RouteView:
- Resource que retorna `null` inmediatamente (sin `await`)
- Resource que lee un array vacío y retorna `null`

**Resultado**: TODOS los tests PASAN ✅

```
RESOURCE .then() - isStale=false, data= null
RESOURCE - Setting state to ready
TEST: Final state = ready
```

**Conclusión**: El Resource SÍ cambia correctamente a `ready` cuando retorna `null` en los tests unitarios. El bug debe estar en alguna interacción específica del navegador/RouteView.

### Hipótesis actuales

1. **El effect del Resource se re-ejecuta antes de que el `.then()` se procese** - `isStale` se pone en `true`
2. **Algo específico del decorador `@Resource`** vs `createResource` directo
3. **Interacción con el `@Computed` de `levelCandidates`**
4. **Race condition entre el scheduler y las microtasks**

### Logs agregados para debug

Se agregaron estos logs al `resource.ts`:
```typescript
// En .then()
console.log(`RESOURCE .then() - isStale=${isStale}, data=`, data);
if (!isStale) {
  console.log('RESOURCE - Setting state to ready');
} else {
  console.log('RESOURCE - SKIPPED because isStale=true');
}

// En onCleanup
console.log('RESOURCE onCleanup called - setting isStale=true');
```

## Próximos pasos

1. **Recargar el navegador** y buscar en los logs:
   - ¿Aparece `RESOURCE .then()` para el L1?
   - ¿`isStale` es `true` o `false`?
   - ¿Aparece `onCleanup called` ANTES del `.then()`?
2. **Si `isStale=true`**: El effect se está re-ejecutando prematuramente
3. **Si `.then()` nunca aparece**: La Promise no se está resolviendo

---

## Logs útiles para debugging

Agregar estos logs temporalmente:

```typescript
// En Resource (resource.ts)
console.log(`[Resource] State changing from ${oldState} to ${newState}`);

// En Show (show.ts)
console.log(`[Show] Effect re-running, condition=${condition}, currentBranch=${currentBranch}`);

// En RouteView (route-view.tsx)
console.log(`[RouteView L${level}] componentClass.state=${this.componentClass.state}`);
```

---

## Notas adicionales

- Los tests unitarios pueden no capturar el problema real si depende de timing o del ciclo de vida del DOM
- El problema podría manifestarse solo en navegación (cambio de ruta), no en carga inicial
- Considerar si hay race conditions entre el Resource y el Show

---

## Sesión 2024-01-28: Diagnóstico con Logs del Navegador

### Hallazgo clave: El Resource SÍ cambia a `ready` pero Show evalúa condición incorrectamente

**Evidencia de los logs**:
1. RouteView L1 ejecuta Resource, candidatos vacíos → retorna `null` inmediatamente
2. Resource cambia estado: `pending` → `ready` (log confirmado)
3. Show evalúa condición `() => this.componentClass.state === 'pending'` pero retorna `true` incluso cuando state es `ready`

**Logs críticos**:
```
[RouteView L1] candidates.length = 0
⚠️ [RouteView L1] No candidates, returning null
[Resource] Promise resolved with data: null
[Resource] Setting state to ready
[Resource] state getter called, returning: ready
[Show] unwrapCondition result: depth=2, value= true true
```

**Paradoja identificada**:
- `[Resource] state getter called, returning: ready` ← El getter reporta estado `ready`
- Pero `[Show] unwrapCondition result: depth=2, value= true true` ← La condición `state === 'pending'` evalúa a `true`

### Hipótesis revisada: Problema de contexto (`this`) o doble wrapping extremo

**Posibles causas**:
1. **`this` mal bindeado**: La función `when` podría perder el contexto de `this`, haciendo que `this.componentClass` sea `undefined` o diferente
2. **Doble wrapping patológico**: El plugin jsx-signals podría estar creando `() => () => () => this.componentClass.state === 'pending'`
3. **Race condition de evaluación**: El effect del Show podría estar evaluando antes de que el cambio de estado se propague reactivamente

**Próximas investigaciones**:
1. Verificar el binding de `this` en las funciones `when` 
2. Añadir logs para ver el valor exacto de `this.componentClass.state` dentro de `unwrapCondition`
3. Investigar si hay múltiples instancias de Resource involucradas
4. Verificar la profundidad real de anidamiento de funciones

### Nueva estrategia de debugging implementada

**Modificaciones al RouteView**:
1. Se creó método `createWhenCondition()` que envuelve cada condición con logging detallado
2. Cada condición `when` ahora muestra: estado actual, estado esperado y resultado booleano
3. Se añadió logging del objeto `componentClass` completo para verificar identidad
4. Se añadió logging de `componentClass.get()` para ver el valor cargado

**Modificaciones al Show component**:
1. Se mejoró `unwrapCondition` con logging de cada paso de ejecución
2. Se añadió manejo de errores en la ejecución de funciones
3. Se añadió logging del raw result de `props.when()` antes del unwrap
4. Se añadió logging de la función `when.toString()` para ver su implementación

**Objetivo de esta estrategia**:
Determinar con precisión si:
1. El problema es de contexto (`this` mal bindeado)
2. El problema es de doble wrapping extremo del plugin jsx-signals
3. El problema es de timing/race condition en la evaluación reactiva

**Logs esperados**:
```
[RouteView L1] when condition "pending": actualState=ready, expectedState=pending, result=false
[Show] unwrapCondition starting: depth=0, value type=function
[Show] when function toString: () => { ... }
[Show] Evaluating when function...
[Show] Raw when result: true, type: boolean
```

Si los logs muestran que `actualState=ready` pero `result=true`, el problema está en la evaluación de la condición o en el contexto.

---

## Sesión 2024-01-29: CAUSA RAÍZ IDENTIFICADA ✅

### Hallazgo definitivo: El plugin jsx-signals envuelve arrow functions en atributos

**Prueba realizada**: Se creó un script de test para verificar las transformaciones del plugin jsx-signals.

**Resultados críticos**:

```
=== TEST 2: Atributo con arrow function (NO debería transformar) ===
Input:   <Show when={() => this.state === 'pending'} />
Output:  <Show when={() => () => this.state === 'pending'}/>;

=== TEST 5: Children con arrow function (NO debería transformar) ===
Input:   <Show>{() => this.renderContent()}</Show>
Output:  <Show>{() => this.renderContent()}</Show>;  ✅ NO transforma

=== TEST 7: Show con when inline arrow function ===
Input:   <Show when={() => this.componentClass.state === 'pending'}>{() => <div>Loading</div>}</Show>
Output:  <Show when={() => () => this.componentClass.state === 'pending'}>{() => <div>Loading</div>}</Show>;
```

### Causa raíz confirmada

**El bug está en `jsx-signals.ts` líneas 54-77**:

El plugin verifica si debe envolver expresiones que contienen `this`, pero para **atributos JSX** no verifica si la expresión **ya es una arrow function**. Para **children** sí lo hace (líneas 85-87):

```typescript
// Para children - CORRECTO ✅
if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
  return ts.visitEachChild(node, visit, context);  // No envuelve
}

// Para atributos - FALTA esta verificación ❌
if (jsxExpression.expression && containsThis(jsxExpression.expression)) {
  // Envuelve sin verificar si ya es función
  const arrowFunction = ts.factory.createArrowFunction(...);
}
```

### Por qué el workaround actual funciona

El RouteView actual usa `createWhenCondition()` que crea funciones FUERA del JSX:

```typescript
const pendingWhen = this.createWhenCondition("pending", "pending");
return <Show when={pendingWhen}>...
```

El plugin ve `when={pendingWhen}` donde `pendingWhen` es una variable, no una expresión con `this` directo. Por eso **no la transforma**.

### Solución propuesta

**Opción A: Arreglar el plugin jsx-signals** (RECOMENDADA)

Agregar verificación de arrow functions para atributos JSX:

```typescript
// Solo procesar si la expresión contiene 'this'
if (
  jsxExpression.expression &&
  containsThis(jsxExpression.expression)
) {
  // ✅ AGREGAR: No envolver si ya es una función
  if (ts.isArrowFunction(jsxExpression.expression) || 
      ts.isFunctionExpression(jsxExpression.expression)) {
    return ts.visitEachChild(node, visit, context);
  }
  
  // Crear arrow function que envuelve la expresión
  const arrowFunction = ts.factory.createArrowFunction(...);
}
```

**Beneficios de esta solución**:
1. Elimina la necesidad de `unwrapCondition` en Show
2. Simplifica el razonamiento sobre props que ya son funciones
3. Comportamiento consistente entre atributos y children
4. Reduce complejidad y posibles bugs de tracking

**Opción B: Mantener workaround en componentes** (ACTUAL)

Usar variables intermedias como `pendingWhen` en lugar de arrow functions inline:

```typescript
// En lugar de:
<Show when={() => this.state === 'pending'}>

// Usar:
const pendingWhen = () => this.state === 'pending';
<Show when={pendingWhen}>
```

### Tests que confirman el comportamiento

1. **Show tests pasan**: El `unwrapCondition` maneja correctamente el doble wrapping
2. **Tracking funciona**: El test de regresión confirma que el tracking reactivo se mantiene
3. **Plugin inconsistente**: Los tests muestran que children no se transforman pero atributos sí

### Impacto del fix

Si se implementa la Opción A:
- El Show component puede simplificarse (eliminar `unwrapCondition`)
- Todos los componentes con props funcionales se benefician
- El código fuente del usuario se transforma de forma más predecible

---

## FIX IMPLEMENTADO ✅

### Cambios realizados

**1. jsx-signals.ts (líneas 57-67)**

Se agregó verificación para no envolver arrow functions en atributos JSX:

```typescript
if (jsxExpression.expression && containsThis(jsxExpression.expression)) {
  // ✅ NUEVO: No envolver si ya es una función
  if (ts.isArrowFunction(jsxExpression.expression) || 
      ts.isFunctionExpression(jsxExpression.expression)) {
    return ts.visitEachChild(node, visit, context);
  }
  
  // Crear arrow function...
}
```

**2. route-view.tsx**

Se eliminó `createWhenCondition()` y se simplificó el método `view()`:

```tsx
view() {
  return (
    <>
      <Show when={() => this.componentClass.state === 'pending'}>
        {() => <div>Cargando...</div>}
      </Show>

      <Show when={() => this.componentClass.state === 'error'}>
        {() => (
          <div>
            Error al cargar la página:{' '}
            {this.componentClass.error}
          </div>
        )}
      </Show>

      <Show when={() => this.componentClass.state === 'ready'}>
        {() => this.jsx(this.componentClass.get() ?? null, {})}
      </Show>
    </>
  );
}
```

**3. Test de integración creado**

`framework/src/router/__tests__/routeview-app-articles.test.ts`:
- Verifica que Show funciona con Resource
- Verifica transición pending → ready
- Verifica que nunca hay múltiples branches visibles
- Test de regresión para el doble wrapping

### Verificación del fix

```
=== VERIFICACIÓN DEL FIX ===

TEST 1: Arrow function en atributo (DEBE permanecer igual)
Input:   <Show when={() => this.state === 'pending'} />
Output:  <Show when={() => this.state === 'pending'}/>;
✅ PASS: SÍ

TEST 2: Expresión simple en atributo (DEBE envolverse)
Input:   <div className={this.active ? 'on' : 'off'} />
Output:  <div className={() => this.active ? 'on' : 'off'}/>;
✅ PASS: SÍ
```

### Tests pasando

```
✓ src/router/__tests__/routeview-app-articles.test.ts (4 tests) 358ms
  ✓ debe mostrar el estado correcto según resource.state con arrow functions inline
  ✓ nunca debe mostrar pending y ready simultáneamente
  ✓ debe manejar resource que retorna null correctamente
  ✓ REGRESIÓN: when debe retornar boolean directamente, no función
```

### Conclusión

El bug del RouteView que mostraba "Cargando..." permanentemente se debía a que el plugin jsx-signals envolvía arrow functions existentes en atributos JSX, causando doble wrapping. Con el fix, el comportamiento es consistente entre atributos y children: las arrow functions existentes no se envuelven.

---

## Sesión 2024-01-29: Segundo Bug Encontrado - Tracking Perdido

### Síntoma

Después de aplicar el fix del plugin jsx-signals, el RouteView L0 funciona correctamente pero el RouteView L1 (anidado) sigue mostrando "Cargando..." permanentemente.

### Diagnóstico

**RouteView L0 (funciona)**:
```
[Signal] _notify() called - subscribers count: 3   ← Los 3 Shows suscritos
[PhaseScheduler] flush() - executing 3 effects    ← Los 3 se re-ejecutan
```

**RouteView L1 (NO funciona)**:
```
[Signal] _notify() called - subscribers count: 1   ← ¡Solo 1 Show suscrito!
[PhaseScheduler] flush() - executing 1 effects    ← Solo 1 se re-ejecuta
```

### Causa identificada: `unwrapCondition` ejecutaba la función dos veces

El código anterior del Show:

```typescript
effect(() => {
  const rawWhenResult = props.when();        // ← Primera ejecución (CON tracking)
  const condition = unwrapCondition(props.when, 0);  // ← Segunda ejecución
});
```

El problema:
1. `props.when()` se ejecutaba primero y creaba la suscripción correcta
2. Luego `unwrapCondition(props.when, 0)` volvía a ejecutar `props.when()` desde cero
3. Esta segunda ejecución **sobrescribía** la suscripción anterior
4. Solo el ÚLTIMO Show que se ejecutaba mantenía su suscripción

### Fix aplicado

Se simplificó el código del Show para usar directamente el resultado de `props.when()`:

```typescript
effect(() => {
  const condition = Boolean(props.when());  // ← Una sola ejecución, tracking correcto
});
```

### Resultado parcial

- RouteView L0: Funciona correctamente ✅
- RouteView L1: Sigue con 1 subscriber en lugar de 3 ❌

### Investigación en curso

El problema persiste para L1. Los 3 Shows de L1 SÍ leen el estado:
```
[Show "pending"] → [Resource] state getter called, returning: pending
[Show "error"] → [Resource] state getter called, returning: pending  
[Show "ready"] → [Resource] state getter called, returning: pending
```

Pero solo 1 se suscribe. Posibles causas:
1. El contexto reactivo (`reactiveContext.currentComputation`) no está activo para todos los Shows
2. Algo en el proceso de creación de L1 interfiere con el tracking
3. Los Shows de L1 se crean en un contexto diferente a los de L0

### Logging agregado para diagnóstico

```typescript
// En Signal.get()
console.log(`[Signal.get] hasComputation=${hasComputation}, isTracking=${isTracking}`);
```

Esto nos dirá si cuando los Shows de L1 leen el estado, el contexto reactivo está activo o no.

### Diferencias entre L0 y L1

| Aspecto | L0 | L1 |
|---------|----|----|
| Subscribers en _stateSignal | 3 | 1 |
| Effects ejecutados en flush | 3 | 1 |
| Comportamiento | Correcto | "Cargando..." permanente |
| Candidates | 1 (App) | 0 (vacío) |
| Resource retorna | App class | null |

### Próximos pasos

1. Verificar con los nuevos logs si `hasComputation` y `isTracking` son `true` para todos los Shows de L1
2. Si no son `true`, investigar por qué el contexto reactivo se pierde
3. Revisar si hay diferencias en cómo se crean los componentes L0 vs L1
