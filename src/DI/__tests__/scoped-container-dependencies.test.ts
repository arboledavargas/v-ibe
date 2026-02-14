import { describe, it, expect } from 'vitest';
import { ScopedContainer } from '../scoped-container';
import { Service } from '../decorators/service';
import { Inject } from '../decorators/inject';
import { getServiceMetadata } from '../service-metadata';

/**
 * Tests para verificar que ScopedContainer resuelve correctamente
 * las dependencias declaradas con @Inject via topological sort.
 *
 * REGRESION: Antes de este fix, @Inject registraba dependencias
 * en un addInitializer (que corre al instanciar), pero el topological sort
 * necesita conocerlas ANTES de instanciar. Resultado: servicios
 * se instanciaban en orden incorrecto y @Inject(Dep) fallaba con
 * "Service Dep not found in any scope".
 *
 * FIX: @Inject ahora registra dependencias en ctx.metadata al momento
 * de DEFINIR la clase (no al instanciar), y @Service las lee de ahí.
 */
describe('ScopedContainer - dependency resolution via @Inject', () => {

  it('debe descubrir dependencias de @Inject en el service metadata', () => {
    // Estas clases usan decoradores nativos de TS v5.
    // @Inject escribe en ctx.metadata al DEFINIR, @Service lee de ctx.metadata.
    @Service
    class DepA {}

    @Service
    class DepB {
      @Inject(DepA) a!: DepA;
    }

    const metaB = getServiceMetadata(DepB);
    expect(metaB).toBeDefined();
    expect(metaB!.dependencies.has(DepA)).toBe(true);
  });

  it('debe instanciar dependencias antes que dependientes (topological sort)', async () => {
    const instantiationOrder: string[] = [];

    @Service
    class Leaf {
      constructor() { instantiationOrder.push('Leaf'); }
    }

    @Service
    class Middle {
      @Inject(Leaf) leaf!: Leaf;
      constructor() { instantiationOrder.push('Middle'); }
    }

    @Service
    class Root {
      @Inject(Middle) middle!: Middle;
      @Inject(Leaf) leaf!: Leaf;
      constructor() { instantiationOrder.push('Root'); }
    }

    const container = new ScopedContainer();
    container.register(Root);
    container.register(Middle);
    container.register(Leaf);

    // Registrar dependencias desde el metadata (como hace bootstrapServicesForNode)
    const services = [Root, Middle, Leaf];
    for (const Svc of services) {
      const meta = getServiceMetadata(Svc);
      if (meta) {
        for (const dep of meta.dependencies) {
          if (services.includes(dep)) {
            container.registerDependency(Svc, dep);
          }
        }
      }
    }

    await container.bootstrap();

    // Leaf debe instanciarse primero (no tiene deps),
    // luego Middle (depende de Leaf),
    // luego Root (depende de Middle y Leaf)
    expect(instantiationOrder).toEqual(['Leaf', 'Middle', 'Root']);
  });

  it('debe resolver @Inject correctamente después del bootstrap', async () => {
    @Service
    class Database {
      name = 'TestDB';
    }

    @Service
    class UserRepo {
      @Inject(Database) db!: Database;
    }

    const container = new ScopedContainer();
    container.register(Database);
    container.register(UserRepo);

    const meta = getServiceMetadata(UserRepo);
    if (meta) {
      for (const dep of meta.dependencies) {
        if ([Database, UserRepo].includes(dep as any)) {
          container.registerDependency(UserRepo, dep);
        }
      }
    }

    await container.bootstrap();

    const repo = container.get(UserRepo);
    expect(repo).toBeDefined();
    // @Inject(Database) debe resolver del mismo container
    expect(repo.db).toBeDefined();
    expect(repo.db.name).toBe('TestDB');
    // Debe ser la misma instancia (singleton dentro del scope)
    expect(repo.db).toBe(container.get(Database));
  });

  it('debe resolver dependencias cross-scope via parent chain', async () => {
    @Service
    class CoreService {
      value = 42;
    }

    @Service
    class ChildService {
      @Inject(CoreService) core!: CoreService;
    }

    // Parent container tiene CoreService
    const parent = new ScopedContainer();
    parent.register(CoreService);
    await parent.bootstrap();

    // Child container tiene ChildService, con parent chain al parent
    const child = new ScopedContainer(parent);
    child.register(ChildService);
    // CoreService NO está en child, así que no se registra como dependencia local
    // Se resolverá via parent chain en get()
    await child.bootstrap();

    const svc = child.get(ChildService);
    expect(svc.core).toBeDefined();
    expect(svc.core.value).toBe(42);
    // Debe ser la misma instancia del parent
    expect(svc.core).toBe(parent.get(CoreService));
  });

  it('bootstrapSync debe funcionar igual que bootstrap para topological sort', () => {
    const order: string[] = [];

    @Service
    class Alpha {
      constructor() { order.push('Alpha'); }
    }

    @Service
    class Beta {
      @Inject(Alpha) alpha!: Alpha;
      constructor() { order.push('Beta'); }
    }

    const container = new ScopedContainer();
    container.register(Alpha);
    container.register(Beta);

    const meta = getServiceMetadata(Beta);
    if (meta) {
      for (const dep of meta.dependencies) {
        if ([Alpha, Beta].includes(dep as any)) {
          container.registerDependency(Beta, dep);
        }
      }
    }

    container.bootstrapSync();

    expect(order).toEqual(['Alpha', 'Beta']);
    expect(container.get(Beta).alpha).toBe(container.get(Alpha));
  });

  it('debe registrar dependencias sin importar el orden del array de services', async () => {
    // REGRESION: bootstrapServicesForNode hacía register + registerDependency
    // en un solo loop. Si Router aparecía antes que Trie en el array,
    // registerDependency(Router, Trie) fallaba con
    // "Cannot register dependency: Trie is not registered in this scope"
    // porque Trie aún no había sido registrado.
    //
    // FIX: separar en dos loops — primero registrar todos, luego dependencias.

    @Service
    class Trie {
      name = 'Trie';
    }

    @Service
    class RouterSvc {
      @Inject(Trie) trie!: Trie;
    }

    // Simular el orden que causaba el bug: dependiente ANTES que dependencia
    const services = [RouterSvc, Trie];

    const container = new ScopedContainer();

    // Primer loop: registrar todos
    for (const Svc of services) {
      container.register(Svc);
    }

    // Segundo loop: registrar dependencias (NO debe lanzar error)
    for (const Svc of services) {
      const meta = getServiceMetadata(Svc);
      if (meta) {
        for (const dep of meta.dependencies) {
          if (services.includes(dep)) {
            container.registerDependency(Svc, dep);
          }
        }
      }
    }

    await container.bootstrap();

    // Trie debe haberse instanciado antes que RouterSvc
    const router = container.get(RouterSvc);
    expect(router.trie).toBeDefined();
    expect(router.trie.name).toBe('Trie');
    expect(router.trie).toBe(container.get(Trie));
  });

  it('debe detectar dependencias circulares', async () => {
    // Simular dependencias circulares registrando manualmente
    // (no podemos usar @Inject(Y) antes de que Y exista en JS)
    @Service
    class X {}

    @Service
    class Y {}

    const container = new ScopedContainer();
    container.register(X);
    container.register(Y);

    // Registrar dependencia circular manualmente: X → Y → X
    container.registerDependency(X, Y);
    container.registerDependency(Y, X);

    await expect(container.bootstrap()).rejects.toThrow(/Circular dependency/);
  });
});
