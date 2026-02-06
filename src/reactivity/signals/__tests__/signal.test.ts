import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Signal, isSignal } from '../signal';
import { effect } from '../effect';
import { computed } from '../computed';
import { derived } from '../derived';
import { phaseScheduler } from '../../phase-scheduler';
import { reactiveContext } from '../../reactive-context';

describe('Signal', () => {
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

  describe('Constructor', () => {
    it('debe crear un Signal con valor inicial', () => {
      const signal = new Signal(42);
      
      expect(signal.get()).toBe(42);
    });

    it('debe crear un Signal con diferentes tipos de valores', () => {
      const numSignal = new Signal(42);
      const strSignal = new Signal('hello');
      const boolSignal = new Signal(true);
      const nullSignal = new Signal(null);
      const undefinedSignal = new Signal(undefined);
      const objSignal = new Signal({ name: 'test' });
      const arrSignal = new Signal([1, 2, 3]);
      
      expect(numSignal.get()).toBe(42);
      expect(strSignal.get()).toBe('hello');
      expect(boolSignal.get()).toBe(true);
      expect(nullSignal.get()).toBe(null);
      expect(undefinedSignal.get()).toBe(undefined);
      expect(objSignal.get()).toEqual({ name: 'test' });
      expect(arrSignal.get()).toEqual([1, 2, 3]);
    });

    it('debe tener la marca isSignal', () => {
      const signal = new Signal(42);
      
      expect(signal.isSignal).toBe(true);
    });
  });

  describe('Método get()', () => {
    it('debe retornar el valor actual', () => {
      const signal = new Signal(10);
      
      expect(signal.get()).toBe(10);
    });

    it('debe retornar el valor actualizado después de set', () => {
      const signal = new Signal(10);
      
      signal.set(20);
      
      expect(signal.get()).toBe(20);
    });

    it('no debe trackear dependencias cuando no hay contexto reactivo', () => {
      const signal = new Signal(10);
      
      // Leer sin contexto reactivo
      signal.get();
      
      // No debe tener subscribers
      const subscribers = signal._getSubscribers();
      expect(subscribers.size).toBe(0);
    });

    it('debe trackear dependencias cuando hay un effect activo', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        signal.get();
      });
      
      // Después de la ejecución inicial, debe tener el effect como subscriber
      const subscribers = signal._getSubscribers();
      expect(subscribers.size).toBe(1);
    });

    it('debe trackear dependencias cuando hay un computed activo', () => {
      const signal = new Signal(10);
      
      const doubled = computed(() => signal.get() * 2);
      doubled.get(); // Leer para inicializar
      
      // Debe tener el computed como subscriber
      const subscribers = signal._getSubscribers();
      expect(subscribers.size).toBe(1);
    });

    it('debe notificar al contexto cuando es trackeada', () => {
      const signal = new Signal(10);
      const trackCallback = vi.fn();
      
      reactiveContext.onTrack = trackCallback;
      
      effect(() => {
        signal.get();
      });
      
      expect(trackCallback).toHaveBeenCalledWith(signal);
      
      reactiveContext.onTrack = null;
    });
  });

  describe('Método set()', () => {
    it('debe actualizar el valor', () => {
      const signal = new Signal(10);
      
      signal.set(20);
      
      expect(signal.get()).toBe(20);
    });

    it('debe notificar a los subscribers cuando el valor cambia', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      let lastValue = 0;
      
      effect(() => {
        executionCount++;
        lastValue = signal.get();
      });
      
      expect(executionCount).toBe(1);
      expect(lastValue).toBe(10);
      
      signal.set(20);
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
      expect(lastValue).toBe(20);
    });

    it('no debe notificar si el valor no cambia (Object.is)', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        signal.get();
      });
      
      expect(executionCount).toBe(1);
      
      // Establecer el mismo valor
      signal.set(10);
      phaseScheduler.flush();
      
      // No debe ejecutarse de nuevo
      expect(executionCount).toBe(1);
    });

    it('debe notificar incluso si el valor es el mismo pero diferente referencia (objetos)', () => {
      const obj1 = { value: 10 };
      const obj2 = { value: 10 }; // Mismo contenido, diferente referencia
      const signal = new Signal(obj1);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        signal.get();
      });
      
      expect(executionCount).toBe(1);
      
      // Establecer un objeto diferente con el mismo contenido
      signal.set(obj2);
      phaseScheduler.flush();
      
      // Debe ejecutarse porque Object.is(obj1, obj2) es false
      expect(executionCount).toBe(2);
    });

    it('debe manejar valores especiales correctamente', () => {
      const signal = new Signal(0);
      
      // NaN
      signal.set(NaN);
      expect(Number.isNaN(signal.get())).toBe(true);
      
      // +0 y -0 son diferentes según Object.is
      signal.set(+0);
      const positiveZero = signal.get();
      signal.set(-0);
      const negativeZero = signal.get();
      
      expect(Object.is(positiveZero, negativeZero)).toBe(false);
    });

    it('debe notificar a múltiples subscribers', () => {
      const signal = new Signal(10);
      let execCount1 = 0;
      let execCount2 = 0;
      let execCount3 = 0;
      
      effect(() => {
        execCount1++;
        signal.get();
      });
      
      effect(() => {
        execCount2++;
        signal.get();
      });
      
      effect(() => {
        execCount3++;
        signal.get();
      });
      
      expect(execCount1).toBe(1);
      expect(execCount2).toBe(1);
      expect(execCount3).toBe(1);
      
      signal.set(20);
      phaseScheduler.flush();
      
      expect(execCount1).toBe(2);
      expect(execCount2).toBe(2);
      expect(execCount3).toBe(2);
    });

    it('debe marcar computeds como dirty cuando cambia la dependencia', () => {
      const signal = new Signal(10);
      let computationCount = 0;
      
      const doubled = computed(() => {
        computationCount++;
        return signal.get() * 2;
      });
      
      expect(computationCount).toBe(0); // Lazy
      
      doubled.get();
      expect(computationCount).toBe(1);
      expect(doubled.get()).toBe(20);
      
      // Cambiar la señal - esto marca el computed como dirty pero no lo recalcula
      signal.set(20);
      
      // El computed es lazy, así que no se recalcula hasta que se lea
      expect(computationCount).toBe(1);
      
      // Al leer, se recalcula síncronamente
      expect(doubled.get()).toBe(40);
      expect(computationCount).toBe(2);
    });

    it('debe agendar effects en el phase scheduler', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        signal.get();
      });
      
      expect(executionCount).toBe(1);
      
      // Cambiar la señal
      signal.set(20);
      
      // Verificar que está en el scheduler
      const info = phaseScheduler.getInfo();
      expect(info.dirtyEffects).toBe(1);
      
      // Antes del flush, no debe ejecutarse
      expect(executionCount).toBe(1);
      
      // Después del flush, debe ejecutarse
      phaseScheduler.flush();
      expect(executionCount).toBe(2);
    });
  });

  describe('Método update()', () => {
    it('debe actualizar el valor usando una función', () => {
      const signal = new Signal(10);
      
      signal.update(x => x * 2);
      
      expect(signal.get()).toBe(20);
    });

    it('debe pasar el valor actual a la función updater', () => {
      const signal = new Signal(10);
      const updater = vi.fn(x => x + 5);
      
      signal.update(updater);
      
      expect(updater).toHaveBeenCalledWith(10);
      expect(signal.get()).toBe(15);
    });

    it('debe trackear dependencias durante update', () => {
      const signal1 = new Signal(10);
      const signal2 = new Signal(5);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        signal1.get();
      });
      
      // Update que lee otra señal
      signal1.update(current => {
        signal2.get(); // Esto no debe trackear signal2 en signal1
        return current + 1;
      });
      
      // Solo debe notificar a los subscribers de signal1
      phaseScheduler.flush();
      expect(executionCount).toBe(2);
    });

    it('debe notificar a los subscribers después de update', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      let lastValue = 0;
      
      effect(() => {
        executionCount++;
        lastValue = signal.get();
      });
      
      expect(executionCount).toBe(1);
      
      signal.update(x => x + 5);
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
      expect(lastValue).toBe(15);
    });

    it('no debe notificar si update retorna el mismo valor', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        signal.get();
      });
      
      expect(executionCount).toBe(1);
      
      signal.update(x => x); // Retorna el mismo valor
      phaseScheduler.flush();
      
      // No debe ejecutarse porque el valor no cambió
      expect(executionCount).toBe(1);
    });
  });

  describe('Suscripciones', () => {
    it('debe agregar subscribers cuando se lee dentro de un effect', () => {
      const signal = new Signal(10);
      
      effect(() => {
        signal.get();
      });
      
      const subscribers = signal._getSubscribers();
      expect(subscribers.size).toBe(1);
    });

    it('debe agregar múltiples subscribers', () => {
      const signal = new Signal(10);
      
      effect(() => signal.get());
      effect(() => signal.get());
      effect(() => signal.get());
      
      const subscribers = signal._getSubscribers();
      expect(subscribers.size).toBe(3);
    });

    it('debe permitir desuscribirse usando _unsubscribe', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      
      const { run } = effect(() => {
        executionCount++;
        signal.get();
      });
      
      expect(executionCount).toBe(1);
      
      // Desuscribirse
      signal._unsubscribe(run);
      
      // Cambiar la señal
      signal.set(20);
      phaseScheduler.flush();
      
      // No debe ejecutarse
      expect(executionCount).toBe(1);
      
      // Verificar que se removió
      const subscribers = signal._getSubscribers();
      expect(subscribers.size).toBe(0);
    });

    it('debe manejar desuscripción de subscribers que no existen', () => {
      const signal = new Signal(10);
      const fakeSubscriber = () => {};
      
      // No debe lanzar error
      expect(() => {
        signal._unsubscribe(fakeSubscriber);
      }).not.toThrow();
    });

    it('debe mantener subscribers únicos (no duplicados)', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      
      const { run } = effect(() => {
        executionCount++;
        signal.get();
      });
      
      // Leer múltiples veces dentro del mismo effect
      effect(() => {
        signal.get();
        signal.get();
        signal.get();
      });
      
      // Debe tener solo 2 subscribers (uno por effect)
      const subscribers = signal._getSubscribers();
      expect(subscribers.size).toBe(2);
    });
  });

  describe('Integración con phase scheduler', () => {
    it('debe agendar effects en el scheduler cuando cambia', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        signal.get();
      });
      
      expect(executionCount).toBe(1);
      
      signal.set(20);
      
      // Verificar que está en el scheduler
      const info = phaseScheduler.getInfo();
      expect(info.dirtyEffects).toBe(1);
      
      phaseScheduler.flush();
      expect(executionCount).toBe(2);
    });

    it('debe evitar duplicados en el scheduler', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        signal.get();
      });
      
      // Cambiar múltiples veces
      signal.set(20);
      signal.set(30);
      signal.set(40);
      
      // Debe estar solo una vez en el scheduler
      const info = phaseScheduler.getInfo();
      expect(info.dirtyEffects).toBe(1);
      
      phaseScheduler.flush();
      
      // Debe ejecutarse solo una vez más
      expect(executionCount).toBe(2);
    });

    it('debe marcar computeds como dirty pero no ejecutarlos hasta que se lean', () => {
      const signal = new Signal(10);
      let computationCount = 0;
      
      const doubled = computed(() => {
        computationCount++;
        return signal.get() * 2;
      });
      
      doubled.get(); // Inicializar
      expect(computationCount).toBe(1);
      
      // Cambiar la señal - esto marca el computed como dirty
      signal.set(20);
      
      // El computed es lazy, así que no se recalcula hasta que se lea
      expect(computationCount).toBe(1);
      
      // No debe estar en el scheduler (los computeds no usan el scheduler)
      const info = phaseScheduler.getInfo();
      expect(info.dirtyEffects).toBe(0);
      
      // Al leer, se recalcula síncronamente
      expect(doubled.get()).toBe(40);
      expect(computationCount).toBe(2);
    });
  });

  describe('Valores especiales', () => {
    it('debe manejar null correctamente', () => {
      const signal = new Signal<number | null>(null);
      
      expect(signal.get()).toBe(null);
      
      signal.set(10);
      expect(signal.get()).toBe(10);
      
      signal.set(null);
      expect(signal.get()).toBe(null);
    });

    it('debe manejar undefined correctamente', () => {
      const signal = new Signal<number | undefined>(undefined);
      
      expect(signal.get()).toBe(undefined);
      
      signal.set(10);
      expect(signal.get()).toBe(10);
      
      signal.set(undefined);
      expect(signal.get()).toBe(undefined);
    });

    it('debe manejar NaN correctamente', () => {
      const signal = new Signal(NaN);
      
      expect(Number.isNaN(signal.get())).toBe(true);
      
      signal.set(10);
      expect(signal.get()).toBe(10);
      
      signal.set(NaN);
      expect(Number.isNaN(signal.get())).toBe(true);
    });

    it('debe distinguir entre +0 y -0', () => {
      const signal = new Signal(+0);
      
      expect(Object.is(signal.get(), +0)).toBe(true);
      
      signal.set(-0);
      expect(Object.is(signal.get(), -0)).toBe(true);
      expect(Object.is(signal.get(), +0)).toBe(false);
    });

    it('debe manejar objetos correctamente', () => {
      const obj1 = { name: 'test', value: 10 };
      const signal = new Signal(obj1);
      
      expect(signal.get()).toBe(obj1);
      
      const obj2 = { name: 'test', value: 20 };
      signal.set(obj2);
      expect(signal.get()).toBe(obj2);
      expect(signal.get()).not.toBe(obj1);
    });

    it('debe manejar arrays correctamente', () => {
      const arr1 = [1, 2, 3];
      const signal = new Signal(arr1);
      
      expect(signal.get()).toBe(arr1);
      
      const arr2 = [4, 5, 6];
      signal.set(arr2);
      expect(signal.get()).toBe(arr2);
      expect(signal.get()).not.toBe(arr1);
    });

    it('debe manejar funciones correctamente', () => {
      const fn1 = () => 1;
      const signal = new Signal(fn1);
      
      expect(signal.get()).toBe(fn1);
      
      const fn2 = () => 2;
      signal.set(fn2);
      expect(signal.get()).toBe(fn2);
    });
  });

  describe('Helper isSignal()', () => {
    it('debe retornar true para instancias de Signal', () => {
      const signal = new Signal(10);
      
      expect(isSignal(signal)).toBe(true);
    });

    it('debe retornar false para valores primitivos', () => {
      expect(isSignal(10)).toBe(false);
      expect(isSignal('hello')).toBe(false);
      expect(isSignal(true)).toBe(false);
      expect(isSignal(null)).toBe(false);
      expect(isSignal(undefined)).toBe(false);
    });

    it('debe retornar false para objetos normales', () => {
      expect(isSignal({})).toBe(false);
      expect(isSignal([])).toBe(false);
      expect(isSignal({ isSignal: true })).toBe(false); // No es suficiente
    });

    it('debe retornar true para Computed (implementa ISignal)', () => {
      const count = new Signal(10);
      const doubled = computed(() => count.get() * 2);
      
      // Computed implementa ISignal (tiene isSignal: true y get())
      expect(isSignal(doubled)).toBe(true);
    });

    it('debe retornar true para Derived (implementa ISignal)', () => {
      const source = new Signal(10);
      const derivedSignal = derived(source, (v: number) => v + 1);
      
      // Derived implementa ISignal (tiene isSignal: true y get())
      expect(isSignal(derivedSignal)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('debe manejar cambios rápidos en secuencia', () => {
      const signal = new Signal(0);
      let executionCount = 0;
      let lastValue = 0;
      
      effect(() => {
        executionCount++;
        lastValue = signal.get();
      });
      
      // Cambios rápidos
      signal.set(1);
      signal.set(2);
      signal.set(3);
      signal.set(4);
      signal.set(5);
      
      // Antes del flush
      expect(executionCount).toBe(1);
      
      // Después del flush, debe ejecutarse solo una vez más
      phaseScheduler.flush();
      expect(executionCount).toBe(2);
      expect(lastValue).toBe(5);
    });

    it('debe manejar efectos que leen la señal múltiples veces', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      let sum = 0;
      
      effect(() => {
        executionCount++;
        sum = signal.get() + signal.get() + signal.get();
      });
      
      expect(executionCount).toBe(1);
      expect(sum).toBe(30);
      
      signal.set(20);
      phaseScheduler.flush();
      
      expect(executionCount).toBe(2);
      expect(sum).toBe(60);
    });

    it('debe manejar efectos que modifican la señal (anti-pattern pero funcional)', () => {
      const signal = new Signal(0);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        const current = signal.get();
        if (current < 5) {
          signal.set(current + 1);
        }
      });
      
      // Debe ejecutarse hasta que llegue a 5
      phaseScheduler.flush();
      phaseScheduler.flush();
      phaseScheduler.flush();
      phaseScheduler.flush();
      phaseScheduler.flush();
      phaseScheduler.flush();
      
      expect(signal.get()).toBe(5);
      expect(executionCount).toBeGreaterThan(1);
    });

    it('debe manejar señales que no tienen subscribers', () => {
      const signal = new Signal(10);
      
      // Cambiar sin subscribers no debe causar error
      expect(() => {
        signal.set(20);
        signal.set(30);
        signal.update(x => x + 1);
      }).not.toThrow();
      
      expect(signal.get()).toBe(31);
    });

    it('debe mantener el valor correcto después de múltiples sets con el mismo valor', () => {
      const signal = new Signal(10);
      let executionCount = 0;
      
      effect(() => {
        executionCount++;
        signal.get();
      });
      
      // Múltiples sets con el mismo valor
      signal.set(10);
      signal.set(10);
      signal.set(10);
      phaseScheduler.flush();
      
      // No debe ejecutarse porque el valor no cambió
      expect(executionCount).toBe(1);
      expect(signal.get()).toBe(10);
    });
  });

  describe('Compatibilidad con ISignal', () => {
    it('debe implementar la interfaz ISignal', () => {
      const signal = new Signal(10);
      
      expect(signal.isSignal).toBe(true);
      expect(typeof signal.get).toBe('function');
      expect(typeof signal.set).toBe('function');
      expect(typeof signal.update).toBe('function');
    });

    it('debe permitir usar get/set/update en secuencia', () => {
      const signal = new Signal(0);
      
      signal.set(10);
      expect(signal.get()).toBe(10);
      
      signal.update(x => x + 5);
      expect(signal.get()).toBe(15);
      
      signal.set(20);
      expect(signal.get()).toBe(20);
    });
  });
});
