import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Behavior, Host } from '../decorators';
import { BehaviorRegistry } from '../behavior-registry';
import { BehaviorManager } from '../behavior-manager';
import { Prop } from '../../components/decorators/prop';
import { BEHAVIOR_PROPS, HOST_KEY } from '../constants';

describe('Behavior System', () => {
  beforeEach(() => {
    // Clear registry before each test
    BehaviorRegistry.clear();
  });

  describe('@Behavior decorator', () => {
    it('should register a behavior with its props', () => {
      @Behavior
      class TestBehavior {
        @Prop test: boolean = true;
        @Prop value: string = '';
      }

      expect(BehaviorRegistry.isBehaviorProp('test')).toBe(true);
      expect(BehaviorRegistry.isBehaviorProp('value')).toBe(true);
    });

    it('should throw error for duplicate prop names', () => {
      @Behavior
      class FirstBehavior {
        @Prop shared: boolean = true;
      }

      expect(() => {
        @Behavior
        class SecondBehavior {
          @Prop shared: boolean = true;
        }
      }).toThrow(/already registered/);
    });

    it('should warn when behavior has no props', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      @Behavior
      class EmptyBehavior {}

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('without @Props')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('@Host decorator', () => {
    it('should mark the host field', () => {
      @Behavior
      class TestBehavior {
        @Host
        el!: HTMLElement;

        @Prop test: boolean = true;
      }

      const instance = new TestBehavior();
      const hostKey = (TestBehavior as any)[HOST_KEY];
      
      expect(hostKey).toBe('el');
    });
  });

  describe('@Prop decorator', () => {
    it('should register prop names in BEHAVIOR_PROPS', () => {
      @Behavior
      class TestBehavior {
        @Prop propA: string = '';
        @Prop propB: number = 0;
        @Prop propC: boolean = true;
      }

      const instance = new TestBehavior();
      const props = (TestBehavior as any)[BEHAVIOR_PROPS] as Set<string>;

      expect(props.has('propA')).toBe(true);
      expect(props.has('propB')).toBe(true);
      expect(props.has('propC')).toBe(true);
    });

    it('should unwrap zero-arg functions (reactive getters)', () => {
      @Behavior
      class TestBehavior {
        @Prop value: string = '';
      }

      const instance = new TestBehavior();
      (instance as any).value = () => 'reactive-value';

      expect(instance.value).toBe('reactive-value');
    });

    it('should NOT unwrap event handlers', () => {
      @Behavior
      class TestBehavior {
        @Prop onClick: Function = () => {};
      }

      const instance = new TestBehavior();
      const handler = () => 'click';
      (instance as any).onClick = handler;

      expect(typeof instance.onClick).toBe('function');
      expect(instance.onClick).toBe(handler);
    });
  });

  describe('BehaviorRegistry', () => {
    describe('resolve()', () => {
      it('should resolve behavior and group its props', () => {
        @Behavior
        class LinkBehavior {
          @Prop link: boolean = true;
          @Prop href: string = '';
        }

        const props = { link: true, href: '/home' };
        const resolved = BehaviorRegistry.resolve(props);

        expect(resolved.size).toBe(1);
        expect(resolved.has(LinkBehavior)).toBe(true);
        expect(resolved.get(LinkBehavior)).toEqual({ link: true, href: '/home' });
      });

      it('should resolve behavior even with non-boolean props', () => {
        @Behavior
        class LinkBehavior {
          @Prop link: boolean = true;
          @Prop href: string = '';
        }

        const props = { link: false, href: '/home' };
        const resolved = BehaviorRegistry.resolve(props);

        expect(resolved.size).toBe(1);
        expect(resolved.has(LinkBehavior)).toBe(true);
        expect(resolved.get(LinkBehavior)).toEqual({ link: false, href: '/home' });
      });

      it('should resolve multiple behaviors', () => {
        @Behavior
        class LinkBehavior {
          @Prop link: boolean = true;
          @Prop href: string = '';
        }

        @Behavior
        class TooltipBehavior {
          @Prop tooltip: boolean = true;
          @Prop text: string = '';
        }

        const props = { link: true, href: '/home', tooltip: true, text: 'Hello' };
        const resolved = BehaviorRegistry.resolve(props);

        expect(resolved.size).toBe(2);
        expect(resolved.has(LinkBehavior)).toBe(true);
        expect(resolved.has(TooltipBehavior)).toBe(true);
        expect(resolved.get(LinkBehavior)).toEqual({ link: true, href: '/home' });
        expect(resolved.get(TooltipBehavior)).toEqual({ tooltip: true, text: 'Hello' });
      });

      it('should only group props that belong to registered behaviors', () => {
        @Behavior
        class LinkBehavior {
          @Prop link: boolean = true;
          @Prop activeClass: string = '';
        }

        @Behavior
        class TooltipBehavior {
          @Prop tooltip: boolean = true;
          @Prop position: string = '';
        }

        const props = { tooltip: true, position: 'top', activeClass: 'selected' };
        const resolved = BehaviorRegistry.resolve(props);

        expect(resolved.size).toBe(2);
        expect(resolved.has(TooltipBehavior)).toBe(true);
        expect(resolved.has(LinkBehavior)).toBe(true);
        expect(resolved.get(TooltipBehavior)).toEqual({ tooltip: true, position: 'top' });
        expect(resolved.get(LinkBehavior)).toEqual({ activeClass: 'selected' });
      });
    });

    describe('isBehaviorProp()', () => {
      it('should return true for registered props', () => {
        @Behavior
        class TestBehavior {
          @Prop myProp: boolean = true;
        }

        expect(BehaviorRegistry.isBehaviorProp('myProp')).toBe(true);
        expect(BehaviorRegistry.isBehaviorProp('unknownProp')).toBe(false);
      });
    });

    describe('clear()', () => {
      it('should clear all registrations', () => {
        @Behavior
        class TestBehavior {
          @Prop test: boolean = true;
        }

        expect(BehaviorRegistry.isBehaviorProp('test')).toBe(true);

        BehaviorRegistry.clear();

        expect(BehaviorRegistry.isBehaviorProp('test')).toBe(false);
      });
    });
  });

  describe('BehaviorManager', () => {
    describe('attachBehaviors()', () => {
      it('should attach behavior to element', () => {
        @Behavior
        class TestBehavior {
          @Host
          el!: HTMLElement;

          @Prop test: boolean = true;
          @Prop value: string = '';

          initialized = false;

          onInit() {
            this.initialized = true;
          }
        }

        const manager = new BehaviorManager();
        const element = document.createElement('div');
        const props = { test: true, value: 'hello' };

        const consumed = manager.attachBehaviors(element, props);

        expect(consumed.has('test')).toBe(true);
        expect(consumed.has('value')).toBe(true);

        const instance = manager.get<TestBehavior>(element, 'TestBehavior');
        expect(instance).toBeDefined();
        expect(instance!.el).toBe(element);
        expect(instance!.value).toBe('hello');
        expect(instance!.initialized).toBe(true);
      });

      it('should return consumed props', () => {
        @Behavior
        class TestBehavior {
          @Prop test: boolean = true;
          @Prop config: string = '';
        }

        const manager = new BehaviorManager();
        const element = document.createElement('div');
        const props = { test: true, config: 'value', className: 'my-class', id: 'my-id' };

        const consumed = manager.attachBehaviors(element, props);

        expect(consumed.has('test')).toBe(true);
        expect(consumed.has('config')).toBe(true);
        expect(consumed.has('className')).toBe(false);
        expect(consumed.has('id')).toBe(false);
      });

      it('should attach multiple behaviors to same element', () => {
        @Behavior
        class BehaviorA {
          @Prop behaviorA: boolean = true;
        }

        @Behavior
        class BehaviorB {
          @Prop behaviorB: boolean = true;
        }

        const manager = new BehaviorManager();
        const element = document.createElement('div');
        const props = { behaviorA: true, behaviorB: true };

        manager.attachBehaviors(element, props);

        expect(manager.get(element, 'BehaviorA')).toBeDefined();
        expect(manager.get(element, 'BehaviorB')).toBeDefined();
      });
    });

    describe('disconnectAll()', () => {
      it('should call onDestroy on all behaviors', () => {
        const destroySpy = vi.fn();

        @Behavior
        class TestBehavior {
          @Prop test: boolean = true;

          onDestroy() {
            destroySpy();
          }
        }

        const manager = new BehaviorManager();
        const element1 = document.createElement('div');
        const element2 = document.createElement('span');

        manager.attachBehaviors(element1, { test: true });
        manager.attachBehaviors(element2, { test: true });

        manager.disconnectAll();

        expect(destroySpy).toHaveBeenCalledTimes(2);
        expect(manager.elementCount).toBe(0);
      });
    });

    describe('disconnectElement()', () => {
      it('should only disconnect behaviors from specified element', () => {
        const destroySpy = vi.fn();

        @Behavior
        class TestBehavior {
          @Prop test: boolean = true;

          onDestroy() {
            destroySpy();
          }
        }

        const manager = new BehaviorManager();
        const element1 = document.createElement('div');
        const element2 = document.createElement('span');

        manager.attachBehaviors(element1, { test: true });
        manager.attachBehaviors(element2, { test: true });

        manager.disconnectElement(element1);

        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(manager.get(element1, 'TestBehavior')).toBeUndefined();
        expect(manager.get(element2, 'TestBehavior')).toBeDefined();
      });
    });

    describe('counts', () => {
      it('should track element and behavior counts', () => {
        @Behavior
        class BehaviorA {
          @Prop behaviorA: boolean = true;
        }

        @Behavior
        class BehaviorB {
          @Prop behaviorB: boolean = true;
        }

        const manager = new BehaviorManager();
        const element1 = document.createElement('div');
        const element2 = document.createElement('span');

        expect(manager.elementCount).toBe(0);
        expect(manager.behaviorCount).toBe(0);

        manager.attachBehaviors(element1, { behaviorA: true, behaviorB: true });
        expect(manager.elementCount).toBe(1);
        expect(manager.behaviorCount).toBe(2);

        manager.attachBehaviors(element2, { behaviorA: true });
        expect(manager.elementCount).toBe(2);
        expect(manager.behaviorCount).toBe(3);
      });
    });
  });

  describe('Real-world examples', () => {
    it('should work with Link behavior', () => {
      @Behavior
      class Link {
        @Host
        el!: HTMLAnchorElement;

        @Prop link: boolean = true;
        @Prop href: string = '';
        @Prop activeClass?: string;

        onInit() {
          this.el.href = this.href;
          if (this.activeClass && window.location.pathname === this.href) {
            this.el.classList.add(this.activeClass);
          }
        }
      }

      const manager = new BehaviorManager();
      const anchor = document.createElement('a');

      manager.attachBehaviors(anchor, {
        link: true,
        href: '/home',
        activeClass: 'active'
      });

      const instance = manager.get<Link>(anchor, 'Link');
      expect(instance).toBeDefined();
      expect(anchor.href).toContain('/home');
    });

    it('should work with Tooltip behavior', () => {
      @Behavior
      class Tooltip {
        @Host
        el!: HTMLElement;

        @Prop tooltip: boolean = true;
        @Prop text: string = '';
        @Prop position: 'top' | 'bottom' = 'top';

        private tooltipEl?: HTMLDivElement;

        onInit() {
          this.tooltipEl = document.createElement('div');
          this.tooltipEl.textContent = this.text;
          this.tooltipEl.className = `tooltip tooltip-${this.position}`;
        }

        onDestroy() {
          this.tooltipEl?.remove();
        }
      }

      const manager = new BehaviorManager();
      const button = document.createElement('button');

      manager.attachBehaviors(button, {
        tooltip: true,
        text: 'Click me!',
        position: 'bottom'
      });

      const instance = manager.get<Tooltip>(button, 'Tooltip');
      expect(instance).toBeDefined();
      expect(instance!.text).toBe('Click me!');
      expect(instance!.position).toBe('bottom');
    });
  });
});
