import { describe, it, expect } from 'vitest';
import { CompositeSignal } from '../../composite';
import { ReactiveArray } from '../../reactive-array';

describe('CompositeSignal - Nivel 1: Estructura básica sin reactividad', () => {
  describe('Constructor y almacenamiento interno', () => {
    it('debe crear una instancia de CompositeSignal con un objeto inicial', () => {
      const initialData = { name: 'Julian', age: 30 };
      const signal = new CompositeSignal(initialData);
      
      expect(signal).toBeInstanceOf(CompositeSignal);
    });

    it('debe almacenar el objeto pasado en el constructor', () => {
      const initialData = { name: 'Julian', age: 30 };
      const signal = new CompositeSignal(initialData);
      
      expect(signal.get('name')).toBe('Julian');
      expect(signal.get('age')).toBe(30);
    });
  });

  describe('Método get - lectura de propiedades', () => {
    it('debe retornar el valor correcto de una propiedad string', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      expect(signal.get('name')).toBe('Julian');
    });

    it('debe retornar el valor correcto de una propiedad numérica', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      expect(signal.get('age')).toBe(30);
    });

    it('debe retornar undefined para una propiedad que no existe', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      
      expect(signal.get('nonExistent')).toBeUndefined();
    });

    it('debe poder leer múltiples propiedades diferentes', () => {
      const signal = new CompositeSignal({
        name: 'Julian',
        age: 30,
        city: 'Bogotá',
        active: true
      });
      
      expect(signal.get('name')).toBe('Julian');
      expect(signal.get('age')).toBe(30);
      expect(signal.get('city')).toBe('Bogotá');
      expect(signal.get('active')).toBe(true);
    });

    it('debe funcionar con símbolos como keys', () => {
      const symbolKey = Symbol('testKey');
      const signal = new CompositeSignal({ [symbolKey]: 'value' });
      
      expect(signal.get(symbolKey)).toBe('value');
    });
  });

  describe('Método set - escritura de propiedades', () => {
    it('debe actualizar correctamente el valor de una propiedad', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      signal.set('name', 'Carlos');
      
      expect(signal.get('name')).toBe('Carlos');
    });

    it('debe retornar el nuevo valor después de hacer set', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      signal.set('name', 'Carlos');
      const newName = signal.get('name');
      
      expect(newName).toBe('Carlos');
    });

    it('debe poder actualizar múltiples propiedades independientemente', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      signal.set('name', 'Carlos');
      signal.set('age', 25);
      
      expect(signal.get('name')).toBe('Carlos');
      expect(signal.get('age')).toBe(25);
    });

    it('debe funcionar con símbolos como keys', () => {
      const symbolKey = Symbol('testKey');
      const signal = new CompositeSignal({ [symbolKey]: 'initial' });
      
      signal.set(symbolKey, 'updated');
      
      expect(signal.get(symbolKey)).toBe('updated');
    });

    it('debe poder crear nuevas propiedades que no existían', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      
      signal.set('age', 30);
      
      expect(signal.get('age')).toBe(30);
    });
  });

  describe('Tipos de valores soportados', () => {
    it('debe trabajar con valores string', () => {
      const signal = new CompositeSignal({ text: 'hello' });
      
      expect(signal.get('text')).toBe('hello');
      
      signal.set('text', 'world');
      expect(signal.get('text')).toBe('world');
    });

    it('debe trabajar con valores numéricos', () => {
      const signal = new CompositeSignal({ count: 42 });
      
      expect(signal.get('count')).toBe(42);
      
      signal.set('count', 100);
      expect(signal.get('count')).toBe(100);
    });

    it('debe trabajar con valores booleanos', () => {
      const signal = new CompositeSignal({ active: true });
      
      expect(signal.get('active')).toBe(true);
      
      signal.set('active', false);
      expect(signal.get('active')).toBe(false);
    });

    it('debe trabajar con valores null', () => {
      const signal = new CompositeSignal({ data: null });
      
      expect(signal.get('data')).toBeNull();
      
      signal.set('data', 'value');
      expect(signal.get('data')).toBe('value');
      
      signal.set('data', null);
      expect(signal.get('data')).toBeNull();
    });

    it('debe trabajar con valores undefined', () => {
      const signal = new CompositeSignal({ optional: undefined });
      
      expect(signal.get('optional')).toBeUndefined();
      
      signal.set('optional', 'defined');
      expect(signal.get('optional')).toBe('defined');
    });

    it('debe trabajar con objetos como valores', () => {
      const nestedObject = { nested: true };
      const signal = new CompositeSignal({ obj: nestedObject });
      
      // Nivel 7: Los objetos ahora se envuelven en CompositeSignal
      const wrappedObj = signal.get('obj');
      expect(wrappedObj).toBeInstanceOf(CompositeSignal);
      expect(wrappedObj.get('nested')).toBe(true);
      
      const newObject = { different: true };
      signal.set('obj', newObject);
      const wrappedNew = signal.get('obj');
      expect(wrappedNew).toBeInstanceOf(CompositeSignal);
      expect(wrappedNew.get('different')).toBe(true);
    });

    it('debe trabajar con arrays como valores', () => {
      const array = [1, 2, 3];
      const signal = new CompositeSignal({ list: array });
      
      // Con composición automática: arrays se envuelven en ReactiveArray
      const wrappedArray = signal.get('list');
      expect(wrappedArray).toBeInstanceOf(ReactiveArray);
      expect(wrappedArray.getPlainValue()).toEqual([1, 2, 3]);
      
      signal.set('list', [4, 5, 6]);
      const wrappedNew = signal.get('list');
      expect(wrappedNew).toBeInstanceOf(ReactiveArray);
      expect(wrappedNew.getPlainValue()).toEqual([4, 5, 6]);
    });
  });

  describe('Casos edge y comportamiento esperado', () => {
    it('debe mantener la referencia al mismo objeto cuando se lee repetidamente', () => {
      const obj = { data: 'test' };
      const signal = new CompositeSignal({ ref: obj });
      
      const ref1 = signal.get('ref');
      const ref2 = signal.get('ref');
      
      // Nivel 7: Debe retornar la misma instancia de CompositeSignal cacheada
      expect(ref1).toBe(ref2);
      expect(ref1).toBeInstanceOf(CompositeSignal);
      expect(ref1.get('data')).toBe('test');
    });

    it('debe permitir sobrescribir el mismo valor múltiples veces', () => {
      const signal = new CompositeSignal({ count: 0 });
      
      signal.set('count', 1);
      signal.set('count', 2);
      signal.set('count', 3);
      
      expect(signal.get('count')).toBe(3);
    });

    it('debe permitir establecer el mismo valor sin errores', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      
      signal.set('name', 'Julian');
      
      expect(signal.get('name')).toBe('Julian');
    });

    it('debe trabajar con objetos vacíos', () => {
      const signal = new CompositeSignal({});
      
      expect(signal.get('anything')).toBeUndefined();
      
      signal.set('newProp', 'value');
      expect(signal.get('newProp')).toBe('value');
    });

    it('debe mantener propiedades no modificadas intactas cuando se actualiza una propiedad', () => {
      const signal = new CompositeSignal({
        prop1: 'value1',
        prop2: 'value2',
        prop3: 'value3'
      });
      
      signal.set('prop2', 'updated');
      
      expect(signal.get('prop1')).toBe('value1');
      expect(signal.get('prop2')).toBe('updated');
      expect(signal.get('prop3')).toBe('value3');
    });
  });
});
