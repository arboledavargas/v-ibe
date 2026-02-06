import { describe, it, expect, vi } from 'vitest';
import { ReactiveArray } from '../../reactive-array';
import { effect } from '../../effect';
import { phaseScheduler } from '../../../phase-scheduler';

describe('ReactiveArray - Nivel 3: Tracking granular por índice', () => {
  describe('Tracking de acceso por at(index)', () => {
    it('debe registrar el computation como subscriber del índice accedido', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let value = 0;
      
      effect(() => {
        value = arr.at(0)!;
      }, { priority: 'Sync' });
      
      // Verificar que el índice 0 tiene subscribers
      const subscribers = arr.getSubscribers(0);
      expect(subscribers).toBeDefined();
      expect(subscribers!.size).toBe(1);
    });

    it('debe re-ejecutar effect cuando cambia el índice específico observado', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let value = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        value = arr.at(0)!;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(value).toBe(10);
      
      // Cambiar el índice 0 usando splice
      arr.splice(0, 1, 999);
      phaseScheduler.flush(); // Forzar ejecución de effects agendados
      
      expect(execCount).toBe(2);
      expect(value).toBe(999);
    });

    it('NO debe re-ejecutar effect si cambia un índice diferente', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let value = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        value = arr.at(0)!;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      // Cambiar índice 2 (el effect solo observa índice 0)
      arr.splice(2, 1, 999);
      phaseScheduler.flush();
      
      // No debería re-ejecutarse
      expect(execCount).toBe(1);
      expect(value).toBe(10); // Sigue siendo el valor original
    });

    it('debe permitir observar múltiples índices independientemente', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let value0 = 0;
      let value2 = 0;
      let exec0Count = 0;
      let exec2Count = 0;
      
      effect(() => {
        exec0Count++;
        value0 = arr.at(0)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec2Count++;
        value2 = arr.at(2)!;
      }, { priority: 'Sync' });
      
      expect(exec0Count).toBe(1);
      expect(exec2Count).toBe(1);
      
      // Cambiar índice 0 - solo reemplazando, sin cambiar length
      arr.splice(0, 1, 100);
      phaseScheduler.flush();
      
      // Solo el effect de índice 0 se re-ejecuta
      expect(exec0Count).toBe(2);
      expect(exec2Count).toBe(1); // No se re-ejecuta
      
      // Cambiar índice 2
      arr.splice(2, 1, 300);
      phaseScheduler.flush();
      
      expect(exec0Count).toBe(2); // No se re-ejecuta esta vez
      expect(exec2Count).toBe(2); // Se re-ejecuta
    });
  });

  describe('Tracking con índices negativos', () => {
    it('debe normalizar índices negativos al trackear', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let value = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        value = arr.at(-1)!; // Último elemento (índice 2)
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(value).toBe(30);
      
      // El subscriber debe estar registrado en el índice 2
      const subscribers = arr.getSubscribers(2);
      expect(subscribers).toBeDefined();
      expect(subscribers!.size).toBe(1);
    });
  });

  describe('Notificación a índices por operaciones mutadoras', () => {
    it('push debe notificar al nuevo índice pero no a los existentes', () => {
      const arr = new ReactiveArray<number>([10, 20]);
      let value0 = 0;
      let exec0Count = 0;
      
      effect(() => {
        exec0Count++;
        value0 = arr.at(0)!;
      }, { priority: 'Sync' });
      
      expect(exec0Count).toBe(1);
      
      // push agrega al final, no afecta índice 0
      arr.push(30);
      phaseScheduler.flush();
      
      expect(exec0Count).toBe(1); // No se re-ejecutó
      expect(value0).toBe(10);
    });

    it('pop debe notificar al índice eliminado', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let value2: number | undefined = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        value2 = arr.at(2);
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(value2).toBe(30);
      
      // pop elimina el último (índice 2)
      arr.pop();
      phaseScheduler.flush();
      
      expect(execCount).toBe(2); // Se re-ejecutó
      expect(value2).toBeUndefined(); // Ya no existe
    });

    it('shift debe notificar TODOS los índices porque todos se mueven', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let value0 = 0;
      let value1 = 0;
      let value2: number | undefined = 0;
      let exec0Count = 0;
      let exec1Count = 0;
      let exec2Count = 0;
      
      effect(() => {
        exec0Count++;
        value0 = arr.at(0)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec1Count++;
        value1 = arr.at(1)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec2Count++;
        value2 = arr.at(2);
      }, { priority: 'Sync' });
      
      expect(exec0Count).toBe(1);
      expect(exec1Count).toBe(1);
      expect(exec2Count).toBe(1);
      
      // shift remueve el primero, todos los índices cambian
      arr.shift();
      phaseScheduler.flush();
      
      // Todos se re-ejecutan
      expect(exec0Count).toBe(2);
      expect(exec1Count).toBe(2);
      expect(exec2Count).toBe(2);
      
      // Los valores ahora son diferentes
      expect(value0).toBe(20); // Era 10, ahora 20
      expect(value1).toBe(30); // Era 20, ahora 30
      expect(value2).toBeUndefined(); // Era 30, ahora no existe
    });

    it('unshift debe notificar TODOS los índices porque todos se mueven', () => {
      const arr = new ReactiveArray<number>([10, 20]);
      let value0 = 0;
      let value1 = 0;
      let exec0Count = 0;
      let exec1Count = 0;
      
      effect(() => {
        exec0Count++;
        value0 = arr.at(0)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec1Count++;
        value1 = arr.at(1)!;
      }, { priority: 'Sync' });
      
      expect(exec0Count).toBe(1);
      expect(exec1Count).toBe(1);
      
      // unshift agrega al inicio, todos se desplazan
      arr.unshift(5);
      phaseScheduler.flush();
      
      expect(exec0Count).toBe(2);
      expect(exec1Count).toBe(2);
      
      expect(value0).toBe(5); // Era 10, ahora 5
      expect(value1).toBe(10); // Era 20, ahora 10
    });

    it('sort debe notificar TODOS los índices porque el orden cambia', () => {
      const arr = new ReactiveArray<number>([30, 10, 20]);
      let value0 = 0;
      let value1 = 0;
      let value2 = 0;
      let exec0Count = 0;
      let exec1Count = 0;
      let exec2Count = 0;
      
      effect(() => {
        exec0Count++;
        value0 = arr.at(0)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec1Count++;
        value1 = arr.at(1)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec2Count++;
        value2 = arr.at(2)!;
      }, { priority: 'Sync' });
      
      expect(exec0Count).toBe(1);
      expect(value0).toBe(30);
      
      // sort cambia el orden
      arr.sort((a, b) => a - b);
      phaseScheduler.flush();
      
      // Todos se re-ejecutan porque todos los índices cambiaron
      expect(exec0Count).toBe(2);
      expect(exec1Count).toBe(2);
      expect(exec2Count).toBe(2);
      
      expect(value0).toBe(10); // Ahora el primer elemento es 10
      expect(value1).toBe(20);
      expect(value2).toBe(30);
    });

    it('reverse debe notificar TODOS los índices', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let value0 = 0;
      let value2 = 0;
      let exec0Count = 0;
      let exec2Count = 0;
      
      effect(() => {
        exec0Count++;
        value0 = arr.at(0)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec2Count++;
        value2 = arr.at(2)!;
      }, { priority: 'Sync' });
      
      expect(value0).toBe(10);
      expect(value2).toBe(30);
      
      arr.reverse();
      phaseScheduler.flush();
      
      expect(exec0Count).toBe(2);
      expect(exec2Count).toBe(2);
      
      expect(value0).toBe(30); // Se invirtió
      expect(value2).toBe(10); // Se invirtió
    });

    it('fill debe notificar TODOS los índices afectados', () => {
      const arr = new ReactiveArray<number>([10, 20, 30, 40, 50]);
      let value0 = 0;
      let value2 = 0;
      let value4 = 0;
      let exec0Count = 0;
      let exec2Count = 0;
      let exec4Count = 0;
      
      effect(() => {
        exec0Count++;
        value0 = arr.at(0)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec2Count++;
        value2 = arr.at(2)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec4Count++;
        value4 = arr.at(4)!;
      }, { priority: 'Sync' });
      
      expect(exec0Count).toBe(1);
      expect(exec2Count).toBe(1);
      expect(exec4Count).toBe(1);
      
      // fill modifica todos los índices
      arr.fill(0);
      phaseScheduler.flush();
      
      // Todos se re-ejecutan
      expect(exec0Count).toBe(2);
      expect(exec2Count).toBe(2);
      expect(exec4Count).toBe(2);
      
      expect(value0).toBe(0);
      expect(value2).toBe(0);
      expect(value4).toBe(0);
    });

    it('splice debe notificar índices reemplazados cuando no hay desplazamiento', () => {
      const arr = new ReactiveArray<number>([10, 20, 30, 40, 50]);
      let value1 = 0;
      let value3 = 0;
      let exec1Count = 0;
      let exec3Count = 0;
      
      effect(() => {
        exec1Count++;
        value1 = arr.at(1)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec3Count++;
        value3 = arr.at(3)!;
      }, { priority: 'Sync' });
      
      expect(value1).toBe(20);
      expect(value3).toBe(40);
      
      // splice reemplaza 2 por 2: no hay desplazamiento
      arr.splice(1, 2, 100, 200);
      phaseScheduler.flush();
      
      // Solo el effect del índice 1 se re-ejecuta (índice directamente modificado)
      expect(exec1Count).toBe(2);
      expect(exec3Count).toBe(1); // NO se re-ejecuta porque el valor no cambió
      
      expect(value1).toBe(100);
      expect(value3).toBe(40); // No cambió
    });

    it('splice debe notificar todos los índices desde start cuando hay desplazamiento', () => {
      const arr = new ReactiveArray<number>([10, 20, 30, 40, 50]);
      let value1 = 0;
      let value3 = 0;
      let exec1Count = 0;
      let exec3Count = 0;
      
      effect(() => {
        exec1Count++;
        value1 = arr.at(1)!;
      }, { priority: 'Sync' });
      
      effect(() => {
        exec3Count++;
        value3 = arr.at(3)!;
      }, { priority: 'Sync' });
      
      expect(value1).toBe(20);
      expect(value3).toBe(40);
      
      // splice elimina 2 elementos pero agrega 1: hay desplazamiento
      arr.splice(1, 2, 100); // [10, 100, 40, 50]
      phaseScheduler.flush();
      
      // Ambos effects se re-ejecutan porque hay desplazamiento
      expect(exec1Count).toBe(2);
      expect(exec3Count).toBe(2);
      
      expect(value1).toBe(100);
      expect(value3).toBe(50); // Se desplazó
    });
  });

  describe('Casos edge de tracking por índice', () => {
    it('debe manejar acceso a índice fuera de rango', () => {
      const arr = new ReactiveArray<number>([10, 20]);
      let value: number | undefined = 999;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        value = arr.at(5); // Índice fuera de rango
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(value).toBeUndefined();
      
      // Agregar elementos no debería afectar si el índice sigue sin existir
      arr.push(30);
      phaseScheduler.flush();
      
      // Como trackea el índice 5, debería notificarse
      // Pero el valor sigue siendo undefined
      expect(execCount).toBe(1);
    });

    it('debe permitir mismo computation observe múltiples índices', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      let sum = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        sum = arr.at(0)! + arr.at(2)!;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(sum).toBe(40);
      
      // Cambiar índice 0
      arr.splice(0, 1, 15);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(sum).toBe(45); // 15 + 30
      
      // Cambiar índice 2
      arr.splice(2, 1, 35);
      phaseScheduler.flush();
      
      expect(execCount).toBe(3);
      expect(sum).toBe(50); // 15 + 35
    });

    it('debe registrar el subscriber del índice en cada lectura', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      
      effect(() => {
        arr.at(0);
      }, { priority: 'Sync' });
      
      const subs0 = arr.getSubscribers(0);
      expect(subs0).toBeDefined();
      expect(subs0!.size).toBe(1);
      
      // Los otros índices no deberían tener subscribers
      expect(arr.getSubscribers(1)).toBeUndefined();
      expect(arr.getSubscribers(2)).toBeUndefined();
    });
  });
});
