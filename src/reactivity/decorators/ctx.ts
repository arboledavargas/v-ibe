import { ISignal, Signal, isSignal } from "../signals/signal";
import { derived } from "../signals/derived";
import { AppTree } from "../../components/app-tree";

// Type for pending context initializers
type ContextInitializer = () => void;

/**
 * @Ctx es un decorador que crea una propiedad reactiva contextual.
 * La propiedad hereda su valor del primer componente padre que provea
 * un contexto con el mismo nombre. Si no encuentra un padre, usa su
 * valor inicial.
 *
 * @param mapper Una función opcional para transformar el valor recibido del padre.
 */
export function Ctx<This extends object, Value>(
  mapper?: (value: Value | undefined, self: This) => Value,
) {
  // El decorador real que se aplica al campo de la clase.
  return function (
    target: undefined,
    context: ClassFieldDecoratorContext<This, Value>,
  ): (this: This, initialValue: Value) => Value {
    if (context.kind !== "field") {
      throw new Error("@Ctx solo se puede aplicar a campos de clase.");
    }

    const propName = context.name;
    const signalPropName = `\$${String(propName)}`; // ej: $level

    // La función inicializadora que se ejecuta cuando se crea una instancia de la clase.
    return function (this: This, initialValue: Value): Value {
      const self = this as any;

      // Variables para la inicialización diferida
      let finalSignal: ISignal<Value> | null = null;
      let isContextInitialized = false;

      const safeMapper = (v: any) => (mapper ? mapper(v, self) : v);

      // Función que inicializa el contexto (se ejecuta después de que appNode esté disponible)
      const initializeContext = (): void => {
        if (isContextInitialized) return;

        // 1. Obtener el nodo padre desde el appNode de la instancia
        const currentAppNode = self.appNode;
        const parentNode = currentAppNode?.parent;

        // 2. Usar la lógica centralizada de AppTree para encontrar la señal fuente.
        const sourceSignal = AppTree.findContextSignalFor(
          signalPropName,
          parentNode,
        );

        // 3. Crear la señal final
        if (sourceSignal) {
          finalSignal = derived(sourceSignal as ISignal<Value>, safeMapper);
        } else {
          const mappedInitialValue = safeMapper(initialValue);
          finalSignal = new Signal(mappedInitialValue);
        }

        // La propiedad interna '$' que expone la señal para los hijos
        Object.defineProperty(self, signalPropName, {
          get: () => finalSignal!,
          enumerable: false, // No queremos que aparezca en un `for...in`
          configurable: true,
        });

        // Redefinir la propiedad pública con la lógica correcta
        const propertyDescriptor: PropertyDescriptor = {
          get: () => finalSignal!.get(),
          enumerable: true,
          configurable: true,
          set: (newValue: Value) => {
            // Solo permitir set si es un proveedor raíz (no tiene sourceSignal)
            const currentAppNode = self.appNode;
            const parentNode = currentAppNode?.parent;
            const sourceSignal = AppTree.findContextSignalFor(
              signalPropName,
              parentNode,
            );

            if (!sourceSignal) {
              finalSignal!.set(newValue);
            }
            // Si tiene sourceSignal, ignorar el set (es read-only)
          },
        };

        Object.defineProperty(self, propName, propertyDescriptor);
        isContextInitialized = true;
      };

      // Registrar el inicializador para ejecución posterior
      if (!self._pendingContextInitializers) {
        self._pendingContextInitializers = [];
      }
      self._pendingContextInitializers.push(initializeContext);

      // Definir temporalmente la propiedad con getter/setter que indican que no está inicializada
      Object.defineProperty(self, propName, {
        get: () => {
          if (!isContextInitialized) {
            throw new Error(
              `Context property '${String(propName)}' accessed before context initialization. ` +
                `Make sure the component is properly initialized via JSX.`,
            );
          }
          return finalSignal!.get();
        },
        enumerable: true,
        configurable: true,
        set: (newValue: Value) => {
          if (!isContextInitialized) {
            // Durante la construcción, almacenar el valor inicial sin hacer nada más
            // Esto evita el timing issue mientras permitimos la asignación
            return;
          }

          // Lógica normal de set después de la inicialización
          const currentAppNode = self.appNode;
          const parentNode = currentAppNode?.parent;
          const sourceSignal = AppTree.findContextSignalFor(
            signalPropName,
            parentNode,
          );

          if (!sourceSignal) {
            finalSignal!.set(newValue);
          }
        },
      });

      // Retornar el valor inicial mapeado para que la instancia se construya correctamente
      return safeMapper(initialValue);
    };
  };
}
