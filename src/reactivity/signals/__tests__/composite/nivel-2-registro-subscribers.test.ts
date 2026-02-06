import { describe, it, expect } from 'vitest';
import { CompositeSignal, Subscriber } from '../../composite';

describe('CompositeSignal - Nivel 2: Registro de subscribers por propiedad', () => {
  describe('Estructura de datos propertySubscribers', () => {
    it('debe inicializar con un Map vacío de propertySubscribers', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      
      expect(signal.getSubscribedProperties()).toEqual([]);
    });

    it('debe almacenar subscribers en un Map organizado por propiedad', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const subscriber: Subscriber = () => {};
      
      signal.subscribeToProperty('name', subscriber);
      
      const subscribers = signal.getSubscribers('name');
      expect(subscribers).toBeInstanceOf(Set);
      expect(subscribers?.size).toBe(1);
      expect(subscribers?.has(subscriber)).toBe(true);
    });
  });

  describe('Método subscribeToProperty - registro básico', () => {
    it('debe permitir registrar un subscriber a una propiedad', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const subscriber: Subscriber = () => {};
      
      signal.subscribeToProperty('name', subscriber);
      
      const subscribers = signal.getSubscribers('name');
      expect(subscribers?.has(subscriber)).toBe(true);
    });

    it('debe crear el Set automáticamente si la propiedad no tiene subscribers', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const subscriber: Subscriber = () => {};
      
      expect(signal.getSubscribers('name')).toBeUndefined();
      
      signal.subscribeToProperty('name', subscriber);
      
      expect(signal.getSubscribers('name')).toBeInstanceOf(Set);
    });

    it('debe registrar múltiples subscribers a la misma propiedad', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const subscriber1: Subscriber = () => {};
      const subscriber2: Subscriber = () => {};
      const subscriber3: Subscriber = () => {};
      
      signal.subscribeToProperty('name', subscriber1);
      signal.subscribeToProperty('name', subscriber2);
      signal.subscribeToProperty('name', subscriber3);
      
      const subscribers = signal.getSubscribers('name');
      expect(subscribers?.size).toBe(3);
      expect(subscribers?.has(subscriber1)).toBe(true);
      expect(subscribers?.has(subscriber2)).toBe(true);
      expect(subscribers?.has(subscriber3)).toBe(true);
    });

    it('debe permitir registrar subscribers a propiedades diferentes', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30, city: 'Bogotá' });
      const subscriber1: Subscriber = () => {};
      const subscriber2: Subscriber = () => {};
      const subscriber3: Subscriber = () => {};
      
      signal.subscribeToProperty('name', subscriber1);
      signal.subscribeToProperty('age', subscriber2);
      signal.subscribeToProperty('city', subscriber3);
      
      expect(signal.getSubscribers('name')?.has(subscriber1)).toBe(true);
      expect(signal.getSubscribers('age')?.has(subscriber2)).toBe(true);
      expect(signal.getSubscribers('city')?.has(subscriber3)).toBe(true);
    });
  });

  describe('Subscribers en múltiples propiedades', () => {
    it('debe permitir que el mismo subscriber esté registrado en múltiples propiedades', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      const subscriber: Subscriber = () => {};
      
      signal.subscribeToProperty('name', subscriber);
      signal.subscribeToProperty('age', subscriber);
      
      expect(signal.getSubscribers('name')?.has(subscriber)).toBe(true);
      expect(signal.getSubscribers('age')?.has(subscriber)).toBe(true);
    });

    it('debe mantener el subscriber en otras propiedades independientemente', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30, city: 'Bogotá' });
      const sharedSubscriber: Subscriber = () => {};
      const nameOnlySubscriber: Subscriber = () => {};
      
      signal.subscribeToProperty('name', sharedSubscriber);
      signal.subscribeToProperty('name', nameOnlySubscriber);
      signal.subscribeToProperty('age', sharedSubscriber);
      signal.subscribeToProperty('city', sharedSubscriber);
      
      const nameSubscribers = signal.getSubscribers('name');
      expect(nameSubscribers?.size).toBe(2);
      expect(nameSubscribers?.has(sharedSubscriber)).toBe(true);
      expect(nameSubscribers?.has(nameOnlySubscriber)).toBe(true);
      
      const ageSubscribers = signal.getSubscribers('age');
      expect(ageSubscribers?.size).toBe(1);
      expect(ageSubscribers?.has(sharedSubscriber)).toBe(true);
      
      const citySubscribers = signal.getSubscribers('city');
      expect(citySubscribers?.size).toBe(1);
      expect(citySubscribers?.has(sharedSubscriber)).toBe(true);
    });
  });

  describe('Comportamiento de Set - no duplicados', () => {
    it('debe evitar duplicados cuando se registra el mismo subscriber múltiples veces en la misma propiedad', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const subscriber: Subscriber = () => {};
      
      signal.subscribeToProperty('name', subscriber);
      signal.subscribeToProperty('name', subscriber);
      signal.subscribeToProperty('name', subscriber);
      
      const subscribers = signal.getSubscribers('name');
      expect(subscribers?.size).toBe(1);
      expect(subscribers?.has(subscriber)).toBe(true);
    });

    it('debe tratar funciones diferentes como subscribers distintos aunque tengan la misma implementación', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      // Crear dos funciones diferentes (referencias diferentes)
      const subscriber1: Subscriber = () => {};
      const subscriber2: Subscriber = () => {};
      
      signal.subscribeToProperty('name', subscriber1);
      signal.subscribeToProperty('name', subscriber2);
      
      const subscribers = signal.getSubscribers('name');
      expect(subscribers?.size).toBe(2);
    });
  });

  describe('Registro a propiedades que no existen en el objeto', () => {
    it('debe permitir registrar subscribers a propiedades que no existen en el valor inicial', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const subscriber: Subscriber = () => {};
      
      signal.subscribeToProperty('age', subscriber);
      
      expect(signal.getSubscribers('age')?.has(subscriber)).toBe(true);
    });

    it('debe mantener subscribers cuando se crea la propiedad posteriormente', () => {
      const signal = new CompositeSignal<any>({ name: 'Julian' });
      const subscriber: Subscriber = () => {};
      
      signal.subscribeToProperty('age', subscriber);
      signal.set('age', 30);
      
      expect(signal.getSubscribers('age')?.has(subscriber)).toBe(true);
      expect(signal.get('age')).toBe(30);
    });
  });

  describe('Soporte para símbolos como propiedades', () => {
    it('debe permitir registrar subscribers usando símbolos como keys', () => {
      const symbolKey = Symbol('testProperty');
      const signal = new CompositeSignal({ [symbolKey]: 'value' });
      const subscriber: Subscriber = () => {};
      
      signal.subscribeToProperty(symbolKey, subscriber);
      
      expect(signal.getSubscribers(symbolKey)?.has(subscriber)).toBe(true);
    });

    it('debe mantener subscribers de símbolos separados de strings', () => {
      const symbolKey = Symbol('name');
      const signal = new CompositeSignal({ name: 'Julian', [symbolKey]: 'Symbol Value' });
      const stringSubscriber: Subscriber = () => {};
      const symbolSubscriber: Subscriber = () => {};
      
      signal.subscribeToProperty('name', stringSubscriber);
      signal.subscribeToProperty(symbolKey, symbolSubscriber);
      
      expect(signal.getSubscribers('name')?.has(stringSubscriber)).toBe(true);
      expect(signal.getSubscribers('name')?.has(symbolSubscriber)).toBe(false);
      expect(signal.getSubscribers(symbolKey)?.has(symbolSubscriber)).toBe(true);
      expect(signal.getSubscribers(symbolKey)?.has(stringSubscriber)).toBe(false);
    });
  });

  describe('Métodos helper de inspección', () => {
    it('getSubscribedProperties debe retornar array vacío si no hay subscribers', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      
      expect(signal.getSubscribedProperties()).toEqual([]);
    });

    it('getSubscribedProperties debe retornar todas las propiedades con subscribers', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      const subscriber: Subscriber = () => {};
      
      signal.subscribeToProperty('name', subscriber);
      signal.subscribeToProperty('age', subscriber);
      
      const properties = signal.getSubscribedProperties();
      expect(properties).toHaveLength(2);
      expect(properties).toContain('name');
      expect(properties).toContain('age');
    });

    it('getSubscribers debe retornar undefined para propiedades sin subscribers', () => {
      const signal = new CompositeSignal({ name: 'Julian', age: 30 });
      
      expect(signal.getSubscribers('name')).toBeUndefined();
      expect(signal.getSubscribers('age')).toBeUndefined();
    });

    it('getSubscribers debe retornar el Set correcto de subscribers', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      const subscriber1: Subscriber = () => {};
      const subscriber2: Subscriber = () => {};
      
      signal.subscribeToProperty('name', subscriber1);
      signal.subscribeToProperty('name', subscriber2);
      
      const subscribers = signal.getSubscribers('name');
      expect(subscribers).toBeInstanceOf(Set);
      expect(subscribers?.size).toBe(2);
      expect(Array.from(subscribers!)).toEqual(
        expect.arrayContaining([subscriber1, subscriber2])
      );
    });
  });

  describe('Caso de uso completo del ejemplo', () => {
    it('debe replicar exactamente el ejemplo del Nivel 2', () => {
      const signal = new CompositeSignal({ name: 'Julian' });
      
      const subscriber1: Subscriber = () => console.log('subscriber1');
      const subscriber2: Subscriber = () => console.log('subscriber2');
      
      signal.subscribeToProperty('name', subscriber1);
      signal.subscribeToProperty('name', subscriber2);
      signal.subscribeToProperty('age', subscriber1);
      
      // Verificar estructura interna
      const nameSubscribers = signal.getSubscribers('name');
      expect(nameSubscribers?.size).toBe(2);
      expect(nameSubscribers?.has(subscriber1)).toBe(true);
      expect(nameSubscribers?.has(subscriber2)).toBe(true);
      
      const ageSubscribers = signal.getSubscribers('age');
      expect(ageSubscribers?.size).toBe(1);
      expect(ageSubscribers?.has(subscriber1)).toBe(true);
      
      // Verificar propiedades registradas
      const properties = signal.getSubscribedProperties();
      expect(properties).toHaveLength(2);
      expect(properties).toContain('name');
      expect(properties).toContain('age');
    });
  });
});
