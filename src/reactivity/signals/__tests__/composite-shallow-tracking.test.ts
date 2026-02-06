import { describe, it, expect, beforeEach } from 'vitest';
import { CompositeSignal } from '../composite';
import { effect } from '../effect';
import { phaseScheduler } from '../../phase-scheduler';
import { reactiveContext } from '../../reactive-context';
import { createObjectProxy } from '../reactive-proxy';

describe('CompositeSignal - Shallow Tracking', () => {
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
  });

  it('Object.keys() debe trackear shallow (cualquier cambio)', () => {
    const composite = new CompositeSignal({ name: 'Julian', age: 30 });
    const proxy = createObjectProxy(composite);

    let execCount = 0;
    let keys: string[] = [];

    effect(() => {
      execCount++;
      keys = Object.keys(proxy);
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);
    expect(keys).toEqual(['name', 'age']);

    // Cambiar una propiedad existente
    proxy.name = 'María';
    phaseScheduler.flush();

    expect(execCount).toBe(2);
    expect(keys).toEqual(['name', 'age']);

    // Cambiar otra propiedad
    proxy.age = 25;
    phaseScheduler.flush();

    expect(execCount).toBe(3);
  });

  it('for...in debe trackear shallow', () => {
    const composite = new CompositeSignal({ a: 1, b: 2 });
    const proxy = createObjectProxy(composite);

    let execCount = 0;
    let collected: string[] = [];

    effect(() => {
      execCount++;
      collected = [];
      for (const key in proxy) {
        collected.push(key);
      }
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);
    expect(collected).toEqual(['a', 'b']);

    // Cambiar valor
    proxy.a = 10;
    phaseScheduler.flush();

    expect(execCount).toBe(2);
  });

  it('Acceso directo al objeto NO debe trackear', () => {
    const composite = new CompositeSignal({ x: 1 });
    const proxy = createObjectProxy(composite);

    let execCount = 0;

    effect(() => {
      execCount++;
      // Solo leer el proxy, no acceder a ninguna propiedad ni iterar
      const _ = proxy;
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);

    // Cambiar una propiedad
    proxy.x = 2;
    phaseScheduler.flush();

    // NO debe ejecutarse porque no se trackeó nada
    expect(execCount).toBe(1);
  });

  it('Acceso a propiedad específica solo trackea esa propiedad', () => {
    const composite = new CompositeSignal({ name: 'Julian', age: 30 });
    const proxy = createObjectProxy(composite);

    let nameCount = 0;

    effect(() => {
      nameCount++;
      const _ = proxy.name;  // Solo trackea 'name'
    }, { priority: 'Sync' });

    expect(nameCount).toBe(1);

    // Cambiar 'age' (no debe notificar)
    proxy.age = 25;
    phaseScheduler.flush();

    expect(nameCount).toBe(1);

    // Cambiar 'name' (debe notificar)
    proxy.name = 'María';
    phaseScheduler.flush();

    expect(nameCount).toBe(2);
  });

  it('Shallow tracking y property tracking pueden coexistir', () => {
    const composite = new CompositeSignal({ a: 1, b: 2 });
    const proxy = createObjectProxy(composite);

    let shallowCount = 0;
    let propertyCount = 0;

    // Effect con shallow tracking (Object.keys)
    effect(() => {
      shallowCount++;
      Object.keys(proxy);
    }, { priority: 'Sync' });

    // Effect con property tracking específico
    effect(() => {
      propertyCount++;
      const _ = proxy.a;
    }, { priority: 'Sync' });

    expect(shallowCount).toBe(1);
    expect(propertyCount).toBe(1);

    // Cambiar 'a' → ambos se ejecutan
    proxy.a = 10;
    phaseScheduler.flush();

    expect(shallowCount).toBe(2);
    expect(propertyCount).toBe(2);

    // Cambiar 'b' → solo shallow se ejecuta
    proxy.b = 20;
    phaseScheduler.flush();

    expect(shallowCount).toBe(3);
    expect(propertyCount).toBe(2);  // No cambió
  });

  it('No debe notificar si el valor no cambia realmente', () => {
    const composite = new CompositeSignal({ value: 100 });
    const proxy = createObjectProxy(composite);

    let execCount = 0;

    effect(() => {
      execCount++;
      Object.keys(proxy);
    }, { priority: 'Sync' });

    expect(execCount).toBe(1);

    // Asignar el mismo valor
    proxy.value = 100;
    phaseScheduler.flush();

    // NO debe ejecutarse
    expect(execCount).toBe(1);
  });

  it('Múltiples shallow subscribers deben ejecutarse todos', () => {
    const composite = new CompositeSignal({ count: 0 });
    const proxy = createObjectProxy(composite);

    let effect1Count = 0;
    let effect2Count = 0;
    let effect3Count = 0;

    effect(() => {
      effect1Count++;
      Object.keys(proxy);
    }, { priority: 'Sync' });

    effect(() => {
      effect2Count++;
      for (const _ in proxy) {}
    }, { priority: 'Sync' });

    effect(() => {
      effect3Count++;
      Object.keys(proxy);
    }, { priority: 'Sync' });

    expect(effect1Count).toBe(1);
    expect(effect2Count).toBe(1);
    expect(effect3Count).toBe(1);

    proxy.count = 1;
    phaseScheduler.flush();

    expect(effect1Count).toBe(2);
    expect(effect2Count).toBe(2);
    expect(effect3Count).toBe(2);
  });
});
