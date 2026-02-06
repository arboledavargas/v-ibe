import { describe, it, expect } from 'vitest';
import { ReactiveArray } from '../../reactive-array';
import { effect } from '../../effect';
import { phaseScheduler } from '../../../phase-scheduler';

describe('ReactiveArray - Nivel 4: Tracking granular de length', () => {
  describe('Tracking de length property', () => {
    it('debe registrar computation como subscriber de length al leer length', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      
      effect(() => {
        len = arr.length;
      }, { priority: 'Sync' });
      
      // Verificar que hay subscribers de 'length'
      const subscribers = arr.getSubscribers('length');
      expect(subscribers).toBeDefined();
      expect(subscribers!.size).toBe(1);
    });

    it('debe re-ejecutar effect cuando length cambia', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(len).toBe(3);
      
      // Cambiar length con push
      arr.push(40);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(len).toBe(4);
    });

    it('NO debe re-ejecutar effect si length no cambia', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(len).toBe(3);
      
      // sort no cambia length
      arr.sort((a, b) => b - a);
      phaseScheduler.flush();
      
      // NO debería re-ejecutarse
      expect(execCount).toBe(1);
      expect(len).toBe(3);
    });
  });

  describe('Operaciones que cambian length', () => {
    it('push debe notificar a subscribers de length', () => {
      const arr = new ReactiveArray<number>([10, 20]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(len).toBe(2);
      
      arr.push(30);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(len).toBe(3);
      
      arr.push(40, 50);
      phaseScheduler.flush();
      
      expect(execCount).toBe(3);
      expect(len).toBe(5);
    });

    it('pop debe notificar a subscribers de length', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(len).toBe(3);
      
      arr.pop();
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(len).toBe(2);
    });

    it('pop en array vacío NO debe notificar (length no cambia)', () => {
      const arr = new ReactiveArray<number>();
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(len).toBe(0);
      expect(execCount).toBe(1);
      
      arr.pop(); // No hace nada
      phaseScheduler.flush();
      
      // NO debería re-ejecutarse porque length sigue siendo 0
      expect(execCount).toBe(1);
      expect(len).toBe(0);
    });

    it('shift debe notificar a subscribers de length', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(len).toBe(3);
      
      arr.shift();
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(len).toBe(2);
    });

    it('shift en array vacío NO debe notificar', () => {
      const arr = new ReactiveArray<number>();
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      arr.shift();
      phaseScheduler.flush();
      
      expect(execCount).toBe(1);
    });

    it('unshift debe notificar a subscribers de length', () => {
      const arr = new ReactiveArray<number>([10, 20]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(len).toBe(2);
      
      arr.unshift(5);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(len).toBe(3);
      
      arr.unshift(1, 2, 3);
      phaseScheduler.flush();
      
      expect(execCount).toBe(3);
      expect(len).toBe(6);
    });

    it('splice que cambia length debe notificar', () => {
      const arr = new ReactiveArray<number>([10, 20, 30, 40, 50]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(len).toBe(5);
      
      // Eliminar 2 elementos
      arr.splice(1, 2);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(len).toBe(3);
      
      // Agregar 3 elementos
      arr.splice(1, 0, 100, 200, 300);
      phaseScheduler.flush();
      
      expect(execCount).toBe(3);
      expect(len).toBe(6);
    });

    it('splice que NO cambia length NO debe notificar a length', () => {
      const arr = new ReactiveArray<number>([10, 20, 30, 40, 50]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(len).toBe(5);
      expect(execCount).toBe(1);
      
      // Reemplazar 2 elementos por 2 elementos (length no cambia)
      arr.splice(1, 2, 100, 200);
      phaseScheduler.flush();
      
      // NO debería re-ejecutarse
      expect(execCount).toBe(1);
      expect(len).toBe(5);
    });

    it('splice sin cambios NO debe notificar', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      // Splice sin eliminar ni agregar
      arr.splice(1, 0);
      phaseScheduler.flush();
      
      expect(execCount).toBe(1);
    });
  });

  describe('Operaciones que NO cambian length', () => {
    it('sort NO debe notificar a subscribers de length', () => {
      const arr = new ReactiveArray<number>([30, 10, 20]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(len).toBe(3);
      
      arr.sort((a, b) => a - b);
      phaseScheduler.flush();
      
      // NO debería re-ejecutarse
      expect(execCount).toBe(1);
      expect(len).toBe(3);
    });

    it('reverse NO debe notificar a subscribers de length', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(len).toBe(3);
      
      arr.reverse();
      phaseScheduler.flush();
      
      // NO debería re-ejecutarse
      expect(execCount).toBe(1);
      expect(len).toBe(3);
    });

    it('fill NO debe notificar a subscribers de length', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(len).toBe(3);
      
      arr.fill(0);
      phaseScheduler.flush();
      
      // NO debería re-ejecutarse
      expect(execCount).toBe(1);
      expect(len).toBe(3);
    });
  });

  describe('Independencia de tracking length vs índices', () => {
    it('effect que solo lee length NO debe reaccionar a cambios en índices', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(len).toBe(3);
      
      // Cambiar valores sin cambiar length
      arr.splice(0, 1, 999); // Reemplazar primer elemento
      phaseScheduler.flush();
      
      // NO debería re-ejecutarse
      expect(execCount).toBe(1);
      
      arr.sort((a, b) => b - a);
      phaseScheduler.flush();
      
      expect(execCount).toBe(1);
      
      arr.reverse();
      phaseScheduler.flush();
      
      expect(execCount).toBe(1);
    });

    it('effect que lee índice NO debe reaccionar a cambios solo en length', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let value = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        value = arr.at(0)!;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(value).toBe(10);
      
      // push no afecta índice 0
      arr.push(40);
      phaseScheduler.flush();
      
      expect(execCount).toBe(1);
      expect(value).toBe(10);
      
      arr.push(50, 60);
      phaseScheduler.flush();
      
      expect(execCount).toBe(1);
    });

    it('effect que lee length y un índice debe reaccionar a ambos', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let value = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
        value = arr.at(0)!;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(len).toBe(3);
      expect(value).toBe(10);
      
      // push cambia length pero no índice 0
      arr.push(40);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2); // Se re-ejecuta por length
      expect(len).toBe(4);
      expect(value).toBe(10); // Sigue igual
      
      // Cambiar índice 0 (no cambia length)
      arr.splice(0, 1, 999);
      phaseScheduler.flush();
      
      expect(execCount).toBe(3); // Se re-ejecuta por índice
      expect(len).toBe(4); // Sigue igual
      expect(value).toBe(999);
      
      // shift cambia ambos
      arr.shift();
      phaseScheduler.flush();
      
      expect(execCount).toBe(4);
      expect(len).toBe(3);
      expect(value).toBe(20); // El nuevo primer elemento
    });
  });

  describe('Casos edge de tracking de length', () => {
    it('debe manejar múltiples effects observando length', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len1 = 0;
      let len2 = 0;
      let exec1Count = 0;
      let exec2Count = 0;
      
      effect(() => {
        exec1Count++;
        len1 = arr.length;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec2Count++;
        len2 = arr.length;
      }, { priority: 'Sync' });
      
      expect(exec1Count).toBe(1);
      expect(exec2Count).toBe(1);
      
      arr.push(40);
      phaseScheduler.flush();
      
      expect(exec1Count).toBe(2);
      expect(exec2Count).toBe(2);
      expect(len1).toBe(4);
      expect(len2).toBe(4);
    });

    it('debe notificar length solo una vez por operación', () => {
      const arr = new ReactiveArray<number>([10, 20]);
      let execCount = 0;
      
      effect(() => {
        execCount++;
        // Leer length múltiples veces
        const l1 = arr.length;
        const l2 = arr.length;
        const l3 = arr.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      arr.push(30);
      phaseScheduler.flush();
      
      // Solo debe re-ejecutarse una vez aunque leímos length 3 veces
      expect(execCount).toBe(2);
    });

    it('debe manejar cambios de length de 0 a N', () => {
      const arr = new ReactiveArray<number>();
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(len).toBe(0);
      expect(execCount).toBe(1);
      
      arr.push(10);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(len).toBe(1);
      
      arr.push(20, 30, 40);
      phaseScheduler.flush();
      
      expect(execCount).toBe(3);
      expect(len).toBe(4);
    });

    it('debe manejar cambios de length de N a 0', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let len = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        len = arr.length;
      }, { priority: 'Sync' });
      
      expect(len).toBe(3);
      
      arr.splice(0); // Eliminar todo
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(len).toBe(0);
    });
  });
});
