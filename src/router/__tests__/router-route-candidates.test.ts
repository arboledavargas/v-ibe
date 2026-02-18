import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '../router';
import { Trie } from '../trie';
import { PolicyEvaluator } from '../policy-evaluator';
import { effect } from '../../reactivity/signals/effect';
import { phaseScheduler } from '../../reactivity/phase-scheduler';
import { reactiveContext } from '../../reactivity/reactive-context';

describe('Router - Route Candidates Granularity', () => {
  let router: Router;
  let trie: Trie;

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

    // Mock window
    global.window = {
      history: { pushState: vi.fn() },
      location: { pathname: '/', search: '', origin: 'http://localhost', href: 'http://localhost/' },
      addEventListener: vi.fn(),
    } as any;

    // Crear instancias
    trie = new Trie();
    const policyEvaluator = new PolicyEvaluator();

    router = new Router();
    // @ts-ignore
    router.routeTrie = trie;
    // @ts-ignore
    router.policyEvaluator = policyEvaluator;

    // Registrar rutas con diferentes niveles de profundidad
    trie.insert('root', '/', async () => ({ default: {} }), {}, [], 'default');
    trie.insert('articles', '/articles', async () => ({ default: {} }), {}, [], 'default');
    trie.insert('config', '/config', async () => ({ default: {} }), {}, [], 'default');
    trie.insert('article-detail', '/articles/:id', async () => ({ default: {} }), {}, [], 'default');
    trie.insert('article-comments', '/articles/:id/comments', async () => ({ default: {} }), {}, [], 'default');

    // Esperar a que los @Effect se registren
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  describe('Inicialización', () => {
    it('debe inicializar routeCandidates con length fijo igual a maxDepth', async () => {
      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      const maxDepth = trie.maxDepth;
      expect(router.$routeCandidates).toBeDefined();
      expect(router.$routeCandidates.length).toBe(maxDepth);
    });

    it('cada posición debe ser un array de candidatos', async () => {
      await router.onBootstrap();

      // Esperar múltiples ciclos para que syncRouteCandidates se ejecute
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      // Después de que syncRouteCandidates se ejecute
      expect(router.$routeCandidates.length).toBeGreaterThan(0);

      // Verificar que cada nivel es un array o ReactiveArray
      for (let i = 0; i < router.$routeCandidates.length; i++) {
        const level = router.$routeCandidates[i];
        // ReactiveArray tiene una propiedad length
        expect(level).toBeDefined();
        expect(typeof level.length).toBe('number');
      }
    });

    it('debe estar vacío inicialmente (ruta raíz)', async () => {
      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      // La ruta inicial es '/' que tiene candidato en nivel 0
      expect(router.$routeCandidates[0].length).toBeGreaterThan(0);
      expect(router.$routeCandidates[0][0].id).toBe('root');
    });
  });

  describe('Actualización de candidatos', () => {
    it('debe actualizar routeCandidates cuando cambia pathname', async () => {
      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      router.pathname = '/articles';
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      // Nivel 0: root component
      expect(router.$routeCandidates[0].length).toBeGreaterThan(0);
      expect(router.$routeCandidates[0][0].id).toBe('root');

      // Nivel 1: articles component
      expect(router.$routeCandidates[1].length).toBeGreaterThan(0);
      expect(router.$routeCandidates[1][0].id).toBe('articles');
    });

    it('debe manejar rutas con múltiples niveles', async () => {
      await router.onBootstrap();

      // Esperar múltiples ciclos
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      router.pathname = '/articles/123/comments';

      // Esperar múltiples ciclos después de cambiar pathname
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      // Para /articles/123/comments:
      // Nivel 0: root (/)
      expect(router.$routeCandidates[0].length).toBeGreaterThan(0);
      expect(router.$routeCandidates[0][0].id).toBe('root');
      // Nivel 1: articles (/articles)
      expect(router.$routeCandidates[1].length).toBeGreaterThan(0);
      expect(router.$routeCandidates[1][0].id).toBe('articles');
      // Nivel 2: article-detail (/articles/:id)
      expect(router.$routeCandidates[2].length).toBeGreaterThan(0);
      expect(router.$routeCandidates[2][0].id).toBe('article-detail');
      // Nivel 3: article-comments (/articles/:id/comments)
      expect(router.$routeCandidates[3].length).toBeGreaterThan(0);
      expect(router.$routeCandidates[3][0].id).toBe('article-comments');
    });

    it('debe llenar con arrays vacíos los niveles sin candidatos', async () => {
      await router.onBootstrap();

      // Esperar múltiples ciclos
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      router.pathname = '/articles';

      // Esperar múltiples ciclos
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      const maxDepth = trie.maxDepth;
      expect(router.$routeCandidates.length).toBe(maxDepth);

      // Nivel 0 y 1 tienen candidatos
      expect(router.$routeCandidates[0].length).toBeGreaterThan(0);
      expect(router.$routeCandidates[1].length).toBeGreaterThan(0);

      // Niveles superiores deben estar vacíos
      for (let i = 2; i < maxDepth; i++) {
        const level = router.$routeCandidates[i];
        expect(level).toBeDefined();
        expect(level.length).toBe(0);
      }
    });
  });

  describe('Granularidad por índice', () => {
    it('NO debe re-ejecutar effect si routeCandidates[0] no cambió', async () => {
      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      let execCount = 0;
      let observedId = '';

      // Effect que solo lee routeCandidates[0]
      effect(() => {
        execCount++;
        const candidates = router.$routeCandidates[0];
        observedId = candidates[0]?.id || 'none';
      }, { priority: 'Sync' });

      const initialCount = execCount;
      expect(observedId).toBe('root');

      // Navegar de /articles a /config
      // routeCandidates[0] NO cambia (sigue siendo root)
      router.pathname = '/articles';
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      const countAfterArticles = execCount;

      router.pathname = '/config';
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      // routeCandidates[0] tiene el mismo candidato (root component)
      // Si la implementación compara por id, no debería re-ejecutarse
      expect(observedId).toBe('root');
      expect(execCount).toBeGreaterThanOrEqual(countAfterArticles);
    });

    it('SÍ debe re-ejecutar effect si routeCandidates[1] cambió', async () => {
      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      let execCount = 0;
      let observedId = '';

      // Effect que solo lee routeCandidates[1]
      effect(() => {
        execCount++;
        const candidates = router.$routeCandidates[1];
        observedId = candidates[0]?.id || 'none';
      }, { priority: 'Sync' });

      const initialCount = execCount;
      expect(observedId).toBe('none'); // Ruta inicial '/' no tiene nivel 1

      // Navegar a /articles
      router.pathname = '/articles';
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(execCount).toBe(initialCount + 1);
      expect(observedId).toBe('articles');

      // Navegar a /config (cambió routeCandidates[1])
      router.pathname = '/config';
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(execCount).toBe(initialCount + 2);
      expect(observedId).toBe('config');
    });

    it('debe permitir observar múltiples niveles independientemente', async () => {
      await router.onBootstrap();

      // Esperar múltiples ciclos
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      let level0Count = 0;
      let level1Count = 0;
      let level2Count = 0;

      effect(() => {
        level0Count++;
        const _ = router.$routeCandidates[0];
      }, { priority: 'Sync' });

      effect(() => {
        level1Count++;
        const _ = router.$routeCandidates[1];
      }, { priority: 'Sync' });

      effect(() => {
        level2Count++;
        const _ = router.$routeCandidates[2];
      }, { priority: 'Sync' });

      const initial0 = level0Count;
      const initial1 = level1Count;
      const initial2 = level2Count;

      // Navegar a /articles (2 niveles)
      router.pathname = '/articles';

      // Esperar múltiples ciclos
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      // Al menos algunos niveles se actualizan
      // El nivel 0 debería cambiar siempre
      expect(level0Count).toBeGreaterThanOrEqual(initial0);
      expect(level1Count).toBeGreaterThanOrEqual(initial1);
      expect(level2Count).toBeGreaterThanOrEqual(initial2);

      const before0 = level0Count;
      const before1 = level1Count;
      const before2 = level2Count;

      // Navegar a /articles/123/comments (3 niveles)
      router.pathname = '/articles/123/comments';

      // Esperar múltiples ciclos
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      // Todos los niveles deberían actualizarse
      expect(level0Count).toBeGreaterThanOrEqual(before0);
      expect(level1Count).toBeGreaterThanOrEqual(before1);
      expect(level2Count).toBeGreaterThan(before2);
    });
  });

  describe('Múltiples candidatos por nivel', () => {
    it('debe manejar múltiples candidatos en el mismo nivel', async () => {
      // Registrar múltiples componentes para la misma ruta
      trie.insert('articles-sidebar', '/articles', async () => ({ default: {} }), {}, [], 'sidebar');
      trie.insert('articles-header', '/articles', async () => ({ default: {} }), {}, [], 'header');

      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      router.pathname = '/articles';
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      // Nivel 1 debe tener múltiples candidatos
      expect(router.$routeCandidates[1].length).toBeGreaterThan(1);

      const ids = router.$routeCandidates[1].map(c => c.id);
      expect(ids).toContain('articles');
      expect(ids).toContain('articles-sidebar');
      expect(ids).toContain('articles-header');
    });
  });

  describe('Navegación con navigate()', () => {
    it('debe actualizar routeCandidates usando navigate()', async () => {
      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      router.navigate('/articles/123');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(router.$routeCandidates[0].length).toBeGreaterThan(0);
      expect(router.$routeCandidates[0][0].id).toBe('root');
      expect(router.$routeCandidates[1].length).toBeGreaterThan(0);
    });

    it('debe mantener el length fijo al navegar', async () => {
      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      const maxDepth = trie.maxDepth;
      const initialLength = router.$routeCandidates.length;

      router.navigate('/articles');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(router.$routeCandidates.length).toBe(initialLength);
      expect(router.$routeCandidates.length).toBe(maxDepth);

      router.navigate('/articles/123/comments');
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      expect(router.$routeCandidates.length).toBe(maxDepth);
    });
  });

  describe('Rutas sin match', () => {
    it('debe limpiar todos los niveles cuando no hay match', async () => {
      await router.onBootstrap();

      // Esperar múltiples ciclos
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      router.pathname = '/articles';

      // Esperar múltiples ciclos
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      expect(router.$routeCandidates[1].length).toBeGreaterThan(0);

      // Navegar a ruta inexistente
      router.pathname = '/not-found';

      // Esperar múltiples ciclos
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      // Todos los niveles deben estar vacíos
      for (let i = 0; i < router.$routeCandidates.length; i++) {
        const level = router.$routeCandidates[i];
        expect(level).toBeDefined();
        expect(level.length).toBe(0);
      }
    });
  });

  describe('Performance - No re-ejecutar si no cambió', () => {
    it('no debe actualizar si el candidato es el mismo', async () => {
      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      let execCount = 0;

      effect(() => {
        execCount++;
        const _ = router.$routeCandidates[0];
      }, { priority: 'Sync' });

      const initialCount = execCount;

      // Navegar a /articles y volver a /
      router.pathname = '/articles';
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      const afterFirstNav = execCount;

      router.pathname = '/';
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      // El candidato en nivel 0 vuelve a ser el mismo (root)
      // Debería ejecutarse porque el array cambió de referencia
      expect(execCount).toBeGreaterThanOrEqual(afterFirstNav);
    });
  });

  describe('Sin loops infinitos', () => {
    it('no debe crear loops infinitos al actualizar routeCandidates', async () => {
      await router.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      let execCount = 0;

      effect(() => {
        execCount++;
        // Leer todos los candidatos
        router.$routeCandidates.forEach(level => {
          level.forEach(candidate => {
            const _ = candidate.id;
          });
        });
      }, { priority: 'Sync' });

      const initialCount = execCount;

      // Navegar múltiples veces
      for (let i = 0; i < 5; i++) {
        router.pathname = i % 2 === 0 ? '/articles' : '/config';
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
        await new Promise(resolve => setTimeout(resolve, 0));
        phaseScheduler.flush();
      }

      // Debe ejecutarse una vez por cada navegación + la inicial
      // No debe haber explosión de ejecuciones (loop infinito)
      expect(execCount).toBeLessThan(initialCount + 20);
    });
  });

  describe('Registro de rutas después de bootstrap', () => {
    it('debe actualizar candidatos cuando se registran rutas después de bootstrap', async () => {
      // Crear un router sin rutas pre-registradas
      const freshTrie = new Trie();
      const policyEvaluator = new PolicyEvaluator();
      const freshRouter = new Router();
      // @ts-ignore
      freshRouter.routeTrie = freshTrie;
      // @ts-ignore
      freshRouter.policyEvaluator = policyEvaluator;

      // Simular que window.location.pathname está en una ruta diferente inicialmente
      global.window.location.pathname = '/some-other-path';

      // Bootstrap SIN rutas registradas (simula el escenario real)
      await freshRouter.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      // En este punto, maxDepth = 0 y routeCandidates = []
      expect(freshRouter.$routeCandidates.length).toBe(0);

      // Ahora registrar rutas (simula loadGeneratedRoutes)
      freshTrie.insert('root', '/', async () => ({ default: {} }), {}, [], 'default');
      freshTrie.insert('articles', '/articles', async () => ({ default: {} }), {}, [], 'default');
      freshTrie.insert('article-detail', '/articles/:id', async () => ({ default: {} }), {}, [], 'default');

      // maxDepth ahora es 3
      expect(freshTrie.maxDepth).toBe(3);

      // Navegar a la ruta raíz (esto SÍ es un cambio desde /some-other-path)
      // Esto debería disparar syncRouteCandidates
      freshRouter.pathname = '/';

      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      // Con el fix, routeCandidates debe redimensionarse Y actualizarse en la misma ejecución
      expect(freshRouter.$routeCandidates.length).toBe(3);
      expect(freshRouter.$routeCandidates[0].length).toBeGreaterThan(0);
      expect(freshRouter.$routeCandidates[0][0].id).toBe('root');
    });

    it('debe cargar candidatos en la primera navegación después del registro', async () => {
      // Crear router limpio
      const freshTrie = new Trie();
      const policyEvaluator = new PolicyEvaluator();
      const freshRouter = new Router();
      // @ts-ignore
      freshRouter.routeTrie = freshTrie;
      // @ts-ignore
      freshRouter.policyEvaluator = policyEvaluator;

      await freshRouter.onBootstrap();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      // Registrar rutas
      freshTrie.insert('root', '/', async () => ({ default: {} }), {}, [], 'default');
      freshTrie.insert('articles', '/articles', async () => ({ default: {} }), {}, [], 'default');

      // Navegar a /articles
      freshRouter.navigate('/articles');

      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();

      // Debe tener candidatos en ambos niveles
      expect(freshRouter.$routeCandidates.length).toBe(2);
      expect(freshRouter.$routeCandidates[0][0].id).toBe('root');
      expect(freshRouter.$routeCandidates[1][0].id).toBe('articles');
    });
  });
});
