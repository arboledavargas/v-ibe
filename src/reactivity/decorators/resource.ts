import { IResource } from "../signals/resource";

export const RESOURCE_PROPERTY_KEYS = Symbol("ResourcePropertyKeys");

/**
 * Tipo para la función source que obtiene los datos del resource.
 * Recibe un AbortSignal como primer parámetro que puede usarse para cancelar
 * la operación si el resource necesita refetch antes de que complete.
 */
type ResourceSourceFn<Ctx extends object, T> = (
  this: Ctx,
  signal: AbortSignal
) => Promise<T>;

/**
 * Metadata interna que guarda el framework sobre cada resource.
 */
export interface ResourceMetadata<T = any> {
  key: string | symbol;
  source: ResourceSourceFn<any, T>;
}

/**
 * Decorador @Resource para crear propiedades reactivas que cargan datos asíncronos.
 *
 * La función source recibe un AbortSignal como primer parámetro que debe pasarse
 * a cualquier operación asíncrona que soporte cancelación. Esto permite que el
 * framework cancele automáticamente operaciones obsoletas cuando las dependencias
 * del resource cambian.
 *
 * @example
 * // Resource con fetch cancelable
 * @Resource((signal) =>
 *   fetch('/api/user', { signal }).then(r => r.json())
 * )
 * userResource!: IResource<User>;
 *
 * @example
 * // Resource que usa el signal en operaciones personalizadas
 * @Resource((signal) => {
 *   return new Promise((resolve, reject) => {
 *     signal.addEventListener('abort', () => {
 *       reject(new Error('Operation cancelled'));
 *     });
 *
 *     // Tu lógica asíncrona aquí
 *     fetchDataSomehow().then(resolve);
 *   });
 * })
 * dataResource!: IResource<Data>;
 *
 * @param source Función que recibe un AbortSignal y retorna una Promise con los datos
 */
export function Resource<Ctx extends object, T>(
  source: ResourceSourceFn<Ctx, T>
) {
  return function (
    target: undefined,
    context: ClassFieldDecoratorContext<Ctx, IResource<T>>,
  ) {
    if (context.kind !== "field") {
      throw new Error(
        "@Resource solo se puede aplicar a campos de clase.",
      );
    }

    const metadata = context.metadata as any;
    metadata.resourceKeys ??= [];
    metadata.resourceKeys.push({
      key: context.name,
      source: source,
    });
  };
}
