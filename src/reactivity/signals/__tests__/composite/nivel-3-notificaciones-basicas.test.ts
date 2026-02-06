import { describe, it, expect, vi } from 'vitest';
import { CompositeSignal, Subscriber } from '../../composite';

// Helper para crear un subscriber síncrono (útil para tests)
function createSyncSubscriber(fn: () => void): Subscriber {
  const subscriber: any = fn;
  subscriber._isComputation = true; // Marcar como computación para ejecución síncrona
  return subscriber;
}

describe('CompositeSignal - Nivel 3: Notificaciones básicas en set', () => {
  describe('Notificación básica de subscribers', () => {
    it('debe ejecutar el subscriber cuando se modifica una propiedad', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executionCount = 0;
      const subscriber = createSyncSubscriber(() => { executionCount++ });
      
      signal.subscribeToProperty('name', subscriber);
      signal.set('name', 'Carlos');
      
      expect(executionCount).toBe(1);
    });

    it('debe ejecutar el subscriber exactamente una vez por cada set', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executionCount = 0;
      const subscriber = createSyncSubscriber(() => { executionCount++ });
      
      signal.subscribeToProperty('name', subscriber);
      
      signal.set('name', 'Carlos');
      expect(executionCount).toBe(1);
      
      signal.set('name', 'Pedro');
      expect(executionCount).toBe(2);
      
      signal.set('name', 'Ana');
      expect(executionCount).toBe(3);
    });

    it('debe ejecutar todos los subscribers de una propiedad cuando cambia', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let count1 = 0, count2 = 0, count3 = 0;
      
      const subscriber1 = createSyncSubscriber(() => { count1++ });
      const subscriber2 = createSyncSubscriber(() => { count2++ });
      const subscriber3 = createSyncSubscriber(() => { count3++ });
      
      signal.subscribeToProperty('name', subscriber1);
      signal.subscribeToProperty('name', subscriber2);
      signal.subscribeToProperty('name', subscriber3);
      
      signal.set('name', 'Carlos');
      
      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(count3).toBe(1);
    });
  });

  describe('Granularidad de notificaciones', () => {
    it('debe notificar SOLO a los subscribers de la propiedad modificada', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      let nameCount = 0, ageCount = 0;
      
      const nameSubscriber = createSyncSubscriber(() => { nameCount++; });
      const ageSubscriber = createSyncSubscriber(() => { ageCount++; });
      
      signal.subscribeToProperty('name', nameSubscriber);
      signal.subscribeToProperty('age', ageSubscriber);
      
      signal.set('name', 'Carlos');
      
      expect(nameCount).toBe(1);
      expect(ageCount).toBe(0);
    });

    it('debe mantener contadores independientes para diferentes propiedades', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30, city: 'Bogotá' });
      let nameCount = 0, ageCount = 0, cityCount = 0;
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => { nameCount++; }));
      signal.subscribeToProperty('age', createSyncSubscriber(() => { ageCount++; }));
      signal.subscribeToProperty('city', createSyncSubscriber(() => { cityCount++; }));
      
      signal.set('name', 'Carlos');
      expect(nameCount).toBe(1);
      expect(ageCount).toBe(0);
      expect(cityCount).toBe(0);
      
      signal.set('age', 35);
      expect(nameCount).toBe(1);
      expect(ageCount).toBe(1);
      expect(cityCount).toBe(0);
      
      signal.set('city', 'Medellín');
      expect(nameCount).toBe(1);
      expect(ageCount).toBe(1);
      expect(cityCount).toBe(1);
    });

    it('debe permitir que un subscriber esté en múltiples propiedades y ejecutarse independientemente', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      let executionCount = 0;
      
      const sharedSubscriber = createSyncSubscriber(() => { executionCount++; });
      
      signal.subscribeToProperty('name', sharedSubscriber);
      signal.subscribeToProperty('age', sharedSubscriber);
      
      signal.set('name', 'Carlos');
      expect(executionCount).toBe(1);
      
      signal.set('age', 35);
      expect(executionCount).toBe(2);
    });
  });

  describe('Comportamiento sin subscribers', () => {
    it('debe funcionar sin errores cuando se modifica una propiedad sin subscribers', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      expect(() => {
        signal.set('name', 'Carlos');
      }).not.toThrow();
      
      expect(signal.get('name')).toBe('Carlos');
    });

    it('debe funcionar cuando ninguna propiedad tiene subscribers', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      signal.set('name', 'Carlos');
      signal.set('age', 35);
      
      expect(signal.get('name')).toBe('Carlos');
      expect(signal.get('age')).toBe(35);
    });

    it('debe funcionar al crear una nueva propiedad sin subscribers', () => {
      const signal = new CompositeSignal<any>({ name: 'Julian' });
      
      signal.set('age', 30);
      
      expect(signal.get('age')).toBe(30);
    });
  });



  describe('Orden de ejecución de subscribers', () => {
    it('debe ejecutar subscribers en el orden en que fueron registrados', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const executionOrder: number[] = [];
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executionOrder.push(1); }));
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executionOrder.push(2); }));
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executionOrder.push(3); }));
      
      signal.set('name', 'Carlos');
      
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('debe mantener el orden de ejecución a través de múltiples sets', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const executionOrder: number[] = [];
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executionOrder.push(1); }));
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executionOrder.push(2); }));
      
      signal.set('name', 'Carlos');
      signal.set('name', 'Pedro');
      
      expect(executionOrder).toEqual([1, 2, 1, 2]);
    });
  });

  describe('Ejecución síncrona de notificaciones', () => {
    it('debe ejecutar subscribers síncronamente', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executed = false;
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executed = true; }));
      
      signal.set('name', 'Carlos');
      
      // Si es síncrono, executed debe ser true inmediatamente
      expect(executed).toBe(true);
    });

    it('debe completar todas las notificaciones antes de retornar del set', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const events: string[] = [];
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => { events.push('subscriber1'); }));
      signal.subscribeToProperty('name', createSyncSubscriber(() => { events.push('subscriber2'); }));
      
      events.push('before-set');
      signal.set('name', 'Carlos');
      events.push('after-set');
      
      expect(events).toEqual(['before-set', 'subscriber1', 'subscriber2', 'after-set']);
    });
  });

  describe('Acceso a valores dentro de subscribers', () => {
    it('debe permitir leer el nuevo valor dentro del subscriber', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let capturedValue: string | undefined;
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => {
        capturedValue = signal.get('name');
      }));
      
      signal.set('name', 'Carlos');
      
      expect(capturedValue).toBe('Carlos');
    });

    it('debe permitir leer otras propiedades dentro del subscriber', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      let capturedAge: number | undefined;
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => {
        capturedAge = signal.get('age');
      }));
      
      signal.set('name', 'Carlos');
      
      expect(capturedAge).toBe(30);
    });
  });

  describe('Caso de uso completo del ejemplo', () => {
    it('debe replicar exactamente el ejemplo del Nivel 3', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      let nameExecutionCount = 0;
      let ageExecutionCount = 0;
      
      const nameSubscriber = createSyncSubscriber(() => { nameExecutionCount++; });
      const ageSubscriber = createSyncSubscriber(() => { ageExecutionCount++; });
      
      signal.subscribeToProperty('name', nameSubscriber);
      signal.subscribeToProperty('age', ageSubscriber);
      
      signal.set('name', 'Carlos');
      expect(nameExecutionCount).toBe(1);
      expect(ageExecutionCount).toBe(0);
      
      signal.set('age', 35);
      expect(nameExecutionCount).toBe(1);
      expect(ageExecutionCount).toBe(1);
    });
  });

  describe('Interacción con vitest mocks', () => {
    it('debe funcionar con spy functions de vitest', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const subscriber: any = vi.fn();
      subscriber._isComputation = true; // Marcar como síncrono
      
      signal.subscribeToProperty('name', subscriber);
      signal.set('name', 'Carlos');
      
      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('debe llamar múltiples spies correctamente', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const spy1: any = vi.fn();
      const spy2: any = vi.fn();
      const spy3: any = vi.fn();
      spy1._isComputation = true;
      spy2._isComputation = true;
      spy3._isComputation = true;
      
      signal.subscribeToProperty('name', spy1);
      signal.subscribeToProperty('name', spy2);
      signal.subscribeToProperty('name', spy3);
      
      signal.set('name', 'Carlos');
      
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
    });
  });
});
