import { Component } from "../components/decorators/component";
import { Inject } from "../DI/decorators/inject";
import { Router } from "./router";
import { BaseComponent } from "../components/base-component";
import { Constructor } from "../DI/types";
import { Ctx } from "../reactivity/decorators/ctx";
import { Prop } from "../components/decorators/prop";
import { Resource } from '../reactivity/decorators/resource';
import { IResource } from '../reactivity/signals/resource';
import { Computed } from "../reactivity/decorators/computed";
import { Effect } from "../reactivity/decorators/effect";
import { Show } from "../custom-components/show";
import { PolicyEvaluator } from "./policy-evaluator";
import { RouteCandidate } from "./trie.types";

const EMPTY_ARRAY: readonly RouteCandidate[] = [];

@Component()
export class RouteView extends BaseComponent {

  @Inject(Router)
  router!: Router;

  @Inject(PolicyEvaluator)
  policyEvaluator!: PolicyEvaluator;

  @Prop
  routeSlot?: string;

  @Ctx(v => (v === undefined ? 0 : v + 1))
  navigationLevel!: number;

  /**
   * Contexto que mantiene el historial de slots desde la raíz hasta el nivel actual.
   * Cada RouteView agrega su slot al array, preservando el historial de los padres.
   *
   * Ejemplo: ['@main', '@sidebar', '@panel']
   *
   * Los componentes pueden acceder a este array para saber:
   * - En qué slot se renderizaron (último elemento)
   * - Toda la cadena de slots desde la raíz
   */
  @Ctx((parentSlots: string[] | undefined, self: RouteView): string[] => {
    const slots = parentSlots ? [...parentSlots] : [];

    // Agregar el slot actual si existe
    if (self.routeSlot) {
      slots.push(self.routeSlot);
    }

    return slots;
  })
  slotPath!: string[];

  /**
   * Contexto que provee el patrón de ruta base desde la cual se renderiza este nivel.
   * Los componentes y behaviors hijos pueden usar esta ruta base para resolver rutas relativas.
   *
   * Se actualiza reactivamente cuando cambian los candidatos de este nivel.
   * Los hijos heredan este valor de forma reactiva (señal derivada).
   *
   * Ejemplo: Si este RouteView renderiza "/store/:storeId", los links hijos
   * que usen "sales" se resolverán como "/store/:storeId/sales" (con params resueltos)
   */
  @Ctx()
  routeBasePath: string = '/';


  /**
  * Computed que retorna los candidatos para este nivel de navegación,
  * filtrados por el slot especificado en la prop routeSlot.
  *
  * Solo se re-ejecuta cuando cambian los candidatos de ESTE nivel específico.
  * Esto es granularidad perfecta: cambios en otros niveles NO afectan este computed.
  */
  @Computed
  get levelCandidates(): readonly RouteCandidate[] {
    const level = this.navigationLevel;
    const candidates = this.router.$routeCandidates[level];

    // Si es undefined, retornar array vacío
    if (candidates === undefined) {
      return EMPTY_ARRAY;
    }

    if (!candidates || candidates.length === 0) {
      return EMPTY_ARRAY;
    }

    // Filtrar candidatos según el slot
    const filtered = candidates.filter(candidate => {
      // Si RouteView NO tiene routeSlot (slot por defecto)
      if (!this.routeSlot) {
        // Solo tomar candidatos que NO tengan slot definido
        return !candidate.slot;
      }

      // Si RouteView tiene routeSlot, debe coincidir exactamente
      return candidate.slot === this.routeSlot;
    });

    return filtered.length > 0 ? filtered : EMPTY_ARRAY;
  }

  /**
   * Effect que sincroniza routeBasePath con los candidatos actuales.
   * Se ejecuta automáticamente cuando cambian los candidatos de este nivel.
   *
   * Si hay candidatos, actualiza routeBasePath con el path del primer candidato.
   * Si no hay candidatos, mantiene el valor actual (que puede ser '/' o heredado).
   */
  @Effect
  private syncRouteBasePath(): void {
    const candidates = this.levelCandidates;

    // Solo actualizar si hay candidatos en este nivel
    if (candidates && candidates.length > 0) {
      this.routeBasePath = candidates[0].path;
    }
  }

  /**
  * Resource que carga el componente asociado
  * SOLO cuando cambia el segmento de este nivel
  * Evalúa policies de todos los candidatos y toma el primero que pase
  */
  @Resource(async function (this: RouteView, signal) {
    try {
      // Acceder a levelCandidates crea una dependencia reactiva
      const candidates = this.levelCandidates;

      // Verificar si candidates existe y tiene elementos
      if (!candidates || candidates.length === 0) {
        return null;
      }

      // Evaluar todos los candidatos a través del PolicyEvaluator
      // Esto retorna el primer candidato que pase las políticas
      const decision = await this.policyEvaluator.evaluateCandidates(candidates, signal);

      // Si ningún candidato pasó las políticas, retornar null
      if (!decision.candidate) {
        console.log('[RouteView] No candidate passed policy evaluation');
        return null;
      }

      // Cargar el módulo del candidato ganador
      const candidate = decision.candidate;
      const module = await candidate.loader(signal);

      if (module?.default) {
        return module.default as Constructor;
      }
    } catch (err) {
      console.error('[RouteView] Error loading component:', err);
    }

    return null;
  })
  componentClass!: IResource<any>;

  view() {
    return (
      <>
        {/* Estado: Pending (Cargando) */}
        <Show when={() => this.componentClass.state === 'pending'}>
          {() => <div>Cargando...</div>}
        </Show>

        {/* Estado: Error */}
        <Show when={() => this.componentClass.state === 'error'}>
          {() => (
            <div>
              Error al cargar la página:{' '}
              {this.componentClass.error}
            </div>
          )}
        </Show>

        {/* Estado: Ready - Renderizar el componente cargado o null si fue bloqueado */}
        <Show when={() => this.componentClass.state === 'ready'}>
          {() => this.jsx(this.componentClass.get() ?? null, {})}
        </Show>
      </>
    );
  }

}
