import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '../router';
import { Trie } from '../trie';
import { PolicyEvaluator } from '../policy-evaluator';
import { phaseScheduler } from '../../reactivity/phase-scheduler';
import { reactiveContext } from '../../reactivity/reactive-context';
import { GeneratedRoute } from '../router';

describe('Router - Generated Routes Loading', () => {
  let router: Router;
  let trie: Trie;
  let policyEvaluator: PolicyEvaluator;

  beforeEach(() => {
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

    // Mock window
    global.window = {
      history: { pushState: vi.fn() },
      location: { pathname: '/', search: '', origin: 'http://localhost', href: 'http://localhost/' },
      addEventListener: vi.fn(),
    } as any;

    // Crear instancias
    trie = new Trie();
    policyEvaluator = new PolicyEvaluator();

    router = new Router();
    // @ts-ignore
    router.routeTrie = trie;
    // @ts-ignore
    router.policyEvaluator = policyEvaluator;
  });

  describe('registerGeneratedRoutes', () => {
    it('debe registrar un array vacío de rutas sin errores', () => {
      const routes: GeneratedRoute[] = [];

      expect(() => {
        router.registerGeneratedRoutes(routes);
      }).not.toThrow();
    });

    it('debe registrar una ruta simple en el Trie', () => {
      const routes: GeneratedRoute[] = [
        {
          id: 'home-route',
          path: '/',
          className: 'HomeComponent',
          loader: async () => ({ default: {} }),
        }
      ];

      router.registerGeneratedRoutes(routes);

      const match = trie.find('/');
      expect(match).not.toBeNull();
      expect(match?.candidatesByLevel).toHaveLength(1);
      expect(match?.candidatesByLevel[0][0].id).toBe('home-route');
    });

    it('debe registrar múltiples rutas', () => {
      const routes: GeneratedRoute[] = [
        {
          id: 'home',
          path: '/',
          className: 'HomeComponent',
          loader: async () => ({ default: {} }),
        },
        {
          id: 'about',
          path: '/about',
          className: 'AboutComponent',
          loader: async () => ({ default: {} }),
        },
        {
          id: 'users',
          path: '/users/:id',
          className: 'UserComponent',
          loader: async () => ({ default: {} }),
        }
      ];

      router.registerGeneratedRoutes(routes);

      // Verificar cada ruta
      const homeMatch = trie.find('/');
      expect(homeMatch?.candidatesByLevel[0][0].id).toBe('home');

      const aboutMatch = trie.find('/about');
      // La ruta /about devuelve 2 niveles: nivel 0 (root con '/') y nivel 1 ('/about')
      expect(aboutMatch?.candidatesByLevel.length).toBe(2);
      expect(aboutMatch?.candidatesByLevel[0][0].id).toBe('home'); // Root level
      expect(aboutMatch?.candidatesByLevel[1][0].id).toBe('about'); // /about level

      const userMatch = trie.find('/users/123');
      // La ruta /users/:id devuelve 2 niveles: nivel 0 (root) y nivel 1 (/users/:id)
      expect(userMatch?.candidatesByLevel.length).toBe(2);
      expect(userMatch?.candidatesByLevel[0][0].id).toBe('home'); // Root level
      expect(userMatch?.candidatesByLevel[1][0].id).toBe('users'); // /users/:id level
      expect(userMatch?.params).toEqual({ id: '123' });
    });

    it('debe registrar rutas con metadata', () => {
      const routes: GeneratedRoute[] = [
        {
          id: 'profile',
          path: '/profile',
          className: 'ProfileComponent',
          loader: async () => ({ default: {} }),
          metadata: {
            title: 'Profile Page',
            requiresAuth: true,
          }
        }
      ];

      router.registerGeneratedRoutes(routes);

      const match = trie.find('/profile');
      expect(match?.candidatesByLevel[0][0].metadata).toEqual({
        title: 'Profile Page',
        requiresAuth: true,
      });
    });

    it('debe registrar rutas con policies', () => {
      class MockPolicy {
        evaluate() { return true; }
      }

      const routes: GeneratedRoute[] = [
        {
          id: 'admin',
          path: '/admin',
          className: 'AdminComponent',
          loader: async () => ({ default: {} }),
          policies: [MockPolicy]
        }
      ];

      router.registerGeneratedRoutes(routes);

      const match = trie.find('/admin');
      expect(match?.candidatesByLevel[0][0].policies).toEqual([MockPolicy]);
    });

    it('debe registrar rutas con slot', () => {
      const routes: GeneratedRoute[] = [
        {
          id: 'sidebar',
          path: '/dashboard',
          className: 'SidebarComponent',
          loader: async () => ({ default: {} }),
          slot: 'sidebar'
        }
      ];

      router.registerGeneratedRoutes(routes);

      const match = trie.find('/dashboard');
      expect(match?.candidatesByLevel[0][0].slot).toBe('sidebar');
    });

    it('debe registrar rutas anidadas correctamente', () => {
      const routes: GeneratedRoute[] = [
        {
          id: 'dashboard-layout',
          path: '/dashboard',
          className: 'DashboardLayout',
          loader: async () => ({ default: {} }),
        },
        {
          id: 'dashboard-settings',
          path: '/dashboard/settings',
          className: 'SettingsComponent',
          loader: async () => ({ default: {} }),
        },
        {
          id: 'dashboard-settings-profile',
          path: '/dashboard/settings/profile',
          className: 'ProfileSettingsComponent',
          loader: async () => ({ default: {} }),
        }
      ];

      router.registerGeneratedRoutes(routes);

      const match = trie.find('/dashboard/settings/profile');

      expect(match).not.toBeNull();
      expect(match?.candidatesByLevel).toHaveLength(3);
      expect(match?.candidatesByLevel[0][0].id).toBe('dashboard-layout');
      expect(match?.candidatesByLevel[1][0].id).toBe('dashboard-settings');
      expect(match?.candidatesByLevel[2][0].id).toBe('dashboard-settings-profile');
    });
  });

  describe('navigate', () => {
    beforeEach(() => {
      const routes: GeneratedRoute[] = [
        {
          id: 'home',
          path: '/',
          className: 'HomeComponent',
          loader: async () => ({ default: {} }),
        },
        {
          id: 'about',
          path: '/about',
          className: 'AboutComponent',
          loader: async () => ({ default: {} }),
        },
        {
          id: 'user',
          path: '/users/:id',
          className: 'UserComponent',
          loader: async () => ({ default: {} }),
        }
      ];

      router.registerGeneratedRoutes(routes);
    });

    it('debe actualizar currentPath al navegar', async () => {
      // El router inicia con pathname vacío hasta onBootstrap
      expect(router.pathname).toBe('');

      router.navigate('/about');

      // Esperar microtasks para que los effects se ejecuten
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(router.pathname).toBe('/about');
      expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/about');
    });

    it('no debe navegar si la ruta es la misma', async () => {
      router.pathname = '/about';
      router.search = '';
      vi.clearAllMocks();

      router.navigate('/about');

      expect(window.history.pushState).not.toHaveBeenCalled();
    });

    it('debe actualizar params al navegar a ruta con parámetros', async () => {
      router.navigate('/users/456');

      // Esperar microtasks para que los effects se ejecuten
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(router.$params).toEqual({ id: '456' });
    });

    it('debe limpiar params al navegar a ruta sin parámetros', async () => {
      router.navigate('/users/456');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      expect(router.$params).toEqual({ id: '456' });

      router.navigate('/about');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      expect(router.$params).toEqual({});
    });
  });

  describe('params reactivity', () => {
    beforeEach(async () => {
      const routes: GeneratedRoute[] = [
        {
          id: 'product',
          path: '/products/:category/:id',
          className: 'ProductComponent',
          loader: async () => ({ default: {} }),
        }
      ];

      router.registerGeneratedRoutes(routes);

      // Esperar microtasks para que effects se registren
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('debe actualizar múltiples params simultáneamente', async () => {
      router.navigate('/products/electronics/123');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(router.$params).toEqual({
        category: 'electronics',
        id: '123'
      });
    });

    it('debe mantener params actualizados en navegaciones sucesivas', async () => {
      router.navigate('/products/books/456');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      expect(router.$params.category).toBe('books');
      expect(router.$params.id).toBe('456');

      router.navigate('/products/toys/789');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      expect(router.$params.category).toBe('toys');
      expect(router.$params.id).toBe('789');
    });
  });

  describe('maxDepth tracking', () => {
    it('debe trackear la profundidad máxima de las rutas', () => {
      const routes: GeneratedRoute[] = [
        {
          id: 'shallow',
          path: '/about',
          className: 'AboutComponent',
          loader: async () => ({ default: {} }),
        },
        {
          id: 'deep',
          path: '/a/b/c/d/e',
          className: 'DeepComponent',
          loader: async () => ({ default: {} }),
        },
        {
          id: 'medium',
          path: '/x/y/z',
          className: 'MediumComponent',
          loader: async () => ({ default: {} }),
        }
      ];

      router.registerGeneratedRoutes(routes);

      expect(trie.maxDepth).toBe(6); // /a/b/c/d/e tiene 5 segmentos + 1 (root)
    });
  });

  describe('onBootstrap lifecycle', () => {
    it('debe inicializar el router solo una vez', async () => {
      await router.onBootstrap();

      // @ts-ignore - accediendo a propiedad privada para testing
      expect(router.hasInitialized).toBe(true);

      // Intentar inicializar de nuevo
      await router.onBootstrap();

      // Debe seguir siendo true sin re-ejecutar
      // @ts-ignore
      expect(router.hasInitialized).toBe(true);
    });

    it('debe configurar listener de popstate', async () => {
      await router.onBootstrap();

      expect(window.addEventListener).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
    });

    it('debe establecer currentPath desde window.location', async () => {
      global.window.location.pathname = '/test-path';

      await router.onBootstrap();

      expect(router.currentPath).toBe('/test-path');
    });
  });
});
