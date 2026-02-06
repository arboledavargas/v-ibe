/**
 * Test de integración para @Ctx con el ciclo de vida completo
 * Simula exactamente lo que pasa en el navegador
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Signal } from '../../signals/signal';
import { derived } from '../../signals/derived';
import { computed } from '../../signals/computed';
import { effect } from '../../signals/effect';
import { createResource } from '../../signals/resource';
import { reactiveContext } from '../../reactive-context';

describe('Integración @Ctx con ciclo de vida completo', () => {
  
  beforeEach(() => {
    reactiveContext.clearStack();
  });

  it('REPRODUCE: Ciclo completo de inicialización como base-component', async () => {
    /**
     * Simula EXACTAMENTE lo que hace base-component:
     * 1. createAndRenderComponent envuelve todo en untrack()
     * 2. Dentro se llama initializeForJSX() que también usa untrack()
     * 3. Dentro de initializeForJSX se inicializan @Ctx y @Resource
     * 4. Luego se llama view() que crea los Shows
     * 5. Los Shows crean effects que leen resource.state
     */
    
    let loopDetected = false;
    let maxIterations = 0;
    
    // Simular createAndRenderComponent con untrack
    reactiveContext.untrack(() => {
      // === PASO 1: Simular constructor e inicialización de @Ctx ===
      
      // RouteView L0 - no tiene padre, crea Signal
      const l0NavigationSignal = new Signal<number>(0);
      
      // === PASO 2: initializeForJSX (también en untrack) ===
      reactiveContext.untrack(() => {
        // initializeContexts() - ya ejecutado arriba
        
        // initializeResources() - crear Resource
        // El Resource crea un effect interno
      });
      
      // === PASO 3: Crear @Computed levelCandidates ===
      let computedExecs = 0;
      const levelCandidates = computed(() => {
        computedExecs++;
        if (computedExecs > 100) {
          loopDetected = true;
          throw new Error('Loop en computed');
        }
        return l0NavigationSignal.get() === 0 ? ['App'] : [];
      });
      
      // === PASO 4: Crear @Resource componentClass ===
      let resourceExecs = 0;
      const componentClass = createResource(async () => {
        resourceExecs++;
        maxIterations = Math.max(maxIterations, resourceExecs);
        if (resourceExecs > 50) {
          loopDetected = true;
          throw new Error('Loop en resource');
        }
        const candidates = levelCandidates.get();
        await new Promise(r => setTimeout(r, 1));
        return candidates.length > 0 ? { name: candidates[0] } : null;
      });
      
      // === PASO 5: view() crea los Shows ===
      // Show crea effect que lee resource.state
      let showEffects = 0;
      
      // Show 1: pending
      const show1Effect = effect(() => {
        showEffects++;
        if (showEffects > 100) {
          loopDetected = true;
          throw new Error('Loop en show effect');
        }
        const isPending = componentClass.state === 'pending';
      });
      
      // Show 2: error
      const show2Effect = effect(() => {
        showEffects++;
        if (showEffects > 100) {
          loopDetected = true;
          throw new Error('Loop en show effect');
        }
        const isError = componentClass.state === 'error';
      });
      
      // Show 3: ready
      const show3Effect = effect(() => {
        showEffects++;
        if (showEffects > 100) {
          loopDetected = true;
          throw new Error('Loop en show effect');
        }
        const isReady = componentClass.state === 'ready';
        if (isReady) {
          // Simular renderizado del componente cargado
          const loadedComponent = componentClass.get();
        }
      });
      
      // Cleanup después del test
      setTimeout(() => {
        show1Effect.dispose();
        show2Effect.dispose();
        show3Effect.dispose();
      }, 500);
    });
    
    // Esperar a que todo se estabilice
    await new Promise(r => setTimeout(r, 300));
    
    expect(loopDetected).toBe(false);
    expect(maxIterations).toBeLessThan(10);
  });

  it('REPRODUCE: RouteView anidados con @Ctx derived', async () => {
    /**
     * Este es el escenario EXACTO del bug:
     * - L0 tiene @Ctx navigationLevel = 0 (Signal)
     * - L1 tiene @Ctx navigationLevel = 1 (derived de L0)
     * - Ambos tienen Resource y Shows
     */
    
    let loopDetected = false;
    
    // === RouteView L0 ===
    let l0: any = {};
    
    reactiveContext.untrack(() => {
      // @Ctx crea Signal porque no tiene padre
      l0.$navigationLevel = new Signal<number>(0);
      
      // @Computed
      let l0ComputedExecs = 0;
      l0.levelCandidates = computed(() => {
        l0ComputedExecs++;
        if (l0ComputedExecs > 50) throw new Error('L0 computed loop');
        return l0.$navigationLevel.get() === 0 ? ['App'] : [];
      });
      
      // @Resource
      let l0ResourceExecs = 0;
      l0.componentClass = createResource(async () => {
        l0ResourceExecs++;
        if (l0ResourceExecs > 20) throw new Error('L0 resource loop');
        const candidates = l0.levelCandidates.get();
        await new Promise(r => setTimeout(r, 1));
        return candidates[0] || null;
      });
      
      // Shows (3 effects)
      let l0ShowExecs = 0;
      l0.shows = [
        effect(() => { l0ShowExecs++; if (l0ShowExecs > 100) throw new Error('L0 show loop'); l0.componentClass.state; }),
        effect(() => { l0ShowExecs++; if (l0ShowExecs > 100) throw new Error('L0 show loop'); l0.componentClass.state; }),
        effect(() => { l0ShowExecs++; if (l0ShowExecs > 100) throw new Error('L0 show loop'); l0.componentClass.state; }),
      ];
    });
    
    // Esperar a que L0 cargue
    await new Promise(r => setTimeout(r, 50));
    
    // === RouteView L1 (creado cuando L0 renderiza su view) ===
    let l1: any = {};
    
    reactiveContext.untrack(() => {
      // @Ctx encuentra $navigationLevel del padre (L0)
      // Crea derived que incrementa el valor
      const sourceSignal = l0.$navigationLevel; // findContextSignalFor encontraría esto
      l1.$navigationLevel = derived(sourceSignal, v => (v ?? 0) + 1);
      
      // @Computed
      let l1ComputedExecs = 0;
      l1.levelCandidates = computed(() => {
        l1ComputedExecs++;
        if (l1ComputedExecs > 50) {
          loopDetected = true;
          throw new Error('L1 computed loop');
        }
        const level = l1.$navigationLevel.get();
        // L1 no tiene candidatos en / 
        return level === 1 ? [] : ['SomePage'];
      });
      
      // @Resource  
      let l1ResourceExecs = 0;
      l1.componentClass = createResource(async () => {
        l1ResourceExecs++;
        if (l1ResourceExecs > 20) {
          loopDetected = true;
          throw new Error('L1 resource loop');
        }
        const candidates = l1.levelCandidates.get();
        await new Promise(r => setTimeout(r, 1));
        return candidates[0] || null;
      });
      
      // Shows
      let l1ShowExecs = 0;
      l1.shows = [
        effect(() => { l1ShowExecs++; if (l1ShowExecs > 100) { loopDetected = true; throw new Error('L1 show loop'); } l1.componentClass.state; }),
        effect(() => { l1ShowExecs++; if (l1ShowExecs > 100) { loopDetected = true; throw new Error('L1 show loop'); } l1.componentClass.state; }),
        effect(() => { l1ShowExecs++; if (l1ShowExecs > 100) { loopDetected = true; throw new Error('L1 show loop'); } l1.componentClass.state; }),
      ];
    });
    
    // Esperar a que todo se estabilice
    await new Promise(r => setTimeout(r, 200));
    
    // Cleanup
    l0.shows.forEach((e: any) => e.dispose());
    l1.shows.forEach((e: any) => e.dispose());
    
    expect(loopDetected).toBe(false);
    expect(l0.componentClass.state).toBe('ready');
    expect(l1.componentClass.state).toBe('ready');
    expect(l1.$navigationLevel.get()).toBe(1);
  });

  it('TEST: Effect dentro de untrack NO debería perder tracking propio', async () => {
    /**
     * Hipótesis: Cuando effect() se crea dentro de untrack(),
     * ¿el effect mantiene su propio tracking?
     */
    
    const signal = new Signal<number>(0);
    let effectRuns = 0;
    
    // Crear effect dentro de untrack
    let eff: any;
    reactiveContext.untrack(() => {
      eff = effect(() => {
        effectRuns++;
        // Este effect debería trackear signal
        const val = signal.get();
      });
    });
    
    expect(effectRuns).toBe(1);
    
    // Cambiar la signal debería re-ejecutar el effect
    signal.set(1);
    await new Promise(r => setTimeout(r, 10));
    
    expect(effectRuns).toBe(2);
    
    eff.dispose();
  });

  it('TEST: Derived dentro de untrack mantiene reactividad', async () => {
    const parent = new Signal<number>(0);
    
    let derivedSignal: any;
    reactiveContext.untrack(() => {
      derivedSignal = derived(parent, v => (v ?? 0) + 1);
    });
    
    expect(derivedSignal.get()).toBe(1);
    
    // Effect que lee el derived
    let effectRuns = 0;
    const eff = effect(() => {
      effectRuns++;
      derivedSignal.get();
    });
    
    expect(effectRuns).toBe(1);
    
    // Cambiar parent debería actualizar derived y re-ejecutar effect
    parent.set(5);
    await new Promise(r => setTimeout(r, 10));
    
    expect(derivedSignal.get()).toBe(6);
    expect(effectRuns).toBe(2);
    
    eff.dispose();
  });
});
