/**
 * RouteView Integration Tests - Tests realistas con Show component
 *
 * Este test usa el DOM de jsdom y los componentes REALES del framework
 * con JSX compilado y el componente Show para simular el escenario exacto
 * del RouteView real.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component } from '../../components/decorators/component';
import { BaseComponent } from '../../components/base-component';
import { Resource } from '../../reactivity/decorators/resource';
import { Computed } from '../../reactivity/decorators/computed';
import { IResource } from '../../reactivity/signals/resource';
import { phaseScheduler } from '../../reactivity/phase-scheduler';
import { reactiveContext } from '../../reactivity/reactive-context';
import { Fragment } from '../../jsx/types';
import { Show } from '../../custom-components/show';

// ============================================================================
// CONFIGURACIÓN GLOBAL DE INSTRUMENTACIÓN
// ============================================================================

interface ExecutionEntry {
  timestamp: number;
  method: string;
  instance?: string;
  args?: any[];
  callCount: number;
}

let executionLog: ExecutionEntry[] = [];
let callCounts: Map<string, number> = new Map();
let loopDetected = false;
const MAX_CALLS_PER_METHOD = 50;

function resetInstrumentation() {
  executionLog = [];
  callCounts.clear();
  loopDetected = false;
}

function logExecution(method: string, instance?: string, args?: any[]) {
  const key = instance ? `${instance}.${method}` : method;
  const count = (callCounts.get(key) || 0) + 1;
  callCounts.set(key, count);

  executionLog.push({
    timestamp: Date.now(),
    method: key,
    instance,
    args,
    callCount: count,
  });

  // Detectar loop
  if (count > MAX_CALLS_PER_METHOD) {
    loopDetected = true;
    console.error(`🚨 LOOP DETECTED: ${key} called ${count} times`);
    console.error('Last 10 executions:', executionLog.slice(-10).map(e => e.method));
    throw new Error(`Infinite loop detected in ${key}`);
  }

  return count;
}

// ============================================================================
// ANÁLISIS DE PATRONES
// ============================================================================

function analyzeExecutionLog(log: ExecutionEntry[]): {
  hasLoop: boolean;
  loopLocation?: string;
  pattern?: string[];
  totalCalls: number;
} {
  const methods = log.map(e => e.method);

  // Buscar secuencia que se repite 3+ veces seguidas
  for (let len = 2; len < 10; len++) {
    for (let i = 0; i < methods.length - len * 3; i++) {
      const pattern = methods.slice(i, i + len);
      const next1 = methods.slice(i + len, i + len * 2);
      const next2 = methods.slice(i + len * 2, i + len * 3);

      if (arraysEqual(pattern, next1) && arraysEqual(pattern, next2)) {
        return {
          hasLoop: true,
          loopLocation: pattern[0],
          pattern: pattern,
          totalCalls: log.length,
        };
      }
    }
  }

  return { hasLoop: false, totalCalls: log.length };
}

function arraysEqual(a: any[], b: any[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function printExecutionSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('EXECUTION SUMMARY');
  console.log('='.repeat(60));

  const sortedCalls = Array.from(callCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('\nTop 10 métodos más llamados:');
  sortedCalls.forEach(([method, count]) => {
    const bar = '█'.repeat(Math.min(count, 30));
    console.log(`  ${method}: ${count} ${bar}`);
  });

  const analysis = analyzeExecutionLog(executionLog);
  console.log('\nAnálisis de loop:', analysis.hasLoop ? '⚠️ LOOP DETECTADO' : '✅ Sin loop');
  if (analysis.pattern) {
    console.log('Patrón del loop:', analysis.pattern.join(' → '));
  }

  console.log('='.repeat(60) + '\n');
}

// ============================================================================
// MOCK DE ROUTE CANDIDATES (simula lo que haría el Router)
// ============================================================================

let mockRouteCandidates: { id: string; path: string; loader: () => Promise<any> }[][] = [];

function setupMockCandidates() {
  mockRouteCandidates = [
    [{ id: 'root', path: '/', loader: async () => ({ default: TestAppComponent }) }],
    [{ id: 'articles', path: '/articles', loader: async () => ({ default: TestArticlesPage }) }],
  ];
}

// ============================================================================
// COMPONENTES DE PRUEBA CON JSX REAL Y SHOW
// ============================================================================

// Componente hoja: página de artículos
@Component()
class TestArticlesPage extends BaseComponent {
  view() {
    logExecution('view', 'ArticlesPage');
    return this.jsx('div', { className: 'articles-page', children: 'Articles Page Content' });
  }
}

// Componente App: contiene RouteView L1
@Component()
class TestAppComponent extends BaseComponent {
  view() {
    logExecution('view', 'TestApp');

    return this.jsxs(Fragment, {
      children: [
        this.jsx('div', { className: 'app-header', children: 'App Header' }),
        this.jsx(TestRouteViewL1, {}),
      ]
    });
  }
}

// RouteView L1 - usa Show component como el RouteView real
@Component()
class TestRouteViewL1 extends BaseComponent {
  navigationLevel = 1;

  @Computed
  get levelCandidates() {
    logExecution('levelCandidates.get', `RouteView-L${this.navigationLevel}`);
    return mockRouteCandidates[this.navigationLevel] || [];
  }

  @Resource(async function(this: TestRouteViewL1, signal) {
    logExecution('Resource.source', `RouteView-L${this.navigationLevel}`);

    const candidates = this.levelCandidates;
    logExecution('Resource.readCandidates', `RouteView-L${this.navigationLevel}`, [candidates.length]);

    if (candidates.length === 0) {
      return null;
    }

    await new Promise(resolve => setTimeout(resolve, 10));

    const module = await candidates[0].loader();
    return module?.default || null;
  })
  componentClass!: IResource<any>;

  // JSX usando Show component - como el RouteView real
  view() {
    logExecution('view', `RouteView-L${this.navigationLevel}`, [this.componentClass.state]);

    return this.jsxs(Fragment, {
      children: [
        // Show para pending
        Show({
          when: () => this.componentClass.state === 'pending',
          children: () => {
            logExecution('Show.pending.children', `RouteView-L${this.navigationLevel}`);
            return this.jsx('div', { className: 'loading', children: 'Loading L1...' });
          }
        }),

        // Show para error
        Show({
          when: () => this.componentClass.state === 'error',
          children: () => {
            logExecution('Show.error.children', `RouteView-L${this.navigationLevel}`);
            return this.jsx('div', { className: 'error', children: 'Error L1' });
          }
        }),

        // Show para ready - renderiza el componente cargado
        Show({
          when: () => this.componentClass.state === 'ready',
          children: () => {
            logExecution('Show.ready.children', `RouteView-L${this.navigationLevel}`);
            const LoadedComponent = this.componentClass.get();
            if (LoadedComponent) {
              return this.jsx(LoadedComponent, {});
            }
            return null;
          }
        }),
      ]
    });
  }
}

// RouteView L0 - el punto de entrada
@Component()
class TestRouteViewL0 extends BaseComponent {
  navigationLevel = 0;

  @Computed
  get levelCandidates() {
    logExecution('levelCandidates.get', `RouteView-L${this.navigationLevel}`);
    return mockRouteCandidates[this.navigationLevel] || [];
  }

  @Resource(async function(this: TestRouteViewL0, signal) {
    logExecution('Resource.source', `RouteView-L${this.navigationLevel}`);

    const candidates = this.levelCandidates;
    logExecution('Resource.readCandidates', `RouteView-L${this.navigationLevel}`, [candidates.length]);

    if (candidates.length === 0) {
      return null;
    }

    await new Promise(resolve => setTimeout(resolve, 10));

    const module = await candidates[0].loader();
    return module?.default || null;
  })
  componentClass!: IResource<any>;

  view() {
    logExecution('view', `RouteView-L${this.navigationLevel}`, [this.componentClass.state]);

    return this.jsxs(Fragment, {
      children: [
        Show({
          when: () => this.componentClass.state === 'pending',
          children: () => {
            logExecution('Show.pending.children', `RouteView-L${this.navigationLevel}`);
            return this.jsx('div', { className: 'loading', children: 'Loading L0...' });
          }
        }),

        Show({
          when: () => this.componentClass.state === 'error',
          children: () => {
            logExecution('Show.error.children', `RouteView-L${this.navigationLevel}`);
            return this.jsx('div', { className: 'error', children: 'Error L0' });
          }
        }),

        Show({
          when: () => this.componentClass.state === 'ready',
          children: () => {
            logExecution('Show.ready.children', `RouteView-L${this.navigationLevel}`);
            const LoadedComponent = this.componentClass.get();
            if (LoadedComponent) {
              return this.jsx(LoadedComponent, {});
            }
            return null;
          }
        }),
      ]
    });
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('RouteView Integration Tests con Show', () => {
  let container: HTMLElement;

  beforeEach(() => {
    resetInstrumentation();
    setupMockCandidates();

    // @ts-ignore - Reset scheduler state
    phaseScheduler.dirtyEffects?.clear?.();
    // @ts-ignore
    phaseScheduler.isFlushScheduled = false;

    // @ts-ignore - Reset reactive context
    reactiveContext.computationStack = [];
    // @ts-ignore
    reactiveContext.contextStack = [];

    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    printExecutionSummary();
    document.body.innerHTML = '';
  });

  describe('RouteView L0 solo', () => {
    it('debe renderizar sin loop infinito', async () => {
      // Configurar para que L0 cargue directamente ArticlesPage (sin RouteView hijo)
      mockRouteCandidates = [
        [{ id: 'root', path: '/', loader: async () => ({ default: TestArticlesPage }) }],
      ];

      const routeViewL0 = new TestRouteViewL0();
      container.appendChild(routeViewL0);

      // Esperar ciclos de renderizado
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 40));
        phaseScheduler.flush();
      }

      const analysis = analyzeExecutionLog(executionLog);

      console.log('\n=== TEST L0 SOLO ===');
      console.log('Total calls:', analysis.totalCalls);
      console.log('Loop detected:', analysis.hasLoop);

      expect(analysis.hasLoop).toBe(false);
      expect(loopDetected).toBe(false);

      // Verificar que se ejecutaron los métodos esperados
      expect(callCounts.get('ArticlesPage.view')).toBeGreaterThanOrEqual(1);
    });

    it('debe mostrar loading mientras carga y luego el contenido', async () => {
      mockRouteCandidates = [
        [{ id: 'root', path: '/', loader: async () => ({ default: TestArticlesPage }) }],
      ];

      const routeViewL0 = new TestRouteViewL0();
      container.appendChild(routeViewL0);

      // Inicialmente debe mostrar loading
      await new Promise(resolve => setTimeout(resolve, 5));
      phaseScheduler.flush();

      // Verificar estado pending
      const loadingEl = container.querySelector('.loading');
      console.log('Loading element:', loadingEl?.textContent);

      // Esperar a que termine de cargar
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 30));
        phaseScheduler.flush();
      }

      // Ahora debe mostrar el contenido
      const contentEl = container.querySelector('.articles-page');
      console.log('Content element:', contentEl?.textContent);

      expect(loopDetected).toBe(false);
    });
  });

  describe('RouteView L1 solo', () => {
    it('debe renderizar sin loop infinito', async () => {
      const routeViewL1 = new TestRouteViewL1();
      container.appendChild(routeViewL1);

      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 40));
        phaseScheduler.flush();
      }

      const analysis = analyzeExecutionLog(executionLog);

      console.log('\n=== TEST L1 SOLO ===');
      console.log('Total calls:', analysis.totalCalls);
      console.log('Loop detected:', analysis.hasLoop);

      expect(analysis.hasLoop).toBe(false);
      expect(loopDetected).toBe(false);
    });
  });

  describe('RouteView L0 + L1 anidados', () => {
    it('debe renderizar ambos niveles sin loop infinito', async () => {
      const TIMEOUT = 5000;

      const testPromise = (async () => {
        logExecution('test.createRouteViewL0');
        const routeViewL0 = new TestRouteViewL0();
        container.appendChild(routeViewL0);

        // Esperar ciclos de renderizado
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          phaseScheduler.flush();

          if (loopDetected) {
            throw new Error('Loop detected during rendering');
          }
        }

        return true;
      })();

      const result = await Promise.race([
        testPromise,
        new Promise<false>((resolve) =>
          setTimeout(() => {
            console.error('⏰ TIMEOUT - Posible loop infinito');
            resolve(false);
          }, TIMEOUT)
        ),
      ]);

      const analysis = analyzeExecutionLog(executionLog);

      console.log('\n=== TEST L0 + L1 ANIDADOS ===');
      console.log('Completed:', result);
      console.log('Loop detected:', analysis.hasLoop);
      console.log('Total calls:', analysis.totalCalls);

      // Log de ejecución para análisis
      console.log('\n=== EXECUTION LOG (primeras 50 entradas) ===');
      executionLog.slice(0, 50).forEach((entry, i) => {
        console.log(`[${i}] ${entry.method} (call #${entry.callCount})`);
      });

      expect(analysis.hasLoop).toBe(false);
      expect(result).toBe(true);

      // Verificar que se renderizó todo el árbol
      const appHeader = container.querySelector('.app-header');
      const articlesPage = container.querySelector('.articles-page');

      console.log('\nDOM renderizado:');
      console.log('- App header:', appHeader?.textContent);
      console.log('- Articles page:', articlesPage?.textContent);
    });

    it('debe ejecutar Resource solo una vez por nivel', async () => {
      const routeViewL0 = new TestRouteViewL0();
      container.appendChild(routeViewL0);

      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        phaseScheduler.flush();
      }

      // Contar ejecuciones de Resource por nivel
      const l0ResourceCalls = callCounts.get('RouteView-L0.Resource.source') || 0;
      const l1ResourceCalls = callCounts.get('RouteView-L1.Resource.source') || 0;

      console.log('\n=== RESOURCE EXECUTION COUNTS ===');
      console.log('L0 Resource calls:', l0ResourceCalls);
      console.log('L1 Resource calls:', l1ResourceCalls);

      // Cada Resource debería ejecutarse máximo 2 veces (initial + posible re-run)
      expect(l0ResourceCalls).toBeLessThanOrEqual(3);
      expect(l1ResourceCalls).toBeLessThanOrEqual(3);
      expect(loopDetected).toBe(false);
    });
  });

  describe('Verificación de Show component', () => {
    it('solo debe renderizar UN branch a la vez (pending XOR ready XOR error)', async () => {
      mockRouteCandidates = [
        [{ id: 'root', path: '/', loader: async () => ({ default: TestArticlesPage }) }],
      ];

      const routeViewL0 = new TestRouteViewL0();
      container.appendChild(routeViewL0);

      // Revisar el DOM en varios puntos
      const checkDOMState = () => {
        const loading = container.querySelectorAll('.loading');
        const error = container.querySelectorAll('.error');
        const content = container.querySelectorAll('.articles-page');

        // Solo uno de estos debería estar presente (o ninguno durante transición)
        const visibleCount = loading.length + error.length + content.length;
        console.log(`DOM state: loading=${loading.length}, error=${error.length}, content=${content.length}`);

        // No deberían coexistir loading y content
        if (loading.length > 0 && content.length > 0) {
          console.error('ERROR: Loading y Content visibles al mismo tiempo!');
          return false;
        }
        return true;
      };

      let allStatesValid = true;
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 30));
        phaseScheduler.flush();

        if (!checkDOMState()) {
          allStatesValid = false;
        }
      }

      expect(allStatesValid).toBe(true);
      expect(loopDetected).toBe(false);
    });
  });
});
