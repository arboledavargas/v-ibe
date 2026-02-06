import { describe, it, expect } from 'vitest';
import { ReactiveArray } from '../../reactive-array';
import { CompositeSignal } from '../../composite';
import { effect } from '../../effect';
import { phaseScheduler } from '../../../phase-scheduler';
import { createArrayProxy } from '../../reactive-proxy';

describe('ReactiveArray - Nivel 7: Composición Bidireccional', () => {
  describe('Construcción con objetos planos', () => {
    it('debe envolver automáticamente objetos al construir ReactiveArray', () => {
      const arr = new ReactiveArray([
        { name: 'Julian', age: 30 },
        { name: 'María', age: 25 }
      ]);
      
      const proxy = createArrayProxy(arr);
      const first = arr.at(0);
      
      // Debe ser un CompositeSignal
      expect(first).toBeInstanceOf(CompositeSignal);
      expect(proxy[0].name).toBe('Julian');
      expect(proxy[0].age).toBe(30);
    });

    it('debe envolver automáticamente arrays anidados', () => {
      const arr = new ReactiveArray([
        { name: 'Julian', hobbies: ['coding', 'music'] },
        { name: 'María', hobbies: ['reading', 'sports'] }
      ]);
      
      const proxy = createArrayProxy(arr);
      const first = arr.at(0);
      const hobbies = proxy[0].hobbies;
      
      // hobbies debe ser un ReactiveArray
      expect(hobbies).toBeInstanceOf(ReactiveArray);
      expect(hobbies.at(0)).toBe('coding');
      expect(hobbies.at(1)).toBe('music');
    });

    it('debe envolver objetos anidados múltiples niveles', () => {
      const arr = new ReactiveArray([
        {
          name: 'Julian',
          address: {
            city: 'Bogotá',
            country: 'Colombia'
          }
        }
      ]);
      
      const proxy = createArrayProxy(arr);
      const first = arr.at(0);
      const address = proxy[0].address;
      
      expect(address).toBeInstanceOf(CompositeSignal);
      expect(address.city).toBe('Bogotá');
      expect(address.country).toBe('Colombia');
    });
  });

  describe('Mutaciones con objetos planos', () => {
    it('debe envolver automáticamente objetos en push()', () => {
      const arr = new ReactiveArray([
        { name: 'Julian', age: 30 }
      ]);
      
      arr.push({ name: 'Carlos', age: 28 });
      
      const proxy = createArrayProxy(arr);
      const carlos = arr.at(1);
      expect(carlos).toBeInstanceOf(CompositeSignal);
      expect(proxy[1].name).toBe('Carlos');
      expect(proxy[1].age).toBe(28);
    });

    it('debe envolver automáticamente objetos en unshift()', () => {
      const arr = new ReactiveArray([
        { name: 'María', age: 25 }
      ]);
      
      arr.unshift({ name: 'Julian', age: 30 });
      
      const proxy = createArrayProxy(arr);
      const julian = arr.at(0);
      expect(julian).toBeInstanceOf(CompositeSignal);
      expect(proxy[0].name).toBe('Julian');
    });

    it('debe envolver automáticamente objetos en splice()', () => {
      const arr = new ReactiveArray([
        { name: 'Julian', age: 30 },
        { name: 'María', age: 25 }
      ]);
      
      arr.splice(1, 0, { name: 'Carlos', age: 28 });
      
      const proxy = createArrayProxy(arr);
      const carlos = arr.at(1);
      expect(carlos).toBeInstanceOf(CompositeSignal);
      expect(proxy[1].name).toBe('Carlos');
    });

    it('debe envolver automáticamente objetos en fill()', () => {
      const arr = new ReactiveArray([
        { name: 'Julian', age: 30 },
        { name: 'María', age: 25 }
      ]);
      
      arr.fill({ name: 'Default', age: 0 });
      
      const proxy = createArrayProxy(arr);
      const first = arr.at(0);
      const second = arr.at(1);
      
      // Ambos deben apuntar al MISMO CompositeSignal (fill usa la misma referencia)
      expect(first).toBe(second);
      expect(proxy[0].name).toBe('Default');
    });
  });

  describe('Reactividad con composición', () => {
    it('debe reaccionar a cambios en propiedades de objetos anidados', () => {
      const arr = new ReactiveArray([
        { name: 'Julian', age: 30 },
        { name: 'María', age: 25 }
      ]);
      
      const proxy = createArrayProxy(arr);
      let execCount = 0;
      let firstName = '';
      
      effect(() => {
        execCount++;
        firstName = proxy[0].name;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(firstName).toBe('Julian');
      
      // Cambiar la propiedad name del primer elemento
      arr.at(0).set('name', 'Julián');
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(firstName).toBe('Julián');
    });

    it('NO debe reaccionar a cambios en propiedades no observadas', () => {
      const arr = new ReactiveArray([
        { name: 'Julian', age: 30, city: 'Bogotá' }
      ]);
      
      const proxy = createArrayProxy(arr);
      let execCount = 0;
      let name = '';
      
      effect(() => {
        execCount++;
        // Solo lee 'name', no 'city'
        name = proxy[0].name;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      // Cambiar city NO debe re-ejecutar el effect
      arr.at(0).set('city', 'Cartagena');
      phaseScheduler.flush();
      
      expect(execCount).toBe(1); // NO cambió
    });

    it('debe reaccionar a cambios en arrays anidados', () => {
      const arr = new ReactiveArray([
        { name: 'Julian', hobbies: ['coding', 'music'] }
      ]);
      
      const proxy = createArrayProxy(arr);
      let execCount = 0;
      let hobbiesCount = 0;
      
      effect(() => {
        execCount++;
        const hobbies = proxy[0].hobbies;
        hobbiesCount = hobbies.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(hobbiesCount).toBe(2);
      
      // Agregar un hobby
      proxy[0].hobbies.push('gaming');
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(hobbiesCount).toBe(3);
    });
  });

  describe('Integración con CompositeSignal', () => {
    it('debe funcionar al empezar desde CompositeSignal', () => {
      const app = new CompositeSignal({
        users: [
          { name: 'Julian', age: 30 },
          { name: 'María', age: 25 }
        ]
      });
      
      const users = app.get('users');
      expect(users).toBeInstanceOf(ReactiveArray);
      
      const proxy = createArrayProxy(users);
      const julian = users.at(0);
      expect(julian).toBeInstanceOf(CompositeSignal);
      expect(proxy[0].name).toBe('Julian');
    });

    it('debe funcionar al empezar desde ReactiveArray', () => {
      const users = new ReactiveArray([
        { name: 'Julian', age: 30 },
        { name: 'María', age: 25 }
      ]);
      
      const proxy = createArrayProxy(users);
      const julian = users.at(0);
      expect(julian).toBeInstanceOf(CompositeSignal);
      expect(proxy[0].name).toBe('Julian');
      
      // Y puedo mutar
      users.push({ name: 'Carlos', age: 28 });
      const carlos = users.at(2);
      expect(carlos).toBeInstanceOf(CompositeSignal);
    });

    it('debe mantener reactividad bidireccional completa', () => {
      const app = new CompositeSignal({
        users: [
          { name: 'Julian', age: 30 }
        ]
      });
      
      const usersProxy = createArrayProxy(app.get('users'));
      let execCount = 0;
      let userName = '';
      
      effect(() => {
        execCount++;
        userName = usersProxy[0].name;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(userName).toBe('Julian');
      
      // Cambiar desde el CompositeSignal anidado
      app.get('users').at(0).set('name', 'Julián');
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(userName).toBe('Julián');
    });
  });

  describe('Casos edge', () => {
    it('debe manejar valores primitivos sin envolver', () => {
      const arr = new ReactiveArray([1, 2, 3]);
      
      expect(arr.at(0)).toBe(1);
      expect(arr.at(1)).toBe(2);
      expect(arr.at(2)).toBe(3);
    });

    it('debe manejar null y undefined correctamente', () => {
      const arr = new ReactiveArray([null, undefined, { name: 'test' }]);
      
      expect(arr.at(0)).toBe(null);
      expect(arr.at(1)).toBe(undefined);
      expect(arr.at(2)).toBeInstanceOf(CompositeSignal);
    });

    it('debe envolver objetos vacíos', () => {
      const arr = new ReactiveArray([{}]);
      
      const proxy = createArrayProxy(arr);
      const obj = arr.at(0);
      expect(obj).toBeInstanceOf(CompositeSignal);
      
      // Debe poder agregar propiedades
      obj.set('newProp', 'value');
      expect(proxy[0].newProp).toBe('value');
    });

    it('debe manejar arrays vacíos anidados', () => {
      const arr = new ReactiveArray([
        { name: 'Julian', tags: [] }
      ]);
      
      const proxy = createArrayProxy(arr);
      const tags = proxy[0].tags;
      expect(tags).toBeInstanceOf(ReactiveArray);
      expect(tags.length).toBe(0);
      
      tags.push('developer');
      expect(tags.length).toBe(1);
    });
  });
});
