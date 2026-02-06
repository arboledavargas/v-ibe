import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactiveArray } from '../../../reactivity/signals/reactive-array';
import { renderChild } from '../child-renderer';
import { effect } from '../../../reactivity/signals/effect';

/**
 * Tests de integración para el rendering de arrays en JSX
 * 
 * Estos tests verifican que:
 * 1. Arrays se renderizan correctamente
 * 2. Push/pop actualizan el DOM
 * 3. El effect se re-ejecuta cuando el array cambia
 */
describe('JSX Array Rendering Integration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  // Helper para esperar microtasks (el scheduler usa queueMicrotask)
  const flushMicrotasks = () => new Promise(resolve => queueMicrotask(resolve));

  describe('renderChild con arrays estáticos', () => {
    it('debe renderizar un array de strings', () => {
      renderChild(container, ['a', 'b', 'c']);
      
      expect(container.textContent).toContain('a');
      expect(container.textContent).toContain('b');
      expect(container.textContent).toContain('c');
    });

    it('debe renderizar un array de números', () => {
      renderChild(container, [1, 2, 3]);
      
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('3');
    });

    it('debe renderizar un array de nodos DOM', () => {
      const div1 = document.createElement('div');
      div1.textContent = 'Item 1';
      const div2 = document.createElement('div');
      div2.textContent = 'Item 2';
      
      renderChild(container, [div1, div2]);
      
      expect(container.contains(div1)).toBe(true);
      expect(container.contains(div2)).toBe(true);
    });
  });

  describe('renderChild con funciones que retornan arrays', () => {
    it('debe renderizar cuando la función retorna un array', async () => {
      const items = [1, 2, 3];
      
      renderChild(container, () => items);
      
      await flushMicrotasks();
      
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('3');
    });

    it('debe actualizar cuando el array cambia y hay un nuevo render', async () => {
      let items = [1, 2, 3];
      
      // Simular el getter reactivo
      const getter = () => items.map(x => x);
      
      renderChild(container, getter);
      
      await flushMicrotasks();
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('3');
    });
  });

  describe('renderChild con ReactiveArray', () => {
    it('debe renderizar un ReactiveArray básico', async () => {
      const reactiveArray = new ReactiveArray([1, 2, 3]);
      
      // Renderizar como función que retorna el array
      renderChild(container, () => Array.from(reactiveArray));
      
      await flushMicrotasks();
      
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('3');
    });

    it('debe actualizar el DOM cuando ReactiveArray hace push', async () => {
      const reactiveArray = new ReactiveArray([1, 2, 3]);
      
      // Renderizar como función que retorna el array (simula el getter del JSX)
      renderChild(container, () => Array.from(reactiveArray));
      
      await flushMicrotasks();
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('3');
      expect(container.textContent).not.toContain('4');
      
      // Push
      reactiveArray.push(4);
      
      await flushMicrotasks();
      
      // El DOM debe haberse actualizado
      expect(container.textContent).toContain('4');
    });

    it('debe actualizar el DOM cuando ReactiveArray hace pop', async () => {
      const reactiveArray = new ReactiveArray([1, 2, 3, 4]);
      
      renderChild(container, () => Array.from(reactiveArray));
      
      await flushMicrotasks();
      expect(container.textContent).toContain('4');
      
      // Pop
      reactiveArray.pop();
      
      await flushMicrotasks();
      
      // El 4 ya no debe estar
      expect(container.textContent).not.toContain('4');
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('3');
    });
  });

  describe('renderChild con ReactiveArray.map()', () => {
    it('debe renderizar el resultado de .map() como nodos DOM', async () => {
      const reactiveArray = new ReactiveArray([1, 2, 3]);
      
      // Simular: {this.items.map(item => <span>{item}</span>)}
      renderChild(container, () => {
        return Array.from(reactiveArray.map(item => {
          const span = document.createElement('span');
          span.textContent = String(item);
          return span;
        }));
      });
      
      await flushMicrotasks();
      
      const spans = container.querySelectorAll('span');
      expect(spans.length).toBe(3);
      expect(spans[0].textContent).toBe('1');
      expect(spans[1].textContent).toBe('2');
      expect(spans[2].textContent).toBe('3');
    });

    it('debe actualizar DOM cuando source de .map() hace push', async () => {
      const reactiveArray = new ReactiveArray([1, 2, 3]);
      
      renderChild(container, () => {
        return Array.from(reactiveArray.map(item => {
          const span = document.createElement('span');
          span.textContent = `Item: ${item}`;
          return span;
        }));
      });
      
      await flushMicrotasks();
      
      let spans = container.querySelectorAll('span');
      expect(spans.length).toBe(3);
      
      // Push
      reactiveArray.push(4);
      
      await flushMicrotasks();
      
      spans = container.querySelectorAll('span');
      expect(spans.length).toBe(4);
      expect(spans[3].textContent).toBe('Item: 4');
    });

    it('debe actualizar DOM cuando source de .map() hace pop', async () => {
      const reactiveArray = new ReactiveArray(['a', 'b', 'c', 'd']);
      
      renderChild(container, () => {
        return Array.from(reactiveArray.map(item => {
          const div = document.createElement('div');
          div.className = 'item';
          div.textContent = item;
          return div;
        }));
      });
      
      await flushMicrotasks();
      
      let items = container.querySelectorAll('.item');
      expect(items.length).toBe(4);
      
      // Pop dos veces
      reactiveArray.pop();
      reactiveArray.pop();
      
      await flushMicrotasks();
      
      items = container.querySelectorAll('.item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('a');
      expect(items[1].textContent).toBe('b');
    });

    it('debe manejar múltiples operaciones push/pop consecutivas', async () => {
      const reactiveArray = new ReactiveArray<number>([1]);
      
      renderChild(container, () => {
        return Array.from(reactiveArray.map(item => {
          const span = document.createElement('span');
          span.textContent = String(item);
          return span;
        }));
      });
      
      await flushMicrotasks();
      expect(container.querySelectorAll('span').length).toBe(1);
      
      // Push varios
      reactiveArray.push(2);
      await flushMicrotasks();
      expect(container.querySelectorAll('span').length).toBe(2);
      
      reactiveArray.push(3);
      await flushMicrotasks();
      expect(container.querySelectorAll('span').length).toBe(3);
      
      reactiveArray.push(4, 5);
      await flushMicrotasks();
      expect(container.querySelectorAll('span').length).toBe(5);
      
      // Pop
      reactiveArray.pop();
      await flushMicrotasks();
      expect(container.querySelectorAll('span').length).toBe(4);
      
      // Verificar contenido final
      const spans = container.querySelectorAll('span');
      expect(spans[0].textContent).toBe('1');
      expect(spans[1].textContent).toBe('2');
      expect(spans[2].textContent).toBe('3');
      expect(spans[3].textContent).toBe('4');
    });
  });

  /**
   * TESTS DE GRANULARIDAD - Actualmente FALLAN
   * 
   * El problema fundamental es que cada vez que el effect se re-ejecuta:
   * 1. `reactiveArray.map(...)` crea un NUEVO ReactiveArray derivado
   * 2. El nuevo array tiene un caché VACÍO
   * 3. La función de transformación se ejecuta para TODOS los elementos
   * 
   * Para solucionar esto, necesitamos que .map() retorne el MISMO array derivado
   * o implementar una estrategia de reconciliación de nodos DOM.
   * 
   * Por ahora, estos tests documentan el comportamiento ESPERADO.
   */
  describe('GRANULARIDAD: push NO debe re-crear nodos existentes', () => {
    it('push debe agregar nuevo nodo sin re-crear los existentes', async () => {
      const reactiveArray = new ReactiveArray([1, 2, 3]);
      
      renderChild(container, () => {
        return Array.from(reactiveArray.map(item => {
          const span = document.createElement('span');
          span.textContent = String(item);
          span.dataset.item = String(item);
          return span;
        }));
      });
      
      await flushMicrotasks();
      
      // Guardar referencias a los nodos ANTES del push
      const spansBefore = Array.from(container.querySelectorAll('span'));
      expect(spansBefore.length).toBe(3);
      
      const node0Before = spansBefore[0];
      const node1Before = spansBefore[1];
      const node2Before = spansBefore[2];
      
      // Push
      reactiveArray.push(4);
      
      await flushMicrotasks();
      
      // Obtener nodos DESPUÉS del push
      const spansAfter = Array.from(container.querySelectorAll('span'));
      expect(spansAfter.length).toBe(4);
      
      // Los nodos existentes deben ser las MISMAS referencias (no re-creados)
      expect(spansAfter[0]).toBe(node0Before);
      expect(spansAfter[1]).toBe(node1Before);
      expect(spansAfter[2]).toBe(node2Before);
      
      // El nuevo nodo debe existir
      expect(spansAfter[3].textContent).toBe('4');
    });

    it('múltiples push deben mantener nodos existentes', async () => {
      const reactiveArray = new ReactiveArray(['a']);
      
      renderChild(container, () => {
        return Array.from(reactiveArray.map(item => {
          const div = document.createElement('div');
          div.className = 'item';
          div.textContent = item;
          return div;
        }));
      });
      
      await flushMicrotasks();
      
      const originalNode = container.querySelector('.item');
      expect(originalNode).not.toBeNull();
      
      // Push varias veces
      reactiveArray.push('b');
      await flushMicrotasks();
      
      reactiveArray.push('c');
      await flushMicrotasks();
      
      reactiveArray.push('d');
      await flushMicrotasks();
      
      // El nodo original debe seguir siendo el mismo
      const items = container.querySelectorAll('.item');
      expect(items.length).toBe(4);
      expect(items[0]).toBe(originalNode);
      expect(items[0].textContent).toBe('a');
    });

    it('pop debe mantener nodos restantes sin re-crearlos', async () => {
      const reactiveArray = new ReactiveArray([1, 2, 3, 4]);
      
      renderChild(container, () => {
        return Array.from(reactiveArray.map(item => {
          const span = document.createElement('span');
          span.textContent = String(item);
          return span;
        }));
      });
      
      await flushMicrotasks();
      
      const spansBefore = Array.from(container.querySelectorAll('span'));
      const node0 = spansBefore[0];
      const node1 = spansBefore[1];
      const node2 = spansBefore[2];
      
      // Pop
      reactiveArray.pop();
      
      await flushMicrotasks();
      
      const spansAfter = Array.from(container.querySelectorAll('span'));
      expect(spansAfter.length).toBe(3);
      
      // Los nodos restantes deben ser las mismas referencias
      expect(spansAfter[0]).toBe(node0);
      expect(spansAfter[1]).toBe(node1);
      expect(spansAfter[2]).toBe(node2);
    });
  });

  describe('Verificación de re-ejecución del effect', () => {
    it('el effect interno debe re-ejecutarse cuando el array cambia', async () => {
      const reactiveArray = new ReactiveArray([1, 2, 3]);
      const renderFn = vi.fn(() => Array.from(reactiveArray));
      
      renderChild(container, renderFn);
      
      await flushMicrotasks();
      
      // Se ejecuta una vez al inicio
      expect(renderFn).toHaveBeenCalledTimes(1);
      
      // Push
      reactiveArray.push(4);
      
      await flushMicrotasks();
      
      // Debe haberse re-ejecutado
      expect(renderFn).toHaveBeenCalledTimes(2);
    });

    it('múltiples push deben causar múltiples re-ejecuciones', async () => {
      const reactiveArray = new ReactiveArray([1]);
      const renderFn = vi.fn(() => Array.from(reactiveArray));
      
      renderChild(container, renderFn);
      
      await flushMicrotasks();
      expect(renderFn).toHaveBeenCalledTimes(1);
      
      reactiveArray.push(2);
      await flushMicrotasks();
      expect(renderFn).toHaveBeenCalledTimes(2);
      
      reactiveArray.push(3);
      await flushMicrotasks();
      expect(renderFn).toHaveBeenCalledTimes(3);
      
      reactiveArray.pop();
      await flushMicrotasks();
      expect(renderFn).toHaveBeenCalledTimes(4);
    });
  });
});
