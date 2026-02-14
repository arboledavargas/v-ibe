import { Service } from "../DI/decorators/service";
import { PolicyDecision, getPolicyRules, PolicyDecisionType } from "./decorators/base-policy";
import { RouteCandidate } from "./trie.types";
import { reactiveContext } from "../reactivity/reactive-context";

/**
 * Servicio que evalúa políticas ejecutando sus reglas decoradas en orden.
 *
 * El evaluador implementa la siguiente semántica:
 *
 * - Para @Allow, @Block, @Redirect:
 *   - Si el método retorna false/undefined: continuar al siguiente método
 *   - Si el método retorna true: ejecutar la acción y detener evaluación
 *
 * - Para @Skip:
 *   - Si el método retorna false: continuar al siguiente método
 *   - Si el método retorna true: esta política completa no opina,
 *     señalar al router que pase a la siguiente política en la cadena
 *
 * Esta semántica permite composición limpia de políticas donde cada una
 * puede explícitamente declinar opinar sobre ciertas navegaciones.
 */
@Service
export class PolicyEvaluator {

  /**
   * Evalúa una instancia de política ejecutando sus reglas decoradas en orden.
   *
   * @param policyInstance La instancia de la política a evaluar
   * @param signal Optional AbortSignal para cancelar la evaluación
   * @returns Una decisión sobre qué hacer con la navegación
   *
   * @example
   * ```typescript
   * const decision = await evaluator.evaluate(authPolicyInstance);
   *
   * if (decision.type === 'skip') {
   *   // Esta política no opina, intentar la siguiente
   * } else if (decision.type === 'allow') {
   *   // Permitir la navegación
   * } else if (decision.type === 'block') {
   *   // Bloquear la navegación
   * }
   * ```
   */
  async evaluate(policyInstance: any, signal?: AbortSignal): Promise<PolicyDecision> {
    // Obtener las reglas de la clase de esta instancia
    const rules = getPolicyRules(policyInstance.constructor as any);

    // Si no hay reglas, la política no tiene opinión
    if (rules.length === 0) {
      return {
        type: 'skip',
        matched: false
      };
    }

    // Evaluar cada regla en orden hasta que una coincida
    for (const rule of rules) {
      // Verificar abort antes de cada regla
      if (signal?.aborted) {
        return {
          type: 'block',
          matched: false
        };
      }

      try {
        // Ejecutar el método en el contexto de la instancia
        const result = rule.handler.call(policyInstance);

        // El resultado puede ser un booleano directo o una Promise<boolean>
        const resolvedResult = await Promise.resolve(result);

        // Si el método retornó false/undefined, continuar al siguiente
        if (!resolvedResult) {
          continue;
        }

        // El método retornó true - esta regla coincidió
        // La semántica depende del tipo de decorador

        if (rule.type === 'skip') {
          // @Skip retornó true = esta política completa se abstiene
          // Señalar que se debe pasar a la siguiente política en la cadena
          return {
            type: 'skip',
            matched: true,
            matchedRule: rule.methodName
          };
        }

        // Para @Allow, @Block, @Redirect: retornar la decisión
        return {
          type: rule.type,
          matched: true,
          matchedRule: rule.methodName
        };

      } catch (error) {
        // Si un método de política lanza un error, loguearlo
        // y tratarlo como un @Block por seguridad
        console.error(
          `Error in policy rule '${String(rule.methodName)}':`,
          error
        );

        return {
          type: 'block',
          matched: true,
          matchedRule: rule.methodName
        };
      }
    }

    // Ninguna regla coincidió (todas retornaron false)
    // Esto significa que la política no tiene opinión sobre esta navegación
    return {
      type: 'skip',
      matched: false
    };
  }

  /**
   * Evalúa una cadena de políticas en orden hasta que una tome una decisión.
   *
   * Este método implementa la composición de políticas:
   * - Si una política retorna 'skip' (o ninguna regla coincide), pasa a la siguiente
   * - Si una política retorna 'allow', 'block', o 'redirect', se detiene y retorna esa decisión
   * - Si todas las políticas hacen skip, retorna la decisión por defecto
   *
   * @param policyInstances Array de instancias de políticas a evaluar en orden
   * @param defaultDecision La decisión a tomar si todas las políticas hacen skip (default: allow)
   * @param signal Optional AbortSignal para cancelar la evaluación
   * @returns La decisión tomada por la primera política que no hizo skip
   *
   * @example
   * ```typescript
   * const decision = await evaluator.evaluateChain([
   *   authPolicyInstance,
   *   featureFlagPolicyInstance,
   *   rolePolicyInstance
   * ]);
   * ```
   */
  async evaluateChain(
    policyInstances: any[],
    defaultDecision: PolicyDecisionType = 'allow',
    signal?: AbortSignal
  ): Promise<PolicyDecision> {

    console.log(`[PolicyEvaluator] Evaluating chain of ${policyInstances.length} policies`);

    // Evaluar cada política en orden

    for (const policyInstance of policyInstances) {
      const policyName = policyInstance.constructor.name;
      console.log(`[PolicyEvaluator] Evaluating policy: ${policyName}`);

      // Si fue abortado, detener la evaluación
      if (signal?.aborted) {
        console.log('[PolicyEvaluator] Signal aborted, stopping chain evaluation');
        return {
          type: 'block',
          matched: false
        };
      }

      const decision = await this.evaluate(policyInstance, signal);
      console.log(`[PolicyEvaluator] Policy ${policyName} decision: ${decision.type}${decision.matched ? ` (matched rule: ${String(decision.matchedRule)})` : ''}`);

      // Si la política no hizo skip, retornar su decisión
      if (decision.type !== 'skip') {
        console.log(`[PolicyEvaluator] Chain stopped at policy ${policyName} with decision: ${decision.type}`);
        return decision;
      }
    }

    // Todas las políticas hicieron skip, usar la decisión por defecto
    console.log(`[PolicyEvaluator] All policies skipped, using default decision: ${defaultDecision}`);
    return {
      type: defaultDecision,
      matched: false
    };
  }

  /**
   * Evalúa una lista de candidatos y retorna el primero que pase las policies.
   *
   * Este método maneja:
   * - Candidatos sin policies (permitir por defecto)
   * - Instanciación de policies desde el DI container
   * - Inyección de metadata
   * - Evaluación secuencial hasta encontrar un allow
   *
   * @param candidates Lista de candidatos a evaluar
   * @param signal Optional AbortSignal para cancelar
   * @returns Decisión con el candidato ganador o block/redirect
   */
  async evaluateCandidates(
    candidates: readonly RouteCandidate[],
    signal?: AbortSignal
  ): Promise<PolicyDecision & { candidate?: RouteCandidate }> {
    for (const candidate of candidates) {
      if (signal?.aborted) {
        return { type: 'block', matched: false };
      }

      // Si no hay policies, permitir por defecto
      if (!candidate.policies || candidate.policies.length === 0) {
        console.log(`[PolicyEvaluator] No policies for ${candidate.path}, allowing by default`);
        return {
          type: 'allow',
          matched: true,
          candidate
        };
      }

      // Obtener instancias de policies desde DI
      const policyInstances = candidate.policies.map(PolicyClass => {
        const instance = (this as any).__container.get(PolicyClass);

        // Inyectar metadata si existe
        if (candidate.metadata) {
          (instance as any).__routeMetadata = candidate.metadata;
        }

        return instance;
      });

      // 🎯 CRÍTICO: Evaluar policies SIN tracking
      // Las policies pueden leer router.currentPath, authService signals, etc.
      // Si trackeamos esas lecturas, causamos infinite loops
      const decision = await reactiveContext.untrack(async () => {
        return await this.evaluateChain(policyInstances, 'allow', signal);
      });

      // Si permite, este candidato gana
      if (decision.type === 'allow') {
        return {
          ...decision,
          candidate
        };
      }

      // Si redirect, detener inmediatamente
      if (decision.type === 'redirect') {
        return decision;
      }

      // Si block o skip, intentar siguiente candidato
    }

    // Ningún candidato pasó
    return { type: 'block', matched: false };
  }
}
