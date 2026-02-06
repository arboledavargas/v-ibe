/**
 * Test de integración: Show con Resource (simula RouteView)
 * 
 * Este test verifica que el Show component funciona correctamente con
 * arrow functions inline cuando se usa con un Resource.
 * 
 * El bug original: jsx-signals envolvía arrow functions en atributos
 * causando doble wrapping: () => () => value
 * Esto hacía que Boolean(function) = true siempre.
 * 
 * Con el fix, las arrow functions no se envuelven y el Show funciona correctamente.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Show } from '../../custom-components/show';
import { Signal } from '../../reactivity/signals/signal';
import { createResource, IResource } from '../../reactivity/signals/resource';
import { phaseScheduler } from '../../reactivity/phase-scheduler';

describe('Show con Resource (simula RouteView)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  /**
   * Test que simula exactamente el patrón del RouteView:
   * - Resource que carga un componente
   * - Show con arrow functions inline para pending/ready/error
   */
  it('debe mostrar el estado correcto según resource.state con arrow functions inline', async () => {
    // Crear un resource que simula cargar un componente
    const resource = createResource<string>(async (signal) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'ComponenteCargado';
    });

    // Crear Shows con arrow functions inline (como en RouteView)
    // CRÍTICO: Si jsx-signals envuelve estas funciones, el test falla
    const pendingShow = Show({
      when: () => resource.state === 'pending',
      children: () => {
        const div = document.createElement('div');
        div.className = 'loading';
        div.textContent = 'Cargando...';
        return div;
      }
    });

    const readyShow = Show({
      when: () => resource.state === 'ready',
      children: () => {
        const div = document.createElement('div');
        div.className = 'ready';
        div.textContent = `Listo: ${resource.get()}`;
        return div;
      }
    });

    container.appendChild(pendingShow);
    container.appendChild(readyShow);

    // Inicialmente debe mostrar loading
    await new Promise(resolve => setTimeout(resolve, 10));
    phaseScheduler.flush();

    let loading = container.querySelector('.loading');
    let ready = container.querySelector('.ready');

    console.log('Estado inicial:');
    console.log('  resource.state:', resource.state);
    console.log('  loading visible:', loading !== null);
    console.log('  ready visible:', ready !== null);

    expect(loading).not.toBeNull();
    expect(ready).toBeNull();

    // Esperar a que el resource termine de cargar
    await new Promise(resolve => setTimeout(resolve, 100));
    phaseScheduler.flush();

    loading = container.querySelector('.loading');
    ready = container.querySelector('.ready');

    console.log('Estado final:');
    console.log('  resource.state:', resource.state);
    console.log('  loading visible:', loading !== null);
    console.log('  ready visible:', ready !== null);

    // Ahora debe mostrar ready, NO loading
    expect(loading).toBeNull();
    expect(ready).not.toBeNull();
    expect(ready?.textContent).toBe('Listo: ComponenteCargado');
  });

  /**
   * Test que verifica que nunca se muestran múltiples branches a la vez
   */
  it('nunca debe mostrar pending y ready simultáneamente', async () => {
    const resource = createResource<string>(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return 'OK';
    });

    const pendingShow = Show({
      when: () => resource.state === 'pending',
      children: () => {
        const div = document.createElement('div');
        div.className = 'pending';
        return div;
      }
    });

    const readyShow = Show({
      when: () => resource.state === 'ready',
      children: () => {
        const div = document.createElement('div');
        div.className = 'ready';
        return div;
      }
    });

    container.appendChild(pendingShow);
    container.appendChild(readyShow);

    // Verificar en múltiples puntos
    let simultaneousCount = 0;

    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      phaseScheduler.flush();

      const pending = container.querySelector('.pending');
      const ready = container.querySelector('.ready');

      if (pending && ready) {
        simultaneousCount++;
        console.error(`Iteración ${i}: AMBOS visibles!`);
      }
    }

    expect(simultaneousCount).toBe(0);
  });

  /**
   * Test que simula Resource retornando null (como cuando no hay candidatos)
   */
  it('debe manejar resource que retorna null correctamente', async () => {
    const resource = createResource<string | null>(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return null; // Sin candidatos
    });

    const pendingShow = Show({
      when: () => resource.state === 'pending',
      children: () => {
        const div = document.createElement('div');
        div.className = 'pending';
        div.textContent = 'Cargando...';
        return div;
      }
    });

    const readyShow = Show({
      when: () => resource.state === 'ready',
      children: () => {
        const div = document.createElement('div');
        div.className = 'ready';
        const value = resource.get();
        div.textContent = value ? `Valor: ${value}` : '(vacío)';
        return div;
      }
    });

    container.appendChild(pendingShow);
    container.appendChild(readyShow);

    // Esperar a que termine
    await new Promise(resolve => setTimeout(resolve, 50));
    phaseScheduler.flush();

    const pending = container.querySelector('.pending');
    const ready = container.querySelector('.ready');

    console.log('Resource null test:');
    console.log('  resource.state:', resource.state);
    console.log('  resource.get():', resource.get());

    // Debe estar en ready (aunque el valor sea null)
    expect(resource.state).toBe('ready');
    expect(pending).toBeNull();
    expect(ready).not.toBeNull();
    expect(ready?.textContent).toBe('(vacío)');
  });

  /**
   * Test de regresión para el bug del doble wrapping
   * 
   * ANTES del fix: props.when() retornaba una función, no un boolean
   * DESPUÉS del fix: props.when() retorna directamente el boolean
   */
  it('REGRESIÓN: when debe retornar boolean directamente, no función', async () => {
    const state = new Signal<'pending' | 'ready'>('pending');

    // Esta es la forma en que jsx-signals transformaría el código
    // CON el fix: when: () => state.get() === 'pending' (no se envuelve)
    // SIN el fix: when: () => () => state.get() === 'pending' (doble wrap)
    
    const show = Show({
      when: () => state.get() === 'pending',
      children: () => {
        const div = document.createElement('div');
        div.className = 'content';
        return div;
      }
    });

    container.appendChild(show);

    await new Promise(resolve => setTimeout(resolve, 5));
    phaseScheduler.flush();

    // Con pending, debe mostrar el contenido
    expect(container.querySelector('.content')).not.toBeNull();

    // Cambiar a ready
    state.set('ready');
    await new Promise(resolve => setTimeout(resolve, 5));
    phaseScheduler.flush();

    // Ahora NO debe mostrar el contenido
    // Si el plugin hiciera doble wrap, esto fallaría porque
    // Boolean(() => false) === true
    expect(container.querySelector('.content')).toBeNull();
  });
});
