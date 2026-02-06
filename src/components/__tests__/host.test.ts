import { describe, it, expect } from 'vitest';
import { Host, HOST_KEY } from '../../behaviors';

// Helper to get HOST_KEY from constructor (set by addInitializer after instantiation)
function getHostKey(cls: any): string | symbol | undefined {
  return cls[HOST_KEY];
}

describe('Host decorator', () => {
  describe('@Host decorator', () => {
    it('should store field name on constructor after instantiation', () => {
      class TestClass {
        @Host
        element!: Element;
      }
      
      // addInitializer runs when instance is created
      new TestClass();
      
      const hostKey = getHostKey(TestClass);
      expect(hostKey).toBeDefined();
      expect(typeof hostKey).toBe('string');
      expect(hostKey).toBe('element');
    });

    it('should store the correct property name', () => {
      class TestClass {
        @Host
        myHost!: Element;
      }
      
      new TestClass();
      
      const hostKey = getHostKey(TestClass);
      expect(hostKey).toBe('myHost');
    });

    it('should work with different property names', () => {
      class Class1 {
        @Host
        el!: Element;
      }
      
      class Class2 {
        @Host
        hostElement!: Element;
      }
      
      new Class1();
      new Class2();
      
      expect(getHostKey(Class1)).toBe('el');
      expect(getHostKey(Class2)).toBe('hostElement');
    });

    it('should allow property to be set after construction', () => {
      class TestClass {
        @Host
        element!: Element;
      }
      
      const instance = new TestClass();
      const div = document.createElement('div');
      
      const hostKey = getHostKey(TestClass);
      (instance as any)[hostKey!] = div;
      
      expect(instance.element).toBe(div);
    });

    it('should work with HTMLElement subclasses', () => {
      class TestClass {
        @Host
        element!: HTMLDivElement;
      }
      
      const instance = new TestClass();
      const div = document.createElement('div') as HTMLDivElement;
      
      const hostKey = getHostKey(TestClass);
      (instance as any)[hostKey!] = div;
      
      expect(instance.element).toBe(div);
      expect(instance.element.tagName).toBe('DIV');
    });

    it('should not interfere with other properties', () => {
      class TestClass {
        @Host
        element!: Element;
        
        name: string = 'test';
        count: number = 0;
      }
      
      const instance = new TestClass();
      expect(instance.name).toBe('test');
      expect(instance.count).toBe(0);
      
      const div = document.createElement('div');
      const hostKey = getHostKey(TestClass);
      (instance as any)[hostKey!] = div;
      
      expect(instance.element).toBe(div);
      expect(instance.name).toBe('test');
      expect(instance.count).toBe(0);
    });

    it('should throw error when applied to non-field', () => {
      expect(() => {
        class TestClass {
          @Host
          myMethod() {
            return 'test';
          }
        }
        // Force evaluation
        new TestClass();
      }).toThrow('@Host can only be applied to class fields.');
    });

    it('should support multiple instances of same class', () => {
      class TestClass {
        @Host
        element!: Element;
      }
      
      const instance1 = new TestClass();
      const instance2 = new TestClass();
      
      const div1 = document.createElement('div');
      const div2 = document.createElement('span');
      
      const hostKey = getHostKey(TestClass);
      (instance1 as any)[hostKey!] = div1;
      (instance2 as any)[hostKey!] = div2;
      
      expect(instance1.element).toBe(div1);
      expect(instance2.element).toBe(div2);
      expect(instance1.element).not.toBe(instance2.element);
    });

    it('should allow only one @Host per class', () => {
      class TestClass {
        @Host
        element1!: Element;
        
        @Host
        element2!: Element;
      }
      
      new TestClass();
      
      const hostKey = getHostKey(TestClass);
      // Should only store one key (the last one processed)
      expect(typeof hostKey).toBe('string');
      expect(['element1', 'element2']).toContain(hostKey);
    });
  });

  describe('HOST_KEY symbol', () => {
    it('should be a symbol', () => {
      expect(typeof HOST_KEY).toBe('symbol');
    });

    it('should have meaningful description', () => {
      expect(HOST_KEY.toString()).toBe('Symbol(behavior:host)');
    });

    it('should be unique', () => {
      const anotherSymbol = Symbol('behavior:host');
      expect(HOST_KEY).not.toBe(anotherSymbol);
    });
  });

  describe('Integration with BehaviorManager pattern', () => {
    it('should enable host injection workflow', () => {
      class TestBehavior {
        @Host
        element!: Element;
        
        initialized = false;
        
        onInit() {
          this.initialized = true;
        }
        
        getTagName(): string {
          return this.element.tagName;
        }
      }
      
      // Simulate what BehaviorManager does
      const testElement = document.createElement('div');
      const instance = new TestBehavior();
      
      // Get the host key from metadata
      const hostKey = getHostKey(TestBehavior);
      expect(hostKey).toBeDefined();
      
      // Inject the host element
      (instance as any)[hostKey!] = testElement;
      
      // Call lifecycle
      instance.onInit();
      
      // Verify
      expect(instance.element).toBe(testElement);
      expect(instance.initialized).toBe(true);
      expect(instance.getTagName()).toBe('DIV');
    });

    it('should work without @Host decorator', () => {
      class SimpleClass {
        value = 'test';
      }
      
      const hostKey = getHostKey(SimpleClass);
      expect(hostKey).toBeUndefined();
      
      const instance = new SimpleClass();
      expect(instance.value).toBe('test');
    });
  });

  describe('TypeScript type safety simulation', () => {
    it('should maintain correct element type at runtime', () => {
      class TestClass {
        @Host
        element!: HTMLButtonElement;
      }
      
      const button = document.createElement('button') as HTMLButtonElement;
      const instance = new TestClass();
      
      const hostKey = getHostKey(TestClass);
      (instance as any)[hostKey!] = button;
      
      expect(instance.element).toBe(button);
      expect(instance.element instanceof HTMLButtonElement).toBe(true);
    });

    it('should handle generic Element type', () => {
      class TestClass {
        @Host
        element!: Element;
      }
      
      const div = document.createElement('div');
      const span = document.createElement('span');
      
      const instance1 = new TestClass();
      const instance2 = new TestClass();
      
      const hostKey = getHostKey(TestClass);
      (instance1 as any)[hostKey!] = div;
      (instance2 as any)[hostKey!] = span;
      
      expect(instance1.element).toBe(div);
      expect(instance2.element).toBe(span);
    });
  });
});
