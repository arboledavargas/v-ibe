import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { For, ForProps } from '../for';
import { ReactiveArray } from '../../reactivity/signals/reactive-array';
import { Signal } from '../../reactivity/signals/signal';
import { createArrayProxy } from '../../reactivity/signals/reactive-proxy';

describe('For Function Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Basic Rendering', () => {
    it('should render a simple array of numbers', () => {
      const items = [1, 2, 3];
      const fragment = For({
        each: items,
        children: (item: number) => {
          const div = document.createElement('div');
          div.textContent = String(item);
          return div;
        }
      });

      container.appendChild(fragment);

      const divs = container.querySelectorAll('div');
      expect(divs.length).toBe(3);
      expect(divs[0].textContent).toBe('1');
      expect(divs[1].textContent).toBe('2');
      expect(divs[2].textContent).toBe('3');
    });

    it('should render a simple array of strings', () => {
      const items = ['a', 'b', 'c'];
      const fragment = For({
        each: items,
        children: (item: string) => document.createTextNode(item)
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('abc');
    });

    it('should handle empty array', () => {
      const items: number[] = [];
      const fragment = For({
        each: items,
        children: (item: number) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      // Should only have the comment anchor
      expect(container.childNodes.length).toBe(1);
      expect(container.childNodes[0].nodeType).toBe(Node.COMMENT_NODE);
    });

    it('should render with index parameter', () => {
      const items = ['a', 'b', 'c'];
      const fragment = For({
        each: items,
        children: (item: string, index: number) => {
          const span = document.createElement('span');
          span.textContent = `${index}:${item}`;
          return span;
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const spans = container.querySelectorAll('span');
      expect(spans[0].textContent).toBe('0:a');
      expect(spans[1].textContent).toBe('1:b');
      expect(spans[2].textContent).toBe('2:c');
    });
  });

  describe('Fallback Support', () => {
    it('should render fallback when array is empty', () => {
      const items: number[] = [];
      const fallbackEl = document.createElement('p');
      fallbackEl.textContent = 'No items';

      const fragment = For({
        each: items,
        children: (item: number) => document.createTextNode(String(item)),
        fallback: fallbackEl
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.querySelector('p')?.textContent).toBe('No items');
    });

    it('should not render fallback when array has items', () => {
      const items = [1, 2, 3];
      const fallbackEl = document.createElement('p');
      fallbackEl.textContent = 'No items';

      const fragment = For({
        each: items,
        children: (item: number) => document.createTextNode(String(item)),
        fallback: fallbackEl
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.querySelector('p')).toBeNull();
    });
  });

  describe('Auto-Keying', () => {
    it('should auto-detect id property', () => {
      const items = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
      ];

      const fragment = For({
        each: items,
        children: (item) => {
          const div = document.createElement('div');
          div.textContent = item.name;
          return div;
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const divs = container.querySelectorAll('div');
      expect(divs.length).toBe(3);
      expect(divs[0].textContent).toBe('Alice');
    });

    it('should auto-detect key property', () => {
      const items = [
        { key: 'a', value: 1 },
        { key: 'b', value: 2 }
      ];

      const fragment = For({
        each: items,
        children: (item) => document.createTextNode(String(item.value))
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('12');
    });

    it('should auto-detect _id property', () => {
      const items = [
        { _id: 'x1', text: 'First' },
        { _id: 'x2', text: 'Second' }
      ];

      const fragment = For({
        each: items,
        children: (item) => document.createTextNode(item.text)
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('FirstSecond');
    });

    it('should auto-detect uuid property', () => {
      const items = [
        { uuid: 'uuid-1', label: 'One' },
        { uuid: 'uuid-2', label: 'Two' }
      ];

      const fragment = For({
        each: items,
        children: (item) => document.createTextNode(item.label)
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('OneTwo');
    });

    it('should fallback to index when no key property found', () => {
      const items = [
        { name: 'Alice' },
        { name: 'Bob' }
      ];

      const fragment = For({
        each: items,
        children: (item) => document.createTextNode(item.name)
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('AliceBob');
    });
  });

  describe('Custom getKey Function', () => {
    it('should use custom getKey function', () => {
      const items = [
        { userId: 100, name: 'Alice' },
        { userId: 200, name: 'Bob' }
      ];

      const fragment = For({
        each: items,
        children: (item) => document.createTextNode(item.name),
        getKey: (item) => item.userId
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('AliceBob');
    });

    it('should pass index to getKey function', () => {
      const items = ['a', 'b', 'c'];
      const getKeySpy = vi.fn((item: string, index: number) => `${item}-${index}`);

      const fragment = For({
        each: items,
        children: (item) => document.createTextNode(item),
        getKey: getKeySpy
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(getKeySpy).toHaveBeenCalledWith('a', 0);
      expect(getKeySpy).toHaveBeenCalledWith('b', 1);
      expect(getKeySpy).toHaveBeenCalledWith('c', 2);
    });
  });

  describe('ReactiveArray Integration', () => {
    it('should detect ReactiveArray for granular rendering', () => {
      const items = new ReactiveArray([1, 2, 3]);
      const consoleSpy = vi.spyOn(console, 'log');

      const fragment = For({
        each: items,
        children: (item: number) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      // Should log that it's using granular rendering
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GRANULAR rendering')
      );

      consoleSpy.mockRestore();
    });

    it('should use standard rendering for plain arrays', () => {
      const items = [1, 2, 3];
      const consoleSpy = vi.spyOn(console, 'log');

      const fragment = For({
        each: items,
        children: (item: number) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      // Should log that it's using standard rendering
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('STANDARD rendering')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Signal Support', () => {
    it('should work with Signal<T[]>', () => {
      const signal = new Signal([1, 2, 3]);

      const fragment = For({
        each: signal,
        children: (item: number) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('123');
    });

    it('should work with function that returns array', () => {
      const getItems = () => [1, 2, 3];

      const fragment = For({
        each: getItems,
        children: (item: number) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('123');
    });

    it('should work with function that returns ReactiveArray', () => {
      const reactiveArray = new ReactiveArray([1, 2, 3]);
      const getItems = () => reactiveArray;
      const consoleSpy = vi.spyOn(console, 'log');

      const fragment = For({
        each: getItems,
        children: (item: number) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('123');
      
      // Should detect ReactiveArray and use granular rendering
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GRANULAR rendering')
      );

      consoleSpy.mockRestore();
    });

    it('should work with nested function that returns ReactiveArray', () => {
      const reactiveArray = new ReactiveArray([10, 20, 30]);
      // Function that returns another function that returns ReactiveArray
      const getItems = () => () => reactiveArray;

      const fragment = For({
        each: getItems,
        children: (item: number) => {
          const div = document.createElement('div');
          div.textContent = String(item);
          return div;
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const divs = container.querySelectorAll('div');
      expect(divs.length).toBe(3);
      expect(divs[0].textContent).toBe('10');
      expect(divs[1].textContent).toBe('20');
      expect(divs[2].textContent).toBe('30');
    });

    it('should work with function that returns proxy wrapping ReactiveArray', () => {
      const reactiveArray = new ReactiveArray([5, 10, 15]);
      const proxy = createArrayProxy(reactiveArray);
      const getItems = () => proxy;
      const consoleSpy = vi.spyOn(console, 'log');

      const fragment = For({
        each: getItems,
        children: (item: number) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('51015');
      
      // Should detect ReactiveArray through proxy and use granular rendering
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GRANULAR rendering')
      );

      consoleSpy.mockRestore();
    });

    it('should work with function that returns Signal containing ReactiveArray', () => {
      const reactiveArray = new ReactiveArray([7, 8, 9]);
      const signal = new Signal(reactiveArray);
      const getItems = () => signal;
      const consoleSpy = vi.spyOn(console, 'log');

      const fragment = For({
        each: getItems,
        children: (item: number) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('789');
      
      // Should detect ReactiveArray inside Signal and use granular rendering
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GRANULAR rendering')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Complex Objects', () => {
    it('should render array of complex objects', () => {
      const items = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
        { id: 3, name: 'Charlie', age: 35 }
      ];

      const fragment = For({
        each: items,
        children: (item) => {
          const div = document.createElement('div');
          div.className = 'user';
          div.textContent = `${item.name} (${item.age})`;
          return div;
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const divs = container.querySelectorAll('.user');
      expect(divs.length).toBe(3);
      expect(divs[0].textContent).toBe('Alice (30)');
      expect(divs[1].textContent).toBe('Bob (25)');
      expect(divs[2].textContent).toBe('Charlie (35)');
    });
  });

  describe('Nested Structures', () => {
    it('should handle nested arrays', () => {
      const groups = [
        { id: 1, items: ['a', 'b'] },
        { id: 2, items: ['c', 'd'] }
      ];

      const fragment = For({
        each: groups,
        children: (group) => {
          const div = document.createElement('div');
          div.className = 'group';
          
          // Nested For would be used here in real scenarios
          group.items.forEach(item => {
            const span = document.createElement('span');
            span.textContent = item;
            div.appendChild(span);
          });
          
          return div;
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const groups_divs = container.querySelectorAll('.group');
      expect(groups_divs.length).toBe(2);
      expect(groups_divs[0].querySelectorAll('span').length).toBe(2);
      expect(groups_divs[1].querySelectorAll('span').length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null items gracefully', () => {
      const items = [1, null, 3] as any[];

      const fragment = For({
        each: items,
        children: (item) => {
          if (item == null) return document.createTextNode('');
          return document.createTextNode(String(item));
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('13');
    });

    it('should handle undefined items gracefully', () => {
      const items = [1, undefined, 3] as any[];

      const fragment = For({
        each: items,
        children: (item) => {
          if (item == null) return document.createTextNode('');
          return document.createTextNode(String(item));
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('13');
    });

    it('should handle boolean values', () => {
      const items = [true, false, true];

      const fragment = For({
        each: items,
        children: (item: boolean) => document.createTextNode(item ? 'T' : 'F')
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('TFT');
    });

    it('should handle mixed types', () => {
      const items = [1, 'two', 3];

      const fragment = For({
        each: items,
        children: (item: any) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      expect(container.textContent).toContain('1two3');
    });

    it('should handle large arrays efficiently', () => {
      const items = Array.from({ length: 1000 }, (_, i) => i);

      const fragment = For({
        each: items,
        children: (item: number) => document.createTextNode(String(item))
      });

      const start = performance.now();
      // Fragment already created
      container.appendChild(fragment);
      const end = performance.now();

      // Should render in reasonable time (< 100ms)
      expect(end - start).toBeLessThan(100);
    });
  });

  describe('Return Value', () => {
    it('should return a DocumentFragment directly', () => {
      const items = [1, 2, 3];
      const fragment = For({
        each: items,
        children: (item: number) => document.createTextNode(String(item))
      });

      expect(fragment).toBeInstanceOf(DocumentFragment);
    });
  });

  describe('Performance Characteristics', () => {
    it('should have comment anchor in DOM', () => {
      const items = [1, 2, 3];
      const fragment = For({
        each: items,
        children: (item: number) => document.createTextNode(String(item))
      });

      // Fragment already created
      container.appendChild(fragment);

      // Should have comment node as anchor
      const comments = Array.from(container.childNodes).filter(
        node => node.nodeType === Node.COMMENT_NODE
      );
      expect(comments.length).toBeGreaterThan(0);
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should infer correct item type', () => {
      const items: { id: number; name: string }[] = [
        { id: 1, name: 'Alice' }
      ];

      const fragment = For({
        each: items,
        children: (item) => {
          // TypeScript should infer item type correctly
          const _name: string = item.name;
          const _id: number = item.id;
          return document.createTextNode(item.name);
        }
      });

      expect(fragment).toBeDefined();
    });
  });

  describe('Granular Reactivity - Node Identity', () => {
    it('should NOT re-create nodes when only one item changes (with ReactiveArray)', async () => {
      const reactiveArray = new ReactiveArray([1, 2, 3]);
      const items = createArrayProxy(reactiveArray); // Use proxy for mutations
      const renderCalls = new Map<number, number>();
      const createdNodes = new Map<number, HTMLDivElement>();

      const fragment = For({
        each: reactiveArray, // Pass ReactiveArray to For
        children: (item: number, index: number) => {
          // Track render calls per item
          renderCalls.set(item, (renderCalls.get(item) || 0) + 1);
          
          const div = document.createElement('div');
          div.textContent = String(item);
          div.className = `item-${item}`;
          
          // Store node reference
          createdNodes.set(item, div);
          
          return div;
        }
      });

      container.appendChild(fragment);

      // Get initial nodes
      const initialNode0 = container.querySelector('.item-1');
      const initialNode1 = container.querySelector('.item-2');
      const initialNode2 = container.querySelector('.item-3');

      expect(initialNode0).toBeTruthy();
      expect(initialNode1).toBeTruthy();
      expect(initialNode2).toBeTruthy();

      // Clear render counts
      renderCalls.clear();

      // Modify ONLY the first item
      items[0] = 10;

      // Wait for microtasks (phase scheduler uses queueMicrotask)
      await new Promise(resolve => queueMicrotask(resolve));

      // Check that only item at index 0 was re-rendered
      const afterNode0 = container.querySelector('.item-10');
      const afterNode1 = container.querySelector('.item-2');
      const afterNode2 = container.querySelector('.item-3');

      // The first node should have changed (new content)
      expect(afterNode0).toBeTruthy();
      expect(afterNode0?.textContent).toBe('10');

      // CRITICAL: Nodes at index 1 and 2 should be THE SAME OBJECTS (not re-created)
      expect(afterNode1).toBe(initialNode1); // Same node reference
      expect(afterNode2).toBe(initialNode2); // Same node reference

      // Only the first item should have been re-rendered
      expect(renderCalls.get(10)).toBe(1); // New value rendered once
      expect(renderCalls.has(2)).toBe(false); // Item 2 NOT re-rendered
      expect(renderCalls.has(3)).toBe(false); // Item 3 NOT re-rendered
    });

    it('should preserve node identity when items do NOT change (plain array)', () => {
      const items = [1, 2, 3];
      let renderCount = 0;

      const fragment = For({
        each: items,
        children: (item: number) => {
          renderCount++;
          const div = document.createElement('div');
          div.textContent = String(item);
          return div;
        }
      });

      container.appendChild(fragment);

      // Should render 3 times (once per item)
      expect(renderCount).toBe(3);

      // With plain arrays, there's no reactivity
      // This test just confirms initial render works
      const divs = container.querySelectorAll('div');
      expect(divs.length).toBe(3);
    });
  });

  describe('Function and Fragment Handling', () => {
    it('should handle render functions that return functions (factories)', () => {
      const items = [1, 2, 3];

      const fragment = For({
        each: items,
        children: (item: number) => {
          // Return a factory function instead of a node directly
          return () => {
            const div = document.createElement('div');
            div.textContent = String(item);
            return div;
          };
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const divs = container.querySelectorAll('div');
      expect(divs.length).toBe(3);
      expect(divs[0].textContent).toBe('1');
      expect(divs[1].textContent).toBe('2');
      expect(divs[2].textContent).toBe('3');
    });

    it('should handle render functions that return DocumentFragments', () => {
      const items = ['a', 'b', 'c'];

      const fragment = For({
        each: items,
        children: (item: string) => {
          // Return a DocumentFragment with multiple nodes
          const fragment = document.createDocumentFragment();
          const span1 = document.createElement('span');
          span1.textContent = item;
          const span2 = document.createElement('span');
          span2.textContent = '-';
          fragment.appendChild(span1);
          fragment.appendChild(span2);
          return fragment;
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const spans = container.querySelectorAll('span');
      expect(spans.length).toBeGreaterThan(0);
    });

    it('should handle nested factory functions', () => {
      const items = [10, 20, 30];

      const fragment = For({
        each: items,
        children: (item: number) => {
          // Nested factory: function that returns function
          return () => () => {
            const p = document.createElement('p');
            p.textContent = `Value: ${item}`;
            return p;
          };
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs.length).toBe(3);
      expect(paragraphs[0].textContent).toBe('Value: 10');
      expect(paragraphs[1].textContent).toBe('Value: 20');
      expect(paragraphs[2].textContent).toBe('Value: 30');
    });

    it('should handle DocumentFragment with single child', () => {
      const items = [1, 2];

      const fragment = For({
        each: items,
        children: (item: number) => {
          const fragment = document.createDocumentFragment();
          const div = document.createElement('div');
          div.className = 'single';
          div.textContent = String(item);
          fragment.appendChild(div);
          return fragment;
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const divs = container.querySelectorAll('.single');
      expect(divs.length).toBe(2);
      expect(divs[0].textContent).toBe('1');
      expect(divs[1].textContent).toBe('2');
    });

    it('should handle mixed returns (nodes, functions, fragments)', () => {
      const items = [1, 2, 3];
      let callCount = 0;

      const fragment = For({
        each: items,
        children: (item: number) => {
          callCount++;
          
          // Different return type based on item
          if (item === 1) {
            // Return a direct node
            const span = document.createElement('span');
            span.textContent = 'direct';
            return span;
          } else if (item === 2) {
            // Return a factory
            return () => {
              const span = document.createElement('span');
              span.textContent = 'factory';
              return span;
            };
          } else {
            // Return a fragment
            const fragment = document.createDocumentFragment();
            const span = document.createElement('span');
            span.textContent = 'fragment';
            fragment.appendChild(span);
            return fragment;
          }
        }
      });

      // Fragment already created
      container.appendChild(fragment);

      const spans = container.querySelectorAll('span');
      expect(spans.length).toBe(3);
      expect(spans[0].textContent).toBe('direct');
      expect(spans[1].textContent).toBe('factory');
      expect(spans[2].textContent).toBe('fragment');
    });
  });
});
