import { describe, it, expect, beforeEach } from 'vitest';
import { ReactiveArray } from '../../reactive-array';
import { effect } from '../../effect';
import { phaseScheduler } from '../../../phase-scheduler';
import { reactiveContext } from '../../../reactive-context';
import { createArrayProxy } from '../../reactive-proxy';

describe('ReactiveArray - Nivel 5: Tracking de mutation (cualquier cambio)', () => {
  beforeEach(() => {
    // Reset scheduler state before each test
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
  describe('Tracking de mutation con métodos no-mutadores de lectura', () => {
    it('map debe registrar computation como subscriber de mutation', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let mapped: ReactiveArray<number>;
      
      effect(() => {
        mapped = arr.map(x => x * 2);
      }, { priority: 'Sync' });
      
      // Verificar que hay subscribers de 'mutation'
      // Nota: puede haber múltiples (effect + DerivedArrayStrategy)
      const subscribers = arr.getSubscribers('mutation');
      expect(subscribers).toBeDefined();
      expect(subscribers!.size).toBeGreaterThanOrEqual(1);
    });

    it('filter debe registrar computation como subscriber de mutation', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let filtered: ReactiveArray<number>;
      
      effect(() => {
        filtered = arr.filter(x => x > 15);
      }, { priority: 'Sync' });
      
      // Nota: puede haber múltiples subscribers (effect + FilteredArrayStrategy)
      const subscribers = arr.getSubscribers('mutation');
      expect(subscribers).toBeDefined();
      expect(subscribers!.size).toBeGreaterThanOrEqual(1);
    });

    it('forEach debe registrar computation como subscriber de mutation', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let sum = 0;
      
      effect(() => {
        sum = 0;
        arr.forEach(x => { sum += x; });
      }, { priority: 'Sync' });
      
      const subscribers = arr.getSubscribers('mutation');
      expect(subscribers).toBeDefined();
      expect(subscribers!.size).toBe(1);
    });

    it('find debe registrar computation como subscriber de mutation', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let found: number | undefined;
      
      effect(() => {
        found = arr.find(x => x > 15);
      }, { priority: 'Sync' });
      
      const subscribers = arr.getSubscribers('mutation');
      expect(subscribers).toBeDefined();
    });
  });

  describe('Reactividad a CUALQUIER mutación', () => {
    it('debe re-ejecutar effect cuando se hace push', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let mapped: ReactiveArray<number>;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        mapped = arr.map(x => x * 2);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(mapped.getPlainValue()).toEqual([20, 40, 60]);
      
      arr.push(40);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(mapped.getPlainValue()).toEqual([20, 40, 60, 80]);
    });

    it('debe re-ejecutar effect cuando se hace pop', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let filtered: ReactiveArray<number>;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        filtered = arr.filter(x => x > 15);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(filtered.getPlainValue()).toEqual([20, 30]);
      
      arr.pop();
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(filtered.getPlainValue()).toEqual([20]);
    });

    it('debe re-ejecutar effect cuando se hace shift', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let sum = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        sum = 0;
        arr.forEach(x => { sum += x; });
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(sum).toBe(60);
      
      arr.shift();
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(sum).toBe(50); // 20 + 30
    });

    it('debe re-ejecutar effect cuando se hace unshift', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let first: number | undefined;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        first = arr.find(x => x < 15);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(first).toBe(10);
      
      arr.unshift(5);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(first).toBe(5);
    });

    it('debe re-ejecutar effect cuando se hace splice', () => {
      const arr = new ReactiveArray<number>([10, 20, 30, 40, 50]);
      let sliced: number[] = [];
      let execCount = 0;
      
      effect(() => {
        execCount++;
        sliced = arr.slice(1, 4);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(sliced).toEqual([20, 30, 40]);
      
      arr.splice(2, 1, 35); // Reemplazar 30 con 35
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(sliced).toEqual([20, 35, 40]);
    });

    it('debe re-ejecutar effect cuando se hace sort', () => {
      const arr = new ReactiveArray<number>([30, 10, 20]);
      let copy: number[] = [];
      let execCount = 0;
      
      effect(() => {
        execCount++;
        copy = arr.slice();
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(copy).toEqual([30, 10, 20]);
      
      arr.sort((a, b) => a - b);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(copy).toEqual([10, 20, 30]);
    });

    it('debe re-ejecutar effect cuando se hace reverse', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let joined = '';
      let execCount = 0;
      
      effect(() => {
        execCount++;
        joined = arr.slice().join(',');
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(joined).toBe('10,20,30');
      
      arr.reverse();
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(joined).toBe('30,20,10');
    });

    it('debe re-ejecutar effect cuando se hace fill', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let sum = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        sum = 0;
        arr.forEach(x => { sum += x; });
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(sum).toBe(60);
      
      arr.fill(0);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(sum).toBe(0);
    });
  });

  describe('Diferencia entre mutation, length e índices', () => {
    it('mutation debe notificarse incluso si length no cambia', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let mapped: ReactiveArray<number>;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        mapped = arr.map(x => x * 2);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      // sort no cambia length pero sí muta el array
      arr.sort((a, b) => b - a);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2); // Debe re-ejecutarse
      expect(mapped.getPlainValue()).toEqual([60, 40, 20]);
    });

    it('mutation debe notificarse incluso si índices específicos no se leen', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let allValues: ReactiveArray<number>;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        // No accedemos a índices específicos, usamos map
        allValues = arr.map(x => x);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      // Cambiar un valor sin cambiar length
      arr.splice(1, 1, 999);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(allValues.getPlainValue()).toEqual([10, 999, 30]);
    });

    it('effect que solo trackea mutation NO reacciona a lecturas sin mutación', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let execCount = 0;
      
      effect(() => {
        execCount++;
        arr.map(x => x * 2); // Leer pero no mutar
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      // Solo leer, no mutar
      const plain = arr.getPlainValue();
      const val = plain[0]; // Leer directamente el array plano
      
      // No hay notificación porque no hubo mutación
      phaseScheduler.flush();
      expect(execCount).toBe(1);
    });
  });

  describe('Operaciones complejas con mutation tracking', () => {
    it('debe manejar forEach con side effects', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      let evenSum = 0;
      let oddSum = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        evenSum = 0;
        oddSum = 0;
        arr.forEach(x => {
          if (x % 2 === 0) evenSum += x;
          else oddSum += x;
        });
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(evenSum).toBe(6); // 2 + 4
      expect(oddSum).toBe(9); // 1 + 3 + 5
      
      arr.push(6);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(evenSum).toBe(12); // 2 + 4 + 6
      expect(oddSum).toBe(9);
    });

    it('debe manejar find con predicado complejo', () => {
      const arr = new ReactiveArray<{ id: number; active: boolean }>([
        { id: 1, active: false },
        { id: 2, active: true },
        { id: 3, active: false }
      ]);
      const proxy = createArrayProxy(arr);
      let firstActive: any;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        firstActive = proxy.find(item => item.active);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(firstActive?.id).toBe(2);
      
      // Agregar uno activo al inicio
      arr.unshift({ id: 0, active: true });
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(firstActive?.id).toBe(0);
    });

    it('debe manejar filter con múltiples condiciones', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      let filtered: ReactiveArray<number>;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        // Números pares mayores a 5
        filtered = arr.filter(x => x % 2 === 0 && x > 5);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(filtered.getPlainValue()).toEqual([6, 8, 10]);
      
      arr.push(12);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(filtered.getPlainValue()).toEqual([6, 8, 10, 12]);
      
      arr.shift(); // Quitar 1
      phaseScheduler.flush();
      
      expect(execCount).toBe(3);
      expect(filtered.getPlainValue()).toEqual([6, 8, 10, 12]); // Sin cambios en el filtrado
    });

    it('debe manejar map con transformaciones', () => {
      const arr = new ReactiveArray<string>(['hello', 'world']);
      let uppercased: ReactiveArray<string>;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        uppercased = arr.map(s => s.toUpperCase());
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(uppercased.getPlainValue()).toEqual(['HELLO', 'WORLD']);
      
      arr.push('test');
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(uppercased.getPlainValue()).toEqual(['HELLO', 'WORLD', 'TEST']);
    });

    it('debe manejar slice con rangos', () => {
      const arr = new ReactiveArray<number>([10, 20, 30, 40, 50]);
      let middle: number[] = [];
      let execCount = 0;
      
      effect(() => {
        execCount++;
        middle = arr.slice(1, 4);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(middle).toEqual([20, 30, 40]);
      
      // Cambiar elemento en el rango
      arr.splice(2, 1, 35);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(middle).toEqual([20, 35, 40]);
    });

    it('debe manejar concat (no muta pero lee todo el array)', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let concatenated: number[] = [];
      let execCount = 0;
      
      effect(() => {
        execCount++;
        concatenated = arr.concat([40, 50]);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(concatenated).toEqual([10, 20, 30, 40, 50]);
      
      arr.push(35);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(concatenated).toEqual([10, 20, 30, 35, 40, 50]);
    });
  });

  describe('Múltiples effects observando mutation', () => {
    it('debe notificar a todos los effects que observan mutation', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let mapped: ReactiveArray<number>;
      let filtered: ReactiveArray<number>;
      let exec1Count = 0;
      let exec2Count = 0;
      
      effect(() => {
        exec1Count++;
        mapped = arr.map(x => x * 2);
      }, { priority: 'Sync' });
      
      effect(() => {
        exec2Count++;
        filtered = arr.filter(x => x > 15);
      }, { priority: 'Sync' });
      
      expect(exec1Count).toBe(1);
      expect(exec2Count).toBe(1);
      
      arr.push(40);
      phaseScheduler.flush();
      
      expect(exec1Count).toBe(2);
      expect(exec2Count).toBe(2);
      
      arr.sort((a, b) => b - a);
      phaseScheduler.flush();
      
      expect(exec1Count).toBe(3);
      expect(exec2Count).toBe(3);
    });
  });

  describe('Casos edge de mutation tracking', () => {
    it('debe manejar indexOf que no muta pero lee', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let index = -1;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        index = arr.indexOf(20);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(index).toBe(1);
      
      // Cambiar posición del elemento
      arr.reverse();
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(index).toBe(1); // Sigue en posición 1 después del reverse
    });

    it('debe manejar includes que no muta pero lee', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let hasValue = false;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        hasValue = arr.includes(25);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(hasValue).toBe(false);
      
      arr.push(25);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(hasValue).toBe(true);
    });

    it('debe manejar findIndex', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let index = -1;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        index = arr.findIndex(x => x > 25);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(index).toBe(2); // 30 está en índice 2
      
      arr.unshift(40);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(index).toBe(0); // Ahora 40 está en índice 0
    });

    it('debe manejar mutaciones que resultan en array vacío', () => {
      const arr = new ReactiveArray<number>([10]);
      let mapped: ReactiveArray<number>;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        mapped = arr.map(x => x * 2);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(mapped.getPlainValue()).toEqual([20]);
      
      arr.pop();
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(mapped.getPlainValue()).toEqual([]);
    });
  });
});
