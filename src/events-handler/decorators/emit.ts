// emit.ts

/**
 * Configuración opcional para el decorador @Emit
 */
export interface EmitOptions {
  /** Nombre personalizado del evento. Si no se especifica, se infiere del nombre del método */
  eventName?: string;
  /** Si el evento debe burbujear (bubble) por el DOM tree. Por defecto: true */
  bubbles?: boolean;
  /** Si el evento puede ser cancelado. Por defecto: true */
  cancelable?: boolean;
  /** Si se debe retornar el CustomEvent creado para permitir verificar preventDefault(). Por defecto: false */
  returnEvent?: boolean;
}

/**
 * @Emit es un decorador para métodos que automáticamente convierte su valor
 * de retorno en un CustomEvent que se despacha desde el componente.
 *
 * Ejemplo de uso:
 * @Emit
 * onUserSelect() {
 *   return { name: this.name, id: this.id };
 * }
 *
 * Esto automáticamente:
 * 1. Crea un CustomEvent llamado 'userselect'
 * 2. Coloca el objeto retornado en event.detail
 * 3. Despacha el evento desde el elemento del componente
 */
export function Emit(options: EmitOptions = {}) {
  // Función factory que retorna el decorador real
  return function <This extends HTMLElement, Return>(
    target: (this: This, ...args: any[]) => Return,
    context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: any[]) => Return
    >,
  ) {
    // Validación: solo se puede aplicar a métodos
    if (context.kind !== "method") {
      throw new Error("@Emit solo se puede aplicar a métodos de clase.");
    }

    // Inferir el nombre del evento desde el nombre del método
    const methodName = String(context.name);
    const defaultEventName = inferEventName(methodName);

    // Aplicar configuración con valores por defecto
    const config: Required<EmitOptions> = {
      eventName: options.eventName ?? defaultEventName,
      bubbles: options.bubbles ?? true,
      cancelable: options.cancelable ?? true,
      returnEvent: options.returnEvent ?? false,
    };

    // Usar addInitializer para modificar el comportamiento del método después
    // de que la clase esté completamente construida
    context.addInitializer(function (this: This) {
      const originalMethod = target;

      // Crear el método mejorado que emite eventos
      const enhancedMethod = function (this: This, ...args: any[]) {
        // Ejecutar el método original para obtener los datos
        const eventData = originalMethod.call(this, ...args);

        // Crear el CustomEvent con los datos retornados
        const customEvent = new CustomEvent(config.eventName, {
          detail: eventData,
          bubbles: config.bubbles,
          cancelable: config.cancelable,
        });

        // Despachar el evento desde el elemento del componente
        this.dispatchEvent(customEvent);

        // Si se configuró returnEvent, retornar el evento para permitir
        // verificar si fue cancelado con preventDefault()
        if (config.returnEvent) {
          return customEvent;
        }

        // Por defecto, retornar los datos originales para mantener
        // compatibilidad con código que espere el valor de retorno original
        return eventData;
      };

      // Reemplazar el método original con el mejorado en la instancia
      // Esto se hace directamente en la instancia para preservar 'this' binding
      Object.defineProperty(this, context.name, {
        value: enhancedMethod,
        writable: true,
        enumerable: false, // No mostrar en enumeraciones
        configurable: true, // Permitir futuras modificaciones si es necesario
      });
    });
  };
}

/**
 * Función auxiliar que convierte el nombre de un método en un nombre de evento
 * siguiendo convenciones estándar
 *
 * Ejemplos:
 * - onUserSelect -> userselect
 * - handleClick -> handleclick
 * - userSelected -> userselected
 * - onClick -> click (caso especial, remueve el 'on')
 */
function inferEventName(methodName: string): string {
  // Caso especial: si el método empieza con 'on' seguido de mayúscula,
  // remover el 'on' y convertir a minúsculas
  if (methodName.startsWith("on") && methodName.length > 2) {
    const thirdChar = methodName.charAt(2);
    if (thirdChar === thirdChar.toUpperCase()) {
      // Remueve 'on' y convierte el resto a lowercase
      return methodName.substring(2).toLowerCase();
    }
  }

  // Para todos los otros casos, simplemente convertir a minúsculas
  // Esto permite flexibilidad en la nomenclatura de métodos
  return methodName.toLowerCase();
}
