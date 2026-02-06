import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '../router';
import { Trie } from '../trie';
import { PolicyEvaluator } from '../policy-evaluator';
import { effect } from '../../reactivity/signals/effect';
import { phaseScheduler } from '../../reactivity/phase-scheduler';
import { reactiveContext } from '../../reactivity/reactive-context';

describe('Router - Query Params Test', () => {
  let router: Router;
  let trie: Trie;

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
      location: {
        pathname: '/',
        search: '',
        origin: 'http://localhost'
      },
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
  });

  it('debe tener queryParams como objeto reactivo', () => {
    expect(router.$queryParams).toBeDefined();
    expect(typeof router.$queryParams).toBe('object');
  });

  it('debe inicializar queryParams vacío cuando no hay search params', async () => {
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();
    expect(router.$queryParams).toEqual({});
  });

  it('debe cargar queryParams desde la URL inicial', async () => {
    global.window.location.search = '?page=1&filter=active';
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(router.$queryParams).toEqual({
      page: '1',
      filter: 'active'
    });
  });

  it('debe actualizar queryParams cuando se navega con query string', async () => {
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();
    expect(router.$queryParams).toEqual({});

    // Simular navegación con query params
    router.navigate('/users?page=2&sort=name');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(router.$queryParams).toEqual({
      page: '2',
      sort: 'name'
    });
  });

  it('debe eliminar query params que ya no existen', async () => {
    global.window.location.search = '?page=1&filter=active';
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(router.$queryParams).toEqual({
      page: '1',
      filter: 'active'
    });

    // Navegar con solo un query param
    router.navigate('/users?page=2');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(router.$queryParams).toEqual({
      page: '2'
    });
  });

  it('debe limpiar todos los queryParams cuando se navega sin query string', async () => {
    global.window.location.search = '?page=1&filter=active';
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(router.$queryParams).toEqual({
      page: '1',
      filter: 'active'
    });

    // Navegar sin query params
    router.navigate('/users');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(router.$queryParams).toEqual({});
  });

  it('debe ser reactivo con effects', async () => {
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));

    let execCount = 0;
    let observedPage = '';

    const eff = effect(() => {
      execCount++;
      observedPage = router.$queryParams.page || '';
      console.log(`Effect ejecutado #${execCount}, observedPage:`, observedPage);
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);
    expect(observedPage).toBe('');

    // Navegar con query params
    router.navigate('/users?page=3');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(execCount).toBe(2);
    expect(observedPage).toBe('3');

    // Cambiar query params
    router.navigate('/users?page=5');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(execCount).toBe(3);
    expect(observedPage).toBe('5');
  });

  it('debe trackear múltiples query params independientemente', async () => {
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));

    let pageExecCount = 0;
    let filterExecCount = 0;
    let observedPage = '';
    let observedFilter = '';

    // Effect que solo observa page
    const pageEffect = effect(() => {
      pageExecCount++;
      observedPage = router.$queryParams.page || '';
    }, { priority: 'Sync' });

    // Effect que solo observa filter
    const filterEffect = effect(() => {
      filterExecCount++;
      observedFilter = router.$queryParams.filter || '';
    }, { priority: 'Sync' });

    expect(pageExecCount).toBe(1);
    expect(filterExecCount).toBe(1);

    // Cambiar solo page
    router.navigate('/users?page=2');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(pageExecCount).toBe(2);
    expect(filterExecCount).toBe(1); // No debe ejecutarse
    expect(observedPage).toBe('2');

    // Agregar filter
    router.navigate('/users?page=2&filter=active');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(pageExecCount).toBe(2); // No cambia porque page sigue siendo 2
    expect(filterExecCount).toBe(2); // Se ejecuta por el nuevo filter
    expect(observedFilter).toBe('active');

    // Cambiar solo filter
    router.navigate('/users?page=2&filter=inactive');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(pageExecCount).toBe(2); // No cambia
    expect(filterExecCount).toBe(3); // Se ejecuta
    expect(observedFilter).toBe('inactive');
  });

  it('debe manejar params y queryParams simultáneamente', async () => {
    trie.insert('user-detail', '/users/:id', async () => ({ default: {} }), {}, [], 'default');
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));

    let execCount = 0;
    let observedId = '';
    let observedPage = '';

    const eff = effect(() => {
      execCount++;
      observedId = router.$params.id || '';
      observedPage = router.$queryParams.page || '';
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);

    // Navegar con params y query params
    router.navigate('/users/123?page=1');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(execCount).toBeGreaterThan(1);
    expect(observedId).toBe('123');
    expect(observedPage).toBe('1');
  });

  it('no debe crear loops infinitos al actualizar queryParams', async () => {
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));

    let execCount = 0;

    const eff = effect(() => {
      execCount++;
      // Leer queryParams dentro del effect
      const page = router.$queryParams.page || '';
      console.log('Reading page:', page);
    }, { priority: 'Sync' });

    const initialCount = execCount;

    // Navegar múltiples veces
    for (let i = 1; i <= 5; i++) {
      router.navigate(`/users?page=${i}`);
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
      await new Promise(resolve => setTimeout(resolve, 0));
      phaseScheduler.flush();
    }

    // Debe ejecutarse una vez por cada cambio + la inicial
    expect(execCount).toBe(initialCount + 5);
  });

  it('debe manejar popstate event con query params', async () => {
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    // Obtener el listener registrado
    const addEventListener = global.window.addEventListener as any;
    const popstateHandler = addEventListener.mock.calls.find(
      (call: any) => call[0] === 'popstate'
    )?.[1];

    expect(popstateHandler).toBeDefined();

    // Simular cambio de URL y popstate
    global.window.location.search = '?page=10';
    global.window.location.pathname = '/users';

    popstateHandler();
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(router.currentPath).toBe('/users');
    expect(router.$queryParams.page).toBe('10');
  });

  it('debe manejar caracteres especiales en query params', async () => {
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));

    const specialValue = 'hello world & test=value';
    const encoded = encodeURIComponent(specialValue);

    router.navigate(`/users?search=${encoded}`);
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    expect(router.$queryParams.search).toBe(specialValue);
  });

  it('debe manejar múltiples valores para el mismo query param (toma el último)', async () => {
    await router.onBootstrap();
    await new Promise(resolve => setTimeout(resolve, 0));

    // URLSearchParams.forEach() itera sobre todos los valores, el último sobrescribe
    router.navigate('/users?tag=javascript&tag=typescript');
    await new Promise(resolve => setTimeout(resolve, 0));
    phaseScheduler.flush();

    // Como usamos forEach, el último valor sobrescribe al primero
    expect(router.$queryParams.tag).toBe('typescript');
  });
});
