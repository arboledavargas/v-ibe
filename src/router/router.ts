import { Inject } from "../DI/decorators/inject";
import { Service } from "../DI/decorators/service";
import { State } from "../reactivity/decorators/state";
import { Effect } from "../reactivity/decorators/effect";
import { Computed } from "../reactivity/decorators/computed";
import { Trie } from "./trie";
import { LifeCycle } from "../DI/lifecycle";
import { PolicyEvaluator } from "./policy-evaluator";
import { reactiveContext } from "../reactivity/reactive-context";
import { Constructor } from "../DI/types";
import { RouteCandidate } from "./trie.types";

/**
 * Interfaz para rutas generadas por el plugin de Vite
 */
export interface GeneratedRoute {
  id: string;
  path: string;
  className: string;
  loader: (signal?: AbortSignal) => Promise<{ default: any }>;
  metadata?: Record<string, any>;
  policies?: Constructor<any>[];
  slot?: string;
}

@Service
export class Router implements LifeCycle {
  @State
  pathname: string = "";

  @State
  search: string = "";

  // Computed para compatibilidad hacia atrás
  @Computed
  get currentPath(): string {
    return this.pathname;
  }

  @Computed
  get activePatterns(): string[] {
    return this.$routeCandidates.map(candidates =>
      candidates.length > 0 ? candidates[0].path : ''
    ).filter(path => path !== '');
  }

  @Inject(Trie)
  routeTrie!: Trie;

  @Inject(PolicyEvaluator)
  policyEvaluator!: PolicyEvaluator;

  @State
  public $params: Record<string, string> = {};

  @State
  public $queryParams: Record<string, string> = {};

  @State
  public $routeCandidates: RouteCandidate[][] = [];

  private hasInitialized = false;
  private routesLoaded = false;

  constructor() {
    // Inicializar routeCandidates con array vacío para evitar undefined
    // El tamaño real se ajustará en onBootstrap cuando maxDepth esté disponible
    this.$routeCandidates = [];
  }

  async onBootstrap(): Promise<void> {
    if (this.hasInitialized) return;

    if (!this.routesLoaded) {
      await this.loadGeneratedRoutes();
    }

    this.hasInitialized = true;

    window.addEventListener("popstate", () => {
      this.pathname = window.location.pathname;
      this.search = window.location.search;
    });

    this.pathname = window.location.pathname;
    this.search = window.location.search;
  }

  @Effect
  private syncRouteParams(): void {
    // Solo trackea pathname, NO params
    const match = this.routeTrie.find(this.pathname);

    // Usar untrack para leer las keys actuales de params sin crear subscripción
    const currentKeys = reactiveContext.untrack(() => Object.keys(this.$params));

    if (match) {
      const newParams = match.params;

      // Eliminar params que ya no existen
      for (const key of currentKeys) {
        if (!(key in newParams)) {
          delete this.$params[key];
        }
      }

      // Actualizar/agregar params
      for (const key in newParams) {
        this.$params[key] = newParams[key];
      }
    } else {
      // Limpiar todos los params si no hay match
      for (const key of currentKeys) {
        delete this.$params[key];
      }
    }
  }

  @Effect
  private syncQueryParams(): void {
    // Solo trackea search, NO queryParams
    const searchParams = new URLSearchParams(this.search);

    // Usar untrack para leer las keys actuales sin crear subscripción
    const currentKeys = reactiveContext.untrack(() => Object.keys(this.$queryParams));

    // Eliminar query params que ya no existen
    for (const key of currentKeys) {
      if (!searchParams.has(key)) {
        delete this.$queryParams[key];
      }
    }

    // Actualizar/agregar query params
    searchParams.forEach((value, key) => {
      this.$queryParams[key] = value;
    });
  }

  @Effect
  private syncRouteCandidates(): void {
    // Solo trackea pathname, NO routeCandidates
    const match = this.routeTrie.find(this.pathname);

    // Obtener maxDepth actual (puede cambiar si se registran nuevas rutas)
    const maxDepth = this.routeTrie.maxDepth;

    // Usar untrack para leer el length actual sin crear subscripción
    const currentLength = reactiveContext.untrack(() => this.$routeCandidates.length);

    // ✅ En lugar de reemplazar todo el array, ajustar el tamaño incrementalmente
    if (currentLength < maxDepth) {
      // Agregar niveles faltantes
      for (let i = currentLength; i < maxDepth; i++) {
        this.$routeCandidates.push([]);
      }
    } else if (currentLength > maxDepth) {
      // Remover niveles sobrantes
      this.$routeCandidates.length = maxDepth;
    }

    if (match) {
      const { candidatesByLevel } = match;

      // Actualizar cada nivel solo si cambió
      for (let i = 0; i < maxDepth; i++) {
        const newCandidates = candidatesByLevel[i] || [];

        // Usar untrack para leer los candidatos actuales sin crear subscripción
        const currentCandidates = reactiveContext.untrack(() => this.$routeCandidates[i]);

        // Comparar si los candidatos cambiaron
        // Comparamos por longitud y luego por ids
        if (!this.candidatesAreEqual(currentCandidates, newCandidates)) {
          // Solo actualizar si realmente cambió
          this.$routeCandidates[i] = newCandidates;
        }
      }
    } else {
      // No hay match, limpiar todos los niveles (arrays vacíos)
      for (let i = 0; i < maxDepth; i++) {
        // Usar untrack para leer sin suscribirse
        const currentCandidates = reactiveContext.untrack(() => this.$routeCandidates[i]);

        // Solo actualizar si no está vacío
        if (currentCandidates.length > 0) {
          this.$routeCandidates[i] = [];
        }
      }
    }
  }

  /**
   * Compara dos arrays de candidatos para determinar si son iguales
   * Usa comparación por id para determinar identidad
   */
  private candidatesAreEqual(a: RouteCandidate[], b: RouteCandidate[]): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id) return false;
    }

    return true;
  }

  /**
   * Fuerza la re-evaluación de todos los route candidates
   * recalculando los candidatos desde el Trie.
   *
   * Esto hace que todos los RouteView detecten el cambio y re-ejecuten
   * sus Resources, incluyendo la evaluación de policies.
   *
   * Útil después de cambios de estado que afectan autorización (ej: OAuth login)
   */
  private revalidateRouteCandidates(): void {
    console.log('[Router] Revalidating all route candidates');

    // Recalcular los candidatos desde el Trie para el pathname actual
    const match = this.routeTrie.find(this.pathname);
    const maxDepth = this.routeTrie.maxDepth;

    if (match) {
      const { candidatesByLevel } = match;

      // Forzar actualización de cada nivel con nuevos arrays
      for (let i = 0; i < maxDepth; i++) {
        const newCandidates = candidatesByLevel[i] || [];
        // Siempre asignar un nuevo array para forzar invalidación
        this.$routeCandidates[i] = [...newCandidates];
      }
    } else {
      // No hay match, asignar arrays vacíos
      for (let i = 0; i < maxDepth; i++) {
        this.$routeCandidates[i] = [];
      }
    }
  }

  navigate(to: string, options?: { 
    revalidate?: boolean;
    replace?: boolean;      // replace vs push en el history
    external?: 'allow' | 'block' | 'native';  // Manejar URLs externas
  }): void {
    // Detectar si es URL externa (protocolo presente o //)
    if (/^[a-z][a-z0-9+.-]*:/i.test(to) || to.startsWith('//')) {
      if (options?.external === 'native' || options?.external === undefined) {
        window.location.href = to; // Dejar que el browser navegue normalmente
        return;
      }
      if (options?.external === 'block') {
        console.warn(`[Router] External navigation blocked: ${to}`);
        return;
      }
    }

    // Usar URL actual completa como base para respetar rutas relativas
    const currentUrl = window.location.href;
    const url = new URL(to, currentUrl);
    
    const newPathname = url.pathname;
    const newSearch = url.search;
    const newHash = url.hash;

    // Verificar qué cambió realmente
    const pathnameChanged = this.pathname !== newPathname;
    const searchChanged = this.search !== newSearch;

    // No hacer nada si nada cambió y no hay revalidate
    if (!pathnameChanged && !searchChanged && !options?.revalidate) {
      return;
    }

    // Construir la ruta completa para pushState/replaceState
    const fullPath = newPathname + newSearch + newHash;
    
    // Soporte para replace vs push
    const historyMethod = options?.replace ? 'replaceState' : 'pushState';
    window.history[historyMethod](null, "", fullPath);

    // ✅ Granularidad perfecta - solo actualiza lo que cambió
    // Cada asignación dispara su propio @Effect
    if (pathnameChanged) {
      this.pathname = newPathname;
    }
    if (searchChanged) {
      this.search = newSearch;
    }

    // Si revalidate está activo, forzar la re-evaluación de todos los candidates
    if (options?.revalidate) {
      this.revalidateRouteCandidates();
    }
  }

  /**
   * Carga las rutas generadas por el plugin de Vite
   * Intenta múltiples rutas posibles donde el archivo puede estar generado
   */
  private async loadGeneratedRoutes(): Promise<void> {
    // Rutas posibles donde el plugin puede generar el archivo
    // Usamos rutas absolutas desde la raíz del proyecto (Vite las resuelve)
    // También intentamos con alias @ si está configurado
    const possiblePaths = [
      '/app/router/generated-routes',  // Ruta más común según el plugin
      '@/router/generated-routes',     // Usando alias @ si está configurado
      '/src/router/generated-routes',   // Alternativa común
      '/router/generated-routes',      // Si está en la raíz
      './app/router/generated-routes', // Relativa (fallback)
      './src/router/generated-routes', // Relativa (fallback)
    ];

    let routes: GeneratedRoute[] | null = null;
    let lastError: Error | null = null;

    // Intentar importar desde cada ruta posible
    for (const routePath of possiblePaths) {
      try {
        // Usar import dinámico con @vite-ignore para permitir rutas dinámicas
        const module = await import(/* @vite-ignore */ routePath);
        // El archivo generado exporta default el array de rutas
        routes = module.default || module.routes || null;
        if (routes && Array.isArray(routes)) {
          break;
        } else {
          console.log(`[Router.loadGeneratedRoutes] ⚠️  ${routePath} existe pero no exporta rutas válidas`);
        }
      } catch (error) {
        lastError = error as Error;
        console.log(`[Router.loadGeneratedRoutes] ❌ Error en ${routePath}:`, (error as Error).message);
        // Continuar con la siguiente ruta
        continue;
      }
    }

    if (!routes || !Array.isArray(routes)) {
      console.warn('⚠️  Could not load generated routes. Make sure the route generator plugin is configured correctly.');
      console.warn('   Tried paths:', possiblePaths);
      if (lastError) {
        console.warn('   Last error:', lastError.message);
      }
      console.warn('   Tip: Make sure generated-routes.ts exists and exports default an array of routes.');
      return;
    }

    // Registrar las rutas cargadas
    this.registerGeneratedRoutes(routes);
    this.routesLoaded = true;
  }

  /**
   * Registra un array de rutas generadas en el Trie
   * @param routes Array de rutas generadas por el plugin
   */
  public registerGeneratedRoutes(routes: GeneratedRoute[]): void {
    for (const route of routes) {
      this.routeTrie.insert(
        route.id,
        route.path,
        route.loader,
        route.metadata,
        route.policies,
        route.slot
      );
    }
  }

}
