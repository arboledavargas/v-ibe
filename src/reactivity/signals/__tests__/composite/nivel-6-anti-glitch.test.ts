import { describe, it, expect, afterEach } from 'vitest';
import { CompositeSignal } from '../../composite';
import { effect } from '../../effect';
import { computed } from '../../computed';
import { Signal } from '../../signal';

describe('CompositeSignal - Nivel 6: Verificación Anti-Glitch (Sin Batching)', () => {
  let disposables: Array<() => void> = [];

  afterEach(() => {
    disposables.forEach(dispose => dispose());
    disposables = [];
  });

  describe('Lecturas síncronas después de múltiples sets', () => {
    it('debe leer el valor más reciente inmediatamente después de sets consecutivos', () => {
      const signal = new CompositeSignal({ count: 0 });

      signal.set('count', 1);
      signal.set('count', 2);
      signal.set('count', 3);

      // Lectura síncrona inmediata debe retornar el último valor
      expect(signal.get('count')).toBe(3);
    });

    it('debe leer el valor correcto incluso con sets muy rápidos', () => {
      const signal = new CompositeSignal({ name: 'A' });

      for (let i = 0; i < 100; i++) {
        signal.set('name', `Value${i}`);
      }

      // NO debe haber glitch - debe leer Value99
      expect(signal.get('name')).toBe('Value99');
    });

    it('debe mantener consistencia cuando se leen múltiples propiedades después de sets', () => {
      const signal = new CompositeSignal({ x: 0, y: 0 });

      signal.set('x', 10);
      signal.set('y', 20);
      signal.set('x', 100);
      signal.set('y', 200);

      // Ambas lecturas deben ver los últimos valores
      expect(signal.get('x')).toBe(100);
      expect(signal.get('y')).toBe(200);
    });
  });

  describe('Interacción con Computed - Anti-Glitch', () => {
    it('computed debe leer siempre el valor más reciente de CompositeSignal', () => {
      const signal = new CompositeSignal({ count: 0 });
      const double = computed(() => signal.get('count') * 2);

      signal.set('count', 5);
      
      // Lectura síncrona de computed DEBE ver el nuevo valor
      // NO debe haber glitch (no debe leer 0)
      expect(double.get()).toBe(10);
    });

    it('computed debe mantenerse consistente con múltiples sets antes de leer', () => {
      const signal = new CompositeSignal({ value: 1 });
      const squared = computed(() => signal.get('value') ** 2);

      signal.set('value', 2);
      signal.set('value', 3);
      signal.set('value', 4);
      signal.set('value', 5);

      // Computed debe recalcular con el último valor (5)
      expect(squared.get()).toBe(25);
    });

    it('múltiples computeds deben ver valores consistentes', () => {
      const signal = new CompositeSignal({ price: 100 });
      const withTax = computed(() => signal.get('price') * 1.21);
      const discounted = computed(() => signal.get('price') * 0.9);

      signal.set('price', 200);

      // Ambos computed deben ver price = 200
      expect(withTax.get()).toBe(242); // 200 * 1.21
      expect(discounted.get()).toBe(180); // 200 * 0.9
    });

    it('computed anidado debe ver valores consistentes (diamond problem)', () => {
      const signal = new CompositeSignal({ base: 10 });
      
      const doubled = computed(() => signal.get('base') * 2);
      const tripled = computed(() => signal.get('base') * 3);
      const sum = computed(() => doubled.get() + tripled.get());

      signal.set('base', 5);

      // base = 5
      // doubled = 10, tripled = 15
      // sum = 25
      expect(sum.get()).toBe(25);
    });

    it('NO debe haber glitch cuando computed se lee entre sets', () => {
      const signal = new CompositeSignal({ counter: 0 });
      const plusOne = computed(() => signal.get('counter') + 1);

      signal.set('counter', 1);
      expect(plusOne.get()).toBe(2);

      signal.set('counter', 2);
      expect(plusOne.get()).toBe(3);

      signal.set('counter', 3);
      expect(plusOne.get()).toBe(4);
    });
  });

  describe('Interacción con Effects - Scheduler batching', () => {
    it('effect se agenda en scheduler y ejecuta en microtask (batching automático)', () => {
      const signal = new CompositeSignal({ count: 0 });
      const executions: number[] = [];

      const { dispose } = effect(() => {
        executions.push(signal.get('count'));
      });
      disposables.push(dispose);

      expect(executions).toEqual([0]); // Ejecución inicial

      signal.set('count', 1);
      signal.set('count', 2);
      signal.set('count', 3);

      // Todavía no se ejecutó (está agendado en scheduler)
      expect(executions).toEqual([0]);

      return new Promise(resolve => {
        queueMicrotask(() => {
          // El scheduler deduplica, así que solo se ejecuta UNA vez
          // con el último valor
          expect(executions).toEqual([0, 3]);
          resolve(undefined);
        });
      });
    });

    it('múltiples properties cambiando se batchean correctamente', () => {
      const signal = new CompositeSignal({ x: 0, y: 0 });
      const executions: Array<{x: number, y: number}> = [];

      const { dispose } = effect(() => {
        executions.push({
          x: signal.get('x'),
          y: signal.get('y')
        });
      });
      disposables.push(dispose);

      expect(executions).toHaveLength(1);
      expect(executions[0]).toEqual({ x: 0, y: 0 });

      signal.set('x', 10);
      signal.set('y', 20);

      // Todavía no se ejecutó
      expect(executions).toHaveLength(1);

      return new Promise(resolve => {
        queueMicrotask(() => {
          // Scheduler deduplica ambas notificaciones
          expect(executions).toHaveLength(2);
          expect(executions[1]).toEqual({ x: 10, y: 20 });
          resolve(undefined);
        });
      });
    });
  });

  describe('Consistencia entre CompositeSignal y Signal normal', () => {
    it('CompositeSignal y Signal deben comportarse igual ante lecturas síncronas', () => {
      const composite = new CompositeSignal({ value: 0 });
      const normal = new Signal(0);

      composite.set('value', 5);
      normal.set(5);

      // Ambos deben leer el nuevo valor inmediatamente
      expect(composite.get('value')).toBe(5);
      expect(normal.get()).toBe(5);
    });

    it('computed sobre CompositeSignal y Signal deben comportarse igual', () => {
      const composite = new CompositeSignal({ num: 10 });
      const normal = new Signal(10);

      const compDoubled = computed(() => composite.get('num') * 2);
      const normDoubled = computed(() => normal.get() * 2);

      composite.set('num', 7);
      normal.set(7);

      // Ambos computed deben leer el nuevo valor
      expect(compDoubled.get()).toBe(14);
      expect(normDoubled.get()).toBe(14);
    });
  });

  describe('Escenarios complejos de glitch potencial', () => {
    it('NO debe haber glitch en cadena de computeds con múltiples sets', () => {
      const signal = new CompositeSignal({ a: 1 });
      
      const b = computed(() => signal.get('a') + 1);
      const c = computed(() => b.get() + 1);
      const d = computed(() => c.get() + 1);

      signal.set('a', 10);
      signal.set('a', 20);
      signal.set('a', 30);

      // d = c + 1 = (b + 1) + 1 = ((a + 1) + 1) + 1 = a + 3 = 33
      expect(d.get()).toBe(33);
    });

    it('NO debe haber glitch cuando effect lee computed que depende de CompositeSignal', () => {
      const signal = new CompositeSignal({ price: 100 });
      const total = computed(() => signal.get('price') * 1.21);
      const readings: number[] = [];

      const { dispose } = effect(() => {
        readings.push(total.get());
      });
      disposables.push(dispose);

      expect(readings).toEqual([121]); // 100 * 1.21

      signal.set('price', 200);

      return new Promise(resolve => {
        queueMicrotask(() => {
          // Effect debe leer el computed con el valor actualizado
          expect(readings).toEqual([121, 242]); // 200 * 1.21
          resolve(undefined);
        });
      });
    });

    it('NO debe haber glitch - effect se ejecuta en microtask con valor actualizado', () => {
      const signal = new CompositeSignal({ value: 'initial' });
      let capturedInEffect = '';

      const { dispose } = effect(() => {
        capturedInEffect = signal.get('value');
      });
      disposables.push(dispose);

      expect(capturedInEffect).toBe('initial');

      signal.set('value', 'updated');

      // Lectura síncrona fuera del effect debe ver el nuevo valor
      expect(signal.get('value')).toBe('updated');

      // El effect todavía no se re-ejecutó (está agendado)
      expect(capturedInEffect).toBe('initial');

      return new Promise(resolve => {
        queueMicrotask(() => {
          // Ahora el effect se ejecutó con el valor actualizado
          expect(capturedInEffect).toBe('updated');
          resolve(undefined);
        });
      });
    });
  });

  describe('Verificación de scheduler para effects vs subscribers manuales', () => {
    it('subscribers sin _isComputation son agendados en scheduler (asíncrono)', () => {
      const signal = new CompositeSignal({ count: 0 });
      const callOrder: string[] = [];

      const subscriber = () => {
        callOrder.push('subscriber');
      };

      signal.subscribeToProperty('count', subscriber);

      callOrder.push('before-set');
      signal.set('count', 1);
      callOrder.push('after-set');

      // Subscriber se agenda, no ejecuta inmediatamente
      expect(callOrder).toEqual(['before-set', 'after-set']);

      return new Promise(resolve => {
        queueMicrotask(() => {
          expect(callOrder).toEqual(['before-set', 'after-set', 'subscriber']);
          resolve(undefined);
        });
      });
    });

    it('subscribers con _isComputation=true ejecutan síncronamente', () => {
      const signal = new CompositeSignal({ value: 0 });
      const callOrder: string[] = [];

      const syncSubscriber: any = () => {
        callOrder.push('sync-subscriber');
      };
      syncSubscriber._isComputation = true; // Marcar como computación

      signal.subscribeToProperty('value', syncSubscriber);

      callOrder.push('before-set');
      signal.set('value', 1);
      callOrder.push('after-set');

      // Este subscriber SÍ ejecuta síncronamente
      expect(callOrder).toEqual(['before-set', 'sync-subscriber', 'after-set']);
    });
  });

  describe('Edge cases que podrían causar glitches', () => {
    it('NO debe glitchear cuando se hace set del mismo valor múltiples veces', () => {
      const signal = new CompositeSignal({ value: 'A' });
      const comp = computed(() => signal.get('value').toLowerCase());

      signal.set('value', 'A'); // Mismo valor, no notifica
      signal.set('value', 'B'); // Cambia
      signal.set('value', 'B'); // Mismo valor, no notifica
      signal.set('value', 'C'); // Cambia

      expect(comp.get()).toBe('c');
    });

    it('NO debe glitchear con valores null/undefined', () => {
      const signal = new CompositeSignal<any>({ val: null });
      const comp = computed(() => signal.get('val') ?? 'default');

      expect(comp.get()).toBe('default');

      signal.set('val', undefined);
      expect(comp.get()).toBe('default');

      signal.set('val', 'value');
      expect(comp.get()).toBe('value');

      signal.set('val', null);
      expect(comp.get()).toBe('default');
    });

    it('NO debe glitchear cuando computed se lee múltiples veces consecutivas', () => {
      const signal = new CompositeSignal({ n: 5 });
      const comp = computed(() => signal.get('n') * 2);

      signal.set('n', 10);

      // Múltiples lecturas síncronas deben retornar el mismo valor
      expect(comp.get()).toBe(20);
      expect(comp.get()).toBe(20);
      expect(comp.get()).toBe(20);
    });
  });
});
