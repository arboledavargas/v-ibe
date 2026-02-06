import { describe, it, expect } from 'vitest';
import { Component } from '../../components/decorators/component';
import { BaseComponent } from '../../components/base-component';
import { Resource } from '../../reactivity/decorators/resource';
import { IResource } from '../../reactivity/signals/resource';
import { Fragment } from '../../jsx/types';
import { Show } from '../../custom-components/show';

@Component()
class ChildComponent extends BaseComponent {
  @Resource(async () => null)
  data!: IResource<any>;

  view() {
    const self = this;
    console.log('[Child] view() - this.constructor.name:', this.constructor.name);
    console.log('[Child] view() - this === self:', this === self);
    
    return this.jsxs(Fragment, {
      children: [
        Show({
          when: () => this.data.state === 'ready',
          children: () => {
            console.log('[Child] Show ready children - this.constructor.name:', this.constructor.name);
            console.log('[Child] Show ready children - this === self:', this === self);
            console.log('[Child] this.data.get():', this.data.get());
            return this.jsx('div', { className: 'child-ready', children: 'Child Ready' });
          }
        }),
      ]
    });
  }
}

@Component()
class ParentComponent extends BaseComponent {
  @Resource(async () => ChildComponent)
  componentClass!: IResource<any>;

  view() {
    const self = this;
    console.log('[Parent] view() - this.constructor.name:', this.constructor.name);
    
    return this.jsxs(Fragment, {
      children: [
        Show({
          when: () => this.componentClass.state === 'ready',
          children: () => {
            console.log('[Parent] Show ready children - this.constructor.name:', this.constructor.name);
            console.log('[Parent] this.componentClass.get():', this.componentClass.get());
            const Comp = this.componentClass.get();
            if (Comp) return this.jsx(Comp, {});
            return null;
          }
        }),
      ]
    });
  }
}

describe('This binding test', () => {
  it('should have correct this in Show children', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    const parent = new ParentComponent();
    container.appendChild(parent);
    
    await new Promise(r => setTimeout(r, 100));
    
    console.log('\n=== FINAL DOM ===');
    console.log('Container:', container.innerHTML);
    console.log('Parent shadowRoot:', parent.shadowRoot?.innerHTML);
    
    const child = parent.shadowRoot?.querySelector('use-child-component') as any;
    console.log('Child shadowRoot:', child?.shadowRoot?.innerHTML);
    
    document.body.innerHTML = '';
  });
});
