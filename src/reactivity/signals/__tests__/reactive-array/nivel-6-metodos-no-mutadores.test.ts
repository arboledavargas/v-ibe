import { describe, it, expect } from 'vitest';
import { ReactiveArray } from '../../reactive-array';
import { createArrayProxy } from '../../reactive-proxy';

describe('ReactiveArray - Nivel 6: Métodos no-mutadores', () => {
  describe('map - transformación de elementos', () => {
    it('debe retornar un nuevo array con elementos transformados', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const doubled = arr.map(x => x * 2);
      
      expect(doubled.getPlainValue()).toEqual([2, 4, 6]);
      expect(doubled.getPlainValue()).not.toBe(arr.getPlainValue());
    });

    it('no debe modificar el array original', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      arr.map(x => x * 10);
      
      expect(arr.getPlainValue()).toEqual([1, 2, 3]);
    });

    it('debe recibir índice y array en el callback', () => {
      const arr = new ReactiveArray<string>(['a', 'b', 'c']);
      
      const indexed = arr.map((value, index, array) => `${index}:${value}`);
      
      expect(indexed.getPlainValue()).toEqual(['0:a', '1:b', '2:c']);
    });

    it('debe trabajar con transformaciones de tipo', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const strings = arr.map(x => x.toString());
      
      expect(strings.getPlainValue()).toEqual(['1', '2', '3']);
    });
  });

  describe('filter - filtrado de elementos', () => {
    it('debe retornar array con elementos que cumplen el predicado', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const evens = arr.filter(x => x % 2 === 0);
      
      expect(evens.getPlainValue()).toEqual([2, 4]);
    });

    it('no debe modificar el array original', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.filter(x => x > 3);
      
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 4, 5]);
    });

    it('debe retornar array vacío si ningún elemento cumple', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.filter(x => x > 10);
      
      expect(result.getPlainValue()).toEqual([]);
    });

    it('debe retornar todos los elementos si todos cumplen', () => {
      const arr = new ReactiveArray<number>([2, 4, 6]);
      
      const result = arr.filter(x => x % 2 === 0);
      
      expect(result.getPlainValue()).toEqual([2, 4, 6]);
    });

    it('debe recibir índice y array en el callback', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      
      const result = arr.filter((value, index) => index > 0);
      
      expect(result.getPlainValue()).toEqual([20, 30]);
    });
  });

  describe('slice - copiar porción del array', () => {
    it('debe retornar copia de todo el array sin argumentos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const copy = arr.slice();
      
      expect(copy).toEqual([1, 2, 3, 4, 5]);
      expect(copy).not.toBe(arr.getPlainValue());
    });

    it('debe retornar porción desde índice hasta el final', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const result = arr.slice(2);
      
      expect(result).toEqual([3, 4, 5]);
    });

    it('debe retornar porción entre dos índices', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const result = arr.slice(1, 4);
      
      expect(result).toEqual([2, 3, 4]);
    });

    it('debe soportar índices negativos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const result = arr.slice(-3, -1);
      
      expect(result).toEqual([3, 4]);
    });

    it('no debe modificar el array original', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.slice(1, 3);
      
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('concat - concatenar arrays', () => {
    it('debe concatenar array con elementos individuales', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.concat(4, 5);
      
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('debe concatenar array con otro array', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.concat([4, 5]);
      
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('debe concatenar con múltiples arrays', () => {
      const arr = new ReactiveArray<number>([1, 2]);
      
      const result = arr.concat([3, 4], [5, 6]);
      
      expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('debe concatenar con mezcla de elementos y arrays', () => {
      const arr = new ReactiveArray<number>([1, 2]);
      
      const result = arr.concat(3, [4, 5], 6);
      
      expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('no debe modificar el array original', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      arr.concat([4, 5]);
      
      expect(arr.getPlainValue()).toEqual([1, 2, 3]);
    });
  });

  describe('find - buscar elemento', () => {
    it('debe retornar el primer elemento que cumple el predicado', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const result = arr.find(x => x > 3);
      
      expect(result).toBe(4);
    });

    it('debe retornar undefined si ningún elemento cumple', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.find(x => x > 10);
      
      expect(result).toBeUndefined();
    });

    it('debe retornar el primer match aunque haya múltiples', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const result = arr.find(x => x > 2);
      
      expect(result).toBe(3); // Primer elemento > 2
    });

    it('debe recibir índice y array en el callback', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      
      const result = arr.find((value, index) => index === 1);
      
      expect(result).toBe(20);
    });

    it('debe trabajar con objetos', () => {
      const arr = new ReactiveArray([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
      ]);
      
      const proxy = createArrayProxy(arr);
      const result = proxy.find(item => item.name === 'Bob');
      
      // El resultado es un CompositeSignal envuelto
      expect(result.id).toBe(2);
      expect(result.name).toBe('Bob');
    });
  });

  describe('findIndex - buscar índice', () => {
    it('debe retornar el índice del primer elemento que cumple', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const result = arr.findIndex(x => x > 3);
      
      expect(result).toBe(3); // Índice de 4
    });

    it('debe retornar -1 si ningún elemento cumple', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.findIndex(x => x > 10);
      
      expect(result).toBe(-1);
    });

    it('debe recibir índice y array en el callback', () => {
      const arr = new ReactiveArray<string>(['a', 'b', 'c']);
      
      const result = arr.findIndex((value, index) => index === 2);
      
      expect(result).toBe(2);
    });
  });

  describe('indexOf - buscar por valor', () => {
    it('debe retornar el índice del elemento buscado', () => {
      const arr = new ReactiveArray<number>([10, 20, 30, 40]);
      
      const result = arr.indexOf(30);
      
      expect(result).toBe(2);
    });

    it('debe retornar -1 si el elemento no existe', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      
      const result = arr.indexOf(99);
      
      expect(result).toBe(-1);
    });

    it('debe retornar el primer índice si hay duplicados', () => {
      const arr = new ReactiveArray<number>([10, 20, 10, 30]);
      
      const result = arr.indexOf(10);
      
      expect(result).toBe(0);
    });

    it('debe soportar fromIndex', () => {
      const arr = new ReactiveArray<number>([10, 20, 10, 30]);
      
      const result = arr.indexOf(10, 1);
      
      expect(result).toBe(2); // Buscar desde índice 1
    });
  });

  describe('includes - verificar existencia', () => {
    it('debe retornar true si el elemento existe', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      
      expect(arr.includes(20)).toBe(true);
    });

    it('debe retornar false si el elemento no existe', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      
      expect(arr.includes(99)).toBe(false);
    });

    it('debe soportar fromIndex', () => {
      const arr = new ReactiveArray<number>([10, 20, 30, 10]);
      
      expect(arr.includes(10, 1)).toBe(true); // Buscar desde índice 1
      expect(arr.includes(10, 4)).toBe(false); // Buscar desde índice 4
    });
  });

  describe('forEach - iterar sobre elementos', () => {
    it('debe ejecutar callback para cada elemento', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      const results: number[] = [];
      
      arr.forEach(x => results.push(x));
      
      expect(results).toEqual([10, 20, 30]);
    });

    it('debe recibir valor, índice y array en el callback', () => {
      const arr = new ReactiveArray<string>(['a', 'b', 'c']);
      const results: string[] = [];
      
      arr.forEach((value, index) => {
        results.push(`${index}:${value}`);
      });
      
      expect(results).toEqual(['0:a', '1:b', '2:c']);
    });

    it('no debe retornar valor', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.forEach(x => x * 2);
      
      expect(result).toBeUndefined();
    });

    it('no debe modificar el array original', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      arr.forEach(x => x * 10);
      
      expect(arr.getPlainValue()).toEqual([1, 2, 3]);
    });
  });

  describe('Combinación de métodos no-mutadores', () => {
    it('debe permitir encadenar map y filter en secuencia', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const doubled = arr.map(x => x * 2);
      const filtered = doubled.filter(x => x > 5);
      
      expect(filtered.getPlainValue()).toEqual([6, 8, 10]);
    });

    it('debe permitir slice y luego map', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const sliced = arr.slice(1, 4);
      const mapped = sliced.map(x => x * 10); // map nativo de arrays
      
      expect(mapped).toEqual([20, 30, 40]);
    });

    it('debe permitir filter y luego find', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      const filtered = arr.filter(x => x > 2);
      const found = filtered.find(x => x % 2 === 0);
      
      expect(found).toBe(4);
    });
  });

  describe('Casos edge de métodos no-mutadores', () => {
    it('debe manejar operaciones en array vacío', () => {
      const arr = new ReactiveArray<number>();
      
      expect(arr.map(x => x * 2).getPlainValue()).toEqual([]);
      expect(arr.filter(x => x > 0).getPlainValue()).toEqual([]);
      expect(arr.slice()).toEqual([]);
      expect(arr.concat([1, 2])).toEqual([1, 2]);
      expect(arr.find(x => x > 0)).toBeUndefined();
      expect(arr.findIndex(x => x > 0)).toBe(-1);
      expect(arr.indexOf(1)).toBe(-1);
      expect(arr.includes(1)).toBe(false);
    });

    it('debe manejar predicados que siempre retornan true', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const filtered = arr.filter(() => true);
      
      expect(filtered.getPlainValue()).toEqual([1, 2, 3]);
    });

    it('debe manejar predicados que siempre retornan false', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const filtered = arr.filter(() => false);
      
      expect(filtered.getPlainValue()).toEqual([]);
    });

    it('debe manejar transformaciones que retornan mismo valor', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const mapped = arr.map(x => x);
      
      expect(mapped.getPlainValue()).toEqual([1, 2, 3]);
      expect(mapped.getPlainValue()).not.toBe(arr.getPlainValue());
    });

    it('debe manejar concat con array vacío', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const result = arr.concat([]);
      
      expect(result).toEqual([1, 2, 3]);
    });

    it('debe manejar slice con índices fuera de rango', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      expect(arr.slice(10)).toEqual([]);
      expect(arr.slice(-10)).toEqual([1, 2, 3]);
      expect(arr.slice(1, 100)).toEqual([2, 3]);
    });

    it('debe preservar valores null y undefined en transformaciones', () => {
      const arr = new ReactiveArray<number | null>([1, null, 3, undefined as any]);
      
      const mapped = arr.map(x => x);
      
      expect(mapped.getPlainValue()).toEqual([1, null, 3, undefined]);
    });
  });

  describe('Verificación de no mutación', () => {
    it('ningún método no-mutador debe cambiar el array original', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      const original = arr.getPlainValue().slice();
      
      // Ejecutar todos los métodos no-mutadores
      arr.map(x => x * 2);
      arr.filter(x => x > 2);
      arr.slice(1, 3);
      arr.concat([6, 7]);
      arr.find(x => x > 3);
      arr.findIndex(x => x > 3);
      arr.indexOf(3);
      arr.includes(3);
      arr.forEach(x => x * 10);
      
      // Verificar que el array no cambió
      expect(arr.getPlainValue()).toEqual(original);
    });
  });
});
