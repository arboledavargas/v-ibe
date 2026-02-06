/**
 * Test de debug simplificado
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '../../components/decorators/component';
import { BaseComponent } from '../../components/base-component';
import { Resource } from '../../reactivity/decorators/resource';
import { Computed } from '../../reactivity/decorators/computed';
import { IResource } from '../../reactivity/signals/resource';
import { phaseScheduler } from '../../reactivity/phase-scheduler';
import { Fragment } from '../../jsx/types';
import { Show } from '../../custom-components/show';

let mockRouteCandidates: any[][] = [
  [{ id: 'app', path: '/', loader: async () => ({ default: SimpleApp }) }],
  [], // L1 no tiene candidatos
];

@Component()
class SimpleApp extends BaseComponent {
  view() {
    console.log('[SimpleApp] view() called');
    return this.jsxs(Fragment, {
      children: [
        this.jsx('div', { className: 'app-content', children: 'App Content' }),
        this.jsx(RouteViewL1, {}),
      ]
    });
  }
}

@Component()
class RouteViewL1 extends BaseComponent {
  @Computed
  get levelCandidates() {
    return mockRouteCandidates[1] || [];
  }

  @Resource(async function(this: RouteViewL1) {
    console.log('[RouteViewL1] Resource executing');
    const candidates = this.levelCandidates;
    console.log('[RouteViewL1] candidates.length:', candidates.length);
    if (candidates.length === 0) {
      console.log('[RouteViewL1] No candidates, returning null');
      return null;
    }
    return null;
  })
  componentClass!: IResource<any>;

  view() {
    const state = this.componentClass.state;
    console.log(`[RouteViewL1] view() - state=${state}`);
    
    return this.jsxs(Fragment, {
      children: [
        Show({
          when: () => {
            const result = this.componentClass.state === 'pending';
            return result;
          },
          children: () => {
            console.log('[RouteViewL1] Rendering PENDING');
            return this.jsx('div', { className: 'l1-pending', children: 'Loading L1...' });
          }
        }),
        Show({
          when: () => this.componentClass.state === 'ready',
          children: () => {
            console.log('[RouteViewL1] Rendering READY');
            const value = this.componentClass.get();
            if (value) return this.jsx(value, {});
            return this.jsx('div', { className: 'l1-empty', children: '(empty)' });
          }
        }),
      ]
    });
  }
}

@Component()
class RouteViewL0 extends BaseComponent {
  @Computed
  get levelCandidates() {
    return mockRouteCandidates[0] || [];
  }

  @Resource(async function(this: RouteViewL0) {
    console.log('[RouteViewL0] Resource executing');
    const candidates = this.levelCandidates;
    if (candidates.length === 0) return null;
    await new Promise(r => setTimeout(r, 10));
    return candidates[0].loader().then(m => m.default);
  })
  componentClass!: IResource<any>;

  view() {
    return this.jsxs(Fragment, {
      children: [
        Show({
          when: () => this.componentClass.state === 'ready',
          children: () => {
            const Comp = this.componentClass.get();
            console.log('[RouteViewL0] Ready branch - component:', Comp?.name);
            if (Comp) return this.jsx(Comp, {});
            return null;
          }
        }),
      ]
    });
  }
}

describe('Debug RouteView', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // @ts-ignore
    phaseScheduler.dirtyEffects?.clear?.();
    // @ts-ignore
    phaseScheduler.isFlushScheduled = false;
    
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('debug nested routeview', async () => {
    console.log('\n=== STARTING DEBUG TEST ===\n');
    
    // Crear componente
    const l0 = new RouteViewL0();
    container.appendChild(l0);
    
    console.log('After append - container HTML:', container.innerHTML);
    
    // Esperar inicialización
    await new Promise(r => setTimeout(r, 50));
    phaseScheduler.flush();
    
    console.log('After init - container HTML:', container.innerHTML);
    console.log('L0 shadowRoot:', l0.shadowRoot?.innerHTML?.substring(0, 500));
    
    // Esperar a que L0 cargue
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 30));
      phaseScheduler.flush();
    }
    
    console.log('\nAfter L0 load - container HTML:', container.innerHTML);
    console.log('L0 shadowRoot:', l0.shadowRoot?.innerHTML?.substring(0, 1000));
    
    // Buscar L1
    const l1 = l0.shadowRoot?.querySelector('use-route-view-l1') as any;
    console.log('L1 element:', l1);
    console.log('L1 shadowRoot:', l1?.shadowRoot?.innerHTML?.substring(0, 1000));
    
    // Verificar DOM
    const pending = l1?.shadowRoot?.querySelector('.l1-pending');
    const empty = l1?.shadowRoot?.querySelector('.l1-empty');
    
    console.log('\n=== RESULTS ===');
    console.log('Pending element:', pending?.textContent || 'NOT FOUND');
    console.log('Empty element:', empty?.textContent || 'NOT FOUND');
    
    document.body.innerHTML = '';
    
    // El test pasa si encontramos el empty
    expect(empty).not.toBeNull();
  });
});
