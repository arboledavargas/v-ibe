import { describe, it, expect, beforeEach } from 'vitest';
import { State } from '../state';
import { Signal } from '../../signals/signal';
import { CompositeSignal } from '../../signals/composite';
import { ReactiveArray } from '../../signals/reactive-array';
import { effect } from '../../signals/effect';
import { phaseScheduler } from '../../phase-scheduler';
import { reactiveContext } from '../../reactive-context';

describe('@State - Decorador Inteligente', () => {
  beforeEach(() => {
    // Reset scheduler
    // @ts-ignore - accessing private for cleanup
    phaseScheduler.dirtyEffects.clear();
    // @ts-ignore
    phaseScheduler.isFlushScheduled = false;
    
    // Reset reactive context
    // @ts-ignore - accessing private properties for testing
    reactiveContext.computationStack = [];
    // @ts-ignore - accessing private properties for testing
    reactiveContext.contextStack = [];
  });

  describe('Primitivos', () => {
    it('debe crear Signal para valores primitivos', () => {
      class TestComponent {
        @State count = 0;
        @State name = 'Julian';
        @State active = true;
      }

      const comp = new TestComponent();

      // Verificar que se crearon Signals
      expect((comp as any).$count).toBeInstanceOf(Signal);
      expect((comp as any).$name).toBeInstanceOf(Signal);
      expect((comp as any).$active).toBeInstanceOf(Signal);

      // Verificar que get/set funcionan
      expect(comp.count).toBe(0);
      expect(comp.name).toBe('Julian');
      expect(comp.active).toBe(true);

      comp.count = 42;
      comp.name = 'María';
      comp.active = false;

      expect(comp.count).toBe(42);
      expect(comp.name).toBe('María');
      expect(comp.active).toBe(false);
    });

    it('debe mantener reactividad con primitivos', () => {
      class Counter {
        @State count = 0;
      }

      const counter = new Counter();
      let execCount = 0;
      let observedValue = 0;

      effect(() => {
        execCount++;
        observedValue = counter.count;
      }, { priority: 'Sync' });

      expect(execCount).toBe(1);
      expect(observedValue).toBe(0);

      counter.count = 10;
      phaseScheduler.flush();

      expect(execCount).toBe(2);
      expect(observedValue).toBe(10);
    });
  });

  describe('Objetos', () => {
    it('debe crear CompositeSignal para objetos', () => {
      class TestComponent {
        @State user = {
          name: 'Julian',
          age: 30,
          email: 'julian@example.com'
        };
      }

      const comp = new TestComponent();

      // Verificar que se creó CompositeSignal
      expect((comp as any).$user).toBeInstanceOf(CompositeSignal);

      // Verificar que devuelve un Proxy
      expect((comp.user as any).__isReactive).toBe(true);
    });

    it('debe permitir sintaxis nativa con objetos', () => {
      class TestComponent {
        @State user = {
          name: 'Julian',
          age: 30
        };
      }

      const comp = new TestComponent();

      // Acceso con sintaxis nativa
      expect(comp.user.name).toBe('Julian');
      expect(comp.user.age).toBe(30);

      // Asignación con sintaxis nativa
      comp.user.name = 'María';
      comp.user.age = 25;

      expect(comp.user.name).toBe('María');
      expect(comp.user.age).toBe(25);
    });

    it('debe mantener reactividad con objetos', () => {
      class UserComponent {
        @State user = {
          name: 'Julian',
          age: 30
        };
      }

      const comp = new UserComponent();
      let execCount = 0;
      let observedName = '';

      effect(() => {
        execCount++;
        observedName = comp.user.name;
      }, { priority: 'Sync' });

      expect(execCount).toBe(1);
      expect(observedName).toBe('Julian');

      comp.user.name = 'María';
      phaseScheduler.flush();

      expect(execCount).toBe(2);
      expect(observedName).toBe('María');
    });

    it('debe trabajar con objetos anidados', () => {
      class TestComponent {
        @State app = {
          user: {
            name: 'Julian',
            profile: {
              bio: 'Developer'
            }
          }
        };
      }

      const comp = new TestComponent();

      // Acceso anidado con sintaxis nativa
      expect(comp.app.user.name).toBe('Julian');
      expect(comp.app.user.profile.bio).toBe('Developer');

      // Asignación anidada
      comp.app.user.name = 'María';
      comp.app.user.profile.bio = 'Designer';

      expect(comp.app.user.name).toBe('María');
      expect(comp.app.user.profile.bio).toBe('Designer');
    });
  });

  describe('Arrays', () => {
    it('debe crear ReactiveArray para arrays', () => {
      class TestComponent {
        @State items = [1, 2, 3];
        @State names = ['Alice', 'Bob'];
      }

      const comp = new TestComponent();

      // Verificar que se crearon ReactiveArrays
      expect((comp as any).$items).toBeInstanceOf(ReactiveArray);
      expect((comp as any).$names).toBeInstanceOf(ReactiveArray);

      // Verificar que devuelve un Proxy
      expect((comp.items as any).__isReactive).toBe(true);
    });

    it('debe permitir sintaxis nativa con arrays', () => {
      class TestComponent {
        @State items = [1, 2, 3];
      }

      const comp = new TestComponent();

      // Acceso por índice
      expect(comp.items[0]).toBe(1);
      expect(comp.items[1]).toBe(2);
      expect(comp.items[2]).toBe(3);

      // Asignación por índice
      comp.items[0] = 10;
      expect(comp.items[0]).toBe(10);

      // Métodos nativos
      comp.items.push(4);
      expect(comp.items.length).toBe(4);
      expect(comp.items[3]).toBe(4);

      const popped = comp.items.pop();
      expect(popped).toBe(4);
      expect(comp.items.length).toBe(3);
    });

    it('debe mantener reactividad con arrays', () => {
      class ListComponent {
        @State items = [1, 2, 3];
      }

      const comp = new ListComponent();
      let execCount = 0;
      let observedLength = 0;

      effect(() => {
        execCount++;
        observedLength = comp.items.length;
      }, { priority: 'Sync' });

      expect(execCount).toBe(1);
      expect(observedLength).toBe(3);

      comp.items.push(4);
      phaseScheduler.flush();

      expect(execCount).toBe(2);
      expect(observedLength).toBe(4);
    });

    it('debe trabajar con arrays de objetos', () => {
      class TestComponent {
        @State users = [
          { name: 'Julian', age: 30 },
          { name: 'María', age: 25 }
        ];
      }

      const comp = new TestComponent();

      // Acceso con sintaxis nativa
      expect(comp.users[0].name).toBe('Julian');
      expect(comp.users[1].age).toBe(25);

      // Asignación
      comp.users[0].name = 'Julián';
      expect(comp.users[0].name).toBe('Julián');

      // Métodos de array
      comp.users.push({ name: 'Pedro', age: 35 });
      expect(comp.users.length).toBe(3);
      expect(comp.users[2].name).toBe('Pedro');
    });

    it('debe funcionar for...of con arrays', () => {
      class TestComponent {
        @State items = [1, 2, 3, 4, 5];
      }

      const comp = new TestComponent();
      const collected: number[] = [];

      for (const item of comp.items) {
        collected.push(item);
      }

      expect(collected).toEqual([1, 2, 3, 4, 5]);
    });

    it('debe funcionar for...of con arrays de objetos', () => {
      class TestComponent {
        @State users = [
          { name: 'Julian' },
          { name: 'María' }
        ];
      }

      const comp = new TestComponent();
      const names: string[] = [];

      for (const user of comp.users) {
        names.push(user.name);
      }

      expect(names).toEqual(['Julian', 'María']);
    });

    it('debe funcionar métodos de array (map, filter)', () => {
      class TestComponent {
        @State items = [1, 2, 3, 4, 5];
      }

      const comp = new TestComponent();

      const doubled = comp.items.map(x => x * 2);
      // map devuelve un ReactiveArray proxiado, verificar que tenga los valores correctos
      expect(doubled.length).toBe(5);
      expect(doubled[0]).toBe(2);
      expect(doubled[1]).toBe(4);
      expect(doubled[2]).toBe(6);
      expect(doubled[3]).toBe(8);
      expect(doubled[4]).toBe(10);

      const evens = comp.items.filter(x => x % 2 === 0);
      // filter también devuelve un ReactiveArray proxiado
      expect(evens.length).toBe(2);
      expect(evens[0]).toBe(2);
      expect(evens[1]).toBe(4);
    });
  });

  describe('Cambio de tipo dinámico', () => {
    it('debe permitir cambiar de primitivo a objeto', () => {
      class TestComponent {
        @State value: any = 42;
      }

      const comp = new TestComponent();
      expect(comp.value).toBe(42);
      expect((comp as any).$value).toBeInstanceOf(Signal);

      // Cambiar a objeto
      comp.value = { name: 'Julian' };
      expect(comp.value.name).toBe('Julian');
      expect((comp as any).$value).toBeInstanceOf(CompositeSignal);
    });

    it('debe permitir cambiar de objeto a array', () => {
      class TestComponent {
        @State value: any = { name: 'Julian' };
      }

      const comp = new TestComponent();
      expect(comp.value.name).toBe('Julian');
      expect((comp as any).$value).toBeInstanceOf(CompositeSignal);

      // Cambiar a array
      comp.value = [1, 2, 3];
      expect(comp.value[0]).toBe(1);
      expect(comp.value.length).toBe(3);
      expect((comp as any).$value).toBeInstanceOf(ReactiveArray);
    });

    it('debe permitir cambiar de array a primitivo', () => {
      class TestComponent {
        @State value: any = [1, 2, 3];
      }

      const comp = new TestComponent();
      expect(comp.value.length).toBe(3);
      expect((comp as any).$value).toBeInstanceOf(ReactiveArray);

      // Cambiar a primitivo
      comp.value = 'hello';
      expect(comp.value).toBe('hello');
      expect((comp as any).$value).toBeInstanceOf(Signal);
    });
  });

  describe('Composición completa', () => {
    it('debe trabajar con estructuras complejas', () => {
      class AppComponent {
        @State app = {
          user: {
            name: 'Julian',
            preferences: {
              theme: 'dark'
            }
          },
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' }
          ],
          count: 0
        };
      }

      const comp = new AppComponent();

      // Acceso profundamente anidado
      expect(comp.app.user.name).toBe('Julian');
      expect(comp.app.user.preferences.theme).toBe('dark');
      expect(comp.app.items[0].name).toBe('Item 1');
      expect(comp.app.count).toBe(0);

      // Modificaciones
      comp.app.user.name = 'María';
      comp.app.user.preferences.theme = 'light';
      comp.app.items[0].name = 'Updated Item';
      comp.app.count = 10;

      expect(comp.app.user.name).toBe('María');
      expect(comp.app.user.preferences.theme).toBe('light');
      expect(comp.app.items[0].name).toBe('Updated Item');
      expect(comp.app.count).toBe(10);
    });

    it('debe mantener reactividad en estructuras complejas', () => {
      class AppComponent {
        @State app = {
          user: { name: 'Julian' },
          items: [1, 2, 3]
        };
      }

      const comp = new AppComponent();
      let execCount = 0;
      let observedName = '';
      let observedLength = 0;

      effect(() => {
        execCount++;
        observedName = comp.app.user.name;
        observedLength = comp.app.items.length;
      }, { priority: 'Sync' });

      expect(execCount).toBe(1);
      expect(observedName).toBe('Julian');
      expect(observedLength).toBe(3);

      comp.app.user.name = 'María';
      phaseScheduler.flush();

      expect(execCount).toBe(2);
      expect(observedName).toBe('María');

      comp.app.items.push(4);
      phaseScheduler.flush();

      expect(execCount).toBe(3);
      expect(observedLength).toBe(4);
    });
  });

  describe('Acceso a señal cruda con $', () => {
    it('debe exponer Signal crudo con $ para primitivos', () => {
      class TestComponent {
        @State count = 0;
      }

      const comp = new TestComponent();
      const signal = (comp as any).$count;

      expect(signal).toBeInstanceOf(Signal);
      expect(signal.get()).toBe(0);

      signal.set(42);
      expect(comp.count).toBe(42);
    });

    it('debe exponer CompositeSignal crudo con $ para objetos', () => {
      class TestComponent {
        @State user = { name: 'Julian' };
      }

      const comp = new TestComponent();
      const composite = (comp as any).$user;

      expect(composite).toBeInstanceOf(CompositeSignal);
      expect(composite.get('name')).toBe('Julian');

      composite.set('name', 'María');
      expect(comp.user.name).toBe('María');
    });

    it('debe exponer ReactiveArray crudo con $ para arrays', () => {
      class TestComponent {
        @State items = [1, 2, 3];
      }

      const comp = new TestComponent();
      const reactiveArray = (comp as any).$items;

      expect(reactiveArray).toBeInstanceOf(ReactiveArray);
      expect(reactiveArray.length).toBe(3);
      expect(reactiveArray.at(0)).toBe(1);

      reactiveArray.push(4);
      expect(comp.items.length).toBe(4);
    });
  });
});
