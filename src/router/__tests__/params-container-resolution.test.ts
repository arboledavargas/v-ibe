import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '../router';
import { Trie } from '../trie';
import { PolicyEvaluator } from '../policy-evaluator';
import { phaseScheduler } from '../../reactivity/phase-scheduler';
import { reactiveContext } from '../../reactivity/reactive-context';
import { DIContainer } from '../../DI/di-container';
import { Param, Params, Query, QueryParams } from '../decorators/params';

/**
 * Tests para verificar que @Param, @Params, @Query, @QueryParams
 * resuelven correctamente desde __container en vez del singleton global.
 *
 * Estos tests validan que cuando migremos los decoradores
 * de `services.get(Router)` a `this.__container.get(Router)`,
 * la resolucion funcione correctamente via __container.
 *
 * ESTADO ACTUAL: Los decoradores usan services.get() (singleton global).
 * TARGET: Los decoradores deben usar this.__container.get().
 */
describe('Param decorators - __container resolution', () => {
  let container: DIContainer;
  let router: Router;

  beforeEach(async () => {
    // Reset scheduler
    // @ts-ignore
    phaseScheduler.dirtyEffects.clear();
    // @ts-ignore
    phaseScheduler.isFlushScheduled = false;

    // Reset reactive context
    // @ts-ignore
    reactiveContext.computationStack = [];
    // @ts-ignore
    reactiveContext.contextStack = [];

    // Mock window completo para que new URL() funcione
    global.window = {
      history: { pushState: vi.fn() },
      location: {
        pathname: '/',
        search: '',
        origin: 'http://localhost',
        href: 'http://localhost/',
        host: 'localhost',
        protocol: 'http:',
      },
      addEventListener: vi.fn(),
    } as any;

    // Crear un container independiente (no el singleton global)
    container = new DIContainer();
    container.register(Trie);
    container.register(PolicyEvaluator);
    container.register(Router);
    container.registerDependency(Router, Trie);
    container.registerDependency(Router, PolicyEvaluator);
    await container.bootstrap();

    router = container.get(Router);

    // Registrar rutas
    const trie = container.get(Trie);
    trie.insert('user-detail', '/users/:id', async () => ({ default: {} }), {}, [], 'default');
    trie.insert('search', '/search', async () => ({ default: {} }), {}, [], 'default');
  });

  describe('@Inject en servicios - ya funciona con __container', () => {
    it('un servicio con @Inject debe resolver dependencias desde su __container', () => {
      const routerFromContainer = container.get(Router);
      const trieFromContainer = container.get(Trie);
      const policyFromContainer = container.get(PolicyEvaluator);

      // El router debe tener __container seteado al container local
      expect((routerFromContainer as any).__container).toBe(container);
      // @Inject resuelve desde __container (ya funciona asi)
      expect(routerFromContainer.routeTrie).toBe(trieFromContainer);
      expect(routerFromContainer.policyEvaluator).toBe(policyFromContainer);
    });
  });

  describe('@Param - resolucion via __container', () => {
    it('debe resolver Router desde __container de la instancia', () => {
      class UserDetail {
        @Param('id')
        userId!: string | null;
      }

      const instance = new UserDetail();
      (instance as any).__container = container;

      router.pathname = '/users/42';
      phaseScheduler.flush();

      expect(instance.userId).toBe('42');
    });

    it('debe funcionar con multiples @Param en la misma clase', () => {
      class OrderDetail {
        @Param('storeId')
        storeId!: string | null;

        @Param('productId')
        productId!: string | null;
      }

      const instance = new OrderDetail();
      (instance as any).__container = container;

      // Registrar ruta con multiples params en un path unico
      const trie = container.get(Trie);
      trie.insert('store-product', '/stores/:storeId/products/:productId', async () => ({ default: {} }), {}, [], 'default');

      router.pathname = '/stores/10/products/55';
      phaseScheduler.flush();

      expect(instance.storeId).toBe('10');
      expect(instance.productId).toBe('55');
    });

    it('debe retornar null si el param no existe', () => {
      class Page {
        @Param('nonexistent')
        value!: string | null;
      }

      const instance = new Page();
      (instance as any).__container = container;

      router.pathname = '/users/1';
      phaseScheduler.flush();

      expect(instance.value).toBeNull();
    });
  });

  describe('@Params - resolucion via __container', () => {
    it('debe resolver todos los params desde __container', () => {
      class UserPage {
        @Params()
        allParams!: Record<string, string>;
      }

      const instance = new UserPage();
      (instance as any).__container = container;

      router.pathname = '/users/99';
      phaseScheduler.flush();

      expect(instance.allParams).toBeDefined();
      expect(instance.allParams.id).toBe('99');
    });

    it('debe retornar objeto vacio cuando no hay params', () => {
      class HomePage {
        @Params()
        allParams!: Record<string, string>;
      }

      const instance = new HomePage();
      (instance as any).__container = container;

      const trie = container.get(Trie);
      trie.insert('home', '/', async () => ({ default: {} }), {}, [], 'default');
      router.pathname = '/';
      phaseScheduler.flush();

      expect(instance.allParams).toBeDefined();
      expect(Object.keys(instance.allParams).length).toBe(0);
    });
  });

  describe('@Query - resolucion via __container', () => {
    it('debe resolver Router desde __container para query params', async () => {
      class SearchPage {
        @Query('q')
        searchQuery!: string | null;
      }

      const instance = new SearchPage();
      (instance as any).__container = container;

      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));

      (global.window.location as any).href = 'http://localhost/';
      router.navigate('/search?q=typescript');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(instance.searchQuery).toBe('typescript');
    });

    it('debe funcionar con multiples @Query en la misma clase', async () => {
      class SearchPage {
        @Query('q')
        searchQuery!: string | null;

        @Query('page')
        page!: string | null;

        @Query('sort')
        sort!: string | null;
      }

      const instance = new SearchPage();
      (instance as any).__container = container;

      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));

      (global.window.location as any).href = 'http://localhost/';
      router.navigate('/search?q=rust&page=3&sort=date');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(instance.searchQuery).toBe('rust');
      expect(instance.page).toBe('3');
      expect(instance.sort).toBe('date');
    });

    it('debe retornar null para query param inexistente', async () => {
      class Page {
        @Query('missing')
        value!: string | null;
      }

      const instance = new Page();
      (instance as any).__container = container;

      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));

      (global.window.location as any).href = 'http://localhost/';
      router.navigate('/search?q=hello');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(instance.value).toBeNull();
    });
  });

  describe('@QueryParams - resolucion via __container', () => {
    it('debe resolver todos los query params desde __container', async () => {
      class SearchPage {
        @QueryParams()
        allQuery!: Record<string, string>;
      }

      const instance = new SearchPage();
      (instance as any).__container = container;

      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));

      (global.window.location as any).href = 'http://localhost/';
      router.navigate('/search?q=hello&page=2&filter=active');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(instance.allQuery).toBeDefined();
      expect(instance.allQuery.q).toBe('hello');
      expect(instance.allQuery.page).toBe('2');
      expect(instance.allQuery.filter).toBe('active');
    });

    it('debe retornar objeto vacio cuando no hay query params', async () => {
      class Page {
        @QueryParams()
        allQuery!: Record<string, string>;
      }

      const instance = new Page();
      (instance as any).__container = container;

      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));

      (global.window.location as any).href = 'http://localhost/';
      router.navigate('/search');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(instance.allQuery).toBeDefined();
      expect(Object.keys(instance.allQuery).length).toBe(0);
    });
  });

  describe('Aislamiento entre containers', () => {
    it('dos instancias con distinto __container deben ver distintos routers', async () => {
      const container2 = new DIContainer();
      container2.register(Trie);
      container2.register(PolicyEvaluator);
      container2.register(Router);
      container2.registerDependency(Router, Trie);
      container2.registerDependency(Router, PolicyEvaluator);
      await container2.bootstrap();

      const router2 = container2.get(Router);
      const trie2 = container2.get(Trie);
      trie2.insert('user-detail', '/users/:id', async () => ({ default: {} }), {}, [], 'default');

      class UserPage {
        @Param('id')
        userId!: string | null;
      }

      const instance1 = new UserPage();
      (instance1 as any).__container = container;

      const instance2 = new UserPage();
      (instance2 as any).__container = container2;

      router.pathname = '/users/AAA';
      phaseScheduler.flush();

      router2.pathname = '/users/BBB';
      phaseScheduler.flush();

      // Cada instancia debe ver su propio router
      expect(instance1.userId).toBe('AAA');
      expect(instance2.userId).toBe('BBB');
    });
  });
});
