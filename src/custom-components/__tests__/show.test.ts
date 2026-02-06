import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Show } from '../show';
import { Signal } from '../../reactivity/signals/signal';
import { effect } from '../../reactivity/signals/effect';

describe('Show Component', () => {
  let container: HTMLElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    document.body.removeChild(container);
  });
  
  it('debe renderizar children cuando when es true', () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        const div = document.createElement('div');
        div.textContent = 'Contenido visible';
        return div;
      }
    });
    
    container.appendChild(fragment);
    
    // Debe haber un comment anchor + el div
    expect(container.childNodes.length).toBe(2);
    expect(container.querySelector('div')?.textContent).toBe('Contenido visible');
  });
  
  it('debe no renderizar children cuando when es false', () => {
    const condition = new Signal(false);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        const div = document.createElement('div');
        div.textContent = 'No debería aparecer';
        return div;
      }
    });
    
    container.appendChild(fragment);
    
    // Solo el comment anchor
    expect(container.childNodes.length).toBe(1);
    expect(container.querySelector('div')).toBeNull();
  });
  
  it('debe renderizar fallback cuando when es false', () => {
    const condition = new Signal(false);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        const div = document.createElement('div');
        div.textContent = 'Truthy';
        return div;
      },
      fallback: () => {
        const div = document.createElement('div');
        div.textContent = 'Falsy';
        return div;
      }
    });
    
    container.appendChild(fragment);
    
    expect(container.querySelector('div')?.textContent).toBe('Falsy');
  });
  
  it('debe cambiar de truthy a falsy reactivamente', async () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        const div = document.createElement('div');
        div.textContent = 'Truthy';
        return div;
      },
      fallback: () => {
        const div = document.createElement('div');
        div.textContent = 'Falsy';
        return div;
      }
    });
    
    container.appendChild(fragment);
    
    // Inicialmente truthy
    expect(container.querySelector('div')?.textContent).toBe('Truthy');
    
    // Cambiar a falsy
    condition.set(false);
    
    // Esperar microtasks
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Ahora debe mostrar fallback
    expect(container.querySelector('div')?.textContent).toBe('Falsy');
  });
  
  it('NO debe trackear dependencias dentro de children (previene loops)', async () => {
    const condition = new Signal(true);
    const innerSignal = new Signal(0);
    
    let effectRuns = 0;
    let childrenRuns = 0;
    
    const fragment = Show({
      when: () => {
        effectRuns++;
        return condition.get();
      },
      children: () => {
        childrenRuns++;
        // Esta lectura NO debe causar re-ejecución del effect de Show
        const value = innerSignal.get();
        const div = document.createElement('div');
        div.textContent = `Value: ${value}`;
        return div;
      }
    });
    
    container.appendChild(fragment);
    
    // Primer render
    expect(effectRuns).toBe(1);
    expect(childrenRuns).toBe(1);
    expect(container.querySelector('div')?.textContent).toBe('Value: 0');
    
    // Cambiar innerSignal - NO debe causar re-ejecución del effect de Show
    innerSignal.set(42);
    
    // Esperar microtasks
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // El effect de Show NO debe re-ejecutarse
    expect(effectRuns).toBe(1); // Sin cambios
    expect(childrenRuns).toBe(1); // Sin cambios
    
    // Cambiar condition - SÍ debe causar re-ejecución
    condition.set(false);
    
    // Esperar microtasks
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(effectRuns).toBe(2); // Re-ejecutado por cambio en condition
    
    condition.set(true);
    
    // Esperar microtasks
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(effectRuns).toBe(3); // Re-ejecutado nuevamente
    expect(childrenRuns).toBe(2); // Children se ejecuta de nuevo al volver a true
  });
  
  it('debe manejar funciones que retornan primitivos', () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => 'Hello World'
    });
    
    container.appendChild(fragment);
    
    // Debe crear un text node
    const textContent = Array.from(container.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join('');
    
    expect(textContent).toContain('Hello World');
  });
  
  it('debe manejar null/undefined sin errores', () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => null
    });
    
    container.appendChild(fragment);
    
    // El anchor comment + un text node vacío
    expect(container.childNodes.length).toBe(2);
  });
  
  it('debe manejar números', () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => 42
    });
    
    container.appendChild(fragment);
    
    const textContent = Array.from(container.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join('');
    
    expect(textContent).toContain('42');
  });
  
  it('debe manejar DocumentFragments con múltiples hijos', () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        const frag = document.createDocumentFragment();
        const span1 = document.createElement('span');
        span1.textContent = 'First';
        const span2 = document.createElement('span');
        span2.textContent = 'Second';
        frag.appendChild(span1);
        frag.appendChild(span2);
        return frag;
      }
    });
    
    container.appendChild(fragment);
    
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe('First');
    expect(spans[1].textContent).toBe('Second');
  });
  
  it('debe manejar DocumentFragments con un solo hijo', () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        const frag = document.createDocumentFragment();
        const div = document.createElement('div');
        div.textContent = 'Single';
        frag.appendChild(div);
        return frag;
      }
    });
    
    container.appendChild(fragment);
    
    expect(container.querySelector('div')?.textContent).toBe('Single');
  });
  
  it('debe manejar funciones factory (funciones que retornan funciones)', () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        // Factory: función que retorna otra función
        return () => {
          const div = document.createElement('div');
          div.textContent = 'Factory result';
          return div;
        };
      }
    });
    
    container.appendChild(fragment);
    
    expect(container.querySelector('div')?.textContent).toBe('Factory result');
  });
  
  it('debe cambiar de empty a truthy', async () => {
    const condition = new Signal(false);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        const div = document.createElement('div');
        div.textContent = 'Now visible';
        return div;
      }
    });
    
    container.appendChild(fragment);
    
    // Inicialmente vacío
    expect(container.querySelector('div')).toBeNull();
    
    // Cambiar a true
    condition.set(true);
    
    // Esperar microtasks
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Ahora debe estar visible
    expect(container.querySelector('div')?.textContent).toBe('Now visible');
  });
  
  it('debe cambiar de truthy a empty (sin fallback)', async () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        const div = document.createElement('div');
        div.textContent = 'Visible';
        return div;
      }
    });
    
    container.appendChild(fragment);
    
    // Inicialmente visible
    expect(container.querySelector('div')?.textContent).toBe('Visible');
    
    // Cambiar a false
    condition.set(false);
    
    // Esperar microtasks
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Ahora debe estar vacío
    expect(container.querySelector('div')).toBeNull();
  });
  
  it('debe manejar cambios múltiples de estado', async () => {
    const condition = new Signal(true);
    
    const fragment = Show({
      when: () => condition.get(),
      children: () => {
        const div = document.createElement('div');
        div.textContent = 'Truthy';
        return div;
      },
      fallback: () => {
        const div = document.createElement('div');
        div.textContent = 'Falsy';
        return div;
      }
    });
    
    container.appendChild(fragment);
    
    // Estado 1: truthy
    expect(container.querySelector('div')?.textContent).toBe('Truthy');
    
    // Estado 2: falsy
    condition.set(false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(container.querySelector('div')?.textContent).toBe('Falsy');
    
    // Estado 3: truthy de nuevo
    condition.set(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(container.querySelector('div')?.textContent).toBe('Truthy');
    
    // Estado 4: falsy de nuevo
    condition.set(false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(container.querySelector('div')?.textContent).toBe('Falsy');
  });
  
  it('debe manejar booleanos directamente (deben renderizar vacío)', () => {
    const condition = new Signal(true);

    const fragment = Show({
      when: () => condition.get(),
      children: () => true // Boolean debe renderizar como vacío
    });

    container.appendChild(fragment);

    // Boolean se convierte en text node vacío
    expect(container.childNodes.length).toBe(2); // anchor + empty text node
  });

  it('debe funcionar correctamente con múltiples Shows y mismo estado (simula RouteView)', async () => {
    const state = new Signal<'pending' | 'ready' | 'error'>('pending');

    // Simular lo que hace RouteView con tres Shows (sintaxis correcta sin doble wrapping)
    const pendingShow = Show({
      when: () => state.get() === 'pending',
      children: () => {
        const div = document.createElement('div');
        div.className = 'pending';
        div.textContent = 'Cargando...';
        return div;
      }
    });

    const errorShow = Show({
      when: () => state.get() === 'error',
      children: () => {
        const div = document.createElement('div');
        div.className = 'error';
        div.textContent = 'Error';
        return div;
      }
    });

    const readyShow = Show({
      when: () => state.get() === 'ready',
      children: () => {
        const div = document.createElement('div');
        div.className = 'ready';
        div.textContent = 'Listo';
        return div;
      }
    });

    container.appendChild(pendingShow);
    container.appendChild(errorShow);
    container.appendChild(readyShow);

    // Estado pending: solo debe mostrar "Cargando..."
    expect(container.querySelector('.pending')?.textContent).toBe('Cargando...');
    expect(container.querySelector('.error')).toBeNull();
    expect(container.querySelector('.ready')).toBeNull();

    // Cambiar a ready
    state.set('ready');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(container.querySelector('.pending')).toBeNull();
    expect(container.querySelector('.error')).toBeNull();
    expect(container.querySelector('.ready')?.textContent).toBe('Listo');

    // Cambiar a error
    state.set('error');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(container.querySelector('.pending')).toBeNull();
    expect(container.querySelector('.error')?.textContent).toBe('Error');
    expect(container.querySelector('.ready')).toBeNull();
  });

  it('debe mantener tracking reactivo correctamente', async () => {
    // Este test verifica que el tracking funciona correctamente
    // cuando when() retorna boolean directamente
    const resourceState = new Signal<'pending' | 'ready' | 'error'>('pending');
    let effectExecutions = 0;

    const fragment = Show({
      when: () => {
        effectExecutions++;
        return resourceState.get() === 'pending';
      },
      children: () => {
        const div = document.createElement('div');
        div.className = 'loading';
        div.textContent = 'Cargando...';
        return div;
      }
    });

    container.appendChild(fragment);

    // Esperar que el effect se ejecute
    await new Promise(resolve => setTimeout(resolve, 0));

    // Estado inicial: pending, debe mostrar loading
    expect(container.querySelector('.loading')).not.toBeNull();
    expect(container.querySelector('.loading')?.textContent).toBe('Cargando...');

    const initialExecutions = effectExecutions;

    // CAMBIAR EL ESTADO - esto es lo que ocurre cuando el Resource termina de cargar
    resourceState.set('ready');

    // Esperar que el sistema reactivo procese el cambio
    await new Promise(resolve => setTimeout(resolve, 10));

    // VERIFICACIÓN CRÍTICA: El effect DEBE haberse re-ejecutado
    expect(effectExecutions).toBeGreaterThan(initialExecutions);

    // El loading DEBE haber desaparecido porque state ya no es 'pending'
    expect(container.querySelector('.loading')).toBeNull();
  });
});
