// En effect.ts

import { effect } from "../signals/effect";

/**
 * @Effect es un decorador para métodos que los convierte en una operación reactiva.
 * El método se ejecutará una vez inicialmente y luego cada vez que una de las
 * señales de las que depende cambie su valor.
 * 
 * Para componentes (BaseComponent), los efectos se difieren hasta después de la
 * inicialización completa para que las dependencias inyectadas estén disponibles.
 */
export function Effect<This extends object>(
  target: (this: This, onCleanup: (cb: () => void) => void) => void,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, onCleanup: (cb: () => void) => void) => void
  >,
): void {
  if (context.kind !== "method") {
    throw new Error("@Effect solo se puede aplicar a métodos de clase.");
  }

  context.addInitializer(function (this: This) {
    const userMethod = target;
    const instance = this as any;

    // Creamos una nueva función que servirá como puente.
    // El motor de `effect` llamará a esta función con `onCleanup`.
    const effectRunner = (onCleanup: (cb: () => void) => void) => {
      // Nosotros, a su vez, llamamos al método original del usuario
      // usando el contexto correcto (`this`) y le pasamos `onCleanup`.
      userMethod.call(this, onCleanup);
    };

    // Función que registra el efecto
    const registerEffect = () => {
      effect(effectRunner);
    };

    // Si es un componente con soporte para efectos diferidos, usar ese sistema
    // Esto resuelve el problema de timing donde @Effect se ejecuta antes de @Provide
    if (typeof instance.queueEffect === 'function') {
      instance.queueEffect(registerEffect);
    } else {
      // Fallback: usar queueMicrotask para clases que no son componentes
      queueMicrotask(registerEffect);
    }
  });
}
