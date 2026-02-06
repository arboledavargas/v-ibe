### Paso 1: Infrastructure de Metadata y Registro

Crea/modifica estos 3 archivos en orden:
1. src/behaviors/constants.ts (Nuevo)

```typescript
// Symbol para almacenar metadata de props en las clases Behavior
export const BEHAVIOR_PROPS = Symbol('behavior:props');

// Symbol para inyectar el host (ya lo tenías, pero centralizado)
export const HOST_KEY = Symbol('behavior:host');
```

### 2. Modificación a tu decorador @Prop existente
Ubicación: /src/components/decorators/prop.ts
Añade la detección de metadata para behaviors:

```typescript 
import { BEHAVIOR_PROPS } from '../behaviors/constants';

export function Prop<This extends object, Value>(
  target: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
): (this: This, initialValue: Value) => Value {
  if (context.kind !== "field") {
    throw new Error("@Prop can only be applied to class fields.");
  }

  const storageKey = Symbol(`prop_storage_${String(context.name)}`);

  // NUEVO: Registrar esta prop en la metadata de la clase si es un Behavior
  const ctor = context.constructor as any;
  if (!ctor[BEHAVIOR_PROPS]) {
    ctor[BEHAVIOR_PROPS] = new Set<string>();
  }
  ctor[BEHAVIOR_PROPS].add(context.name);

  return function(this: any, initialValue: Value): Value {
    this[storageKey] = initialValue;

    Object.defineProperty(this, context.name, {
      get: () => {
        const storedValue = this[storageKey];
        const propName = String(context.name);

        // Event handlers no se desenvuelven
        if (propName.startsWith('on') && propName.length > 2) {
          return storedValue;
        }

        // Unwrap de signals/funciones (tu lógica actual)
        if (typeof storedValue === 'function' && storedValue.length === 0) {
          return storedValue();
        }

        return storedValue;
      },

      set: (newValue: Value) => {
        this[storageKey] = newValue;
      },

      enumerable: true,
      configurable: true,
    });

    return initialValue;
  };
}
```

3. src/behaviors/property-registry.ts (Reescribir)

Reemplaza tu PropertyRegistry actual con este:

```typescript
import { BEHAVIOR_PROPS } from './constants';

type Constructor = new (...args: any[]) => any;

export class PropertyRegistry {
  // Map: nombreDeProp -> ConstructorDelBehavior
  // Ejemplo: "link" -> Link, "activeClass" -> Link, "draggable" -> Draggable
  private static propIndex = new Map<string, Constructor>();
  
  // Set de todas las props que pertenecen a behaviors (para bindProps)
  private static allBehaviorProps = new Set<string>();

  /**
   * Registra una clase como Behavior.
   * Llama a esto desde el decorador @Behavior.
   */
  static register(cls: Constructor): void {
    const props = (cls as any)[BEHAVIOR_PROPS] as Set<string> | undefined;
    
    if (!props || props.size === 0) {
      console.warn(`[Behavior] ${cls.name} registrado sin @Props. ¿Olvidaste decorar las propiedades?`);
    }

    // Registrar cada prop como entrada a este behavior
    props?.forEach(propName => {
      if (this.propIndex.has(propName)) {
        const existing = this.propIndex.get(propName)!.name;
        throw new Error(
          `[Behavior Conflict] La propiedad "${propName}" ya está registrada ` +
          `por el behavior "${existing}". No puede usarse en "${cls.name}".`
        );
      }
      
      this.propIndex.set(propName, cls);
      this.allBehaviorProps.add(propName);
    });
  }

  /**
   * Resuelve qué behaviors aplicar y con qué configuración.
   * Input: props del JSX (ej: {link: true, activeClass: 'selected', href: '/'})
   * Output: Map<BehaviorClass, config>
   */
  static resolve(props: Record<string, any>): Map<Constructor, Record<string, any>> {
    const behaviors = new Map<Constructor, Record<string, any>>();
    const assigned = new Set<string>();

    // PASO 1: Encontrar activadores booleanos (props que son exactamente `true`)
    for (const [key, value] of Object.entries(props)) {
      if (value === true) {
        const BehaviorClass = this.propIndex.get(key);
        if (BehaviorClass) {
          // Es un activador de behavior
          behaviors.set(BehaviorClass, { [key]: true });
          assigned.add(key);
        }
      }
    }

    // PASO 2: Asignar props restantes a behaviors activos
    for (const [key, value] of Object.entries(props)) {
      if (assigned.has(key)) continue;
      
      const BehaviorClass = this.propIndex.get(key);
      if (BehaviorClass && behaviors.has(BehaviorClass)) {
        // Esta prop pertenece a un behavior que ya está activo
        const config = behaviors.get(BehaviorClass)!;
        config[key] = value;
        assigned.add(key);
      }
    }

    return behaviors;
  }

  static isBehaviorProp(name: string): boolean {
    return this.allBehaviorProps.has(name);
  }

  static debug(): void {
    console.log('[PropertyRegistry] Props registradas:', 
      Array.from(this.propIndex.entries()).map(([k, v]) => `${k} -> ${v.name}`)
    );
  }
}
```

4. src/behaviors/decorators.ts (Nuevo)

El decorador @Behavior:

```typescript
import { PropertyRegistry } from './property-registry';
import { HOST_KEY } from './constants';

export function Behavior<T extends { new (...args: any[]): {} }>(target: T): T {
  // Registrar en el sistema global
  PropertyRegistry.register(target);
  
  // Podemos añadir metadata adicional aquí si es necesario
  return target;
}

export function Host(target: undefined, context: ClassFieldDecoratorContext<any, any>) {
  if (context.kind !== 'field') {
    throw new Error('@Host can only be used on class fields');
  }
  
  // Marcar esta clase para saber qué campo recibe el elemento host
  const ctor = context.constructor as any;
  if (!ctor[HOST_KEY]) {
    ctor[HOST_KEY] = context.name;
  }
}
```

Checkpoint de Compilación

Después de implementar esto, deberías poder hacer esto sin errores:
```
import { Behavior, Host, Prop } from './behaviors';
import { PropertyRegistry } from './behaviors/property-registry';

@Behavior
class TestBehavior {
  @Host el!: HTMLElement;
  @Prop() link: boolean = true;
  @Prop() activeClass?: string;
}

// Verificar registro
PropertyRegistry.debug(); 
// Debería imprimir: link -> TestBehavior, activeClass -> TestBehavior
```

¿Lograste que compile este primer paso sin errores? Una vez confirmado, pasamos al Paso 2: Modificar PropertyManager para usar resolve() y manejar el ciclo de vida correctamente.


Paso 2: PropertyManager Integrado y BindProps Adaptado.

Este paso hace que el sistema reconozca el nuevo flujo de "resolución múltiple" (un elemento puede tener varios behaviors) y separe limpiamente las props de behaviors de las props DOM.

Paso 2: PropertyManager y Props-Handler

1. src/components/property-manager.ts (Reemplazar completamente)

```typescript
import { PropertyRegistry } from '../behaviors/property-registry';
import { HOST_KEY } from '../behaviors/constants';

type Constructor = new (...args: any[]) => any;

export class PropertyManager {
  // Map: Element -> Map<BehaviorName, Instance>
  // Ejemplo: <a> -> Map { "Link" -> LinkInstance, "Tooltip" -> TooltipInstance }
  private instances = new Map<Element, Map<string, any>>();
  
  // Referencia al componente padre (para contexto de effects/DI si es necesario)
  private hostComponent: any;

  constructor(hostComponent?: any) {
    this.hostComponent = hostComponent;
  }

  /**
   * Punto de entrada principal. Analiza todas las props del elemento,
   * instancia los behaviors correspondientes, y devuelve qué props fueron consumidas.
   * 
   * @returns Set<string> con los nombres de todas las props que fueron manejadas por behaviors
   */
  attachBehaviors(el: Element, props: Record<string, any>): Set<string> {
    const behaviorMap = PropertyRegistry.resolve(props);
    const consumedProps = new Set<string>();

    for (const [BehaviorClass, config] of behaviorMap) {
      // El nombre del behavior es el nombre de la clase
      const behaviorName = BehaviorClass.name;
      
      this.attach(el, BehaviorClass, behaviorName, config);
      
      // Marcar como consumidas: el nombre del behavior (ej: 'link') + sus props
      const behaviorProps = this.getBehaviorPropNames(BehaviorClass);
      behaviorProps.forEach(prop => {
        if (props.hasOwnProperty(prop)) {
          consumedProps.add(prop);
        }
      });
    }

    return consumedProps;
  }

  /**
   * Ata un behavior específico a un elemento.
   */
  private attach(
    el: Element, 
    BehaviorClass: Constructor, 
    behaviorName: string,
    config: Record<string, any>
  ): void {
    // 1. Instanciar
    const instance = new BehaviorClass();

    // 2. Inyectar Host (@Host decorator)
    const hostPropName = (BehaviorClass as any)[HOST_KEY] as string | undefined;
    if (hostPropName) {
      instance[hostPropName] = el;
    }

    // 3. Asignar configuración (las props del JSX que corresponden a este behavior)
    // Object.assign activará los setters de @Prop del behavior
    Object.assign(instance, config);

    // 4. Guardar para cleanup posterior
    if (!this.instances.has(el)) {
      this.instances.set(el, new Map());
    }
    this.instances.get(el)!.set(behaviorName, instance);

    // 5. Inicializar
    if (typeof instance.onInit === 'function') {
      instance.onInit();
    }

    // Nota: Los @Effect en el behavior se activarán automáticamente 
    // cuando accedan a signals dentro de sus métodos, gracias a tu sistema de reactividad.
    // Si necesitas integración específica con el queueEffect del hostComponent, 
    // se añadiría aquí.
  }

  /**
   * Obtiene los nombres de todas las @Prop registradas en este behavior.
   */
  private getBehaviorPropNames(BehaviorClass: Constructor): Set<string> {
    const BEHAVIOR_PROPS = Symbol.for('behavior:props');
    const props = (BehaviorClass as any)[BEHAVIOR_PROPS] as Set<string> | undefined;
    return props ? new Set(props) : new Set();
  }

  /**
   * Obtiene una instancia de behavior específica de un elemento
   * (útil para debugging o interacción programática).
   */
  get<T>(el: Element, behaviorName: string): T | undefined {
    return this.instances.get(el)?.get(behaviorName);
  }

  /**
   * Desconecta todos los behaviors de todos los elementos.
   * Llamado desde disconnectedCallback del componente padre.
   */
  disconnectAll(): void {
    for (const [el, behaviors] of this.instances) {
      for (const [name, instance] of behaviors) {
        if (typeof instance.onDestroy === 'function') {
          try {
            instance.onDestroy();
          } catch (e) {
            console.error(`[Behavior ${name}] Error en onDestroy:`, e);
          }
        }
      }
    }
    this.instances.clear();
  }

  /**
   * Desconecta behaviors de un elemento específico (útil si el elemento se remueve del DOM
   * pero el componente padre sigue vivo).
   */
  disconnectElement(el: Element): void {
    const behaviors = this.instances.get(el);
    if (!behaviors) return;

    for (const [name, instance] of behaviors) {
      if (typeof instance.onDestroy === 'function') {
        instance.onDestroy();
      }
    }
    
    this.instances.delete(el);
  }
}
```

2. Modificación a src/jsx/dynamic/props-handler.ts

Cambia bindProps para usar el nuevo flujo de behaviors. Esto es crítico: primero resuelve behaviors, luego props DOM.

```typescript

import { PropertyManager } from '../../components/property-manager';
// ... otros imports

export function bindProps(
  el: Element, 
  props: Record<string, PropValue>,
  propertyManager?: PropertyManager
): void {
  // PASO 1: Procesar Behaviors primero (si hay PropertyManager)
  let domProps = props;
  
  if (propertyManager) {
    // attachBehaviors devuelve qué props fueron consumidas por behaviors
    const consumed = propertyManager.attachBehaviors(el, props);
    
    // Filtrar las props consumidas para no pasarlas al DOM
    if (consumed.size > 0) {
      domProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !consumed.has(key))
      );
    }
  }

  // PASO 2: Procesar props DOM (las que no son behaviors)
  Object.entries(domProps).forEach(([key, value]) => {
    bindSingleProp(el, key, value);
  });
}

// Elimina el parámetro propertyManager de bindSingleProp ya no es necesario aquí
function bindSingleProp(
  el: Element, 
  key: string, 
  value: PropValue
): void {
  // Lógica actual de eventos, className, style, signals...
  // (La parte de "PRIORITY 0: Try to attach as a registered Property" se elimina 
  // porque ahora lo maneja attachBehaviors arriba)
  
  if (key === "ref") {
    bindRefProp(el, value);
    return;
  }

  if (isEventProp(key)) {
    bindEventProp(el, key, value);
    return;
  }

  if (key === "className") {
    bindClassNameProp(el, value as ClassNameProp);
    return;
  }

  if (key === "style") {
    bindStyleProp(el, value as StyleProp);
    return;
  }

  // Tu lógica actual de signals/props...
  if (isSignal(value)) {
    bindSignalProp(el, key, value as Signal<any>);
  } else if (typeof value === "function") {
    bindComputedProp(el, key, value as Function);
  } else {
    bindStaticProp(el, key, value);
  }
}
```

3. Asegurar la exportación en src/behaviors/index.ts (Nuevo archivo)
