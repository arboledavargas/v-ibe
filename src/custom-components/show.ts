/**
 * SHOW COMPONENT - Conditional Rendering with Untracked Children
 * 
 * Este componente separa la evaluación de la condición del rendering del contenido,
 * evitando loops infinitos cuando el hijo crea dependencias reactivas que invalidarían
 * al padre.
 * 
 * Características clave:
 * - La condición `when` se evalúa CON tracking
 * - El contenido `children` se ejecuta SIN tracking (untrack)
 * - Previene loops infinitos en casos como RouteView anidados
 * - Soporta fallback para el caso false
 * 
 * Transformación JSX:
 *   <Show when={() => condition}>{() => content}</Show>
 * 
 * Compila a:
 *   Show({ when: () => condition, children: () => content })
 */

import { effect } from '../reactivity/signals/effect';
import { reactiveContext } from '../reactivity/reactive-context';

/**
 * Props del componente Show
 */
export interface ShowProps {
  /**
   * Condición reactiva a evaluar.
   * Debe ser una función que retorne boolean.
   * Esta función SE TRACKEA - cambios en sus dependencias re-evalúan el Show.
   */
  when: () => boolean;
  
  /**
   * Contenido a renderizar cuando la condición es true.
   * Debe ser una función que retorne el contenido.
   * Esta función NO SE TRACKEA - previene loops infinitos.
   */
  children: () => any;
  
  /**
   * Contenido a mostrar cuando la condición es false.
   * Opcional. También se ejecuta sin tracking.
   */
  fallback?: () => any;
}

/**
 * Show - Helper para rendering condicional sin loops
 * 
 * @example Prevenir loop en RouteView
 * ```tsx
 * @Component
 * class RouteView extends BaseComponent {
 *   @Resource(...)
 *   componentClass!: IResource<any>;
 *   
 *   view() {
 *     return (
 *       <>
 *         <Show when={() => this.componentClass.state === 'pending'}>
 *           {() => <div>Loading...</div>}
 *         </Show>
 *         
 *         <Show when={() => this.componentClass.state === 'ready'}>
 *           {() => this.jsx(this.componentClass.get(), {})}
 *         </Show>
 *       </>
 *     );
 *   }
 * }
 * ```
 * 
 * @example Con fallback
 * ```tsx
 * <Show 
 *   when={() => this.user.isLoggedIn}
 *   fallback={() => <LoginButton />}
 * >
 *   {() => <UserProfile user={this.user} />}
 * </Show>
 * ```
 */

export function Show(props: ShowProps): DocumentFragment {
  const container = document.createDocumentFragment();
  const anchor = document.createComment('show');
  container.appendChild(anchor);

  let currentNode: Node | null = null;
  let currentBranch: 'truthy' | 'falsy' | 'empty' = 'empty';

  effect(() => {
    // Verificar si el anchor sigue en el DOM
    // Si el componente padre fue removido, el anchor no tendrá parentNode
    if (!anchor.parentNode) {
      return;
    }
    
    // PASO 1: Evaluar condición CON tracking
    // props.when() debe retornar un boolean directamente
    const condition = Boolean(props.when());
    
    // PASO 2: Decidir qué branch renderizar (condition ya es boolean)
    const shouldShowTruthy = condition;
    const shouldShowFalsy = !shouldShowTruthy && props.fallback;
    
    // PASO 3: Renderizar el branch apropiado SIN tracking
    if (shouldShowTruthy) {
      if (currentBranch === 'truthy') {
        return;
      }
      
      // Limpiar el nodo anterior primero para evitar acumulación
      if (currentNode) {
        anchor.parentNode?.removeChild(currentNode);
      }
      
      // Ejecutar children SIN tracking para evitar dependencias en el effect padre
      const content = reactiveContext.untrack(() => props.children());
      const newNode = elementToNode(content);
      
      // Insertar el nuevo nodo después del anchor
      anchor.parentNode?.insertBefore(newNode, anchor.nextSibling);
      currentNode = newNode;
      currentBranch = 'truthy';
      
    } else if (shouldShowFalsy) {
      if (currentBranch === 'falsy') {
        // Ya estamos mostrando el fallback, no hacer nada
        return;
      }
      
      // Limpiar el nodo anterior primero
      if (currentNode) {
        anchor.parentNode?.removeChild(currentNode);
      }
      
      // Ejecutar fallback SIN tracking
      const content = reactiveContext.untrack(() => props.fallback!());
      const newNode = elementToNode(content);
      
      // Insertar el nuevo nodo después del anchor
      anchor.parentNode?.insertBefore(newNode, anchor.nextSibling);
      currentNode = newNode;
      currentBranch = 'falsy';
      
    } else {
      // No mostrar nada
      if (currentBranch === 'empty') {
        return;
      }
      
      if (currentNode) {
        currentNode.parentNode?.removeChild(currentNode);
        currentNode = null;
      }
      currentBranch = 'empty';
    }
  });
  
  return container;
}

/**
 * Convierte un elemento JSX a nodo DOM
 */
function elementToNode(element: any): Node {
  if (element == null || typeof element === 'boolean') {
    return document.createTextNode('');
  }
  
  if (typeof element === 'string' || typeof element === 'number') {
    return document.createTextNode(String(element));
  }
  
  if (element instanceof Node) {
    return element;
  }
  
  // Si es una función (factory), ejecutarla
  if (typeof element === 'function') {
    const result = element();
    return elementToNode(result); // Recursivo
  }
  
  // DocumentFragment
  if (element instanceof DocumentFragment) {
    // Si el fragment tiene un solo hijo, retornar ese hijo directamente
    if (element.childNodes.length === 1) {
      const child = element.firstChild!;
      // Remover del fragment para evitar que se pierda
      element.removeChild(child);
      return child;
    }
    
    // Si tiene múltiples hijos, crear un wrapper
    const wrapper = document.createElement('span');
    wrapper.style.display = 'contents'; // El wrapper no afecta el layout
    // Mover todos los nodos del fragment al wrapper
    while (element.firstChild) {
      wrapper.appendChild(element.firstChild);
    }
    return wrapper;
  }
  
  // JSX element object - debería tener props y type
  if (element && typeof element === 'object') {
    console.warn('[Show] Received unknown object type:', element);
    return document.createTextNode(JSON.stringify(element));
  }
  
  return document.createTextNode('');
}

/**
 * Reemplaza un nodo en el DOM
 */
function replaceNode(
  anchor: Comment,
  oldNode: Node | null,
  newNode: Node
): void {
  if (oldNode) {
    anchor.parentNode?.replaceChild(newNode, oldNode);
  } else {
    anchor.parentNode?.insertBefore(newNode, anchor.nextSibling);
  }
}
