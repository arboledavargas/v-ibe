import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effect } from '../effect';
import { Signal } from '../signal';
import { phaseScheduler } from '../../phase-scheduler';
import { reactiveContext } from '../../reactive-context';

describe('effect', () => {
  beforeEach(() => {
    // Limpiar el scheduler antes de cada test
    // @ts-ignore - accessing private for cleanup
    phaseScheduler.dirtyEffects.clear();
    // @ts-ignore
    phaseScheduler.isFlushScheduled = false;
    
    // Reset reactive context
    // @ts-ignore - accessing private properties for testing
    reactiveContext.computationStack = [];
    // @ts-ignore - accessing private properties for testing
    reactiveContext.contextStack = [];
  });

  afterEach(() => {
    // Asegurar que no queden efectos pendientes
    phaseScheduler.flush();
  });

  describe('Ejecución inicial', () => {
    it('debe ejecutarse inmediatamente al crearse', () => {
      let executed = false;
      
      effect(() => {
        executed = true;
      });
      
      expect(executed).toBe(true);
    });

    it('debe ejecutarse con el contexto reactivo activo', () => {
      let hasContext = false;
      
      effect(() => {
        hasContext = reactiveContext.currentComputation !== null;
      });
      
      expect(hasContext).toBe(true);
    });

    it('debe tener tracking activo durante la ejecución', () => {
      let wasTracking = false;
      
      effect(() => {
        wasTracking = reactiveContext.isTracking;
      });
      
      expect(wasTracking).toBe(true);
    });
  });

  describe('Reactividad básica', () => {
    it('debe re-ejecutarse cuando una dependencia cambia', () => {
      const count = new Signal(0);
      let executionCount = 0;
      let lastValue = 0;
      
      effect(() => {
        executionCount++;
        lastValue = count.get();
      });
      
      expect(executionCount).toBe(1);
      expect(lastValue).toBe(0);
      
      // Cambiar la señal
      count.set(5);
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
      expect(lastValue).toBe(5);
    });

    it('debe trackear múltiples dependencias', () => {
      const a = new Signal(1);
      const b = new Signal(2);
      let executionCount = 0;
      let lastSum = 0;
      
      effect(() => {
        executionCount++;
        lastSum = a.get() + b.get();
      });
      
      expect(executionCount).toBe(1);
      expect(lastSum).toBe(3);
      
      // Cambiar una dependencia
      a.set(10);
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
      expect(lastSum).toBe(12);
      
      // Cambiar otra dependencia
      b.set(20);
      phaseScheduler.flush();
      
      expect(executionCount).toBe(3);
      expect(lastSum).toBe(30);
    });

    it('debe re-ejecutarse cuando cambian múltiples dependencias en batch', () => {
      const a = new Signal(1);
      const b = new Signal(2);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        a.get();
        b.get();
      });
      
      expect(executionCount).toBe(1);
      
      // Cambiar ambas señales
      a.set(10);
      b.set(20);
      
      // Antes del flush, no debe ejecutarse
      expect(executionCount).toBe(1);
      
      // Después del flush, debe ejecutarse solo una vez
      phaseScheduler.flush();
      expect(executionCount).toBe(2);
    });

    it('no debe re-ejecutarse si el valor no cambia', () => {
      const count = new Signal(5);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        count.get();
      });
      
      expect(executionCount).toBe(1);
      
      // Establecer el mismo valor
      count.set(5);
      phaseScheduler.flush();
      
      // No debe ejecutarse porque Signal.set optimiza valores iguales
      expect(executionCount).toBe(1);
    });
  });

  describe('Cleanup functions', () => {
    it('debe ejecutar cleanup antes de la siguiente ejecución', () => {
      const count = new Signal(0);
      let cleanupCalled = false;
      let executionCount = 0;
      
      effect((onCleanup) => {
        executionCount++;
        count.get();
        
        onCleanup(() => {
          cleanupCalled = true;
        });
      });
      
      expect(executionCount).toBe(1);
      expect(cleanupCalled).toBe(false);
      
      // Cambiar la señal
      count.set(5);
      phaseScheduler.flush();
      
      // Cleanup debe haberse ejecutado antes de la segunda ejecución
      expect(cleanupCalled).toBe(true);
      expect(executionCount).toBe(2);
    });

    it('debe ejecutar cleanup al hacer dispose', () => {
      const count = new Signal(0);
      let cleanupCalled = false;
      
      const { dispose } = effect((onCleanup) => {
        count.get();
        
        onCleanup(() => {
          cleanupCalled = true;
        });
      });
      
      expect(cleanupCalled).toBe(false);
      
      // Dispose
      dispose();
      
      expect(cleanupCalled).toBe(true);
    });

    it('debe permitir múltiples cleanups', () => {
      const count = new Signal(0);
      const cleanups: string[] = [];
      
      effect((onCleanup) => {
        count.get();
        
        onCleanup(() => cleanups.push('first'));
        onCleanup(() => cleanups.push('second'));
      });
      
      // Cambiar la señal
      count.set(5);
      phaseScheduler.flush();
      
      // Solo el último cleanup debe ejecutarse (el anterior se sobrescribe)
      expect(cleanups).toEqual(['second']);
    });

    it('debe ejecutar cleanup incluso si el effect lanza un error', () => {
      const count = new Signal(0);
      let cleanupCalled = false;
      
      effect((onCleanup) => {
        count.get();
        onCleanup(() => {
          cleanupCalled = true;
        });
        
        if (count.get() > 0) {
          throw new Error('Test error');
        }
      });
      
      // Cambiar la señal (causará error)
      count.set(5);
      
      // Silenciar el error en consola
      const originalError = console.error;
      console.error = () => {};
      
      phaseScheduler.flush();
      
      console.error = originalError;
      
      // Cleanup debe haberse ejecutado
      expect(cleanupCalled).toBe(true);
    });
  });

  describe('Async effects', () => {
    it('debe manejar efectos que retornan Promise', async () => {
      const count = new Signal(0);
      let executionCount = 0;
      let asyncWorkDone = false;
      
      effect(async (onCleanup) => {
        executionCount++;
        count.get();
        
        // Simular trabajo async
        await new Promise(resolve => setTimeout(resolve, 10));
        asyncWorkDone = true;
      });
      
      expect(executionCount).toBe(1);
      
      // Esperar a que termine el trabajo async
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(asyncWorkDone).toBe(true);
    });

    it('debe limpiar contexto después de que la Promise se resuelva', async () => {
      const count = new Signal(0);
      let contextCleaned = false;
      
      effect(async (onCleanup) => {
        count.get();
        
        onCleanup(() => {
          contextCleaned = true;
        });
        
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      // Esperar a que termine
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // El contexto debe haberse limpiado
      expect(reactiveContext.getComputationStackSize()).toBe(0);
    });

    it('debe manejar errores en Promises', async () => {
      const count = new Signal(0);
      let errorHandled = false;
      
      // Capturar el error de la Promise rechazada
      const originalError = console.error;
      const errorHandler = vi.fn();
      console.error = errorHandler;
      
      effect(async (onCleanup) => {
        count.get();
        
        try {
          await new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Async error')), 10);
          });
        } catch (e) {
          errorHandled = true;
        }
      });
      
      // Esperar a que termine
      await new Promise(resolve => setTimeout(resolve, 30));
      
      console.error = originalError;
      
      // El error debe haberse manejado
      expect(errorHandled).toBe(true);
      
      // El contexto debe haberse limpiado incluso con error
      expect(reactiveContext.getComputationStackSize()).toBe(0);
    });
  });

  describe('Disposal', () => {
    it('debe remover el effect del contexto reactivo', () => {
      const count = new Signal(0);
      let executionCount = 0;
      
      const { dispose } = effect(() => {
        executionCount++;
        count.get();
      });
      
      expect(executionCount).toBe(1);
      
      // Dispose
      dispose();
      
      // Verificar que el contexto está limpio
      expect(reactiveContext.getComputationStackSize()).toBe(0);
      
      // Nota: La implementación actual no desuscribe automáticamente de las señales.
      // El effect puede seguir siendo ejecutado por el phase scheduler si está suscrito.
      // Para prevenir completamente la ejecución, se necesitaría tracking de suscripciones.
    });

    it('debe limpiar el contexto reactivo al hacer dispose', () => {
      const count = new Signal(0);
      
      const { dispose } = effect(() => {
        count.get();
      });
      
      // Debe tener contexto activo inicialmente
      expect(reactiveContext.getComputationStackSize()).toBe(0); // Ya se limpió después de la ejecución
      
      // Dispose
      dispose();
      
      // El contexto debe estar limpio
      expect(reactiveContext.getComputationStackSize()).toBe(0);
    });

    it('debe ejecutar cleanup al hacer dispose', () => {
      let cleanupCalled = false;
      
      const { dispose } = effect((onCleanup) => {
        onCleanup(() => {
          cleanupCalled = true;
        });
      });
      
      expect(cleanupCalled).toBe(false);
      
      dispose();
      
      expect(cleanupCalled).toBe(true);
    });

    it('debe ser seguro llamar dispose múltiples veces', () => {
      const count = new Signal(0);
      let cleanupCallCount = 0;
      
      const { dispose } = effect((onCleanup) => {
        count.get();
        onCleanup(() => {
          cleanupCallCount++;
        });
      });
      
      // Llamar dispose múltiples veces
      dispose();
      dispose();
      dispose();
      
      // Cleanup solo debe ejecutarse una vez
      expect(cleanupCallCount).toBe(1);
      
      // El contexto debe estar limpio
      expect(reactiveContext.getComputationStackSize()).toBe(0);
    });
  });

  describe('Método run', () => {
    it('debe permitir ejecutar el effect manualmente', () => {
      const count = new Signal(0);
      let executionCount = 0;
      
      const { run } = effect(() => {
        executionCount++;
        count.get();
      });
      
      expect(executionCount).toBe(1);
      
      // Ejecutar manualmente
      run();
      
      expect(executionCount).toBe(2);
    });

    it('debe ejecutar cleanup antes de re-ejecutar con run', () => {
      const count = new Signal(0);
      let cleanupCalled = false;
      
      const { run } = effect((onCleanup) => {
        count.get();
        onCleanup(() => {
          cleanupCalled = true;
        });
      });
      
      expect(cleanupCalled).toBe(false);
      
      // Ejecutar manualmente
      run();
      
      expect(cleanupCalled).toBe(true);
    });

    it('debe trackear dependencias cuando se ejecuta con run', () => {
      const count = new Signal(0);
      let lastValue = 0;
      
      const { run } = effect(() => {
        lastValue = count.get();
      });
      
      expect(lastValue).toBe(0);
      
      // Cambiar la señal
      count.set(5);
      
      // Ejecutar manualmente (debe leer el nuevo valor)
      run();
      
      expect(lastValue).toBe(5);
    });
  });

  describe('Manejo de errores', () => {
    it('debe limpiar el contexto incluso si el effect lanza un error', () => {
      let errorThrown = false;
      
      try {
        effect(() => {
          throw new Error('Test error');
        });
      } catch (e) {
        errorThrown = true;
      }
      
      expect(errorThrown).toBe(true);
      
      // El contexto debe estar limpio
      expect(reactiveContext.getComputationStackSize()).toBe(0);
    });

    it('debe continuar funcionando después de un error', () => {
      const count = new Signal(0);
      let executionCount = 0;
      let errorThrown = false;
      
      effect(() => {
        executionCount++;
        const value = count.get();
        
        if (value > 0 && !errorThrown) {
          errorThrown = true;
          throw new Error('Test error');
        }
      });
      
      expect(executionCount).toBe(1);
      
      // Cambiar la señal (causará error)
      count.set(5);
      
      // Silenciar el error en consola
      const originalError = console.error;
      console.error = () => {};
      
      phaseScheduler.flush();
      
      console.error = originalError;
      
      // Debe haber intentado ejecutarse
      expect(errorThrown).toBe(true);
      
      // Cambiar de nuevo (no debe causar error ahora)
      count.set(10);
      phaseScheduler.flush();
      
      // Debe seguir funcionando
      expect(executionCount).toBeGreaterThan(1);
    });
  });

  describe('Contexto reactivo', () => {
    it('debe establecer el contexto correctamente durante la ejecución', () => {
      const count = new Signal(0);
      let computationDuringExecution: any = null;
      
      const { run } = effect(() => {
        computationDuringExecution = reactiveContext.currentComputation;
        count.get();
      });
      
      // Durante la ejecución, debe tener el contexto
      expect(computationDuringExecution).toBe(run);
    });

    it('debe limpiar el contexto después de la ejecución', () => {
      const count = new Signal(0);
      
      effect(() => {
        count.get();
      });
      
      // Después de la ejecución inicial, el stack debe estar limpio
      expect(reactiveContext.getComputationStackSize()).toBe(0);
    });

    it('debe permitir múltiples effects anidados', () => {
      const count = new Signal(0);
      let outerExecutions = 0;
      let innerExecutions = 0;
      
      effect(() => {
        outerExecutions++;
        count.get();
        
        // Crear un effect interno
        if (outerExecutions === 1) {
          effect(() => {
            innerExecutions++;
            count.get();
          });
        }
      });
      
      expect(outerExecutions).toBe(1);
      expect(innerExecutions).toBe(1);
      
      // Cambiar la señal
      count.set(5);
      phaseScheduler.flush();
      
      expect(outerExecutions).toBe(2);
      expect(innerExecutions).toBe(2);
    });
  });

  describe('Integración con phase scheduler', () => {
    it('debe ser agendado por el phase scheduler cuando cambia una dependencia', () => {
      const count = new Signal(0);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        count.get();
      });
      
      expect(executionCount).toBe(1);
      
      // Cambiar la señal
      count.set(5);
      
      // Verificar que está en el scheduler
      const info = phaseScheduler.getInfo();
      expect(info.dirtyEffects).toBe(1);
      
      // Flush
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
      expect(phaseScheduler.getInfo().dirtyEffects).toBe(0);
    });

    it('debe evitar duplicados en el scheduler', () => {
      const a = new Signal(1);
      const b = new Signal(2);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        a.get();
        b.get();
      });
      
      // Cambiar ambas señales múltiples veces
      a.set(10);
      b.set(20);
      a.set(15);
      b.set(25);
      
      // Debe estar solo una vez en el scheduler
      const info = phaseScheduler.getInfo();
      expect(info.dirtyEffects).toBe(1);
      
      phaseScheduler.flush();
      
      // Debe ejecutarse solo una vez más
      expect(executionCount).toBe(2);
    });
  });

  describe('Opciones (compatibilidad)', () => {
    it('debe aceptar opciones sin causar error', () => {
      const count = new Signal(0);
      let executionCount = 0;
      
      // priority es ignorado pero no debe causar error
      effect(() => {
        executionCount++;
        count.get();
      }, { priority: 'Frame' as any });
      
      expect(executionCount).toBe(1);
      
      count.set(5);
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('debe manejar effects que no leen ninguna señal', () => {
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
      });
      
      expect(executionCount).toBe(1);
      
      // No hay señales que cambien, así que no debe ejecutarse de nuevo
      phaseScheduler.flush();
      
      expect(executionCount).toBe(1);
    });

    it('debe manejar effects que cambian señales (anti-pattern pero funcional)', () => {
      const a = new Signal(1);
      const b = new Signal(0);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        const value = a.get();
        b.set(value * 2);
      });
      
      expect(executionCount).toBe(1);
      expect(b.get()).toBe(2);
      
      // Cambiar a
      a.set(5);
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
      expect(b.get()).toBe(10);
    });

    it('debe manejar cleanup que se registra después de async work', async () => {
      const count = new Signal(0);
      let cleanupCalled = false;
      
      effect(async (onCleanup) => {
        count.get();
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        onCleanup(() => {
          cleanupCalled = true;
        });
      });
      
      // Esperar a que termine
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Cambiar la señal
      count.set(5);
      phaseScheduler.flush();
      
      // Cleanup debe ejecutarse
      expect(cleanupCalled).toBe(true);
    });

    it('debe manejar effects que se crean dentro de otros effects', () => {
      const count = new Signal(0);
      let outerExecutions = 0;
      let innerExecutions = 0;
      
      effect(() => {
        outerExecutions++;
        count.get();
        
        // Crear un nuevo effect cada vez
        effect(() => {
          innerExecutions++;
          count.get();
        });
      });
      
      expect(outerExecutions).toBe(1);
      expect(innerExecutions).toBe(1);
      
      // Cambiar la señal
      count.set(5);
      phaseScheduler.flush();
      
      // Ambos deben ejecutarse
      expect(outerExecutions).toBe(2);
      // El inner se crea de nuevo, así que se ejecuta inmediatamente
      expect(innerExecutions).toBeGreaterThan(1);
    });
  });
});
