# Signals Normalizados: State y Computed

## ¿Qué significa "normalizado" en el contexto de Signals?

Cuando hablamos de **"State" y "Computed" normalizados** en el mundo de las signals, nos referimos a una **interfaz común y estandarizada** que todos los frameworks pueden implementar, permitiendo que las signals de diferentes frameworks sean **interoperables**.

## El Problema que Resuelve

Cada framework tiene su propia implementación de signals:

- **Angular**: `signal()`, `computed()`, `effect()`
- **Vue**: `ref()`, `reactive()`, `computed()`, `watchEffect()`
- **Preact**: `signal()`, `computed()`, `effect()`
- **SolidJS**: `createSignal()`, funciones derivadas, `createEffect()`

Aunque todos hacen lo mismo conceptualmente, tienen APIs diferentes. Esto impide que uses una signal de Angular en un componente de Vue, o viceversa.

## La Solución: Normalización

La **normalización** significa definir un **contrato común** (interfaz) que todas las implementaciones deben cumplir. Esto permite que:

1. Una signal creada en Angular pueda ser leída/escrita desde Vue
2. Un computed de Preact pueda depender de una signal de SolidJS
3. Los efectos puedan reaccionar a signals de cualquier framework

## El Contrato Normalizado: `ISignal<T>`

En tu framework, ya tienes esta interfaz definida:

```typescript
export interface ISignal<T> {
  readonly isSignal: true;  // Marca de identificación
  get(): T;                  // Leer el valor
  set(newValue: T): void;     // Escribir el valor (solo para State)
  update(updater: (currentValue: T) => T): void;  // Actualizar con función
}
```

### ¿Por qué estas tres operaciones?

1. **`isSignal: true`**: Permite detectar si algo es una signal (type guard)
2. **`get()`**: Método estándar para leer valores (tracking automático)
3. **`set()`**: Método estándar para escribir valores (solo en State, no en Computed)
4. **`update()`**: Conveniencia para actualizar basado en el valor actual

## State Normalizado (Signal.State)

**State** es una signal **escribible** que almacena un valor mutable:

```typescript
// Tu implementación actual
class Signal<T> implements ISignal<T> {
  readonly isSignal = true;
  get(): T { /* ... */ }
  set(newValue: T): void { /* ... */ }
  update(updater: (currentValue: T) => T): void { /* ... */ }
}
```

### Características del State normalizado:

1. **Escribible**: Puedes cambiar su valor con `set()` o `update()`
2. **Trackeable**: Cuando se lee con `get()`, registra automáticamente dependencias
3. **Notificable**: Cuando cambia, notifica a todos sus subscribers
4. **Comparación**: Usa `Object.is()` por defecto para evitar notificaciones innecesarias

### Ejemplo de uso normalizado:

```typescript
// Crear un state
const count = new Signal(0);

// Leer (trackea dependencias automáticamente)
const value = count.get(); // 0

// Escribir
count.set(10);

// Actualizar
count.update(n => n + 1); // 11
```

## Computed Normalizado (Signal.Computed)

**Computed** es una signal **de solo lectura** que deriva su valor de otras signals:

```typescript
// Tu implementación actual
class Computed<T> implements ISignal<T> {
  readonly isSignal = true;
  get(): T { /* recalcula si está dirty */ }
  set(newValue: T): void { throw new Error("Cannot set...") }
  update(...): void { throw new Error("Cannot update...") }
}
```

### Características del Computed normalizado:

1. **Solo lectura**: No puedes escribir directamente (`set()` lanza error)
2. **Lazy evaluation**: Solo recalcula cuando se lee y está "dirty"
3. **Memoización**: Guarda el valor calculado hasta que cambien las dependencias
4. **Tracking dinámico**: Las dependencias se detectan automáticamente al ejecutar el getter
5. **Cleanup automático**: ✅ **IMPLEMENTADO** - Se des-suscribe de dependencias que ya no se usan

#### ¿Cómo funciona el Cleanup Automático?

Cada vez que un `Computed` se recalcula (cuando está "dirty" y se lee), el proceso es:

1. **Cleanup previo** (línea 84): Antes de re-trackear, se des-suscribe de todas las dependencias anteriores:
   ```typescript
   private _cleanup(): void {
     this._sources.forEach((source) => {
       if (source._unsubscribe) {
         source._unsubscribe(this._computation); // Des-suscribirse
       }
     });
     this._sources.clear(); // Limpiar la lista
   }
   ```

2. **Re-trackear**: Se ejecuta el getter y se registran las nuevas dependencias que se leen

3. **Resultado**: Si las dependencias cambian dinámicamente (ej: condicionales), el computed solo se suscribe a las signals que realmente lee en esta ejecución

**Ejemplo práctico:**
```typescript
const useA = new Signal(true);
const a = new Signal(1);
const b = new Signal(2);

const conditional = computed(() => {
  if (useA.get()) {
    return a.get() * 10; // Solo depende de 'a'
  }
  return b.get() * 10;   // Solo depende de 'b'
});

conditional.get(); // Depende de: useA, a
useA.set(false);   // Cambia la condición
conditional.get(); // Ahora depende de: useA, b (se des-suscribió de 'a')

// Si cambias 'a' ahora, NO notifica a 'conditional' porque ya no está suscrito
a.set(777); // ✅ conditional NO se actualiza (cleanup funcionó)
```

### Ejemplo de uso normalizado:

```typescript
// Crear un state
const count = new Signal(0);

// Crear un computed que depende del state
const doubled = computed(() => count.get() * 2);

// Leer (recalcula automáticamente si count cambió)
const value = doubled.get(); // 0 * 2 = 0

// Cambiar el state
count.set(5);

// Leer de nuevo (recalcula automáticamente)
const newValue = doubled.get(); // 5 * 2 = 10
```

## Interoperabilidad en la Práctica

Con signals normalizados, podrías hacer algo como esto (hipotético):

```typescript
// Signal creada en Angular
const angularSignal = angular.signal(10);

// Usarla en tu framework
const myComputed = computed(() => {
  // Leer la signal de Angular usando la interfaz normalizada
  return angularSignal.get() * 2; // 20
});

// O crear una signal en tu framework y usarla en Vue
const mySignal = new Signal(42);
// Vue podría leerla así: vueComputed(() => mySignal.get())
```

## Comparación: Tu Framework vs Especificación

### ✅ Lo que ya tienes implementado correctamente:

1. **Interfaz `ISignal<T>`**: Contrato común que define `get()`, `set()`, `update()`
2. **Marca `isSignal`**: Permite detectar si algo es una signal
3. **Tracking automático**: `get()` registra dependencias automáticamente
4. **Computed lazy**: Solo recalcula cuando se lee y está dirty
5. **Cleanup bidireccional**: Signals saben sus subscribers, Computed saben sus sources

### 📋 Lo que la especificación TC39 propone:

La propuesta TC39 (Stage 1) define:

- **`Signal.State<T>`**: Equivalente a tu `Signal<T>` (writable)
- **`Signal.Computed<T>`**: Equivalente a tu `Computed<T>` (read-only)
- **`Signal.subtle`**: API de bajo nivel para frameworks
- **`Signal.user`**: API de alto nivel para desarrolladores

### 🎯 Tu implementación vs Especificación:

| Concepto | Tu Framework | TC39 Spec | Compatible |
|----------|-------------|-----------|------------|
| State escribible | `Signal<T>` | `Signal.State<T>` | ✅ Sí (mismo concepto) |
| Computed de solo lectura | `Computed<T>` | `Signal.Computed<T>` | ✅ Sí (mismo concepto) |
| Interfaz común | `ISignal<T>` | `Signal<T>` (base) | ✅ Sí (mismo contrato) |
| Tracking automático | `get()` | `get()` | ✅ Sí (mismo método) |
| Marca de identificación | `isSignal: true` | `[Symbol.signal]` | ⚠️ Diferente (pero funcional) |

## Resumen

**"State y Computed normalizados"** significa:

1. **Contrato común**: Una interfaz (`ISignal<T>`) que todas las signals deben implementar
2. **Operaciones estándar**: `get()`, `set()`, `update()` como métodos universales
3. **Comportamiento predecible**: Tracking automático, memoización, cleanup
4. **Interoperabilidad**: Signals de diferentes frameworks pueden trabajar juntas

Tu framework ya está **bien alineado** con estos conceptos. La diferencia principal es que la especificación TC39 usa nombres como `Signal.State` y `Signal.Computed`, pero el concepto es idéntico a tu `Signal` y `Computed`.

## Referencias

- [TC39 Signals Proposal](https://github.com/tc39/proposal-signals)
- [Angular Signals Guide](https://angular.dev/guide/signals)
- [Preact Signals](https://preactjs.com/blog/signal-boosting/)
- [Vue Reactivity](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
- [SolidJS Signals](https://www.solidjs.com/docs/latest/api#createsignal)
