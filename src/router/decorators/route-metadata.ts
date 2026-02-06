// decorators/route-metadata.ts

const METADATA_KEY = Symbol('routeMetadata');

/**
 * Decorador sobrecargado para inyectar metadata de la ruta.
 *
 * Uso sin parámetros: @RouteMetadata metadata!: Record<string, any>;
 * Inyecta toda la metadata de la ruta.
 *
 * Uso con key: @RouteMetadata('role') role!: string;
 * Inyecta solo el valor específico de la metadata.
 */
export function RouteMetadata(): (value: undefined, context: ClassFieldDecoratorContext) => void;
export function RouteMetadata(key: string): (value: undefined, context: ClassFieldDecoratorContext) => void;
export function RouteMetadata(key?: string) {
  return function (value: undefined, context: ClassFieldDecoratorContext) {
    if (context.kind !== "field") {
      throw new Error("@RouteMetadata can only be used on fields");
    }

    context.addInitializer(function (this: any) {
      Object.defineProperty(this, context.name, {
        enumerable: true,
        configurable: true,
        get() {
          const metadata = (this as any).__routeMetadata || {};

          // Si se especificó una key, retornar solo ese valor
          if (key !== undefined) {
            return metadata[key];
          }

          // Si no, retornar toda la metadata
          return metadata;
        }
      });
    });
  };
}
