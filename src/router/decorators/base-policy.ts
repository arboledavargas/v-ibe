import { Constructor } from "../../DI/types";

/**
 * Tipos de decisiones que una política puede tomar sobre una navegación.
 * Cada decorador corresponde a uno de estos tipos.
 */
export type PolicyDecisionType = 'allow' | 'block' | 'redirect' | 'skip';

/**
 * Representa una regla individual dentro de una política.
 * Una regla es un método decorado que puede tomar decisiones sobre navegación.
 */
export interface PolicyRule {
  /** Nombre del método (útil para debugging) */
  methodName: string | symbol;
  
  /** La función del método que se ejecutará */
  handler: Function;
  
  /** Qué tipo de decisión toma este método cuando retorna true */
  type: PolicyDecisionType;
}

/**
 * El resultado de evaluar una política.
 * Contiene información sobre qué se decidió y por qué.
 */
export interface PolicyDecision {
  /** Qué tipo de acción debe tomarse */
  type: PolicyDecisionType;
  
  /** Si alguna regla coincidió (retornó true) */
  matched: boolean;
  
  /** Nombre del método que tomó la decisión (si matched es true) */
  matchedRule?: string | symbol;
}

/**
 * Symbol privado para almacenar las reglas de política en la clase.
 * Usar un Symbol previene colisiones con propiedades del usuario.
 */
const POLICY_RULES = Symbol('policyRules');

/**
 * Helper para obtener las reglas almacenadas en una clase de política.
 * Este método es usado internamente por el evaluador de políticas.
 * 
 * @param policyClass El constructor de cualquier clase con métodos decorados
 * @returns Array de reglas en el orden que fueron declaradas
 */
export function getPolicyRules(policyClass: Constructor<any>): PolicyRule[] {
  return (policyClass as any)[POLICY_RULES] || [];
}

/**
 * Helper privado para agregar una regla a una clase de política.
 * Este método es llamado por los decoradores cuando se aplican.
 */
function addPolicyRule(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
  type: PolicyDecisionType
): void {
  const constructor = target.constructor;
  
  // Inicializar el array de reglas si no existe
  if (!constructor[POLICY_RULES]) {
    constructor[POLICY_RULES] = [];
  }
  
  // Crear la regla
  const rule: PolicyRule = {
    methodName: propertyKey,
    handler: descriptor.value,
    type: type
  };
  
  // Agregar la regla al array
  // El orden del array refleja el orden de declaración en el archivo
  constructor[POLICY_RULES].push(rule);
}

/**
 * Decorador @Allow()
 * 
 * Marca un método que, cuando retorna true, indica que la navegación
 * debe ser permitida. El componente se cargará y la ruta se activará.
 * 
 * El método puede ser síncrono o asíncrono.
 * Si retorna false o undefined, se considera que este método no tiene
 * opinión sobre la navegación y se continuará evaluando otros métodos.
 * 
 * @example
 * ```typescript
 * @Allow()
 * publicRoute() {
 *   return this.route.meta?.public === true;
 * }
 * ```
 */
export function Allow() {
  return function (
    target: Function,
    context: ClassMethodDecoratorContext
  ): void {
    context.addInitializer(function (this: any) {
      const descriptor = Object.getOwnPropertyDescriptor(this, context.name) || {
        value: target,
        writable: true,
        enumerable: true,
        configurable: true
      };
      addPolicyRule(Object.getPrototypeOf(this), context.name, descriptor, 'allow');
    });
  };
}

/**
 * Decorador @Block()
 * 
 * Marca un método que, cuando retorna true, indica que la navegación
 * debe ser bloqueada completamente. El componente no se cargará y el
 * router intentará el siguiente candidato si existe.
 * 
 * A diferencia de @Redirect(), este decorador no navega a ninguna otra ruta.
 * Simplemente detiene la navegación actual.
 * 
 * @example
 * ```typescript
 * @Block()
 * maintenanceMode() {
 *   return this.configService.isMaintenanceMode();
 * }
 * ```
 */
export function Block() {
  return function (
    target: Function,
    context: ClassMethodDecoratorContext
  ): void {
    context.addInitializer(function (this: any) {
      const descriptor = Object.getOwnPropertyDescriptor(this, context.name) || {
        value: target,
        writable: true,
        enumerable: true,
        configurable: true
      };
      addPolicyRule(Object.getPrototypeOf(this), context.name, descriptor, 'block');
    });
  };
}

/**
 * Decorador @Redirect()
 * 
 * Marca un método que, cuando retorna true, indica que ya ha manejado
 * la navegación mediante un redirect a otra ruta. El método debe llamar
 * a router.navigate() antes de retornar true.
 * 
 * El router detectará que el currentPath cambió durante la ejecución
 * y cancelará la navegación original.
 * 
 * @example
 * ```typescript
 * @Redirect()
 * redirectToLogin() {
 *   if (!this.authService.isAuthenticated()) {
 *     sessionStorage.setItem('return_url', this.router.currentPath);
 *     this.router.navigate('/login');
 *     return true;
 *   }
 *   return false;
 * }
 * ```
 */
export function Redirect() {
  return function (
    target: Function,
    context: ClassMethodDecoratorContext
  ): void {
    context.addInitializer(function (this: any) {
      const descriptor = Object.getOwnPropertyDescriptor(this, context.name) || {
        value: target,
        writable: true,
        enumerable: true,
        configurable: true
      };
      addPolicyRule(Object.getPrototypeOf(this), context.name, descriptor, 'redirect');
    });
  };
}

/**
 * Decorador @Skip()
 * 
 * Marca un método que puede explícitamente declarar que TODA LA POLÍTICA
 * no tiene opinión sobre una navegación particular retornando true.
 * 
 * Esto es diferente de simplemente retornar false (que continúa evaluando
 * otros métodos de la misma política). Cuando @Skip retorna true, se detiene
 * la evaluación de esta política completa y se pasa a la siguiente política
 * en la cadena.
 * 
 * Esto es crítico para la composición de políticas. Permite que una política
 * declare "yo no soy responsable de esta navegación, pregúntenle a otra política".
 * 
 * @example
 * ```typescript
 * @Skip()
 * onlyForAdminRoutes() {
 *   // Esta política solo se preocupa de rutas /admin/*
 *   // Para cualquier otra ruta, explícitamente nos abstenemos
 *   if (!this.router.currentPath.startsWith('/admin/')) {
 *     return true; // SKIP - no somos responsables de esto
 *   }
 *   
 *   // Si llegamos aquí, estamos en una ruta admin
 *   // Retornar false para continuar evaluando otros métodos de esta política
 *   return false;
 * }
 * 
 * @Allow()
 * adminWithPermission() {
 *   // Este método solo se ejecutará si onlyForAdminRoutes retornó false
 *   return this.user.hasPermission('admin');
 * }
 * ```
 * 
 * Caso de uso común: Políticas especializadas que solo aplican a ciertas rutas.
 * Por ejemplo, una AdminPolicy que solo se preocupa de rutas /admin/*, o una
 * ApiPolicy que solo se preocupa de rutas /api/*.
 */
export function Skip() {
  return function (
    target: Function,
    context: ClassMethodDecoratorContext
  ): void {
    context.addInitializer(function (this: any) {
      const descriptor = Object.getOwnPropertyDescriptor(this, context.name) || {
        value: target,
        writable: true,
        enumerable: true,
        configurable: true
      };
      addPolicyRule(Object.getPrototypeOf(this), context.name, descriptor, 'skip');
    });
  };
}


