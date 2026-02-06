import { Behavior, Host, ComponentHost } from '../behaviors/decorators';
import { Prop } from '../components/decorators/prop';
import { Inject } from '../DI/decorators/inject';
import { Router } from './router';
import { Effect } from '../reactivity/decorators/effect';
import { Computed } from '../reactivity/decorators/computed';
import { BaseComponent } from '../components/base-component';

/**
 * Link Behavior
 * 
 * Convierte un <a> en un link de navegación SPA que usa el Router interno.
 * También maneja la clase CSS activa basada en la ruta actual.
 * 
 * @example
 * ```tsx
 * // Navegación simple
 * <a link href="/home">Home</a>
 * 
 * // Con clase activa
 * <a link href="/about" activeClass="active">About</a>
 * 
 * // Con múltiples clases activas
 * <a link href="/contact" activeClass="active font-bold">Contact</a>
 * 
 * // Replace en lugar de push (no agrega al historial)
 * <a link href="/login" replace>Login</a>
 * 
 * // Manejo de links externos
 * <a link href="https://docs.com" external="native">External Docs</a>
 * <a link href="https://api.com" external="block">Blocked API</a>
 * ```
 */
@Behavior
export class Link {
  @Host
  el!: HTMLAnchorElement;

  @ComponentHost
  hostComponent?: BaseComponent;

  @Prop
  link: boolean = true;

  @Prop
  href: string = '';

  @Prop
  activeClass?: string;

  @Prop
  replace?: boolean;

  @Prop
  external?: 'allow' | 'block' | 'native';

  @Inject(Router)
  private router!: Router;

  private clickHandler?: (e: MouseEvent) => void;
  
  onInit() {
    // 1. Resolver la ruta siguiendo el estándar de frameworks modernos
    const resolvedHref = this.resolveHref(this.href);

    // 2. Establecer el href visual en el elemento
    this.el.href = resolvedHref;

    // 3. Interceptar clicks para navegación SPA
    this.clickHandler = (e: MouseEvent) => {
      // Solo interceptar click izquierdo sin modificadores
      if (
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.defaultPrevented
      ) {
        return; // Dejar que el navegador maneje estos casos
      }

      // Verificar si tiene target blank
      if (this.el.target === '_blank') {
        return; // Dejar que abra en nueva pestaña
      }

      // Verificar si es una ruta externa
      if (this.isExternalLink(this.href)) {
        // Si tenemos configuración externa, usar el router para manejarla
        if (this.external) {
          e.preventDefault();
          this.router.navigate(this.href, { external: this.external });
          return;
        }
        // Sin configuración, dejar que el navegador maneje
        return;
      }

      // Interceptar y usar router para SPA
      e.preventDefault();
      // Usar la ruta resuelta que ya calculamos
      this.router.navigate(resolvedHref, {
        replace: this.replace
      });
    };

    this.el.addEventListener('click', this.clickHandler);

    // 4. Aplicar active class si corresponde (reactivo)
    if (this.activeClass) {
      this.updateActiveClass();
    }
  }
  
  /**
   * Computed que determina si el link está activo.
   *
   * Un link está activo si su href resuelto hace match con alguno de los patrones activos del router.
   * Los patrones pueden contener variables como `:id`, por lo que necesitamos pattern matching real.
   *
   * Ejemplos:
   * - href="/articles" hace match con pattern "/articles"
   * - href="/articles/123" hace match con pattern "/articles/:id"
   * - href="/dashboard/nested" hace match con patterns "/dashboard" y "/dashboard/nested"
   */
  @Computed
  get isActive(): boolean {
    // Resolver el href para comparar correctamente con los patrones
    const resolvedHref = this.resolveHref(this.href);
    const normalizedHref = resolvedHref.replace(/\/$/, '') || '/';

    // Verificar si el href hace match con alguno de los patrones activos
    return this.router.activePatterns.some(pattern => {
      const normalizedPattern = pattern.replace(/\/$/, '') || '/';
      return this.matchPattern(normalizedHref, normalizedPattern);
    });
  }
  
  /**
   * Verifica si un href hace match con un patrón de ruta.
   * 
   * @param href - El href del link (ej: "/articles/123")
   * @param pattern - El patrón de ruta (ej: "/articles/:id")
   * @returns true si el href hace match con el patrón
   */
  private matchPattern(href: string, pattern: string): boolean {
    // Match exacto (sin parámetros)
    if (href === pattern) {
      return true;
    }
    
    // Si el patrón no tiene parámetros, no puede hacer match
    if (!pattern.includes(':')) {
      return false;
    }
    
    // Convertir el patrón en regex
    // /articles/:id -> ^\/articles\/([^\/]+)$
    const regexPattern = pattern
      .split('/')
      .map(segment => {
        if (segment.startsWith(':')) {
          return '([^/]+)'; // Match cualquier cosa excepto /
        }
        return segment; // Segmento literal
      })
      .join('/');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(href);
  }
  
  /**
   * Effect que actualiza las clases CSS cuando cambia el estado activo del link.
   */
  @Effect
  private updateActiveClass(): void {
    if (!this.activeClass) return;
    
    // Trackear el computed isActive (que internamente trackea pathname y activePatterns)
    const isActive = this.isActive;
    
    // Aplicar o remover las clases activas
    const classes = this.activeClass.split(' ').filter(cls => cls.trim());
    
    if (isActive) {
      this.el.classList.add(...classes);
    } else {
      this.el.classList.remove(...classes);
    }
  }
  
  /**
   * Resuelve un href siguiendo el estándar de frameworks modernos (React Router, Next.js, etc.)
   *
   * Comportamiento:
   * - Rutas absolutas (empiezan con /): se usan tal cual → "/products" = "/products"
   * - Rutas externas (con protocolo): se devuelven tal cual
   * - Rutas relativas (no empiezan con /): se resuelven desde routeBasePath del componente host
   *   - routeBasePath="/store/:storeId" + params={storeId:"123"} + href="sales" = "/store/123/sales"
   *
   * @param href - El href original del prop
   * @returns El href resuelto que se debe usar para navegación
   */
  private resolveHref(href: string): string {
    // Si es una ruta externa o absoluta, usar lógica actual
    if (this.isExternalLink(href)) {
      return href;
    }

    if (href.startsWith('/')) {
      return href;
    }

    // Es una ruta relativa - intentar resolver desde routeBasePath
    const normalizedHref = href.startsWith('./') ? href.slice(2) : href;

    // Intentar obtener routeBasePath del componente host
    let basePath = '/';
    if (this.hostComponent && 'routeBasePath' in this.hostComponent) {
      // Acceder directamente a la propiedad (el getter de @Ctx devuelve el valor)
      basePath = (this.hostComponent as any).routeBasePath;
    }

    // Si no hay routeBasePath válido, fallback a pathname actual (comportamiento anterior)
    if (!basePath || basePath === '/') {
      const currentPathname = this.router.pathname;
      const basePathname = currentPathname.endsWith('/')
        ? currentPathname
        : currentPathname + '/';
      return basePathname + normalizedHref;
    }

    // Resolver parámetros del basePath con valores actuales
    const resolvedBasePath = this.resolvePathParams(basePath);

    // Asegurar que termina en /
    const finalBasePath = resolvedBasePath.endsWith('/')
      ? resolvedBasePath
      : resolvedBasePath + '/';

    return finalBasePath + normalizedHref;
  }

  /**
   * Reemplaza parámetros (:paramName) en un path con valores del router.$params
   *
   * @param path - Path con parámetros (ej: "/store/:storeId/products")
   * @returns Path con parámetros resueltos (ej: "/store/123/products")
   */
  private resolvePathParams(path: string): string {
    // Dividir en segmentos
    const segments = path.split('/');

    // Reemplazar cada segmento que empiece con :
    const resolved = segments.map(segment => {
      if (segment.startsWith(':')) {
        const paramName = segment.slice(1);
        // Obtener valor del router.$params
        const paramValue = this.router.$params[paramName];
        return paramValue || segment; // Si no existe, mantener :paramName
      }
      return segment;
    });

    return resolved.join('/');
  }

  /**
   * Determina si un href es un link externo
   */
  private isExternalLink(href: string): boolean {
    // Links que empiezan con protocolo o //
    if (/^(https?:)?\/\//.test(href)) {
      // Verificar si es mismo dominio
      try {
        const url = new URL(href, window.location.origin);
        return url.origin !== window.location.origin;
      } catch {
        return true;
      }
    }

    // Otros protocolos (mailto:, tel:, etc.)
    if (/^[a-z]+:/i.test(href)) {
      return true;
    }

    return false;
  }
  
  onDestroy() {
    // Limpiar event listener
    if (this.clickHandler) {
      this.el.removeEventListener('click', this.clickHandler);
    }
  }
}
