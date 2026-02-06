import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositeSignal } from '../../composite';

describe('CompositeSignal - Nivel 8: Soporte para ObservableArray', () => {
  describe('onChange callback', () => {
    it('debe registrar y llamar un callback cuando cualquier propiedad cambia', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      signal.set('name', 'Carlos');
      
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
    });

    it('el callback debe recibir tres argumentos: property, oldValue, newValue', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      signal.set('name', 'Carlos');
      
      expect(onChangeSpy).toHaveBeenCalledWith('name', 'Julian', 'Carlos');
    });

    it('debe llamar al callback para cada propiedad que cambia', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30, city: 'Bogotá' });
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      signal.set('name', 'Carlos');
      signal.set('age', 35);
      signal.set('city', 'Medellín');
      
      expect(onChangeSpy).toHaveBeenCalledTimes(3);
      expect(onChangeSpy).toHaveBeenNthCalledWith(1, 'name', 'Julian', 'Carlos');
      expect(onChangeSpy).toHaveBeenNthCalledWith(2, 'age', 30, 35);
      expect(onChangeSpy).toHaveBeenNthCalledWith(3, 'city', 'Bogotá', 'Medellín');
    });

    it('debe llamar al callback múltiples veces si la misma propiedad cambia múltiples veces', () => {
      const signal = new CompositeSignal({ count: 0 });
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      signal.set('count', 1);
      signal.set('count', 2);
      signal.set('count', 3);
      
      expect(onChangeSpy).toHaveBeenCalledTimes(3);
      expect(onChangeSpy).toHaveBeenNthCalledWith(1, 'count', 0, 1);
      expect(onChangeSpy).toHaveBeenNthCalledWith(2, 'count', 1, 2);
      expect(onChangeSpy).toHaveBeenNthCalledWith(3, 'count', 2, 3);
    });

    it('NO debe llamar al callback si el valor no cambia (Object.is)', () => {
      const signal = new CompositeSignal({ name: 'Julian', count: 0 });
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      signal.set('name', 'Julian'); // Mismo valor
      signal.set('count', 0); // Mismo valor
      
      expect(onChangeSpy).not.toHaveBeenCalled();
    });

    it('debe manejar correctamente valores especiales como null, undefined, NaN', () => {
      const signal = new CompositeSignal({ value: null });
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      signal.set('value', undefined);
      signal.set('value', NaN);
      signal.set('value', 0);
      
      expect(onChangeSpy).toHaveBeenCalledTimes(3);
      expect(onChangeSpy).toHaveBeenNthCalledWith(1, 'value', null, undefined);
      expect(onChangeSpy).toHaveBeenNthCalledWith(2, 'value', undefined, NaN);
      // NaN no es igual a sí mismo con ===, pero Object.is(NaN, NaN) es true
      expect(onChangeSpy).toHaveBeenNthCalledWith(3, 'value', NaN, 0);
    });

    it('debe funcionar con símbolos como keys', () => {
      const symbolKey = Symbol('test');
      const signal = new CompositeSignal({ [symbolKey]: 'initial' });
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      signal.set(symbolKey, 'updated');
      
      expect(onChangeSpy).toHaveBeenCalledWith(symbolKey, 'initial', 'updated');
    });

    it('debe llamar al callback síncronamente, antes de cualquier batching', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const events: string[] = [];
      const onChangeSpy = vi.fn(() => {
        events.push('onChange');
      });
      
      // Crear un subscriber para verificar el orden
      const subscriber = () => { events.push('subscriber'); };
      (subscriber as any)._isComputation = true; // Marcar como síncrono
      
      signal.onChange(onChangeSpy);
      signal.subscribeToProperty('name', subscriber);
      
      events.push('before-set');
      signal.set('name', 'Carlos');
      events.push('after-set');
      
      // onChange debe llamarse antes del subscriber y dentro del set
      expect(events).toEqual(['before-set', 'onChange', 'subscriber', 'after-set']);
    });

    it('debe permitir sobrescribir el callback con una nueva llamada a onChange', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const firstSpy = vi.fn();
      const secondSpy = vi.fn();
      
      signal.onChange(firstSpy);
      signal.set('name', 'Carlos');
      expect(firstSpy).toHaveBeenCalledTimes(1);
      expect(secondSpy).not.toHaveBeenCalled();
      
      // Sobrescribir callback
      signal.onChange(secondSpy);
      signal.set('name', 'Pedro');
      expect(firstSpy).toHaveBeenCalledTimes(1); // No debe llamarse de nuevo
      expect(secondSpy).toHaveBeenCalledTimes(1);
      expect(secondSpy).toHaveBeenCalledWith('name', 'Carlos', 'Pedro');
    });

    it('debe permitir remover el callback estableciéndolo como undefined', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const spy = vi.fn();
      
      signal.onChange(spy);
      signal.set('name', 'Carlos');
      expect(spy).toHaveBeenCalledTimes(1);
      
      // Establecer nuevo callback como undefined (o nulo)
      signal.onChange(undefined as any);
      signal.set('name', 'Pedro');
      expect(spy).toHaveBeenCalledTimes(1); // No debe llamarse de nuevo
    });
  });

  describe('getPlainValue', () => {
    it('debe retornar el objeto JavaScript plano original', () => {
      const originalObject = { name: 'Julian', age: 30 };
      const signal = new CompositeSignal(originalObject);
      
      const plainValue = signal.getPlainValue();
      
      expect(plainValue).toBe(originalObject);
      expect(plainValue).toEqual({ name: 'Julian', age: 30 });
    });

    it('el objeto retornado NO debe ser una instancia de CompositeSignal', () => {
      const originalObject = { name: 'Julian' };
      const signal = new CompositeSignal(originalObject);
      
      const plainValue = signal.getPlainValue();
      
      expect(plainValue).not.toBeInstanceOf(CompositeSignal);
      expect(plainValue).toBe(originalObject);
    });

    it('debe reflejar los cambios realizados a través de set', () => {
      const originalObject = { name: 'Julian', age: 30 };
      const signal = new CompositeSignal(originalObject);
      
      signal.set('name', 'Carlos');
      signal.set('age', 35);
      
      const plainValue = signal.getPlainValue();
      
      expect(plainValue.name).toBe('Carlos');
      expect(plainValue.age).toBe(35);
      expect(plainValue).toBe(originalObject); // Misma referencia
    });

    it('debe permitir modificar el objeto directamente (aunque no es recomendado)', () => {
      const originalObject = { name: 'Julian', age: 30 };
      const signal = new CompositeSignal(originalObject);
      
      const plainValue = signal.getPlainValue();
      plainValue.name = 'Modified';
      plainValue.newProp = 'added';
      
      // El objeto subyacente debe reflejar los cambios
      expect(signal.get('name')).toBe('Modified');
      expect(signal.get('newProp')).toBe('added');
      
      // Pero los cambios directos no activarán onChange ni notificaciones
      // (esto es comportamiento esperado)
    });

    it('debe funcionar con objetos anidados', () => {
      const nestedObject = { data: { nested: true } };
      const signal = new CompositeSignal(nestedObject);
      
      const plainValue = signal.getPlainValue();
      
      expect(plainValue).toBe(nestedObject);
      expect(plainValue.data).toBe(nestedObject.data);
      expect(plainValue.data.nested).toBe(true);
    });

    it('debe funcionar con objetos vacíos', () => {
      const emptyObject = {};
      const signal = new CompositeSignal(emptyObject);
      
      const plainValue = signal.getPlainValue();
      
      expect(plainValue).toBe(emptyObject);
      expect(Object.keys(plainValue)).toHaveLength(0);
    });

    it('debe funcionar con arrays como valores (aunque no se envuelven en CompositeSignal)', () => {
      const objectWithArray = { items: [1, 2, 3] };
      const signal = new CompositeSignal(objectWithArray);
      
      const plainValue = signal.getPlainValue();
      
      expect(plainValue).toBe(objectWithArray);
      expect(plainValue.items).toBe(objectWithArray.items);
      expect(plainValue.items).toEqual([1, 2, 3]);
    });
  });

  describe('Integración entre onChange y getPlainValue', () => {
    it('onChange debe recibir los valores correctos incluso después de múltiples modificaciones', () => {
      const originalObject = { count: 0 };
      const signal = new CompositeSignal(originalObject);
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      
      signal.set('count', 1);
      expect(onChangeSpy).toHaveBeenCalledWith('count', 0, 1);
      expect(signal.getPlainValue().count).toBe(1);
      
      signal.set('count', 2);
      expect(onChangeSpy).toHaveBeenCalledWith('count', 1, 2);
      expect(signal.getPlainValue().count).toBe(2);
    });

    it('getPlainValue debe retornar el estado actual incluso durante una llamada de onChange', () => {
      const signal = new CompositeSignal({ count: 0 });
      let plainValueDuringCallback: any;
      
      signal.onChange((property, oldValue, newValue) => {
        plainValueDuringCallback = signal.getPlainValue();
      });
      
      signal.set('count', 1);
      
      expect(plainValueDuringCallback.count).toBe(1);
    });

    it('debe funcionar con propiedades que son objetos (envueltos en CompositeSignal)', () => {
      const originalObject = { user: { name: 'Julian', age: 30 } };
      const signal = new CompositeSignal(originalObject);
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      
      // Obtener el CompositeSignal anidado
      const nestedSignal = signal.get('user');
      expect(nestedSignal).toBeInstanceOf(CompositeSignal);
      
      // Cambiar propiedad del objeto anidado
      nestedSignal.set('name', 'Carlos');
      
      // onChange NO debe llamarse porque cambió una propiedad del objeto anidado, no del objeto raíz
      expect(onChangeSpy).not.toHaveBeenCalled();
      
      // Pero getPlainValue debe reflejar el cambio
      expect(signal.getPlainValue().user.name).toBe('Carlos');
    });

    it('debe notificar cuando se reemplaza completamente un objeto anidado', () => {
      const originalUser = { name: 'Julian' };
      const originalObject = { user: originalUser };
      const signal = new CompositeSignal(originalObject);
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      
      const newUser = { name: 'Carlos' };
      signal.set('user', newUser);
      
      // Verificar que el callback fue llamado con los valores correctos
      // oldValue debe ser el objeto original, newValue el nuevo objeto
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      expect(onChangeSpy).toHaveBeenCalledWith('user', originalUser, newUser);
      expect(signal.getPlainValue().user).toBe(newUser);
    });
  });

  describe('Compatibilidad con funcionalidad existente', () => {
    it('onChange no debe interferir con el registro normal de subscribers', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const onChangeSpy = vi.fn();
      const subscriberSpy = vi.fn();
      (subscriberSpy as any)._isComputation = true;
      
      signal.onChange(onChangeSpy);
      signal.subscribeToProperty('name', subscriberSpy);
      
      signal.set('name', 'Carlos');
      
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      expect(subscriberSpy).toHaveBeenCalledTimes(1);
    });

    it('getPlainValue no debe interferir con get', () => {
      const originalObject = { name: 'Julian', age: 30 };
      const signal = new CompositeSignal(originalObject);
      
      const viaGet = signal.get('name');
      const viaPlainValue = signal.getPlainValue().name;
      
      expect(viaGet).toBe('Julian');
      expect(viaPlainValue).toBe('Julian');
      
      signal.set('name', 'Carlos');
      
      expect(signal.get('name')).toBe('Carlos');
      expect(signal.getPlainValue().name).toBe('Carlos');
    });

    it('debe mantener el comportamiento de Object.is para comparaciones', () => {
      const signal = new CompositeSignal({ value: 0 });
      const onChangeSpy = vi.fn();
      
      signal.onChange(onChangeSpy);
      
      // Object.is(0, -0) es false, así que debe notificar
      signal.set('value', -0);
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      
      // Object.is(NaN, NaN) es true, así que no debe notificar
      signal.set('value', NaN);
      signal.set('value', NaN); // Segundo set con NaN
      // Solo el primer cambio de -0 a NaN debe notificar
      expect(onChangeSpy).toHaveBeenCalledTimes(2);
    });
  });
});