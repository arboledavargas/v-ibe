import { describe, it, expect } from 'vitest';
import { createStore } from '../../reactive-proxy';
import { effect } from '../../effect';
import { phaseScheduler } from '../../../phase-scheduler';

describe('Proxies Reactivos - Sintaxis Nativa', () => {
  describe('createStore con objetos', () => {
    it('debe permitir acceso a propiedades con sintaxis nativa', () => {
      const store = createStore({
        name: 'Julian',
        age: 30
      });
      
      expect(store.name).toBe('Julian');
      expect(store.age).toBe(30);
    });

    it('debe permitir asignación con sintaxis nativa', () => {
      const store = createStore({
        name: 'Julian',
        age: 30
      });
      
      store.name = 'Julián';
      store.age = 31;
      
      expect(store.name).toBe('Julián');
      expect(store.age).toBe(31);
    });

    it('debe mantener reactividad con sintaxis nativa', () => {
      const store = createStore({
        name: 'Julian',
        age: 30
      });
      
      let execCount = 0;
      let observedName = '';
      
      effect(() => {
        execCount++;
        observedName = store.name;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(observedName).toBe('Julian');
      
      store.name = 'Julián';
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(observedName).toBe('Julián');
    });

    it('debe trabajar con objetos anidados', () => {
      const store = createStore({
        user: {
          name: 'Julian',
          address: {
            city: 'Bogotá',
            country: 'Colombia'
          }
        }
      });
      
      expect(store.user.name).toBe('Julian');
      expect(store.user.address.city).toBe('Bogotá');
      expect(store.user.address.country).toBe('Colombia');
    });

    it('debe mantener reactividad con objetos anidados', () => {
      const store = createStore({
        user: {
          name: 'Julian',
          address: {
            city: 'Bogotá',
            country: 'Colombia'
          }
        }
      });
      
      let execCount = 0;
      let city = '';
      
      effect(() => {
        execCount++;
        city = store.user.address.city;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(city).toBe('Bogotá');
      
      store.user.address.city = 'Medellín';
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(city).toBe('Medellín');
    });

    it('debe mantener granularidad - no reaccionar a propiedades no observadas', () => {
      const store = createStore({
        user: {
          name: 'Julian',
          age: 30,
          city: 'Bogotá'
        }
      });
      
      let execCount = 0;
      
      effect(() => {
        execCount++;
        // Solo lee name, no age ni city
        const name = store.user.name;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      store.user.age = 31;
      phaseScheduler.flush();
      expect(execCount).toBe(1); // NO cambió
      
      store.user.city = 'Medellín';
      phaseScheduler.flush();
      expect(execCount).toBe(1); // NO cambió
      
      store.user.name = 'Julián';
      phaseScheduler.flush();
      expect(execCount).toBe(2); // SÍ cambió
    });
  });

  describe('createStore con arrays', () => {
    it('debe permitir acceso por índice con sintaxis nativa', () => {
      const store = createStore([1, 2, 3, 4, 5]);
      
      expect(store[0]).toBe(1);
      expect(store[2]).toBe(3);
      expect(store[4]).toBe(5);
    });

    it('debe permitir usar length', () => {
      const store = createStore([1, 2, 3]);
      
      expect(store.length).toBe(3);
    });

    it('debe permitir métodos mutadores con sintaxis nativa', () => {
      const store = createStore([1, 2, 3]);
      
      store.push(4);
      expect(store.length).toBe(4);
      expect(store[3]).toBe(4);
      
      const last = store.pop();
      expect(last).toBe(4);
      expect(store.length).toBe(3);
    });

    it('debe mantener reactividad con arrays', () => {
      const store = createStore([10, 20, 30]);
      
      let execCount = 0;
      let first = 0;
      
      effect(() => {
        execCount++;
        first = store[0];
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(first).toBe(10);
      
      store.push(40);
      phaseScheduler.flush();
      
      expect(execCount).toBe(1); // NO cambió (no afecta store[0])
      
      store[0] = 15; // Nota: esto podría no estar soportado
    });

    it('debe trabajar con arrays de objetos', () => {
      const store = createStore([
        { name: 'Julian', age: 30 },
        { name: 'María', age: 25 }
      ]);
      
      expect(store[0].name).toBe('Julian');
      expect(store[1].name).toBe('María');
      
      store[0].age = 31;
      expect(store[0].age).toBe(31);
    });

    it('debe mantener reactividad con arrays de objetos', () => {
      const store = createStore([
        { name: 'Julian', age: 30 },
        { name: 'María', age: 25 }
      ]);
      
      let execCount = 0;
      let firstName = '';
      
      effect(() => {
        execCount++;
        firstName = store[0].name;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(firstName).toBe('Julian');
      
      store[0].name = 'Julián';
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(firstName).toBe('Julián');
    });

    it('debe funcionar for...of', () => {
      const store = createStore([1, 2, 3, 4, 5]);
      
      const result: number[] = [];
      for (const item of store) {
        result.push(item);
      }
      
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('debe funcionar for...of con objetos', () => {
      const store = createStore([
        { name: 'Julian' },
        { name: 'María' }
      ]);
      
      const names: string[] = [];
      for (const user of store) {
        names.push(user.name);
      }
      
      expect(names).toEqual(['Julian', 'María']);
    });
  });

  describe('Composición completa', () => {
    it('debe funcionar con estructuras complejas anidadas', () => {
      const app = createStore({
        user: {
          name: 'Julian',
          age: 30,
          address: {
            city: 'Bogotá',
            country: 'Colombia'
          }
        },
        projects: [
          { id: 1, name: 'Framework', stars: 100 },
          { id: 2, name: 'Backend', stars: 50 }
        ]
      });
      
      expect(app.user.name).toBe('Julian');
      expect(app.user.address.city).toBe('Bogotá');
      expect(app.projects[0].name).toBe('Framework');
      expect(app.projects[1].stars).toBe(50);
    });

    it('debe mantener reactividad en estructuras complejas', () => {
      const app = createStore({
        user: {
          name: 'Julian',
          address: {
            city: 'Bogotá'
          }
        },
        projects: [
          { id: 1, name: 'Framework' }
        ]
      });
      
      let execCount = 0;
      let message = '';
      
      effect(() => {
        execCount++;
        const name = app.user.name;
        const city = app.user.address.city;
        const project = app.projects[0].name;
        message = `${name} en ${city} trabaja en ${project}`;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(message).toBe('Julian en Bogotá trabaja en Framework');
      
      // Cambiar una propiedad observada
      app.user.address.city = 'Medellín';
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(message).toBe('Julian en Medellín trabaja en Framework');
      
      // Agregar un proyecto no afecta
      app.projects.push({ id: 2, name: 'Backend' });
      phaseScheduler.flush();
      
      expect(execCount).toBe(2); // NO cambió (solo leemos projects[0])
      
      // Cambiar el nombre del primer proyecto
      app.projects[0].name = 'Framework v2';
      phaseScheduler.flush();
      
      expect(execCount).toBe(3);
      expect(message).toBe('Julian en Medellín trabaja en Framework v2');
    });
  });

  describe('Métodos de array', () => {
    it('debe funcionar map', () => {
      const store = createStore([1, 2, 3, 4, 5]);
      
      const doubled = store.map(x => x * 2);
      
      expect(doubled[0]).toBe(2);
      expect(doubled[4]).toBe(10);
    });

    it('debe funcionar filter', () => {
      const store = createStore([1, 2, 3, 4, 5]);
      
      const evens = store.filter(x => x % 2 === 0);
      
      expect(evens.length).toBe(2);
      expect(evens[0]).toBe(2);
      expect(evens[1]).toBe(4);
    });

    it('debe mantener reactividad en arrays derivados', () => {
      const store = createStore([
        { name: 'Alice', active: true },
        { name: 'Bob', active: false },
        { name: 'Charlie', active: true }
      ]);
      
      let execCount = 0;
      let activeNames: string[] = [];
      
      effect(() => {
        execCount++;
        const actives = store.filter(u => u.active);
        activeNames = [];
        for (const user of actives) {
          activeNames.push(user.name);
        }
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(activeNames).toEqual(['Alice', 'Charlie']);
      
      // Cambiar el estado de Bob
      store[1].active = true;
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(activeNames).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });

  describe('Propiedades especiales', () => {
    it('debe exponer __isReactive en objetos', () => {
      const store = createStore({ name: 'Julian' });
      
      expect((store as any).__isReactive).toBe(true);
    });

    it('debe exponer __isReactive en arrays', () => {
      const store = createStore([1, 2, 3]);
      
      expect((store as any).__isReactive).toBe(true);
    });

    it('debe poder acceder al CompositeSignal subyacente', () => {
      const store = createStore({ name: 'Julian' });
      
      const composite = (store as any).__getCompositeSignal;
      expect(composite).toBeDefined();
      expect(composite.get('name')).toBe('Julian');
    });

    it('debe poder acceder al ReactiveArray subyacente', () => {
      const store = createStore([1, 2, 3]);
      
      const reactiveArray = (store as any).__getReactiveArray;
      expect(reactiveArray).toBeDefined();
      expect(reactiveArray.at(0)).toBe(1);
    });
  });

  describe('Caché de proxies', () => {
    it('debe retornar el mismo proxy para el mismo objeto anidado', () => {
      const store = createStore({
        user: { name: 'Julian' }
      });
      
      const user1 = store.user;
      const user2 = store.user;
      
      expect(user1).toBe(user2); // Misma referencia
    });

    it('debe retornar el mismo proxy para el mismo array anidado', () => {
      const store = createStore({
        items: [1, 2, 3]
      });
      
      const items1 = store.items;
      const items2 = store.items;
      
      expect(items1).toBe(items2); // Misma referencia
    });
  });
});
