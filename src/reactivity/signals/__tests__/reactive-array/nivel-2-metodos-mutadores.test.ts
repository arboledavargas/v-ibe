import { describe, it, expect } from 'vitest';
import { ReactiveArray } from '../../reactive-array';

describe('ReactiveArray - Nivel 2: Métodos mutadores básicos', () => {
  describe('push - agregar elementos al final', () => {
    it('debe agregar un elemento al final del array', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.push(4);
      
      expect(result).toBe(4); // Retorna la nueva longitud
      expect(arr.length).toBe(4);
      expect(arr.at(3)).toBe(4);
    });

    it('debe agregar múltiples elementos al final', () => {
      const arr = new ReactiveArray<number>([1, 2]);
      
      const result = arr.push(3, 4, 5);
      
      expect(result).toBe(5);
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 4, 5]);
    });

    it('debe funcionar en array vacío', () => {
      const arr = new ReactiveArray<number>();
      
      arr.push(1);
      
      expect(arr.length).toBe(1);
      expect(arr.at(0)).toBe(1);
    });

    it('debe retornar la nueva longitud', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const newLength = arr.push(4, 5);
      
      expect(newLength).toBe(5);
      expect(newLength).toBe(arr.length);
    });
  });

  describe('pop - eliminar último elemento', () => {
    it('debe eliminar y retornar el último elemento', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const removed = arr.pop();
      
      expect(removed).toBe(3);
      expect(arr.length).toBe(2);
      expect(arr.getPlainValue()).toEqual([1, 2]);
    });

    it('debe retornar undefined si el array está vacío', () => {
      const arr = new ReactiveArray<number>();
      
      const removed = arr.pop();
      
      expect(removed).toBeUndefined();
      expect(arr.length).toBe(0);
    });

    it('debe reducir la longitud del array', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.pop();
      expect(arr.length).toBe(4);
      
      arr.pop();
      expect(arr.length).toBe(3);
    });
  });

  describe('shift - eliminar primer elemento', () => {
    it('debe eliminar y retornar el primer elemento', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const removed = arr.shift();
      
      expect(removed).toBe(1);
      expect(arr.length).toBe(2);
      expect(arr.getPlainValue()).toEqual([2, 3]);
    });

    it('debe retornar undefined si el array está vacío', () => {
      const arr = new ReactiveArray<number>();
      
      const removed = arr.shift();
      
      expect(removed).toBeUndefined();
      expect(arr.length).toBe(0);
    });

    it('debe reindexar todos los elementos', () => {
      const arr = new ReactiveArray<string>(['a', 'b', 'c', 'd']);
      
      arr.shift();
      
      expect(arr.at(0)).toBe('b');
      expect(arr.at(1)).toBe('c');
      expect(arr.at(2)).toBe('d');
      expect(arr.length).toBe(3);
    });
  });

  describe('unshift - agregar elementos al inicio', () => {
    it('debe agregar un elemento al inicio', () => {
      const arr = new ReactiveArray<number>([2, 3, 4]);
      
      const result = arr.unshift(1);
      
      expect(result).toBe(4); // Nueva longitud
      expect(arr.at(0)).toBe(1);
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 4]);
    });

    it('debe agregar múltiples elementos al inicio', () => {
      const arr = new ReactiveArray<number>([4, 5]);
      
      const result = arr.unshift(1, 2, 3);
      
      expect(result).toBe(5);
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 4, 5]);
    });

    it('debe reindexar todos los elementos existentes', () => {
      const arr = new ReactiveArray<string>(['c', 'd']);
      
      arr.unshift('a', 'b');
      
      expect(arr.at(0)).toBe('a');
      expect(arr.at(1)).toBe('b');
      expect(arr.at(2)).toBe('c');
      expect(arr.at(3)).toBe('d');
    });

    it('debe funcionar en array vacío', () => {
      const arr = new ReactiveArray<number>();
      
      arr.unshift(1, 2, 3);
      
      expect(arr.getPlainValue()).toEqual([1, 2, 3]);
    });
  });

  describe('splice - insertar/eliminar elementos en posición específica', () => {
    it('debe eliminar elementos desde una posición', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const removed = arr.splice(2, 2); // Eliminar 2 elementos desde índice 2
      
      expect(removed).toEqual([3, 4]);
      expect(arr.getPlainValue()).toEqual([1, 2, 5]);
    });

    it('debe insertar elementos sin eliminar', () => {
      const arr = new ReactiveArray<number>([1, 2, 5]);
      
      const removed = arr.splice(2, 0, 3, 4); // Insertar en índice 2, sin eliminar
      
      expect(removed).toEqual([]);
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 4, 5]);
    });

    it('debe eliminar e insertar simultáneamente', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const removed = arr.splice(2, 2, 30, 40); // Reemplazar 3,4 con 30,40
      
      expect(removed).toEqual([3, 4]);
      expect(arr.getPlainValue()).toEqual([1, 2, 30, 40, 5]);
    });

    it('debe eliminar hasta el final si deleteCount no se especifica', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const removed = arr.splice(2);
      
      expect(removed).toEqual([3, 4, 5]);
      expect(arr.getPlainValue()).toEqual([1, 2]);
    });

    it('debe manejar índices negativos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const removed = arr.splice(-2, 1); // Eliminar penúltimo
      
      expect(removed).toEqual([4]);
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 5]);
    });

    it('debe retornar array vacío si deleteCount es 0 y no se insertan elementos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const removed = arr.splice(1, 0);
      
      expect(removed).toEqual([]);
      expect(arr.getPlainValue()).toEqual([1, 2, 3]); // Sin cambios
    });
  });

  describe('sort - ordenar elementos', () => {
    it('debe ordenar números en orden ascendente con función comparadora', () => {
      const arr = new ReactiveArray<number>([3, 1, 4, 1, 5, 9, 2, 6]);
      
      arr.sort((a, b) => a - b);
      
      expect(arr.getPlainValue()).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    });

    it('debe ordenar strings alfabéticamente sin función comparadora', () => {
      const arr = new ReactiveArray<string>(['banana', 'apple', 'cherry']);
      
      arr.sort();
      
      expect(arr.getPlainValue()).toEqual(['apple', 'banana', 'cherry']);
    });

    it('debe ordenar en orden descendente', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.sort((a, b) => b - a);
      
      expect(arr.getPlainValue()).toEqual([5, 4, 3, 2, 1]);
    });

    it('debe retornar this para encadenamiento', () => {
      const arr = new ReactiveArray<number>([3, 1, 2]);
      
      const result = arr.sort((a, b) => a - b);
      
      expect(result).toBe(arr);
    });

    it('no debe cambiar la longitud del array', () => {
      const arr = new ReactiveArray<number>([5, 3, 1, 4, 2]);
      const originalLength = arr.length;
      
      arr.sort((a, b) => a - b);
      
      expect(arr.length).toBe(originalLength);
    });
  });

  describe('reverse - invertir orden de elementos', () => {
    it('debe invertir el orden de los elementos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.reverse();
      
      expect(arr.getPlainValue()).toEqual([5, 4, 3, 2, 1]);
    });

    it('debe retornar this para encadenamiento', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.reverse();
      
      expect(result).toBe(arr);
    });

    it('no debe cambiar la longitud del array', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      const originalLength = arr.length;
      
      arr.reverse();
      
      expect(arr.length).toBe(originalLength);
    });

    it('debe funcionar con array de un elemento', () => {
      const arr = new ReactiveArray<number>([42]);
      
      arr.reverse();
      
      expect(arr.getPlainValue()).toEqual([42]);
    });

    it('debe funcionar con array vacío', () => {
      const arr = new ReactiveArray<number>();
      
      arr.reverse();
      
      expect(arr.length).toBe(0);
    });
  });

  describe('fill - llenar con un valor', () => {
    it('debe llenar todo el array con un valor', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.fill(0);
      
      expect(arr.getPlainValue()).toEqual([0, 0, 0, 0, 0]);
    });

    it('debe llenar desde un índice específico hasta el final', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.fill(0, 2);
      
      expect(arr.getPlainValue()).toEqual([1, 2, 0, 0, 0]);
    });

    it('debe llenar en un rango específico', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.fill(0, 1, 4);
      
      expect(arr.getPlainValue()).toEqual([1, 0, 0, 0, 5]);
    });

    it('debe manejar índices negativos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.fill(0, -2);
      
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 0, 0]);
    });

    it('debe retornar this para encadenamiento', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.fill(0);
      
      expect(result).toBe(arr);
    });

    it('no debe cambiar la longitud del array', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      const originalLength = arr.length;
      
      arr.fill(0);
      
      expect(arr.length).toBe(originalLength);
    });
  });

  describe('Combinación de operaciones mutadoras', () => {
    it('debe permitir encadenar operaciones que retornan this', () => {
      const arr = new ReactiveArray<number>([3, 1, 4, 1, 5]);
      
      arr.sort((a, b) => a - b).reverse();
      
      expect(arr.getPlainValue()).toEqual([5, 4, 3, 1, 1]);
    });

    it('debe mantener consistencia a través de múltiples mutaciones', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      arr.push(4);
      arr.unshift(0);
      arr.pop();
      arr.shift();
      
      expect(arr.getPlainValue()).toEqual([1, 2, 3]);
    });

    it('debe manejar mutaciones complejas correctamente', () => {
      const arr = new ReactiveArray<number>([5, 3, 8, 1, 9, 2]);
      
      arr.splice(2, 2, 10, 11); // [5, 3, 10, 11, 9, 2]
      arr.sort((a, b) => a - b); // [2, 3, 5, 9, 10, 11]
      arr.reverse(); // [11, 10, 9, 5, 3, 2]
      arr.pop(); // [11, 10, 9, 5, 3]
      arr.shift(); // [10, 9, 5, 3]
      
      expect(arr.getPlainValue()).toEqual([10, 9, 5, 3]);
    });
  });

  describe('Casos edge en mutaciones', () => {
    it('debe manejar push en array con millones sería muy lento, usar array pequeño', () => {
      const arr = new ReactiveArray<number>();
      
      for (let i = 0; i < 100; i++) {
        arr.push(i);
      }
      
      expect(arr.length).toBe(100);
      expect(arr.at(0)).toBe(0);
      expect(arr.at(99)).toBe(99);
    });

    it('debe manejar splice que no cambia nada', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      const before = arr.getPlainValue().slice();
      
      arr.splice(2, 0); // No elimina ni agrega nada
      
      expect(arr.getPlainValue()).toEqual(before);
    });

    it('debe manejar splice con start fuera de rango', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      // start > length debería agregar al final
      arr.splice(10, 0, 4, 5);
      
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 4, 5]);
    });

    it('debe manejar operaciones en array vacío sin errores', () => {
      const arr = new ReactiveArray<number>();
      
      expect(arr.pop()).toBeUndefined();
      expect(arr.shift()).toBeUndefined();
      arr.reverse(); // No debe lanzar error
      arr.sort(); // No debe lanzar error
      arr.fill(0); // No hace nada pero no debe lanzar error
      
      expect(arr.length).toBe(0);
    });
  });
});
