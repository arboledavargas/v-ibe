import { describe, it, expect } from 'vitest';
import { CompositeSignal } from '../composite';
import { ReactiveArray } from '../reactive-array';
import { effect } from '../effect';
import { phaseScheduler } from '../../phase-scheduler';

describe('Composición automática - CompositeSignal y ReactiveArray', () => {
  describe('CompositeSignal → ReactiveArray', () => {
    it('debe devolver ReactiveArray cuando get() encuentra un array', () => {
      const obj = new CompositeSignal({ numbers: [1, 2, 3] });
      
      const numbers = obj.get('numbers');
      
      expect(numbers).toBeInstanceOf(ReactiveArray);
    });

    it('el ReactiveArray devuelto debe ser funcional', () => {
      const obj = new CompositeSignal({ numbers: [1, 2, 3] });
      
      const numbers = obj.get('numbers') as ReactiveArray<number>;
      
      expect(numbers.length).toBe(3);
      expect(numbers.at(0)).toBe(1);
      expect(numbers.at(1)).toBe(2);
    });

    it('debe devolver la misma instancia en llamadas sucesivas', () => {
      const obj = new CompositeSignal({ numbers: [1, 2, 3] });
      
      const numbers1 = obj.get('numbers');
      const numbers2 = obj.get('numbers');
      
      expect(numbers1).toBe(numbers2);
    });
  });

  describe('ReactiveArray → CompositeSignal', () => {
    it('debe devolver CompositeSignal cuando at() encuentra un objeto', () => {
      const arr = new ReactiveArray([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]);
      
      const first = arr.at(0);
      
      expect(first).toBeInstanceOf(CompositeSignal);
    });

    it('el CompositeSignal devuelto debe ser funcional', () => {
      const arr = new ReactiveArray([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]);
      
      const first = arr.at(0) as CompositeSignal<any>;
      
      expect(first.get('id')).toBe(1);
      expect(first.get('name')).toBe('Alice');
    });

    it('debe devolver la misma instancia para el mismo índice', () => {
      const arr = new ReactiveArray([{ id: 1, name: 'Alice' }]);
      
      const first1 = arr.at(0);
      const first2 = arr.at(0);
      
      expect(first1).toBe(first2);
    });
  });

  describe('Composición multinivel - Objetos con arrays', () => {
    it('debe manejar objeto con array de primitivos', () => {
      const app = new CompositeSignal({
        user: {
          name: 'Julian',
          scores: [10, 20, 30]
        }
      });
      
      const user = app.get('user') as CompositeSignal<any>;
      expect(user).toBeInstanceOf(CompositeSignal);
      
      const scores = user.get('scores') as ReactiveArray<number>;
      expect(scores).toBeInstanceOf(ReactiveArray);
      expect(scores.at(0)).toBe(10);
    });

    it('debe manejar objeto con array de objetos', () => {
      const app = new CompositeSignal({
        user: {
          name: 'Julian',
          projects: [
            { id: 1, name: 'v-ibe' },
            { id: 2, name: 'mocca-backend' }
          ]
        }
      });
      
      const user = app.get('user') as CompositeSignal<any>;
      const projects = user.get('projects') as ReactiveArray<any>;
      const firstProject = projects.at(0) as CompositeSignal<any>;
      
      expect(user).toBeInstanceOf(CompositeSignal);
      expect(projects).toBeInstanceOf(ReactiveArray);
      expect(firstProject).toBeInstanceOf(CompositeSignal);
      expect(firstProject.get('name')).toBe('v-ibe');
    });

    it('debe manejar array de objetos con arrays anidados', () => {
      const arr = new ReactiveArray([
        {
          id: 1,
          tags: ['javascript', 'typescript']
        },
        {
          id: 2,
          tags: ['react', 'vue']
        }
      ]);
      
      const first = arr.at(0) as CompositeSignal<any>;
      const tags = first.get('tags') as ReactiveArray<string>;
      
      expect(first).toBeInstanceOf(CompositeSignal);
      expect(tags).toBeInstanceOf(ReactiveArray);
      expect(tags.at(0)).toBe('javascript');
    });
  });

  describe('Tracking granular con composición', () => {
    it('effect debe reaccionar solo a cambios en la propiedad observada', () => {
      const app = new CompositeSignal({
        user: {
          name: 'Julian',
          projects: [
            { id: 1, name: 'Project A' }
          ]
        }
      });
      
      let projectName = '';
      let execCount = 0;
      
      effect(() => {
        execCount++;
        const user = app.get('user') as CompositeSignal<any>;
        const projects = user.get('projects') as ReactiveArray<any>;
        const firstProject = projects.at(0) as CompositeSignal<any>;
        projectName = firstProject.get('name');
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(projectName).toBe('Project A');
      
      // Cambiar el nombre del proyecto
      const user = app.get('user') as CompositeSignal<any>;
      const projects = user.get('projects') as ReactiveArray<any>;
      const firstProject = projects.at(0) as CompositeSignal<any>;
      firstProject.set('name', 'Project B');
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(projectName).toBe('Project B');
    });

    it('effect NO debe reaccionar a cambios en otros elementos del array', () => {
      const arr = new ReactiveArray([
        { id: 1, value: 'A' },
        { id: 2, value: 'B' }
      ]);
      
      let value0 = '';
      let execCount = 0;
      
      effect(() => {
        execCount++;
        const item = arr.at(0) as CompositeSignal<any>;
        value0 = item.get('value');
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      
      // Cambiar el segundo elemento
      const item1 = arr.at(1) as CompositeSignal<any>;
      item1.set('value', 'C');
      phaseScheduler.flush();
      
      // NO debería re-ejecutarse
      expect(execCount).toBe(1);
      expect(value0).toBe('A');
    });

    it('effect debe reaccionar a cambios en longitud del array', () => {
      const obj = new CompositeSignal({
        items: [1, 2, 3]
      });
      
      let length = 0;
      let execCount = 0;
      
      effect(() => {
        execCount++;
        const items = obj.get('items') as ReactiveArray<number>;
        length = items.length;
      }, { priority: 'Sync' });
      
      expect(execCount).toBe(1);
      expect(length).toBe(3);
      
      // Agregar elemento
      const items = obj.get('items') as ReactiveArray<number>;
      items.push(4);
      phaseScheduler.flush();
      
      expect(execCount).toBe(2);
      expect(length).toBe(4);
    });
  });

  describe('Consistencia del caché compartido', () => {
    it('mismo objeto debe devolver misma instancia desde diferentes rutas', () => {
      const sharedConfig = { theme: 'dark', lang: 'es' };
      
      const app = new CompositeSignal({
        config: sharedConfig,
        settings: {
          appConfig: sharedConfig
        }
      });
      
      const config1 = app.get('config');
      const settings = app.get('settings') as CompositeSignal<any>;
      const config2 = settings.get('appConfig');
      
      // Deben ser la misma instancia
      expect(config1).toBe(config2);
    });

    it('mismo array debe devolver misma instancia desde diferentes rutas', () => {
      const sharedTags = ['javascript', 'typescript'];
      
      const app = new CompositeSignal({
        tags: sharedTags,
        metadata: {
          allTags: sharedTags
        }
      });
      
      const tags1 = app.get('tags');
      const metadata = app.get('metadata') as CompositeSignal<any>;
      const tags2 = metadata.get('allTags');
      
      expect(tags1).toBe(tags2);
    });

    it('mutación en instancia compartida debe verse en todas las referencias', () => {
      const sharedArray = [1, 2, 3];
      
      const obj1 = new CompositeSignal({ numbers: sharedArray });
      const obj2 = new CompositeSignal({ values: sharedArray });
      
      const numbers = obj1.get('numbers') as ReactiveArray<number>;
      const values = obj2.get('values') as ReactiveArray<number>;
      
      // Son la misma instancia
      expect(numbers).toBe(values);
      
      // Mutar a través de numbers
      numbers.push(4);
      
      // Debe verse en values porque es la misma instancia
      expect(values.length).toBe(4);
      expect(values.at(3)).toBe(4);
    });
  });

  describe('Casos edge de composición', () => {
    it('debe manejar arrays vacíos', () => {
      const obj = new CompositeSignal({ items: [] });
      const items = obj.get('items');
      
      expect(items).toBeInstanceOf(ReactiveArray);
      expect((items as ReactiveArray<any>).length).toBe(0);
    });

    it('debe manejar objetos vacíos en array', () => {
      const arr = new ReactiveArray([{}]);
      const item = arr.at(0);
      
      expect(item).toBeInstanceOf(CompositeSignal);
    });

    it('debe manejar valores null en objetos', () => {
      const obj = new CompositeSignal({ value: null });
      const value = obj.get('value');
      
      expect(value).toBeNull();
    });

    it('debe manejar valores undefined en arrays', () => {
      const arr = new ReactiveArray([undefined, 42]);
      const value = arr.at(0);
      
      expect(value).toBeUndefined();
    });

    it('debe manejar arrays con mezcla de tipos', () => {
      const arr = new ReactiveArray([
        42,
        'string',
        { id: 1 },
        [1, 2, 3],
        null
      ]);
      
      expect(arr.at(0)).toBe(42);
      expect(arr.at(1)).toBe('string');
      expect(arr.at(2)).toBeInstanceOf(CompositeSignal);
      expect(arr.at(3)).toBeInstanceOf(ReactiveArray);
      expect(arr.at(4)).toBeNull();
    });
  });
});
