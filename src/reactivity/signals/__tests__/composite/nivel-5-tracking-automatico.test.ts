import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CompositeSignal } from '../../composite';
import { effect } from '../../effect';
import { reactiveContext } from '../../../reactive-context';

describe('CompositeSignal - Nivel 5: Integración con reactiveContext para tracking automático', () => {
  // Helper para asegurar limpieza después de cada test
  let disposables: Array<() => void> = [];

  afterEach(() => {
    disposables.forEach(dispose => dispose());
    disposables = [];
  });

  describe('Auto-registro de subscribers dentro de efectos', () => {
    it('debe auto-registrar el efecto como subscriber cuando se accede a una propiedad', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executionCount = 0;

      const { dispose } = effect(() => {
        signal.get('name'); // Auto-registra el efecto
        executionCount++;
      });
      disposables.push(dispose);

      expect(executionCount).toBe(1); // Ejecución inicial

      signal.set('name', 'Carlos');
      
      // Esperar a que el microtask se ejecute (effect usa priority "Sync")
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(executionCount).toBe(2); // Re-ejecución automática
          resolve(undefined);
        });
      });
    });

    it('debe funcionar sin necesidad de llamar manualmente a subscribeToProperty', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let capturedName = '';

      const { dispose } = effect(() => {
        capturedName = signal.get('name');
      });
      disposables.push(dispose);

      expect(capturedName).toBe('Julian');

      signal.set('name', 'Carlos');
      
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(capturedName).toBe('Carlos');
          resolve(undefined);
        });
      });
    });

    it('debe verificar que el subscriber fue registrado internamente', () => {
      const signal = new CompositeSignal({ name: 'Julian' });

      const { dispose, run } = effect(() => {
        signal.get('name');
      });
      disposables.push(dispose);

      const subscribers = signal.getSubscribers('name');
      expect(subscribers).toBeDefined();
      expect(subscribers?.has(run)).toBe(true);
    });
  });

  describe('Acceso fuera de efectos', () => {
    it('NO debe registrar subscriber cuando se accede fuera de un efecto', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      
      const value = signal.get('name'); // Sin efecto activo
      
      expect(value).toBe('Julian');
      expect(signal.getSubscribers('name')).toBeUndefined();
    });

    it('NO debe lanzar error cuando se accede sin efecto activo', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      
      expect(() => {
        signal.get('name');
        signal.get('age');
      }).not.toThrow();
    });

    it('debe funcionar correctamente mezclando accesos dentro y fuera de efectos', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      let nameInEffect = '';

      // Acceso fuera de efecto
      const ageOutside = signal.get('age');
      expect(ageOutside).toBe(30);
      expect(signal.getSubscribers('age')).toBeUndefined();

      // Acceso dentro de efecto
      const { dispose } = effect(() => {
        nameInEffect = signal.get('name');
      });
      disposables.push(dispose);

      expect(nameInEffect).toBe('Julian');
      expect(signal.getSubscribers('name')).toBeDefined();
    });
  });

  describe('Tracking de múltiples propiedades', () => {
    it('debe registrar el efecto en todas las propiedades accedidas', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30, city: 'Bogotá' });

      const { dispose, run } = effect(() => {
        signal.get('name');
        signal.get('age');
        signal.get('city');
      });
      disposables.push(dispose);

      expect(signal.getSubscribers('name')?.has(run)).toBe(true);
      expect(signal.getSubscribers('age')?.has(run)).toBe(true);
      expect(signal.getSubscribers('city')?.has(run)).toBe(true);
    });

    it('debe re-ejecutar el efecto cuando cambia cualquiera de las propiedades accedidas', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      let executionCount = 0;

      const { dispose } = effect(() => {
        signal.get('name');
        signal.get('age');
        executionCount++;
      });
      disposables.push(dispose);

      expect(executionCount).toBe(1);

      signal.set('name', 'Carlos');
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(executionCount).toBe(2);

          signal.set('age', 35);
          queueMicrotask(() => {
            expect(executionCount).toBe(3);
            resolve(undefined);
          });
        });
      });
    });

    it('NO debe re-ejecutar cuando cambia una propiedad no accedida', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30, city: 'Bogotá' });
      let executionCount = 0;

      const { dispose } = effect(() => {
        signal.get('name'); // Solo accede a 'name'
        executionCount++;
      });
      disposables.push(dispose);

      expect(executionCount).toBe(1);

      signal.set('age', 35); // Modifica 'age' que no fue accedida
      signal.set('city', 'Medellín'); // Modifica 'city' que no fue accedida

      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(executionCount).toBe(1); // No debe haber re-ejecución
          resolve(undefined);
        });
      });
    });
  });

  describe('Re-tracking en re-ejecuciones', () => {
    it('debe actualizar el tracking cuando el efecto se re-ejecuta', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      let executionCount = 0;

      const { dispose } = effect(() => {
        signal.get('name');
        signal.get('age');
        executionCount++;
      });
      disposables.push(dispose);

      expect(executionCount).toBe(1);

      signal.set('name', 'Carlos');
      
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(executionCount).toBe(2);
          // En la re-ejecución, el tracking debe funcionar nuevamente
          
          signal.set('age', 35);
          queueMicrotask(() => {
            expect(executionCount).toBe(3);
            resolve(undefined);
          });
        });
      });
    });

    it.skip('debe manejar dependencias dinámicas (diferentes propiedades en cada ejecución) - PENDIENTE: requiere cleanup de dependencias', () => {
      // NOTA: Este test requiere implementar un mecanismo de cleanup de dependencias
      // cuando un efecto se re-ejecuta. Actualmente, los subscribers viejos no se
      // eliminan, lo que causa re-ejecuciones adicionales.
      // Esto se implementará en un nivel posterior cuando agregemos unsubscribe.
      
      const signal = new CompositeSignal({ showAge: false, name: 'Julian', age: 30 });
      let executionCount = 0;
      let capturedValue = '';

      const { dispose } = effect(() => {
        const shouldShowAge = signal.get('showAge');
        if (shouldShowAge) {
          capturedValue = `Age: ${signal.get('age')}`;
        } else {
          capturedValue = `Name: ${signal.get('name')}`;
        }
        executionCount++;
      });
      disposables.push(dispose);

      expect(executionCount).toBe(1);
      expect(capturedValue).toBe('Name: Julian');
    });
  });

  describe('Interacción con reactiveContext.isTracking', () => {
    it('NO debe registrar subscriber cuando isTracking es false', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executionCount = 0;

      const { dispose } = effect(() => {
        // Deshabilitar tracking temporalmente
        reactiveContext.untrack(() => {
          signal.get('name'); // No debe registrarse
        });
        executionCount++;
      });
      disposables.push(dispose);

      expect(executionCount).toBe(1);
      expect(signal.getSubscribers('name')).toBeUndefined();

      signal.set('name', 'Carlos');
      
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(executionCount).toBe(1); // No re-ejecuta
          resolve(undefined);
        });
      });
    });

    it('debe mezclar tracking y untracking correctamente', () => {
      const signal = new CompositeSignal({ tracked: 'A', untracked: 'B' });
      let executionCount = 0;

      const { dispose, run } = effect(() => {
        signal.get('tracked'); // Debe registrarse
        
        reactiveContext.untrack(() => {
          signal.get('untracked'); // NO debe registrarse
        });
        
        executionCount++;
      });
      disposables.push(dispose);

      expect(signal.getSubscribers('tracked')?.has(run)).toBe(true);
      expect(signal.getSubscribers('untracked')).toBeUndefined();

      signal.set('untracked', 'C');
      
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(executionCount).toBe(1); // No re-ejecuta

          signal.set('tracked', 'D');
          queueMicrotask(() => {
            expect(executionCount).toBe(2); // Sí re-ejecuta
            resolve(undefined);
          });
        });
      });
    });
  });

  describe('Múltiples efectos sobre la misma propiedad', () => {
    it('debe permitir que múltiples efectos se registren en la misma propiedad', () => {
      const signal = new CompositeSignal({ count: 0 });
      let effect1Count = 0;
      let effect2Count = 0;
      let effect3Count = 0;

      const { dispose: dispose1 } = effect(() => {
        signal.get('count');
        effect1Count++;
      });
      disposables.push(dispose1);

      const { dispose: dispose2 } = effect(() => {
        signal.get('count');
        effect2Count++;
      });
      disposables.push(dispose2);

      const { dispose: dispose3 } = effect(() => {
        signal.get('count');
        effect3Count++;
      });
      disposables.push(dispose3);

      expect(effect1Count).toBe(1);
      expect(effect2Count).toBe(1);
      expect(effect3Count).toBe(1);

      signal.set('count', 1);
      
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(effect1Count).toBe(2);
          expect(effect2Count).toBe(2);
          expect(effect3Count).toBe(2);
          resolve(undefined);
        });
      });
    });
  });

  describe('Caso de uso completo del ejemplo', () => {
    it('debe replicar exactamente el ejemplo del Nivel 5', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executionCount = 0;

      const { dispose } = effect(() => {
        const name = signal.get('name'); // Auto-registra el efecto actual
        executionCount++;
      });
      disposables.push(dispose);

      expect(executionCount).toBe(1); // Ejecución inicial

      signal.set('name', 'Carlos');
      
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(executionCount).toBe(2); // El efecto se re-ejecuta automáticamente
          resolve(undefined);
        });
      });
    });
  });

  describe('Evitar registros duplicados', () => {
    it('NO debe registrar el mismo efecto múltiples veces en la misma propiedad', () => {
      const signal = new CompositeSignal({ name: 'Julian' });

      const { dispose, run } = effect(() => {
        signal.get('name');
        signal.get('name'); // Acceso duplicado
        signal.get('name'); // Acceso duplicado
      });
      disposables.push(dispose);

      const subscribers = signal.getSubscribers('name');
      // El Set garantiza que solo haya una referencia
      expect(subscribers?.size).toBe(1);
      expect(subscribers?.has(run)).toBe(true);
    });
  });

  describe('Compatibilidad con subscribeToProperty manual', () => {
    it('debe permitir mezclar auto-tracking con suscripción manual', () => {
      const signal = new CompositeSignal({ auto: 'A', manual: 'B' });
      let autoCount = 0;
      let manualCount = 0;

      // Auto-tracking
      const { dispose: disposeAuto } = effect(() => {
        signal.get('auto');
        autoCount++;
      });
      disposables.push(disposeAuto);

      // Suscripción manual
      const manualSubscriber = () => { manualCount++; };
      signal.subscribeToProperty('manual', manualSubscriber);

      expect(autoCount).toBe(1);
      expect(manualCount).toBe(0);

      signal.set('auto', 'A2');
      signal.set('manual', 'B2');
      
      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(autoCount).toBe(2);
          expect(manualCount).toBe(1);
          resolve(undefined);
        });
      });
    });
  });
});
