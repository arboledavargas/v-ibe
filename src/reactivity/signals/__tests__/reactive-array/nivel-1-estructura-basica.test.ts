import { describe, it, expect } from 'vitest';
import { ReactiveArray } from '../../reactive-array';
import { CompositeSignal } from '../../composite';
import { createArrayProxy } from '../../reactive-proxy';

describe('ReactiveArray - Nivel 1: Estructura básica y acceso sin reactividad', () => {
  describe('Constructor y almacenamiento interno', () => {
    it('debe crear una instancia de ReactiveArray con array inicial vacío', () => {
      const arr = new ReactiveArray<number>();
      
      expect(arr).toBeInstanceOf(ReactiveArray);
      expect(arr.length).toBe(0);
    });

    it('debe crear una instancia con array inicial con elementos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      expect(arr).toBeInstanceOf(ReactiveArray);
      expect(arr.length).toBe(3);
    });

    it('debe clonar el array pasado para evitar mutaciones externas', () => {
      const original = [1, 2, 3];
      const arr = new ReactiveArray<number>(original);
      
      // Mutar el original no debe afectar el ReactiveArray
      original.push(4);
      
      expect(arr.length).toBe(3);
      expect(arr.getPlainValue()).toEqual([1, 2, 3]);
    });
  });

  describe('Método at - acceso por índice', () => {
    it('debe retornar el elemento en el índice especificado', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      
      expect(arr.at(0)).toBe(10);
      expect(arr.at(1)).toBe(20);
      expect(arr.at(2)).toBe(30);
    });

    it('debe soportar índices negativos', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      
      expect(arr.at(-1)).toBe(30); // último elemento
      expect(arr.at(-2)).toBe(20);
      expect(arr.at(-3)).toBe(10);
    });

    it('debe retornar undefined para índices fuera de rango', () => {
      const arr = new ReactiveArray<number>([10, 20, 30]);
      
      expect(arr.at(3)).toBeUndefined();
      expect(arr.at(100)).toBeUndefined();
      expect(arr.at(-4)).toBeUndefined();
    });
  });

  describe('Propiedad length', () => {
    it('debe retornar 0 para array vacío', () => {
      const arr = new ReactiveArray<number>();
      
      expect(arr.length).toBe(0);
    });

    it('debe retornar el número correcto de elementos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      expect(arr.length).toBe(5);
    });

    it('debe actualizarse cuando se agregan elementos', () => {
      const arr = new ReactiveArray<number>([1, 2]);
      
      arr.push(3);
      expect(arr.length).toBe(3);
      
      arr.push(4, 5);
      expect(arr.length).toBe(5);
    });

    it('debe actualizarse cuando se eliminan elementos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3, 4, 5]);
      
      arr.pop();
      expect(arr.length).toBe(4);
      
      arr.shift();
      expect(arr.length).toBe(3);
    });
  });

  describe('Método getPlainValue', () => {
    it('debe retornar el array JavaScript subyacente', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      const plain = arr.getPlainValue();
      
      expect(Array.isArray(plain)).toBe(true);
      expect(plain).toEqual([1, 2, 3]);
    });

    it('debe reflejar mutaciones realizadas a través de métodos', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      arr.push(4);
      expect(arr.getPlainValue()).toEqual([1, 2, 3, 4]);
      
      arr.pop();
      expect(arr.getPlainValue()).toEqual([1, 2, 3]);
    });

    it('debe retornar la misma referencia en llamadas sucesivas', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      const plain1 = arr.getPlainValue();
      const plain2 = arr.getPlainValue();
      
      expect(plain1).toBe(plain2);
    });
  });

  describe('Tipos de valores soportados', () => {
    it('debe trabajar con números', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      expect(arr.at(0)).toBe(1);
      expect(arr.at(1)).toBe(2);
      expect(arr.at(2)).toBe(3);
    });

    it('debe trabajar con strings', () => {
      const arr = new ReactiveArray<string>(['hello', 'world']);
      
      expect(arr.at(0)).toBe('hello');
      expect(arr.at(1)).toBe('world');
    });

    it('debe trabajar con objetos', () => {
      const obj1 = { id: 1, name: 'Alice' };
      const obj2 = { id: 2, name: 'Bob' };
      const arr = new ReactiveArray([obj1, obj2]);
      const proxy = createArrayProxy(arr);
      
      // Con composición automática: objetos se envuelven en CompositeSignal
      const wrapped1 = arr.at(0);
      const wrapped2 = arr.at(1);
      expect(wrapped1).toBeInstanceOf(CompositeSignal);
      expect(wrapped2).toBeInstanceOf(CompositeSignal);
      
      // Con proxy: acceso con sintaxis nativa
      expect(proxy[0].id).toBe(1);
      expect(proxy[0].name).toBe('Alice');
    });

    it('debe trabajar con valores null y undefined', () => {
      const arr = new ReactiveArray([null, undefined, 42]);
      
      expect(arr.at(0)).toBeNull();
      expect(arr.at(1)).toBeUndefined();
      expect(arr.at(2)).toBe(42);
    });

    it('debe trabajar con arrays anidados', () => {
      const arr = new ReactiveArray([[1, 2], [3, 4]]);
      
      // Con composición automática: arrays anidados se envuelven en ReactiveArray
      const nested1 = arr.at(0);
      const nested2 = arr.at(1);
      expect(nested1).toBeInstanceOf(ReactiveArray);
      expect(nested2).toBeInstanceOf(ReactiveArray);
      expect(nested1.getPlainValue()).toEqual([1, 2]);
      expect(nested2.getPlainValue()).toEqual([3, 4]);
    });
  });

  describe('Método onChange', () => {
    it('debe permitir registrar un callback', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      const callback = () => {};
      
      // No debe lanzar error
      expect(() => arr.onChange(callback)).not.toThrow();
    });

    it('debe llamar el callback cuando se hace push', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      let called = false;
      let operation = '';
      let args: any[] = [];
      
      arr.onChange((op, ...rest) => {
        called = true;
        operation = op;
        args = rest;
      });
      
      arr.push(4);
      
      expect(called).toBe(true);
      expect(operation).toBe('push');
      expect(args[0]).toEqual([4]);
    });

    it('debe llamar el callback cuando se hace pop', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      let operation = '';
      let result: any;
      
      arr.onChange((op, ...rest) => {
        operation = op;
        result = rest[0];
      });
      
      arr.pop();
      
      expect(operation).toBe('pop');
      expect(result).toBe(3);
    });
  });

  describe('Métodos de inspección (para testing)', () => {
    it('debe exponer getSubscribers para inspección', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      // Debe retornar undefined si no hay subscribers
      expect(arr.getSubscribers('mutation')).toBeUndefined();
      expect(arr.getSubscribers('length')).toBeUndefined();
      expect(arr.getSubscribers(0)).toBeUndefined();
    });

    it('debe exponer getSubscribedKeys para inspección', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      
      // Array sin subscribers debe retornar array vacío
      expect(arr.getSubscribedKeys()).toEqual([]);
    });
  });

  describe('Casos edge', () => {
    it('debe manejar array con un solo elemento', () => {
      const arr = new ReactiveArray<number>([42]);
      
      expect(arr.length).toBe(1);
      expect(arr.at(0)).toBe(42);
      expect(arr.at(-1)).toBe(42);
    });

    it('debe manejar múltiples operaciones en secuencia', () => {
      const arr = new ReactiveArray<number>([1]);
      
      arr.push(2);
      arr.push(3);
      arr.pop();
      arr.push(4);
      
      expect(arr.length).toBe(3);
      expect(arr.getPlainValue()).toEqual([1, 2, 4]);
    });

    it('debe mantener consistencia después de operaciones que no cambian nada', () => {
      const arr = new ReactiveArray<number>([1, 2, 3]);
      const original = arr.getPlainValue().slice();
      
      // Intentar pop en array vacío... espera, ya tiene elementos
      // Mejor: hacer splice sin eliminar ni agregar nada
      arr.splice(1, 0); // No cambia nada
      
      expect(arr.getPlainValue()).toEqual(original);
    });
  });
});
