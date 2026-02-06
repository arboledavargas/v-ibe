import { Subscriber } from "./types";

// Tipo para el callback que se ejecuta cuando una signal es trackeada
export type OnTrackCallback = (signal: any) => void;

/**
 * ReactiveFrame - Representa un nivel en el stack de contextos reactivos
 * 
 * Cada frame contiene toda la información necesaria para ese contexto:
 * - computation: El subscriber (effect/computed) que debe recibir suscripciones
 * - tracking: Si el tracking está activo (lecturas de signals crean suscripciones)
 * - type: El tipo de contexto (para debugging y semántica)
 */
export interface ReactiveFrame {
  computation: Subscriber | null;
  tracking: boolean;
  type: 'effect' | 'computed' | 'untrack' | 'batch' | 'legacy';
}

/**
 * ReactiveContext - Gestiona el contexto reactivo usando un STACK UNIFICADO
 * 
 * ARQUITECTURA (POST-FIX):
 * - Un solo stack que contiene todo el estado de contexto
 * - Cada operación (effect, computed, untrack) push/pop un frame
 * - Elimina la ambigüedad de dos stacks con prioridades conflictivas
 * - Garantiza que effects anidados dentro de untrack tengan su propio contexto
 * 
 * PROBLEMA QUE RESUELVE:
 * El sistema anterior tenía dos stacks (computationStack y contextStack)
 * donde contextStack tenía prioridad. Esto causaba que effects creados
 * dentro de untrack() usaran la computation del padre en lugar de la propia.
 */
class ReactiveContext {
  /**
   * Stack unificado de contextos reactivos
   * El último frame (top) es siempre el contexto actual
   */
  private stack: ReactiveFrame[] = [];

  // Callback que se ejecuta cuando una signal es trackeada durante get()
  // Usado por Computed para llevar registro de sus dependencias (_sources)
  public onTrack: OnTrackCallback | null = null;

  // --- API Principal (Nueva) ---

  /**
   * Entra a un nuevo contexto reactivo.
   * Retorna una función para salir del contexto (dispose).
   * 
   * @param computation - El subscriber que recibirá suscripciones
   * @param tracking - Si el tracking está activo
   * @param type - Tipo de contexto (para debugging)
   * @returns Función dispose para salir del contexto
   * 
   * @example
   * const exit = reactiveContext.enter(computation, true, 'effect');
   * try {
   *   // código reactivo...
   * } finally {
   *   exit();
   * }
   */
  enter(computation: Subscriber | null, tracking: boolean, type: ReactiveFrame['type']): () => void {
    this.stack.push({ computation, tracking, type });
    let disposed = false;
    return () => {
      if (!disposed) {
        disposed = true;
        this.exit();
      }
    };
  }

  /**
   * Sale del contexto actual (pop del stack)
   * 
   * NOTA: No lanza error si el stack está vacío.
   * Esto es intencional para manejar casos donde:
   * 1. Tests limpian el stack manualmente
   * 2. Async effects intentan cerrar contexto después de cleanup
   */
  exit(): void {
    if (this.stack.length === 0) {
      // No hacer nada si el stack está vacío
      // Esto puede ocurrir cuando:
      // - Tests limpian el stack en beforeEach/afterEach
      // - Async effects intentan cerrar después de dispose
      return;
    }
    this.stack.pop();
  }

  // --- Getters Principales ---

  /**
   * Obtiene la computación actual del contexto.
   * Si hay un frame en el stack, retorna su computation.
   * Si el stack está vacío, retorna null.
   */
  public get currentComputation(): Subscriber | null {
    if (this.stack.length === 0) {
      return null;
    }
    return this.stack[this.stack.length - 1].computation;
  }

  /**
   * Obtiene el estado de tracking actual.
   * Si hay un frame en el stack, retorna su tracking.
   * Si el stack está vacío, retorna false (no tracking por defecto).
   */
  public get isTracking(): boolean {
    if (this.stack.length === 0) {
      return false;
    }
    return this.stack[this.stack.length - 1].tracking;
  }

  // --- Método Utilitario ---

  /**
   * Ejecuta una función sin tracking.
   * Útil para operaciones que no deben crear suscripciones.
   * 
   * @param fn - Función a ejecutar sin tracking
   * @returns El resultado de la función
   */
  public untrack<T>(fn: () => T): T {
    // Crear un nuevo frame con tracking=false pero manteniendo la computation actual
    // Esto permite que efectos hijos creen sus propios contextos
    const exit = this.enter(this.currentComputation, false, 'untrack');
    try {
      return fn();
    } finally {
      exit();
    }
  }

  // --- API de Compatibilidad (Deprecated pero funcional) ---

  /**
   * @deprecated Usar enter() en su lugar
   * Push un contexto al stack (para compatibilidad)
   */
  pushContext(computation: Subscriber | null, tracking: boolean): void {
    this.stack.push({ computation, tracking, type: 'legacy' });
  }

  /**
   * @deprecated Usar exit() en su lugar
   * Pop del stack (para compatibilidad)
   * @throws Error si el stack está vacío (para compatibilidad con tests)
   */
  popContext(): void {
    if (this.stack.length === 0) {
      throw new Error('Cannot pop context: stack is empty');
    }
    this.stack.pop();
  }

  /**
   * @deprecated Usar enter() en su lugar
   * Agrega una computation al contexto (para compatibilidad con computed.ts)
   */
  pushComputation(comp: Subscriber): void {
    // En el sistema unificado, esto crea un nuevo frame con tracking=true
    this.stack.push({ computation: comp, tracking: true, type: 'computed' });
  }

  /**
   * @deprecated El sistema unificado no necesita esto
   * Intenta remover una computation (no-op en el nuevo sistema)
   * Nota: En el sistema unificado, el context se maneja via push/pop,
   * no necesitamos remover computaciones específicas.
   */
  removeComputation(computationToRemove: Subscriber): void {
    // En el sistema antiguo, esto removía del computationStack.
    // En el sistema unificado, no tiene efecto directo.
    // Los contexts se limpian automáticamente via exit()/popContext().
    // 
    // Mantenemos este método vacío para compatibilidad,
    // pero el cleanup real se hace en exit().
  }

  /**
   * @deprecated Usar enter() con tracking específico
   * Modifica el tracking del frame actual (para compatibilidad)
   */
  setTracking(tracking: boolean): void {
    // En el sistema antiguo, esto modificaba el contextStack.
    // En el sistema unificado, modificamos el frame actual.
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].tracking = tracking;
    }
  }

  // --- Métodos de Debug/Testing ---

  /**
   * @internal - Solo para testing
   * Obtiene el tamaño del stack
   */
  getContextStackSize(): number {
    return this.stack.length;
  }

  /**
   * @internal - Solo para testing/compatibilidad
   * En el sistema unificado, esto es equivalente a getContextStackSize
   */
  getComputationStackSize(): number {
    return this.stack.length;
  }

  /**
   * @internal - Solo para testing/debugging
   * Obtiene una copia del stack actual (para inspección)
   */
  getStackSnapshot(): ReactiveFrame[] {
    return [...this.stack];
  }

  /**
   * @internal - Solo para testing
   * Limpia completamente el stack (útil en beforeEach de tests)
   */
  clearStack(): void {
    this.stack = [];
  }

  // --- Compatibilidad con tests que acceden a propiedades privadas ---

  /**
   * @internal - Solo para compatibilidad con tests existentes
   * Getter/setter para simular el computationStack antiguo
   */
  get computationStack(): Subscriber[] {
    // Retorna las computations de todos los frames (para compatibilidad)
    return this.stack
      .filter(f => f.computation !== null)
      .map(f => f.computation!);
  }

  set computationStack(value: Subscriber[]) {
    // Reset del stack para tests
    this.stack = [];
  }

  /**
   * @internal - Solo para compatibilidad con tests existentes
   * Getter/setter para simular el contextStack antiguo
   */
  get contextStack(): Array<{ computation: Subscriber | null; tracking: boolean }> {
    return this.stack.map(f => ({ computation: f.computation, tracking: f.tracking }));
  }

  set contextStack(value: Array<{ computation: Subscriber | null; tracking: boolean }>) {
    // Reset del stack para tests
    this.stack = [];
  }
}

export const reactiveContext = new ReactiveContext();
