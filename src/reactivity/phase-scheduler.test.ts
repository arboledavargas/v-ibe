import { describe, it, expect, beforeEach } from 'vitest';
import { phaseScheduler, Phase } from './phase-scheduler';
import { Signal } from './signals/signal';
import { effect } from './signals/effect';
import { reactiveContext } from './reactive-context';

describe('PhaseScheduler Simple - Sistema basado en fases', () => {
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

  describe('Batching automático', () => {
    it('debe agrupar múltiples cambios en un solo ciclo', () => {
      const a = new Signal(1);
      const b = new Signal(1);
      const c = new Signal(1);
      let execCount = 0;
      
      effect(() => {
        execCount++;
        // Leer las tres señales
        a.get();
        b.get();
        c.get();
      });
      
      expect(execCount).toBe(1);
      
      // Cambiar las tres señales
      a.set(2);
      b.set(2);
      c.set(2);
      
      // Antes del flush, execCount no debe haber cambiado
      expect(execCount).toBe(1);
      
      // Ejecutar el ciclo de fases
      phaseScheduler.flush();
      
      // Debe ejecutarse solo una vez más, no tres veces
      expect(execCount).toBe(2);
    });

    it('debe eliminar duplicados automáticamente', () => {
      const a = new Signal(1);
      let execCount = 0;
      
      effect(() => {
        execCount++;
        a.get();
      });
      
      expect(execCount).toBe(1);
      
      // Cambiar múltiples veces
      a.set(2);
      a.set(3);
      a.set(4);
      
      // El effect debe estar marcado como dirty solo una vez
      const info = phaseScheduler.getInfo();
      expect(info.dirtyEffects).toBe(1);
      
      phaseScheduler.flush();
      
      // Debe ejecutarse solo una vez
      expect(execCount).toBe(2);
    });
  });

  describe('Consistencia', () => {
    it('debe garantizar que todos los effects vean el mismo estado', () => {
      const a = new Signal(1);
      const values: number[] = [];
      
      // Múltiples effects leyendo la misma signal
      effect(() => {
        values.push(a.get());
      });
      
      effect(() => {
        values.push(a.get());
      });
      
      effect(() => {
        values.push(a.get());
      });
      
      values.length = 0; // Clear initial executions
      
      // Cambiar la señal
      a.set(5);
      phaseScheduler.flush();
      
      // Todos los effects deben ver el mismo valor
      expect(values).toEqual([5, 5, 5]);
    });
  });

  describe('Orden de ejecución', () => {
    it('debe ejecutar effects en orden de inserción', () => {
      const a = new Signal(1);
      const executionOrder: string[] = [];
      
      effect(() => {
        a.get();
        executionOrder.push('first');
      });
      
      effect(() => {
        a.get();
        executionOrder.push('second');
      });
      
      effect(() => {
        a.get();
        executionOrder.push('third');
      });
      
      executionOrder.length = 0;
      
      a.set(2);
      phaseScheduler.flush();
      
      expect(executionOrder).toEqual(['first', 'second', 'third']);
    });
  });

  describe('runIfScheduled', () => {
    it('debe ejecutar effect inmediatamente si está dirty', () => {
      const a = new Signal(1);
      let execCount = 0;
      let lastValue = 0;
      
      const { run } = effect(() => {
        execCount++;
        lastValue = a.get();
      });
      
      expect(execCount).toBe(1);
      
      // Cambiar a (marca effect como dirty)
      a.set(5);
      
      // Ejecutar inmediatamente sin flush
      phaseScheduler.runIfScheduled(run);
      
      expect(execCount).toBe(2);
      expect(lastValue).toBe(5);
    });

    it('no debe hacer nada si el effect no está dirty', () => {
      const a = new Signal(1);
      let execCount = 0;
      
      const { run } = effect(() => {
        execCount++;
        a.get();
      });
      
      expect(execCount).toBe(1);
      
      // No cambiar nada
      phaseScheduler.runIfScheduled(run);
      
      // No debe ejecutarse de nuevo
      expect(execCount).toBe(1);
    });
  });

  describe('Fases del ciclo', () => {
    it('debe comenzar en fase IDLE', () => {
      expect(phaseScheduler.getCurrentPhase()).toBe(Phase.IDLE);
    });

    it('debe volver a IDLE después del flush', () => {
      const a = new Signal(1);
      
      effect(() => {
        a.get();
      });
      
      a.set(2);
      phaseScheduler.flush();
      
      expect(phaseScheduler.getCurrentPhase()).toBe(Phase.IDLE);
    });
  });

  describe('Manejo de errores', () => {
    it('debe continuar ejecutando otros effects si uno falla', () => {
      const a = new Signal(1);
      let execCount1 = 0;
      let execCount2 = 0;
      
      // Silenciar el error en consola para el test
      const originalError = console.error;
      console.error = () => {};
      
      effect(() => {
        a.get();
        execCount1++;
        if (execCount1 > 1) {
          throw new Error('Test error');
        }
      });
      
      effect(() => {
        a.get();
        execCount2++;
      });
      
      expect(execCount1).toBe(1);
      expect(execCount2).toBe(1);
      
      a.set(2);
      phaseScheduler.flush();
      
      console.error = originalError;
      
      // Ambos effects deben haber ejecutado
      expect(execCount1).toBe(2);
      expect(execCount2).toBe(2);
    });
  });

  describe('Información del scheduler', () => {
    it('debe reportar información correcta', () => {
      const a = new Signal(1);
      
      effect(() => a.get());
      effect(() => a.get());
      
      // Cambiar la señal
      a.set(2);
      
      const info = phaseScheduler.getInfo();
      expect(info.dirtyEffects).toBe(2);
      expect(info.currentPhase).toBe(Phase.IDLE);
      
      phaseScheduler.flush();
      
      const infoAfter = phaseScheduler.getInfo();
      expect(infoAfter.dirtyEffects).toBe(0);
    });
  });

  describe('Compatibilidad con sistema anterior', () => {
    it('debe ignorar la opción priority en effects', () => {
      const a = new Signal(1);
      let execCount = 0;
      
      // priority es ignorado pero no debe causar error
      effect(() => {
        execCount++;
        a.get();
      }, { priority: 'Frame' as any });
      
      a.set(2);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
    });
  });

  describe('Effects anidados', () => {
    it('debe manejar effects que se agregan durante la ejecución', () => {
      const a = new Signal(1);
      let outerCount = 0;
      let innerCount = 0;
      
      effect(() => {
        outerCount++;
        a.get();
        
        if (outerCount === 2) {
          // Agregar un effect durante la ejecución
          effect(() => {
            innerCount++;
            a.get();
          });
        }
      });
      
      a.set(2);
      phaseScheduler.flush();
      
      expect(outerCount).toBe(2);
      expect(innerCount).toBe(1); // El inner se ejecutó inmediatamente
      
      // Cambiar de nuevo
      a.set(3);
      phaseScheduler.flush();
      
      expect(outerCount).toBe(3);
      expect(innerCount).toBe(2); // El inner se re-ejecuta
    });
  });
});
