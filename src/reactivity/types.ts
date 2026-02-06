export type EffectPriority = "Sync" | "Frame" | "Idle";

export interface Subscriber extends Function {
  priority?: EffectPriority;
  /**
   * Marca que indica si este subscriber es una computación (Computed)
   * que debe ejecutarse síncronamente para evitar glitches.
   * 
   * - true: Es un Computed, ejecutar síncronamente
   * - false/undefined: Es un Effect, agendar en scheduler
   */
  _isComputation?: boolean;
}
