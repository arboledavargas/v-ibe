/**
 * Test para reproducir el bug de loop infinito con @Ctx
 * 
 * El bug ocurre cuando:
 * 1. Un RouteView usa @Ctx navigationLevel
 * 2. Hay RouteViews anidados (padre e hijo)
 * 3. El hijo busca $navigationLevel del padre y crea un derived
 * 4. Algo en esta cadena causa un loop infinito
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Signal, ISignal } from '../../signals/signal';
import { derived } from '../../signals/derived';
import { computed } from '../../signals/computed';
import { effect } from '../../signals/effect';
import { reactiveContext } from '../../reactive-context';
import { phaseScheduler } from '../../phase-scheduler';

// Mock de AppTree.findContextSignalFor
const mockFindContextSignal = vi.fn();

describe('Bug: Loop infinito con @Ctx', () => {
  beforeEach(() => {
    reactiveContext.clearStack();
    mockFindContextSignal.mockReset();
  });

  afterEach(() => {
    reactiveContext.clearStack();
  });

  it('debe reproducir el escenario básico de @Ctx con derived', async () => {
    // Simular el escenario de RouteView padre
    const parentLevelSignal = new Signal<number>(0);
    
    // Simular el escenario de RouteView hijo que usa @Ctx
    // El mapper es: v => (v === undefined ? 0 : v + 1)
    const mapper = (v: number | undefined) => (v === undefined ? 0 : v + 1);
    
    // Crear el derived como lo hace @Ctx
    const childLevelSignal = derived(parentLevelSignal, mapper);
    
    // Verificar que el valor inicial es correcto
    expect(childLevelSignal.get()).toBe(1); // 0 + 1 = 1
    
    // Cambiar el valor del padre
    parentLevelSignal.set(1);
    
    // El hijo debería tener 2
    expect(childLevelSignal.get()).toBe(2); // 1 + 1 = 2
  });

  it('debe manejar múltiples niveles de anidamiento sin loop', async () => {
    // Nivel 0 (raíz)
    const level0Signal = new Signal<number>(0);
    
    // Nivel 1 (hijo de nivel 0)
    const mapper = (v: number | undefined) => (v === undefined ? 0 : v + 1);
    const level1Signal = derived(level0Signal, mapper);
    
    // Nivel 2 (hijo de nivel 1)
    const level2Signal = derived(level1Signal, mapper);
    
    // Verificar valores
    expect(level0Signal.get()).toBe(0);
    expect(level1Signal.get()).toBe(1);
    expect(level2Signal.get()).toBe(2);
    
    // Cambiar el valor raíz
    level0Signal.set(5);
    
    // Todos deberían actualizarse
    expect(level0Signal.get()).toBe(5);
    expect(level1Signal.get()).toBe(6);
    expect(level2Signal.get()).toBe(7);
  });

  it('debe manejar @Ctx con @Computed sin loop', async () => {
    // Simular RouteView padre
    const parentLevelSignal = new Signal<number>(0);
    
    // Simular RouteView hijo con @Ctx
    const mapper = (v: number | undefined) => (v === undefined ? 0 : v + 1);
    const childLevelSignal = derived(parentLevelSignal, mapper);
    
    // Simular @Computed levelCandidates que lee navigationLevel
    let computedExecutions = 0;
    const levelCandidatesComputed = computed(() => {
      computedExecutions++;
      const level = childLevelSignal.get();
      return [`candidate-for-level-${level}`];
    });
    
    // Primera lectura
    expect(levelCandidatesComputed.get()).toEqual(['candidate-for-level-1']);
    expect(computedExecutions).toBe(1);
    
    // Segunda lectura (debería estar cacheado)
    expect(levelCandidatesComputed.get()).toEqual(['candidate-for-level-1']);
    expect(computedExecutions).toBe(1); // No debería haber re-ejecutado
    
    // Cambiar el padre
    parentLevelSignal.set(2);
    
    // El computed debería estar dirty pero no re-ejecutado aún
    // Hasta que lo leamos
    expect(levelCandidatesComputed.get()).toEqual(['candidate-for-level-3']);
    expect(computedExecutions).toBe(2);
  });

  it('TEST AISLADO: effect con computed y derived - SIN modificar state', async () => {
    /**
     * Test simplificado para aislar el problema
     */
    const parentSignal = new Signal<number>(0);
    const childSignal = derived(parentSignal, v => (v ?? 0) + 1);
    
    const computedValue = computed(() => {
      return childSignal.get();
    });
    
    let effectExecutions = 0;
    
    const eff = effect(() => {
      effectExecutions++;
      if (effectExecutions > 5) {
        throw new Error(`LOOP: ${effectExecutions} ejecuciones`);
      }
      const val = computedValue.get();
    });
    
    // Esperar
    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(effectExecutions).toBe(1);
    
    eff.dispose();
  });

  it('TEST AISLADO: effect con state.set en Promise.then', async () => {
    /**
     * HIPÓTESIS: El loop ocurre porque:
     * 1. Effect lee un computed
     * 2. Dentro del effect hay Promise.then que hace state.set
     * 3. El state.set causa que el effect se re-agende
     * 4. Al re-ejecutarse, vuelve a crear Promise.then
     */
    const computedSource = new Signal<number>(0);
    const computedValue = computed(() => computedSource.get());
    
    const stateSignal = new Signal<'pending' | 'ready'>('pending');
    
    let effectExecutions = 0;
    
    const eff = effect(() => {
      effectExecutions++;
      if (effectExecutions > 5) {
        throw new Error(`LOOP: ${effectExecutions} ejecuciones`);
      }
      
      // Leer computed
      const val = computedValue.get();
      
      // Simular Resource: Promise.then que hace set
      Promise.resolve().then(() => {
        stateSignal.set('ready');
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Debería ser solo 1 ejecución porque stateSignal no es dependencia
    expect(effectExecutions).toBe(1);
    
    eff.dispose();
  });

  it('TEST CRÍTICO: effect que LEE state que modifica en Promise.then', async () => {
    /**
     * HIPÓTESIS REFINADA:
     * El loop ocurre cuando el effect LEE la misma signal que modifica
     */
    const stateSignal = new Signal<'pending' | 'ready'>('pending');
    
    let effectExecutions = 0;
    
    const eff = effect(() => {
      effectExecutions++;
      if (effectExecutions > 10) {
        throw new Error(`LOOP: ${effectExecutions} ejecuciones`);
      }
      
      // Leer el state (crea suscripción)
      const currentState = stateSignal.get();
      
      // Si está pending, cambiarlo a ready en un then
      if (currentState === 'pending') {
        Promise.resolve().then(() => {
          stateSignal.set('ready');
        });
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Debería ejecutarse 2 veces: una inicial (pending), una después del set (ready)
    expect(effectExecutions).toBe(2);
    expect(stateSignal.get()).toBe('ready');
    
    eff.dispose();
  });

  it('TEST: Simula Resource completo con createResource', async () => {
    /**
     * Este test simula exactamente lo que hace createResource:
     * 1. Crea signals para data, state, error
     * 2. Crea effect que ejecuta source y maneja Promise
     */
    const { createResource } = await import('../../signals/resource');
    
    let sourceExecutions = 0;
    
    // Simular un Resource que lee una señal externa
    const externalSignal = new Signal<number>(1);
    
    const resource = createResource(async (signal) => {
      sourceExecutions++;
      if (sourceExecutions > 10) {
        throw new Error(`LOOP en source: ${sourceExecutions}`);
      }
      
      // Leer señal externa (crea dependencia)
      const val = externalSignal.get();
      
      // Simular carga async
      await new Promise(r => setTimeout(r, 5));
      
      return `loaded-${val}`;
    });
    
    // Esperar a que cargue
    await new Promise(r => setTimeout(r, 50));
    
    expect(resource.state).toBe('ready');
    expect(resource.get()).toBe('loaded-1');
    expect(sourceExecutions).toBe(1);
    
    // Cambiar la señal externa debería re-ejecutar el resource
    externalSignal.set(2);
    
    await new Promise(r => setTimeout(r, 50));
    
    expect(resource.get()).toBe('loaded-2');
    expect(sourceExecutions).toBe(2);
  });

  it('TEST: RouteView simulado con @Ctx + @Computed + @Resource', async () => {
    /**
     * Simula el escenario exacto del RouteView:
     * - navigationLevel viene de @Ctx (derived del padre)
     * - levelCandidates es @Computed que lee navigationLevel
     * - componentClass es @Resource que lee levelCandidates
     */
    const { createResource } = await import('../../signals/resource');
    
    // Simular @Ctx navigationLevel (como si fuera el RouteView raíz)
    const navigationLevelSignal = new Signal<number>(0);
    
    // Simular @Computed levelCandidates
    let computedExecs = 0;
    const levelCandidates = computed(() => {
      computedExecs++;
      const level = navigationLevelSignal.get();
      if (computedExecs > 20) {
        throw new Error(`Computed loop: ${computedExecs}`);
      }
      // Simular que retorna candidatos para este nivel
      return level === 0 ? ['App'] : [];
    });
    
    // Simular @Resource componentClass
    let resourceExecs = 0;
    const componentClass = createResource(async (signal) => {
      resourceExecs++;
      if (resourceExecs > 10) {
        throw new Error(`Resource loop: ${resourceExecs}`);
      }
      
      // El Resource lee levelCandidates (computed)
      const candidates = levelCandidates.get();
      
      if (candidates.length === 0) {
        return null;
      }
      
      // Simular import dinámico
      await new Promise(r => setTimeout(r, 5));
      
      return { name: candidates[0] };
    });
    
    // Esperar
    await new Promise(r => setTimeout(r, 100));
    
    expect(componentClass.state).toBe('ready');
    expect(componentClass.get()).toEqual({ name: 'App' });
    expect(resourceExecs).toBe(1);
    expect(computedExecs).toBeLessThan(5); // Puede ejecutarse varias veces por lazy eval
  });

  it('TEST: Dos RouteViews anidados simulados', async () => {
    /**
     * Simula EXACTAMENTE el escenario problemático:
     * - RouteView L0 (navigationLevel = 0)
     * - RouteView L1 (navigationLevel = 1, derivado de L0)
     * Ambos tienen @Computed levelCandidates y @Resource componentClass
     */
    const { createResource } = await import('../../signals/resource');
    
    // === RouteView L0 ===
    const l0NavigationSignal = new Signal<number>(0);
    
    let l0ComputedExecs = 0;
    const l0LevelCandidates = computed(() => {
      l0ComputedExecs++;
      const level = l0NavigationSignal.get();
      return level === 0 ? ['App'] : [];
    });
    
    let l0ResourceExecs = 0;
    const l0ComponentClass = createResource(async (signal) => {
      l0ResourceExecs++;
      if (l0ResourceExecs > 10) throw new Error(`L0 Resource loop: ${l0ResourceExecs}`);
      
      const candidates = l0LevelCandidates.get();
      if (candidates.length === 0) return null;
      
      await new Promise(r => setTimeout(r, 5));
      return { name: candidates[0] };
    });
    
    // === RouteView L1 (hijo) ===
    // @Ctx crea un derived de la señal del padre
    const l1NavigationSignal = derived(l0NavigationSignal, v => (v ?? 0) + 1);
    
    let l1ComputedExecs = 0;
    const l1LevelCandidates = computed(() => {
      l1ComputedExecs++;
      const level = l1NavigationSignal.get();
      // L1 no tiene candidatos (simulando navegación a /)
      return level === 1 ? [] : ['SomePage'];
    });
    
    let l1ResourceExecs = 0;
    const l1ComponentClass = createResource(async (signal) => {
      l1ResourceExecs++;
      if (l1ResourceExecs > 10) throw new Error(`L1 Resource loop: ${l1ResourceExecs}`);
      
      const candidates = l1LevelCandidates.get();
      if (candidates.length === 0) return null;
      
      await new Promise(r => setTimeout(r, 5));
      return { name: candidates[0] };
    });
    
    // Esperar a que todo se estabilice
    await new Promise(r => setTimeout(r, 200));
    
    // Verificar L0
    expect(l0ComponentClass.state).toBe('ready');
    expect(l0ComponentClass.get()).toEqual({ name: 'App' });
    
    // Verificar L1
    expect(l1ComponentClass.state).toBe('ready');
    expect(l1ComponentClass.get()).toBeNull();
    
    // Verificar que no hubo loops
    expect(l0ResourceExecs).toBeLessThan(5);
    expect(l1ResourceExecs).toBeLessThan(5);
  });

  it('TEST: Simula @Ctx con búsqueda de padre y creación de derived', async () => {
    /**
     * Este test simula exactamente lo que hace @Ctx:
     * 1. Busca $navigationLevel en el padre
     * 2. Si lo encuentra, crea un derived
     * 3. Si no, crea un Signal nuevo
     */
    const { createResource } = await import('../../signals/resource');
    
    // Simular el "padre" que provee $navigationLevel
    const parentInstance = {
      $navigationLevel: new Signal<number>(0)
    };
    
    // Simular findContextSignalFor
    const findContextSignalFor = (propName: string, parentNode: any) => {
      if (parentNode && propName in parentNode.instance) {
        return parentNode.instance[propName];
      }
      return undefined;
    };
    
    // === RouteView L0 (raíz, sin padre) ===
    const l0ParentNode = undefined;
    const l0SourceSignal = findContextSignalFor('$navigationLevel', l0ParentNode);
    
    // Como no tiene padre, crear Signal nuevo
    const l0NavigationSignal = l0SourceSignal 
      ? derived(l0SourceSignal, v => (v ?? 0) + 1)
      : new Signal<number>(0);
    
    // Definir $navigationLevel para que los hijos lo encuentren
    const l0Instance = {
      $navigationLevel: l0NavigationSignal
    };
    const l0AppNode = { instance: l0Instance };
    
    // L0 Computed y Resource
    let l0ResourceExecs = 0;
    const l0LevelCandidates = computed(() => {
      const level = l0NavigationSignal.get();
      return level === 0 ? ['App'] : [];
    });
    
    const l0ComponentClass = createResource(async (signal) => {
      l0ResourceExecs++;
      if (l0ResourceExecs > 10) throw new Error(`L0 loop: ${l0ResourceExecs}`);
      
      const candidates = l0LevelCandidates.get();
      if (candidates.length === 0) return null;
      await new Promise(r => setTimeout(r, 5));
      return { name: candidates[0] };
    });
    
    // === RouteView L1 (hijo de L0) ===
    const l1ParentNode = l0AppNode;
    const l1SourceSignal = findContextSignalFor('$navigationLevel', l1ParentNode);
    
    // El hijo encuentra la señal del padre, crea derived
    expect(l1SourceSignal).toBeDefined();
    const l1NavigationSignal = l1SourceSignal 
      ? derived(l1SourceSignal, v => (v ?? 0) + 1)
      : new Signal<number>(0);
    
    // L1 Computed y Resource
    let l1ResourceExecs = 0;
    const l1LevelCandidates = computed(() => {
      const level = l1NavigationSignal.get();
      return level === 1 ? [] : ['SomePage'];
    });
    
    const l1ComponentClass = createResource(async (signal) => {
      l1ResourceExecs++;
      if (l1ResourceExecs > 10) throw new Error(`L1 loop: ${l1ResourceExecs}`);
      
      const candidates = l1LevelCandidates.get();
      if (candidates.length === 0) return null;
      await new Promise(r => setTimeout(r, 5));
      return { name: candidates[0] };
    });
    
    // Esperar
    await new Promise(r => setTimeout(r, 200));
    
    // Verificar
    expect(l0NavigationSignal.get()).toBe(0);
    expect(l1NavigationSignal.get()).toBe(1);
    expect(l0ComponentClass.state).toBe('ready');
    expect(l1ComponentClass.state).toBe('ready');
    expect(l0ResourceExecs).toBeLessThan(5);
    expect(l1ResourceExecs).toBeLessThan(5);
  });

  it('TEST: Múltiples efectos leyendo mismo computed derivado', async () => {
    /**
     * Hipótesis: El problema podría ser cuando múltiples effects
     * (Resource y Show) leen el mismo computed que depende de un derived
     */
    const { createResource } = await import('../../signals/resource');
    
    const parentSignal = new Signal<number>(0);
    const childSignal = derived(parentSignal, v => (v ?? 0) + 1);
    
    const levelCandidates = computed(() => {
      const level = childSignal.get();
      return level === 1 ? ['App'] : [];
    });
    
    // Effect 1: Resource
    let resourceExecs = 0;
    const resourceState = new Signal<'pending' | 'ready'>('pending');
    
    const resource = createResource(async () => {
      resourceExecs++;
      if (resourceExecs > 10) throw new Error(`Resource loop: ${resourceExecs}`);
      const candidates = levelCandidates.get();
      await new Promise(r => setTimeout(r, 5));
      return candidates;
    });
    
    // Effect 2: Simula Show (effect que lee resource.state)
    let showExecs = 0;
    const showEffect = effect(() => {
      showExecs++;
      if (showExecs > 20) throw new Error(`Show loop: ${showExecs}`);
      
      const state = resource.state;
      const candidates = levelCandidates.get();
    });
    
    await new Promise(r => setTimeout(r, 200));
    
    expect(resourceExecs).toBeLessThan(5);
    expect(showExecs).toBeLessThan(10);
    
    showEffect.dispose();
  });
});
