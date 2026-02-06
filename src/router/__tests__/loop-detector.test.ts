/**
 * LOOP DETECTOR - Test de integración para detectar loops infinitos
 *
 * Este test usa el DOM de jsdom y los componentes REALES del framework
 * con JSX compilado para simular el escenario exacto del bug.
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

function findRepeatingPatterns(log: ExecutionEntry[]): Array<{
  sequence: string[];
  count: number;
}> {
  const methods = log.map(e => e.method);
  const patterns: Map<string, number> = new Map();

  for (let len = 2; len <= 5; len++) {
    for (let i = 0; i < methods.length - len; i++) {
      const sequence = methods.slice(i, i + len);
      const key = sequence.join(' → ');
      patterns.set(key, (patterns.get(key) || 0) + 1);
    }
  }

  return Array.from(patterns.entries())
    .filter(([_, count]) => count >= 3)
    .map(([key, count]) => ({
      sequence: key.split(' → '),
      count,
    }))
    .sort((a, b) => b.count - a.count);
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

  const patterns = findRepeatingPatterns(executionLog);
  if (patterns.length > 0) {
    console.log('\nPatrones repetitivos detectados:');
    patterns.slice(0, 5).forEach(p => {
      console.log(`  [${p.count}x] ${p.sequence.join(' → ')}`);
    });
  }

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
// COMPONENTES DE PRUEBA CON JSX REAL
// ============================================================================

// Componente que simula la página de artículos (hoja del árbol)
@Component()
class TestArticlesPage extends BaseComponent {
  view() {
    logExecution('view', 'ArticlesPage');
    return this.jsx('div', { children: 'Articles Page Content' });
  }
}

// Componente que simula App (contiene RouteView L1)
@Component()
class TestAppComponent extends BaseComponent {
  view() {
    logExecution('view', 'TestApp');

    // App contiene un RouteView nivel 1
    return this.jsxs(Fragment, {
      children: [
        this.jsx('div', { children: 'App Header' }),
        // Aquí iría <RouteView /> que es TestRouteViewL1
        this.jsx(TestRouteViewL1, {}),
      ]
    });
  }
}

// RouteView L1 - con JSX real
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

  // JSX REAL como lo genera el compilador
  view() {
    logExecution('view', `RouteView-L${this.navigationLevel}`, [this.componentClass.state]);

    return this.jsxs(Fragment, {
      children: [
        // Expresión reactiva: () => condition && element
        () => this.componentClass.state === 'pending' && this.jsx('div', { children: 'Loading L1...' }),
        () => this.componentClass.state === 'error' && this.jsx('div', { children: 'Error L1' }),
        // CLAVE: Esta es la expresión que causa el problema
        // Cada vez que se evalúa, llama this.jsx() que SIEMPRE crea nueva instancia
        () => this.componentClass.state === 'ready' && this.jsx(this.componentClass.get() ?? null, {}),
      ]
    });
  }
}

// RouteView L0 - con JSX real (el que inicia todo)
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

  // JSX REAL como lo genera el compilador
  view() {
    logExecution('view', `RouteView-L${this.navigationLevel}`, [this.componentClass.state]);

    return this.jsxs(Fragment, {
      children: [
        () => this.componentClass.state === 'pending' && this.jsx('div', { children: 'Loading L0...' }),
        () => this.componentClass.state === 'error' && this.jsx('div', { children: 'Error L0' }),
        () => this.componentClass.state === 'ready' && this.jsx(this.componentClass.get() ?? null, {}),
      ]
    });
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Loop Detector - Integration Tests con JSX Real', () => {
  let container: HTMLElement;

  beforeEach(() => {
    resetInstrumentation();
    setupMockCandidates();

    // @ts-ignore
    phaseScheduler.dirtyEffects?.clear?.();
    // @ts-ignore
    phaseScheduler.isFlushScheduled = false;

    // @ts-ignore
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

  describe('Detección de Loop con JSX Real', () => {
    it('debe detectar si RouteView L0 con JSX real causa loop infinito', async () => {
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

      console.log('\n=== TEST RESULT ===');
      console.log('Completed:', result);
      console.log('Loop detected:', analysis.hasLoop);
      console.log('Total calls:', analysis.totalCalls);
      if (analysis.pattern) {
        console.log('Loop pattern:', analysis.pattern);
      }

      // Log completo para análisis
      console.log('\n=== EXECUTION LOG (primeras 100 entradas) ===');
      executionLog.slice(0, 100).forEach((entry, i) => {
        console.log(`[${i}] ${entry.method} (call #${entry.callCount})`);
      });

      expect(analysis.hasLoop).toBe(false);
      expect(result).toBe(true);
    });

    it('debe registrar la secuencia completa de ejecución para análisis', async () => {
      const routeViewL0 = new TestRouteViewL0();
      container.appendChild(routeViewL0);

      // Esperar que todo se resuelva
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 40));
        phaseScheduler.flush();
      }

      console.log('\n=== EXECUTION LOG COMPLETO ===');
      executionLog.forEach((entry, i) => {
        console.log(`[${i}] ${entry.method} (call #${entry.callCount})`);
      });

      // Verificar que al menos se ejecutaron los métodos esperados
      const hasL0View = executionLog.some(e => e.method.includes('RouteView-L0.view'));
      const hasL0Resource = executionLog.some(e => e.method.includes('RouteView-L0.Resource'));

      console.log('\nVerificaciones:');
      console.log('- L0 view ejecutado:', hasL0View);
      console.log('- L0 Resource ejecutado:', hasL0Resource);

      expect(loopDetected).toBe(false);
    });
  });

  describe('Test aislado de un solo RouteView', () => {
    it('RouteView L0 solo (sin hijo) no debe causar loop', async () => {
      // Modificar mock para que L0 cargue una página simple (sin RouteView hijo)
      mockRouteCandidates = [
        [{ id: 'root', path: '/', loader: async () => ({ default: TestArticlesPage }) }],
      ];

      const routeViewL0 = new TestRouteViewL0();
      container.appendChild(routeViewL0);

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
    });

    it('RouteView L1 solo (sin padre) no debe causar loop', async () => {
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
});
