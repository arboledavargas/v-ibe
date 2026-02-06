/**
 * Symbol para almacenar metadata de props en las clases Behavior.
 * Usado por @Prop para registrar qué campos son props del behavior.
 */
export const BEHAVIOR_PROPS = Symbol('behavior:props');

/**
 * Symbol para marcar qué campo recibe el elemento host.
 * Usado por @Host para inyectar el elemento al que se adjunta el behavior.
 */
export const HOST_KEY = Symbol('behavior:host');

/**
 * Symbol para marcar qué campo recibe el componente host.
 * Usado por @ComponentHost para inyectar el componente que contiene el behavior.
 * Permite a behaviors acceder al contexto (@Ctx) del componente.
 */
export const COMPONENT_HOST_KEY = Symbol('behavior:componentHost');
