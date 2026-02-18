import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Router } from '../router';
import { Trie } from '../trie';
import { PolicyEvaluator } from '../policy-evaluator';
import { effect } from '../../reactivity/signals/effect';
import { phaseScheduler } from '../../reactivity/phase-scheduler';
import { reactiveContext } from '../../reactivity/reactive-context';

// Helper para hacer flush completo hasta que no haya más cambios
function flushAll() {
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    const sizeBefore = (phaseScheduler as any).dirtyEffects.size;
    phaseScheduler.flush();
    const sizeAfter = (phaseScheduler as any).dirtyEffects.size;

    if (sizeAfter === 0) break;
    iterations++;
  }

  if (iterations >= maxIterations) {
    throw new Error('Infinite loop detected in flushAll');
  }
}

describe('Router - Fine Grained Reactivity con Params', () => {
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

    // Registrar rutas
    trie.insert('home', '/', async () => ({ default: {} }), {}, [], 'default');
    trie.insert('users', '/users', async () => ({ default: {} }), {}, [], 'default');
    trie.insert('user-detail', '/users/:id', async () => ({ default: {} }), {}, [], 'default');
    trie.insert('user-posts', '/users/:id/posts', async () => ({ default: {} }), {}, [], 'default');
    trie.insert('post-detail', '/users/:id/posts/:postId', async () => ({ default: {} }), {}, [], 'default');

    // Esperar a que el @Effect se registre
    await new Promise(resolve => queueMicrotask(resolve));
  });

  it('debe tener params vacío inicialmente', () => {
    expect(router.$params).toEqual({});
  });

  it('debe actualizar params cuando cambia pathname', () => {
    router.pathname = '/users/123';
    flushAll();

    expect(router.$params).toEqual({ id: '123' });
  });

  it('debe ser reactivo - effect se ejecuta cuando cambia un param', () => {
    let execCount = 0;
    let observedId = '';

    effect(() => {
      execCount++;
      observedId = router.$params.id || '';
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);
    expect(observedId).toBe('');

    router.pathname = '/users/456';
    flushAll();

    expect(execCount).toBe(2);
    expect(observedId).toBe('456');
  });

  it('debe actualizar solo el param que cambió (granularidad fina)', () => {
    router.pathname = '/users/456/posts/789';
    flushAll();

    expect(router.$params).toEqual({ id: '456', postId: '789' });

    let idCount = 0;
    let postIdCount = 0;

    effect(() => {
      idCount++;
      const _ = router.$params.id;
    }, { priority: 'Sync' });

    effect(() => {
      postIdCount++;
      const _ = router.$params.postId;
    }, { priority: 'Sync' });

    expect(idCount).toBe(1);
    expect(postIdCount).toBe(1);

    // Cambiar a otra ruta con id diferente pero postId igual
    router.pathname = '/users/111/posts/789';
    flushAll();

    // id cambió de '456' a '111', así que su effect debe ejecutarse
    expect(idCount).toBe(2);
    // postId NO cambió (sigue siendo '789'), así que NO debe notificar (granularidad fina real)
    expect(postIdCount).toBe(1);
  });

  it('debe eliminar params que ya no existen en la nueva ruta', () => {
    router.pathname = '/users/222/posts/333';
    flushAll();

    expect(router.$params).toEqual({ id: '222', postId: '333' });

    // Cambiar a una ruta con solo un param
    router.pathname = '/users/789';
    flushAll();

    expect(router.$params).toEqual({ id: '789' });
    expect(router.$params.postId).toBeUndefined();
  });

  it('debe limpiar params cuando la ruta no tiene match', () => {
    router.pathname = '/users/123';
    flushAll();

    expect(router.$params).toEqual({ id: '123' });

    router.pathname = '/not-found';
    flushAll();

    expect(router.$params).toEqual({});
  });

  it('debe reaccionar a cambios múltiples de params', () => {
    const observed: string[] = [];

    effect(() => {
      const id = router.$params.id || 'none';
      observed.push(id);
    }, { priority: 'Sync' });

    expect(observed).toEqual(['none']);

    router.pathname = '/users/999';
    flushAll();
    expect(observed).toEqual(['none', '999']);

    router.pathname = '/users/111/posts/222';
    flushAll();
    expect(observed).toEqual(['none', '999', '111']);

    router.pathname = '/users/300';
    flushAll();
    expect(observed).toEqual(['none', '999', '111', '300']);
  });

  it('navigate() debe actualizar pathname y params reactivamente', async () => {
    router.navigate('/users/999');
    await new Promise(resolve => setTimeout(resolve, 0));
    flushAll();
    await new Promise(resolve => setTimeout(resolve, 0));
    flushAll();

    expect(router.pathname).toBe('/users/999');
    expect(router.$params.id).toBe('999');
  });

  it('navigate() no debe hacer nada si el path es el mismo', () => {
    router.pathname = '/users/123';
    flushAll();

    let execCount = 0;
    effect(() => {
      execCount++;
      const _ = router.pathname;
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);

    router.navigate('/users/123');
    flushAll();

    // No debería ejecutarse de nuevo
    expect(execCount).toBe(1);
  });

  it('debe funcionar correctamente con rutas sin params', () => {
    let execCount = 0;
    let hasId = false;

    effect(() => {
      execCount++;
      hasId = 'id' in router.$params;
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);
    expect(hasId).toBe(false);

    router.pathname = '/users';
    flushAll();

    // El effect NO se ejecuta porque params sigue siendo {} (vacío)
    expect(execCount).toBe(1);
    expect(hasId).toBe(false);

    router.pathname = '/users/456';
    flushAll();

    expect(execCount).toBe(2);
    expect(hasId).toBe(true);
  });

  it('no debe tener loops infinitos', () => {
    let execCount = 0;

    effect(() => {
      execCount++;
      // Leer una propiedad específica de params
      const _ = router.$params.id;
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);

    // Cambiar pathname múltiples veces
    router.pathname = '/users/1';
    flushAll();
    expect(execCount).toBe(2);

    router.pathname = '/users/2';
    flushAll();
    expect(execCount).toBe(3);

    router.pathname = '/users/3';
    flushAll();
    expect(execCount).toBe(4);

    // Debería haber exactamente 4 ejecuciones (1 inicial + 3 cambios)
  });
});
