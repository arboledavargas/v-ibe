import { describe, it, expect } from 'vitest';
import { CompositeSignal, Subscriber } from '../../composite';

// Helper para crear un subscriber síncrono (útil para tests)
function createSyncSubscriber(fn: () => void): Subscriber {
  const subscriber: any = fn;
  subscriber._isComputation = true; // Marcar como computación para ejecución síncrona
  return subscriber;
}

describe('CompositeSignal - Nivel 4: Comparación de valores para evitar notificaciones innecesarias', () => {
  describe('Notificación cuando el valor cambia', () => {
    it('debe notificar cuando el valor cambia', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executionCount = 0;
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('name', 'Carlos');
      
      expect(executionCount).toBe(1);
    });

    it('debe notificar múltiples veces cuando el valor cambia múltiples veces', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executionCount = 0;
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('name', 'Carlos');
      signal.set('name', 'Maria');
      signal.set('name', 'Pedro');
      
      expect(executionCount).toBe(3);
    });
  });

  describe('No notificación cuando el valor no cambia', () => {
    it('NO debe notificar cuando se asigna el mismo valor', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executionCount = 0;
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('name', 'Julian'); // Mismo valor
      
      expect(executionCount).toBe(0);
    });

    it('NO debe notificar en múltiples sets con el mismo valor', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      let executionCount = 0;
      
      signal.subscribeToProperty('name', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('name', 'Julian');
      signal.set('name', 'Julian');
      signal.set('name', 'Julian');
      
      expect(executionCount).toBe(0);
    });

    it('debe actualizar el valor solo cuando cambia', () => {
      const signal = new CompositeSignal({ count: 0 });
      let executionCount = 0;
      
      signal.subscribeToProperty('count', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('count', 0); // Mismo valor
      expect(executionCount).toBe(0);
      
      signal.set('count', 1); // Valor diferente
      expect(executionCount).toBe(1);
      
      signal.set('count', 1); // Mismo valor otra vez
      expect(executionCount).toBe(1);
    });
  });

  describe('Caso de uso completo del ejemplo', () => {
    it('debe replicar exactamente el ejemplo del Nivel 4', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      let executionCount = 0;
      const subscriber = createSyncSubscriber(() => { executionCount++; });
      
      signal.subscribeToProperty('name', subscriber);
      
      signal.set('name', 'Carlos');
      expect(executionCount).toBe(1); // Cambió de 'Julian' a 'Carlos'
      
      signal.set('name', 'Carlos');
      expect(executionCount).toBe(1); // Mismo valor, no notifica
      
      signal.set('name', 'Maria');
      expect(executionCount).toBe(2); // Cambió de 'Carlos' a 'Maria'
    });
  });

  describe('Comparación estricta de tipos', () => {
    it('debe tratar number y string como diferentes', () => {
      const signal = new CompositeSignal<any>({ value: 30 });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', '30'); // number 30 -> string '30'
      
      expect(executionCount).toBe(1);
    });

    it('debe tratar 0 y "0" como diferentes', () => {
      const signal = new CompositeSignal<any>({ value: 0 });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', '0');
      
      expect(executionCount).toBe(1);
    });

    it('debe tratar true y 1 como diferentes', () => {
      const signal = new CompositeSignal<any>({ value: true });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', 1);
      
      expect(executionCount).toBe(1);
    });

    it('debe tratar false y 0 como diferentes', () => {
      const signal = new CompositeSignal<any>({ value: false });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', 0);
      
      expect(executionCount).toBe(1);
    });
  });

  describe('Manejo de null y undefined', () => {
    it('NO debe notificar cuando se asigna null a null', () => {
      const signal = new CompositeSignal<any>({ value: null });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', null);
      
      expect(executionCount).toBe(0);
    });

    it('NO debe notificar cuando se asigna undefined a undefined', () => {
      const signal = new CompositeSignal<any>({ value: undefined });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', undefined);
      
      expect(executionCount).toBe(0);
    });

    it('debe notificar cuando cambia de null a undefined', () => {
      const signal = new CompositeSignal<any>({ value: null });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', undefined);
      
      expect(executionCount).toBe(1);
    });

    it('debe notificar cuando cambia de undefined a null', () => {
      const signal = new CompositeSignal<any>({ value: undefined });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', null);
      
      expect(executionCount).toBe(1);
    });

    it('debe notificar cuando cambia de valor a null', () => {
      const signal = new CompositeSignal<any>({ value: 'something' });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', null);
      
      expect(executionCount).toBe(1);
    });

    it('debe notificar cuando cambia de null a valor', () => {
      const signal = new CompositeSignal<any>({ value: null });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', 'something');
      
      expect(executionCount).toBe(1);
    });
  });

  describe('Comparación por referencia para objetos y arrays', () => {
    it('debe notificar cuando se asigna un objeto diferente aunque tenga el mismo contenido', () => {
      const signal = new CompositeSignal({ obj: { x: 1, y: 2 } });
      let executionCount = 0;
      
      signal.subscribeToProperty('obj', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('obj', { x: 1, y: 2 }); // Mismo contenido, diferente referencia
      
      expect(executionCount).toBe(1);
    });

    it('NO debe notificar cuando se asigna la misma referencia de objeto', () => {
      const obj = { x: 1, y: 2 };
      const signal = new CompositeSignal({ obj });
      let executionCount = 0;
      
      signal.subscribeToProperty('obj', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('obj', obj); // Misma referencia
      
      expect(executionCount).toBe(0);
    });

    it('debe notificar cuando se asigna un array diferente aunque tenga el mismo contenido', () => {
      const signal = new CompositeSignal({ arr: [1, 2, 3] });
      let executionCount = 0;
      
      signal.subscribeToProperty('arr', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('arr', [1, 2, 3]); // Mismo contenido, diferente referencia
      
      expect(executionCount).toBe(1);
    });

    it('NO debe notificar cuando se asigna la misma referencia de array', () => {
      const arr = [1, 2, 3];
      const signal = new CompositeSignal({ arr });
      let executionCount = 0;
      
      signal.subscribeToProperty('arr', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('arr', arr); // Misma referencia
      
      expect(executionCount).toBe(0);
    });

    it('debe notificar cuando el contenido del objeto muta (nueva referencia)', () => {
      const signal = new CompositeSignal({ obj: { count: 0 } });
      let executionCount = 0;
      
      signal.subscribeToProperty('obj', createSyncSubscriber(() => { executionCount++; }));
      
      const oldObj = signal.get('obj');
      signal.set('obj', { ...oldObj, count: 1 }); // Nueva referencia con contenido mutado
      
      expect(executionCount).toBe(1);
    });
  });

  describe('Manejo especial de +0 y -0', () => {
    it('NO debe notificar cuando se asigna +0 a +0', () => {
      const signal = new CompositeSignal({ value: +0 });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', +0);
      
      expect(executionCount).toBe(0);
    });

    it('NO debe notificar cuando se asigna -0 a -0', () => {
      const signal = new CompositeSignal({ value: -0 });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', -0);
      
      expect(executionCount).toBe(0);
    });

    it('debe notificar cuando cambia de +0 a -0 (Object.is los distingue)', () => {
      const signal = new CompositeSignal({ value: +0 });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', -0);
      
      // Object.is(+0, -0) es false, por lo que debe notificar
      expect(executionCount).toBe(1);
    });

    it('debe notificar cuando cambia de -0 a +0 (Object.is los distingue)', () => {
      const signal = new CompositeSignal({ value: -0 });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', +0);
      
      // Object.is(-0, +0) es false, por lo que debe notificar
      expect(executionCount).toBe(1);
    });
  });

  describe('Manejo especial de NaN', () => {
    it('NO debe notificar cuando se asigna NaN a NaN', () => {
      const signal = new CompositeSignal({ value: NaN });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', NaN);
      
      // Object.is(NaN, NaN) es true, a diferencia de NaN === NaN que es false
      expect(executionCount).toBe(0);
    });

    it('debe notificar cuando cambia de número a NaN', () => {
      const signal = new CompositeSignal({ value: 42 });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', NaN);
      
      expect(executionCount).toBe(1);
    });

    it('debe notificar cuando cambia de NaN a número', () => {
      const signal = new CompositeSignal({ value: NaN });
      let executionCount = 0;
      
      signal.subscribeToProperty('value', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('value', 42);
      
      expect(executionCount).toBe(1);
    });
  });

  describe('Valores primitivos', () => {
    it('NO debe notificar con strings iguales', () => {
      const signal = new CompositeSignal({ text: 'hello' });
      let executionCount = 0;
      
      signal.subscribeToProperty('text', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('text', 'hello');
      
      expect(executionCount).toBe(0);
    });

    it('NO debe notificar con números iguales', () => {
      const signal = new CompositeSignal({ count: 42 });
      let executionCount = 0;
      
      signal.subscribeToProperty('count', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('count', 42);
      
      expect(executionCount).toBe(0);
    });

    it('NO debe notificar con booleanos iguales', () => {
      const signal = new CompositeSignal({ active: true });
      let executionCount = 0;
      
      signal.subscribeToProperty('active', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('active', true);
      
      expect(executionCount).toBe(0);
    });

    it('debe notificar cuando cambia de true a false', () => {
      const signal = new CompositeSignal({ active: true });
      let executionCount = 0;
      
      signal.subscribeToProperty('active', createSyncSubscriber(() => { executionCount++; }));
      
      signal.set('active', false);
      
      expect(executionCount).toBe(1);
    });
  });

  describe('Optimización: valor no cambia', () => {
    it('no debe actualizar el valor interno cuando no cambia', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const originalValue = signal.get('name');
      
      signal.set('name', 'Julian');
      
      expect(signal.get('name')).toBe(originalValue);
    });

    it('debe actualizar el valor interno solo cuando cambia', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      
      signal.set('name', 'Julian'); // No cambia
      expect(signal.get('name')).toBe('Julian');
      
      signal.set('name', 'Carlos'); // Cambia
      expect(signal.get('name')).toBe('Carlos');
      
      signal.set('name', 'Carlos'); // No cambia
      expect(signal.get('name')).toBe('Carlos');
    });
  });
});
