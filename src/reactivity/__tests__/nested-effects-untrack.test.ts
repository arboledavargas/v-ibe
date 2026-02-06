/**
 * TEST: Bug de suscripciones en effects anidados dentro de untrack
 * 
 * Este test reproduce el bug encontrado en RouteView con Shows anidados:
 * 
 * ESCENARIO:
 * - Effect padre (L0) crea children dentro de untrack()
 * - Los children contienen múltiples effects (L1)
 * - Cada effect L1 debería tener su propia suscripción a la señal
 * 
 * BUG:
 * - Con dos stacks separados (computationStack y contextStack), 
 *   el contextStack tiene prioridad
 * - Cuando untrack() pone tracking=false en contextStack, los effects hijos
 *   leen la computation del padre en lugar de la propia
 * - Resultado: Solo 1 de N effects queda suscrito
 * 
 * ESPERADO:
 * - Cada effect debe tener su propia suscripción
 * - Cuando la señal cambia, TODOS los effects deben re-ejecutarse
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { effect } from '../signals/effect';
import { Signal } from '../signals/signal';
import { phaseScheduler } from '../phase-scheduler';
import { reactiveContext } from '../reactive-context';

describe('Bug: Effects anidados dentro de untrack pierden suscripciones', () => {
  beforeEach(() => {
    // Limpiar el scheduler antes de cada test
    // @ts-ignore - accessing private for cleanup
    phaseScheduler.dirtyEffects.clear();
    // @ts-ignore
    phaseScheduler.isFlushScheduled = false;
    
    // Reset reactive context stacks
    // @ts-ignore - accessing private properties for testing
    reactiveContext.computationStack = [];
    // @ts-ignore - accessing private properties for testing
    reactiveContext.contextStack = [];
  });

  afterEach(() => {
    phaseScheduler.flush();
  });

  it('CRITICAL: Múltiples effects creados dentro de untrack deben tener suscripciones independientes', () => {
    const state = new Signal<'pending' | 'ready' | 'error'>('pending');
    
    // Contadores para verificar que cada effect se ejecuta
    let effect1Executions = 0;
    let effect2Executions = 0;
    let effect3Executions = 0;
    
    // Simular el patrón de Show/RouteView:
    // Un effect padre que crea children dentro de untrack
    effect(() => {
      // Este es el effect padre (como el effect de un Show en L0)
      
      // Simular untrack(() => props.children()) que es lo que hace Show
      reactiveContext.untrack(() => {
        // Dentro del untrack, se crean los effects hijos (como los Shows de L1)
        
        // Effect hijo 1 (Show "pending")
        effect(() => {
          effect1Executions++;
          const currentState = state.get();
          // console.log(`Effect 1: state=${currentState}`);
        });
        
        // Effect hijo 2 (Show "ready")
        effect(() => {
          effect2Executions++;
          const currentState = state.get();
          // console.log(`Effect 2: state=${currentState}`);
        });
        
        // Effect hijo 3 (Show "error")
        effect(() => {
          effect3Executions++;
          const currentState = state.get();
          // console.log(`Effect 3: state=${currentState}`);
        });
      });
    });
    
    // Después de la creación inicial, cada effect debe haberse ejecutado una vez
    expect(effect1Executions).toBe(1);
    expect(effect2Executions).toBe(1);
    expect(effect3Executions).toBe(1);
    
    // Verificar que la señal tiene 3 suscriptores (uno por cada effect hijo)
    // @ts-ignore - accessing private for testing
    const subscriberCount = state._getSubscribers().size;
    console.log(`Subscriber count after creation: ${subscriberCount}`);
    
    // ESTE ES EL TEST CRÍTICO:
    // Con el bug, solo 1 effect queda suscrito
    // Después del fix, deben ser 3
    expect(subscriberCount).toBe(3);
    
    // Cambiar el estado
    state.set('ready');
    phaseScheduler.flush();
    
    // TODOS los effects deben haberse re-ejecutado
    console.log(`After state change: effect1=${effect1Executions}, effect2=${effect2Executions}, effect3=${effect3Executions}`);
    
    expect(effect1Executions).toBe(2);
    expect(effect2Executions).toBe(2);
    expect(effect3Executions).toBe(2);
  });

  it('Effects anidados sin untrack deben funcionar correctamente (control)', () => {
    const state = new Signal('initial');
    
    let innerEffect1Executions = 0;
    let innerEffect2Executions = 0;
    
    // Effect padre que crea effects hijos DIRECTAMENTE (sin untrack)
    effect(() => {
      // Solo crear los hijos en la primera ejecución
      if (innerEffect1Executions === 0 && innerEffect2Executions === 0) {
        effect(() => {
          innerEffect1Executions++;
          state.get();
        });
        
        effect(() => {
          innerEffect2Executions++;
          state.get();
        });
      }
    });
    
    expect(innerEffect1Executions).toBe(1);
    expect(innerEffect2Executions).toBe(1);
    
    // Verificar suscripciones
    // @ts-ignore
    const subscriberCount = state._getSubscribers().size;
    // Deben ser al menos 2 (los effects hijos)
    expect(subscriberCount).toBeGreaterThanOrEqual(2);
    
    // Cambiar estado
    state.set('changed');
    phaseScheduler.flush();
    
    // Ambos effects deben re-ejecutarse
    expect(innerEffect1Executions).toBe(2);
    expect(innerEffect2Executions).toBe(2);
  });

  it('untrack no debe interferir con effects que se crean después', () => {
    const state = new Signal(0);
    let effectExecutions = 0;
    
    // Primero, hacer un untrack
    const untrackedValue = reactiveContext.untrack(() => {
      return state.get(); // Lee sin trackear
    });
    
    expect(untrackedValue).toBe(0);
    
    // Luego, crear un effect (debería funcionar normalmente)
    effect(() => {
      effectExecutions++;
      state.get();
    });
    
    expect(effectExecutions).toBe(1);
    
    // El effect debe estar suscrito
    // @ts-ignore
    expect(state._getSubscribers().size).toBe(1);
    
    // Cambiar estado
    state.set(1);
    phaseScheduler.flush();
    
    expect(effectExecutions).toBe(2);
  });

  it('Simula exactamente el patrón de Show component con RouteView anidado', () => {
    // Esta es una simulación más exacta del caso real
    const resourceState = new Signal<'pending' | 'ready' | 'error'>('pending');
    
    // Track de qué "branch" está visible
    let pendingVisible = false;
    let readyVisible = false;
    let errorVisible = false;
    
    // Contadores de re-renders
    let pendingRenders = 0;
    let readyRenders = 0;
    let errorRenders = 0;
    
    // Simular Show components
    function createShow(
      condition: () => boolean, 
      onTrue: () => void,
      debugName: string
    ) {
      let currentBranch: 'truthy' | 'empty' = 'empty';
      
      effect(() => {
        // PASO 1: Evaluar condición CON tracking
        const shouldShow = condition();
        
        // PASO 2: Renderizar SIN tracking (como hace Show)
        if (shouldShow && currentBranch !== 'truthy') {
          currentBranch = 'truthy';
          reactiveContext.untrack(() => {
            onTrue();
          });
        } else if (!shouldShow && currentBranch !== 'empty') {
          currentBranch = 'empty';
        }
      });
    }
    
    // Simular RouteView L0 que renderiza L1 con sus Shows
    createShow(
      () => true, // L0 siempre visible para este test
      () => {
        // Estos son los Shows de L1 (RouteView anidado)
        createShow(
          () => resourceState.get() === 'pending',
          () => {
            pendingRenders++;
            pendingVisible = true;
            readyVisible = false;
            errorVisible = false;
          },
          'L1-pending'
        );
        
        createShow(
          () => resourceState.get() === 'ready',
          () => {
            readyRenders++;
            readyVisible = true;
            pendingVisible = false;
            errorVisible = false;
          },
          'L1-ready'
        );
        
        createShow(
          () => resourceState.get() === 'error',
          () => {
            errorRenders++;
            errorVisible = true;
            pendingVisible = false;
            readyVisible = false;
          },
          'L1-error'
        );
      },
      'L0'
    );
    
    // Estado inicial: pending
    expect(pendingVisible).toBe(true);
    expect(readyVisible).toBe(false);
    expect(errorVisible).toBe(false);
    
    // Verificar suscripciones
    // @ts-ignore
    const subscribers = resourceState._getSubscribers().size;
    console.log(`RouteView pattern - subscribers: ${subscribers}`);
    
    // DEBE haber 3 suscripciones (una por cada Show de L1)
    expect(subscribers).toBe(3);
    
    // Cambiar estado a 'ready'
    resourceState.set('ready');
    phaseScheduler.flush();
    
    // El Show "ready" debe haberse activado
    console.log(`After ready: pending=${pendingVisible}, ready=${readyVisible}, error=${errorVisible}`);
    expect(readyVisible).toBe(true);
    
    // Verificar que todos los Shows se re-evaluaron
    expect(pendingRenders).toBeGreaterThanOrEqual(1);
    expect(readyRenders).toBe(1); // El ready se renderizó
  });

  it('currentComputation debe retornar el effect correcto dentro de untrack anidado', () => {
    const computationsObserved: (Function | null)[] = [];
    
    const outerEffect = effect(() => {
      computationsObserved.push(reactiveContext.currentComputation);
      
      reactiveContext.untrack(() => {
        // Dentro de untrack, currentComputation debería ser null o el padre
        computationsObserved.push(reactiveContext.currentComputation);
        
        // Crear un effect hijo
        const innerEffect = effect(() => {
          // CRÍTICO: Aquí currentComputation debe ser el innerEffect, NO el outerEffect
          computationsObserved.push(reactiveContext.currentComputation);
        });
        
        // Después del effect hijo, volvemos al contexto de untrack
        computationsObserved.push(reactiveContext.currentComputation);
      });
    });
    
    // Verificar el orden de computations observadas
    // [0]: outerEffect (dentro del effect padre)
    // [1]: outerEffect o null (dentro de untrack, el padre sin tracking)
    // [2]: innerEffect.run (dentro del effect hijo) - ESTE ES EL CRÍTICO
    // [3]: outerEffect o null (después del effect hijo, dentro de untrack)
    
    console.log('Computations observed:', computationsObserved.map((c, i) => `[${i}]: ${c ? c.name || 'anonymous' : 'null'}`));
    
    // El computation[2] (dentro del effect hijo) NO debe ser igual a computation[0] (padre)
    // Si es igual, significa que el effect hijo está usando el contexto del padre (BUG)
    expect(computationsObserved[2]).not.toBe(computationsObserved[0]);
    
    // El computation[2] debe ser una función (el effect hijo)
    expect(typeof computationsObserved[2]).toBe('function');
  });
});
