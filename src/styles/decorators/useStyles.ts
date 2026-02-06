import { BaseComponent } from "../../components/base-component";
import { BaseStyleSheet } from "../base-style-sheet";

type BaseComponentConstructor = new (...args: any[]) => BaseComponent;

export function UseStyles<StylesClass extends BaseStyleSheet>(
  StylesConstructor: new () => StylesClass,
) {
  return function <T extends BaseComponentConstructor>(
    target: T,
    context: ClassDecoratorContext<T>,
  ) {
    if (context.kind !== "class") {
      throw new Error(
        "@UseStyles solo puede aplicarse a clases de componentes.",
      );
    }

    // SOLUCIÓN: Interceptar el constructor en lugar de usar addInitializer
    return class extends target {
      constructor(...args: any[]) {
        super(...args);

        try {
          // Crear la instancia de la clase de estilos
          const stylesInstance = new StylesConstructor();
          // Establecer la conexión bidireccional
          stylesInstance.setHost(this);

          // Asignar la propiedad styles de manera explícita
          Object.defineProperty(this, "styles", {
            value: stylesInstance,
            writable: false,
            enumerable: true,
            configurable: false,
          });

        } catch (error) {
          console.error("❌ [UseStyles] Error inicializando estilos:", error);
        }
      }
    } as T;
  };
}
