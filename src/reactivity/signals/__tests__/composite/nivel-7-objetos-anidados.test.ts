import { describe, it, expect, beforeEach } from 'vitest';
import { CompositeSignal, Subscriber } from '../../composite.js';
import { reactiveContext } from '../../../reactive-context.js';
import { Computed } from '../../computed.js';
import { ReactiveArray } from '../../reactive-array.js';

/**
 * Helper para crear subscribers síncronos en tests
 * Los marca con _isComputation = true para que se ejecuten inmediatamente
 */
function createSyncSubscriber(fn: () => void): Subscriber {
  const subscriber: any = fn;
  subscriber._isComputation = true;
  return subscriber;
}

describe('CompositeSignal - Nivel 7: Objetos anidados con caché', () => {
  describe('Wrapping de objetos anidados', () => {
    it('debe envolver un objeto anidado en un CompositeSignal', () => {
      const composite = new CompositeSignal({
        user: {
          name: 'Alice',
          age: 30
        }
      });

      const user = composite.get('user');
      
      expect(user).toBeInstanceOf(CompositeSignal);
    });

    it('debe permitir acceder a propiedades del objeto anidado', () => {
      const composite = new CompositeSignal({
        user: {
          name: 'Alice',
          age: 30
        }
      });

      const user = composite.get('user');
      
      expect(user.get('name')).toBe('Alice');
      expect(user.get('age')).toBe(30);
    });

    it('no debe envolver valores primitivos', () => {
      const composite = new CompositeSignal({
        name: 'Alice',
        age: 30,
        active: true
      });

      expect(composite.get('name')).toBe('Alice');
      expect(composite.get('age')).toBe(30);
      expect(composite.get('active')).toBe(true);
      
      // No deben ser CompositeSignals
      expect(composite.get('name')).not.toBeInstanceOf(CompositeSignal);
    });

    it('no debe envolver null', () => {
      const composite = new CompositeSignal({
        value: null
      });

      expect(composite.get('value')).toBeNull();
      expect(composite.get('value')).not.toBeInstanceOf(CompositeSignal);
    });

    it('no debe envolver undefined', () => {
      const composite = new CompositeSignal({
        value: undefined
      });

      expect(composite.get('value')).toBeUndefined();
      expect(composite.get('value')).not.toBeInstanceOf(CompositeSignal);
    });

    it('debe envolver arrays en ReactiveArray con composición automática', () => {
      const arr = [1, 2, 3];
      const composite = new CompositeSignal({
        items: arr
      });

      const items = composite.get('items');
      // Con composición automática: arrays se envuelven en ReactiveArray
      expect(items).toBeInstanceOf(ReactiveArray);
      expect(items).not.toBeInstanceOf(CompositeSignal);
      expect(items.getPlainValue()).toEqual([1, 2, 3]);
    });

    it('no debe envolver Date', () => {
      const date = new Date();
      const composite = new CompositeSignal({
        created: date
      });

      expect(composite.get('created')).toBe(date);
      expect(composite.get('created')).not.toBeInstanceOf(CompositeSignal);
    });

    it('no debe envolver RegExp', () => {
      const regex = /test/;
      const composite = new CompositeSignal({
        pattern: regex
      });

      expect(composite.get('pattern')).toBe(regex);
      expect(composite.get('pattern')).not.toBeInstanceOf(CompositeSignal);
    });

    it('no debe envolver Map', () => {
      const map = new Map();
      const composite = new CompositeSignal({
        data: map
      });

      expect(composite.get('data')).toBe(map);
      expect(composite.get('data')).not.toBeInstanceOf(CompositeSignal);
    });

    it('no debe envolver Set', () => {
      const set = new Set();
      const composite = new CompositeSignal({
        tags: set
      });

      expect(composite.get('tags')).toBe(set);
      expect(composite.get('tags')).not.toBeInstanceOf(CompositeSignal);
    });
  });

  describe('Caché de CompositeSignals anidados', () => {
    it('debe retornar la misma instancia de CompositeSignal en accesos sucesivos', () => {
      const composite = new CompositeSignal({
        user: {
          name: 'Alice'
        }
      });

      const user1 = composite.get('user');
      const user2 = composite.get('user');
      
      expect(user1).toBe(user2);
    });

    it('debe usar el caché global para el mismo objeto', () => {
      const userObj = { name: 'Alice' };
      
      const composite1 = new CompositeSignal({ user: userObj });
      const composite2 = new CompositeSignal({ user: userObj });

      const user1 = composite1.get('user');
      const user2 = composite2.get('user');
      
      // Deben ser la misma instancia porque envuelven el mismo objeto
      expect(user1).toBe(user2);
    });

    it('debe crear diferentes CompositeSignals para objetos diferentes', () => {
      const composite = new CompositeSignal({
        user1: { name: 'Alice' },
        user2: { name: 'Bob' }
      });

      const user1 = composite.get('user1');
      const user2 = composite.get('user2');
      
      expect(user1).not.toBe(user2);
      expect(user1).toBeInstanceOf(CompositeSignal);
      expect(user2).toBeInstanceOf(CompositeSignal);
    });
  });

  describe('Invalidación de caché en set', () => {
    it('debe invalidar el caché cuando se reemplaza un objeto', () => {
      const composite = new CompositeSignal({
        user: { name: 'Alice' }
      });

      const user1 = composite.get('user');
      
      // Reemplazar el objeto
      composite.set('user', { name: 'Bob' });
      
      const user2 = composite.get('user');
      
      // Debe ser una nueva instancia
      expect(user1).not.toBe(user2);
      expect(user2.get('name')).toBe('Bob');
    });

    it('no debe invalidar el caché si se actualiza una propiedad primitiva', () => {
      const composite = new CompositeSignal({
        user: { name: 'Alice' },
        count: 0
      });

      const user1 = composite.get('user');
      
      // Actualizar una propiedad primitiva diferente
      composite.set('count', 1);
      
      const user2 = composite.get('user');
      
      // Debe ser la misma instancia
      expect(user1).toBe(user2);
    });

    it('debe invalidar el caché al cambiar de objeto a primitivo', () => {
      const composite = new CompositeSignal({
        value: { x: 10 }
      });

      const value1 = composite.get('value');
      expect(value1).toBeInstanceOf(CompositeSignal);
      
      // Cambiar a primitivo
      composite.set('value', 42);
      
      const value2 = composite.get('value');
      expect(value2).toBe(42);
      expect(value2).not.toBeInstanceOf(CompositeSignal);
    });

    it('debe invalidar el caché al cambiar de primitivo a objeto', () => {
      const composite = new CompositeSignal({
        value: 42
      });

      const value1 = composite.get('value');
      expect(value1).toBe(42);
      
      // Cambiar a objeto
      composite.set('value', { x: 10 });
      
      const value2 = composite.get('value');
      expect(value2).toBeInstanceOf(CompositeSignal);
      expect(value2.get('x')).toBe(10);
    });
  });

  describe('Tracking de propiedades anidadas', () => {
    it('debe trackear cambios en propiedades del objeto anidado', () => {
      const composite = new CompositeSignal({
        user: {
          name: 'Alice'
        }
      });

      let executionCount = 0;
      let lastName = '';

      const computed = new Computed(() => {
        executionCount++;
        const user = composite.get('user');
        lastName = user.get('name');
        return lastName;
      });

      expect(computed.get()).toBe('Alice');
      expect(executionCount).toBe(1);

      // Cambiar la propiedad del objeto anidado
      const user = composite.get('user');
      user.set('name', 'Bob');

      expect(computed.get()).toBe('Bob');
      expect(executionCount).toBe(2);
    });

    it('debe trackear el objeto padre cuando se accede a una propiedad objeto', () => {
      const composite = new CompositeSignal({
        user: {
          name: 'Alice'
        }
      });

      let executionCount = 0;
      let userName = '';

      const computed = new Computed(() => {
        executionCount++;
        const user = composite.get('user');
        userName = user.get('name');
        return userName;
      });

      expect(computed.get()).toBe('Alice');
      expect(executionCount).toBe(1);

      // Reemplazar el objeto completo
      composite.set('user', { name: 'Bob' });

      expect(computed.get()).toBe('Bob');
      expect(executionCount).toBe(2);
    });

    it('no debe re-ejecutar si solo se modifica una propiedad no trackeada del objeto anidado', () => {
      const composite = new CompositeSignal({
        user: {
          name: 'Alice',
          age: 30
        }
      });

      let executionCount = 0;

      const computed = new Computed(() => {
        executionCount++;
        const user = composite.get('user');
        return user.get('name');
      });

      expect(computed.get()).toBe('Alice');
      expect(executionCount).toBe(1);

      // Modificar una propiedad que NO está siendo trackeada
      const user = composite.get('user');
      user.set('age', 31);

      // No debería re-ejecutar porque 'age' no está siendo trackeada
      expect(computed.get()).toBe('Alice');
      expect(executionCount).toBe(1);
    });
  });

  describe('Objetos anidados multinivel', () => {
    it('debe soportar objetos anidados a múltiples niveles', () => {
      const composite = new CompositeSignal({
        company: {
          name: 'Acme',
          ceo: {
            name: 'Alice',
            contact: {
              email: 'alice@acme.com'
            }
          }
        }
      });

      const company = composite.get('company');
      expect(company).toBeInstanceOf(CompositeSignal);
      
      const ceo = company.get('ceo');
      expect(ceo).toBeInstanceOf(CompositeSignal);
      
      const contact = ceo.get('contact');
      expect(contact).toBeInstanceOf(CompositeSignal);
      
      expect(contact.get('email')).toBe('alice@acme.com');
    });

    it('debe trackear cambios en objetos anidados profundos', () => {
      const composite = new CompositeSignal({
        company: {
          ceo: {
            contact: {
              email: 'alice@acme.com'
            }
          }
        }
      });

      let executionCount = 0;
      let email = '';

      const computed = new Computed(() => {
        executionCount++;
        const company = composite.get('company');
        const ceo = company.get('ceo');
        const contact = ceo.get('contact');
        email = contact.get('email');
        return email;
      });

      expect(computed.get()).toBe('alice@acme.com');
      expect(executionCount).toBe(1);

      // Cambiar el email profundamente anidado
      const company = composite.get('company');
      const ceo = company.get('ceo');
      const contact = ceo.get('contact');
      contact.set('email', 'alice@newdomain.com');

      expect(computed.get()).toBe('alice@newdomain.com');
      expect(executionCount).toBe(2);
    });

    it('debe mantener el caché en diferentes niveles de anidación', () => {
      const composite = new CompositeSignal({
        level1: {
          level2: {
            value: 'deep'
          }
        }
      });

      const level1_a = composite.get('level1');
      const level1_b = composite.get('level1');
      expect(level1_a).toBe(level1_b);

      const level2_a = level1_a.get('level2');
      const level2_b = level1_b.get('level2');
      expect(level2_a).toBe(level2_b);
    });
  });

  describe('Notificaciones con objetos anidados', () => {
    it('debe notificar subscribers cuando cambia una propiedad del objeto anidado', () => {
      const composite = new CompositeSignal({
        settings: {
          theme: 'dark'
        }
      });

      let notificationCount = 0;
      const subscriber = createSyncSubscriber(() => {
        notificationCount++;
      });

      const settings = composite.get('settings');
      settings.subscribeToProperty('theme', subscriber);

      settings.set('theme', 'light');
      expect(notificationCount).toBe(1);

      settings.set('theme', 'auto');
      expect(notificationCount).toBe(2);
    });

    it('debe notificar cuando se reemplaza un objeto anidado', () => {
      const composite = new CompositeSignal({
        config: {
          debug: true
        }
      });

      let notificationCount = 0;
      const subscriber = createSyncSubscriber(() => {
        notificationCount++;
      });

      composite.subscribeToProperty('config', subscriber);

      composite.set('config', { debug: false });
      expect(notificationCount).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('debe manejar objetos vacíos', () => {
      const composite = new CompositeSignal({
        empty: {}
      });

      const empty = composite.get('empty');
      expect(empty).toBeInstanceOf(CompositeSignal);
      expect(empty.get('nonexistent')).toBeUndefined();
    });

    it('debe manejar objetos con propiedades symbol', () => {
      const sym = Symbol('test');
      const composite = new CompositeSignal({
        obj: {
          [sym]: 'value'
        }
      });

      const obj = composite.get('obj');
      expect(obj.get(sym)).toBe('value');
    });

    it('debe manejar circular references sin entrar en loop infinito', () => {
      const circular: any = { name: 'root' };
      circular.self = circular;

      const composite = new CompositeSignal({
        circular
      });

      const obj = composite.get('circular');
      expect(obj).toBeInstanceOf(CompositeSignal);
      
      const self = obj.get('self');
      // Debe ser el mismo CompositeSignal por el caché global
      expect(self).toBe(obj);
    });

    it('debe manejar objetos con propiedades getter/setter', () => {
      const obj = {
        _value: 10,
        get value() {
          return this._value;
        },
        set value(v: number) {
          this._value = v;
        }
      };

      const composite = new CompositeSignal({ config: obj });
      const config = composite.get('config');

      expect(config.get('value')).toBe(10);
      
      // Los getters/setters del objeto original aún funcionan
      config.set('value', 20);
      expect(config.get('value')).toBe(20);
    });
  });
});
