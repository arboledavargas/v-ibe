import { describe, it, expect } from 'vitest';
import { getOrCreateReactive } from './reactive-cache';
import { CompositeSignal } from './signals/composite';
import { ReactiveArray } from './signals/reactive-array';

describe('reactive-cache - Caché compartido global', () => {
  describe('getOrCreateReactive - valores primitivos', () => {
    it('debe devolver primitivos tal cual', () => {
      expect(getOrCreateReactive(42)).toBe(42);
      expect(getOrCreateReactive('hello')).toBe('hello');
      expect(getOrCreateReactive(true)).toBe(true);
      expect(getOrCreateReactive(null)).toBe(null);
      expect(getOrCreateReactive(undefined)).toBe(undefined);
    });
  });

  describe('getOrCreateReactive - objetos', () => {
    it('debe envolver objetos en CompositeSignal', () => {
      const obj = { name: 'Julian', age: 30 };
      const reactive = getOrCreateReactive(obj);
      
      expect(reactive).toBeInstanceOf(CompositeSignal);
    });

    it('debe devolver la misma instancia para el mismo objeto', () => {
      const obj = { name: 'Julian' };
      const reactive1 = getOrCreateReactive(obj);
      const reactive2 = getOrCreateReactive(obj);
      
      expect(reactive1).toBe(reactive2); // Misma referencia
    });

    it('debe devolver diferentes instancias para objetos diferentes', () => {
      const obj1 = { name: 'Julian' };
      const obj2 = { name: 'Julian' }; // Mismo contenido pero diferente referencia
      
      const reactive1 = getOrCreateReactive(obj1);
      const reactive2 = getOrCreateReactive(obj2);
      
      expect(reactive1).not.toBe(reactive2);
    });

    it('debe devolver instancias ya reactivas tal cual', () => {
      const obj = { name: 'Julian' };
      const composite = new CompositeSignal(obj);
      
      const result = getOrCreateReactive(composite);
      
      expect(result).toBe(composite);
    });
  });

  describe('getOrCreateReactive - arrays', () => {
    it('debe envolver arrays en ReactiveArray', () => {
      const arr = [1, 2, 3];
      const reactive = getOrCreateReactive(arr);
      
      expect(reactive).toBeInstanceOf(ReactiveArray);
    });

    it('debe devolver la misma instancia para el mismo array', () => {
      const arr = [1, 2, 3];
      const reactive1 = getOrCreateReactive(arr);
      const reactive2 = getOrCreateReactive(arr);
      
      expect(reactive1).toBe(reactive2);
    });

    it('debe devolver diferentes instancias para arrays diferentes', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];
      
      const reactive1 = getOrCreateReactive(arr1);
      const reactive2 = getOrCreateReactive(arr2);
      
      expect(reactive1).not.toBe(reactive2);
    });

    it('debe devolver instancias ya reactivas tal cual', () => {
      const arr = [1, 2, 3];
      const reactiveArr = new ReactiveArray(arr);
      
      const result = getOrCreateReactive(reactiveArr);
      
      expect(result).toBe(reactiveArr);
    });
  });

  describe('getOrCreateReactive - objetos especiales', () => {
    it('debe devolver Date tal cual sin envolver', () => {
      const date = new Date();
      const result = getOrCreateReactive(date);
      
      expect(result).toBe(date);
      expect(result).not.toBeInstanceOf(CompositeSignal);
    });

    it('debe devolver RegExp tal cual sin envolver', () => {
      const regex = /test/;
      const result = getOrCreateReactive(regex);
      
      expect(result).toBe(regex);
      expect(result).not.toBeInstanceOf(CompositeSignal);
    });

    it('debe devolver Map tal cual sin envolver', () => {
      const map = new Map([['key', 'value']]);
      const result = getOrCreateReactive(map);
      
      expect(result).toBe(map);
      expect(result).not.toBeInstanceOf(CompositeSignal);
    });

    it('debe devolver Set tal cual sin envolver', () => {
      const set = new Set([1, 2, 3]);
      const result = getOrCreateReactive(set);
      
      expect(result).toBe(set);
      expect(result).not.toBeInstanceOf(CompositeSignal);
    });
  });

  describe('Caché compartido - consistencia', () => {
    it('debe garantizar que el mismo objeto devuelve la misma instancia reactiva', () => {
      const shared = { x: 10, y: 20 };
      
      const obj1 = { point: shared };
      const obj2 = { position: shared };
      
      const reactive1 = getOrCreateReactive(obj1) as CompositeSignal<any>;
      const reactive2 = getOrCreateReactive(obj2) as CompositeSignal<any>;
      
      const point1 = reactive1.get('point');
      const point2 = reactive2.get('position');
      
      // Ambos deben devolver la misma instancia porque shared es el mismo objeto
      expect(point1).toBe(point2);
    });

    it('debe garantizar que el mismo array devuelve la misma instancia reactiva', () => {
      const shared = [1, 2, 3];
      
      const obj1 = { numbers: shared };
      const obj2 = { values: shared };
      
      const reactive1 = getOrCreateReactive(obj1) as CompositeSignal<any>;
      const reactive2 = getOrCreateReactive(obj2) as CompositeSignal<any>;
      
      const numbers1 = reactive1.get('numbers');
      const numbers2 = reactive2.get('values');
      
      expect(numbers1).toBe(numbers2);
    });

    it('debe funcionar con estructuras anidadas complejas', () => {
      const sharedUser = { name: 'Julian', age: 30 };
      
      const app = {
        currentUser: sharedUser,
        users: [sharedUser, { name: 'Maria', age: 25 }]
      };
      
      const reactive = getOrCreateReactive(app) as CompositeSignal<any>;
      
      // Acceder al usuario por dos caminos diferentes
      const userFromCurrent = reactive.get('currentUser');
      const userFromArray = (reactive.get('users') as ReactiveArray<any>).at(0);
      
      // Deben ser la misma instancia reactiva
      expect(userFromCurrent).toBe(userFromArray);
    });
  });

  describe('Casos edge del caché', () => {
    it('debe manejar objetos vacíos', () => {
      const empty = {};
      const reactive1 = getOrCreateReactive(empty);
      const reactive2 = getOrCreateReactive(empty);
      
      expect(reactive1).toBe(reactive2);
      expect(reactive1).toBeInstanceOf(CompositeSignal);
    });

    it('debe manejar arrays vacíos', () => {
      const empty: number[] = [];
      const reactive1 = getOrCreateReactive(empty);
      const reactive2 = getOrCreateReactive(empty);
      
      expect(reactive1).toBe(reactive2);
      expect(reactive1).toBeInstanceOf(ReactiveArray);
    });

    it('debe manejar objetos con propiedades null/undefined', () => {
      const obj = { a: null, b: undefined, c: 'value' };
      const reactive = getOrCreateReactive(obj);
      
      expect(reactive).toBeInstanceOf(CompositeSignal);
    });

    it('debe manejar arrays con elementos null/undefined', () => {
      const arr = [null, undefined, 42];
      const reactive = getOrCreateReactive(arr);
      
      expect(reactive).toBeInstanceOf(ReactiveArray);
    });
  });
});
