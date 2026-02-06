import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '../router';
import { Trie } from '../trie';
import { PolicyEvaluator } from '../policy-evaluator';
import { effect } from '../../reactivity/signals/effect';
import { phaseScheduler } from '../../reactivity/phase-scheduler';
import { reactiveContext } from '../../reactivity/reactive-context';

describe('Router - Params Simple Test', () => {
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
      location: { pathname: '/', search: '', origin: 'http://localhost' },
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
    trie.insert('user-detail', '/users/:id', async () => ({ default: {} }), {}, [], 'default');

    // Esperar a que los microtasks se procesen (para que @Effect se registre)
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('debe tener params como objeto reactivo', () => {
    expect(router.$params).toBeDefined();
    expect(typeof router.$params).toBe('object');
  });

  it('debe actualizar params cuando cambia pathname', async () => {
    console.log('\n=== Test: Actualizar params ===');

    expect(router.$params).toEqual({});
    console.log('Initial params:', router.$params);

    // Cambiar pathname
    router.pathname = '/users/123';
    console.log('Pathname changed to:', router.pathname);

    // Flush scheduler para ejecutar effects
    phaseScheduler.flush();
    console.log('After flush, params:', router.$params);

    expect(router.$params).toEqual({ id: '123' });
  });

  it('debe ser reactivo con effects', async () => {
    console.log('\n=== Test: Reactividad con effects ===');

    let execCount = 0;
    let observedId = '';

    const eff = effect(() => {
      execCount++;
      observedId = router.$params.id || '';
      console.log(`Effect ejecutado #${execCount}, observedId:`, observedId);
      console.log('execCount dentro del effect:', execCount);
    }, { priority: 'Sync' });

    console.log('Después de crear effect, execCount:', execCount);
    expect(execCount).toBe(1);
    expect(observedId).toBe('');

    router.pathname = '/users/456';
    console.log('Pathname changed to:', router.pathname);
    console.log('Antes de flush, execCount:', execCount);
    phaseScheduler.flush();

    // Esperar microtasks para que el effect del Router se ejecute
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    console.log('Después de flush, execCount:', execCount);
    console.log('After flush, params:', router.$params);

    expect(execCount).toBe(2);
    expect(observedId).toBe('456');
  });
});
