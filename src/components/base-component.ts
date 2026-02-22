import { RESOURCE_PROPERTY_KEYS } from "../reactivity/decorators/resource";
import { reactiveContext } from "../reactivity/reactive-context";
import { createResource } from "../reactivity/signals/resource";
import { AppTree } from "./app-tree";
import { INode, Constructor } from "./types";
import { bindProps } from "../jsx/dynamic/props-handler";
import { renderChild } from "../jsx/dynamic/child-renderer";
import { Fragment } from "../jsx/types";
import { globalStylesheets } from "../styles/global-styles-registry";
import { BehaviorManager } from "../behaviors/behavior-manager";
import { ScopedContainer } from "../DI/scoped-container";
import { getServiceMetadata } from "../DI/service-metadata";

export class BaseComponent extends HTMLElement {
  #isInitialized = false;
  #globalStylesheetIds: symbol[] = []; // Para estilos @Shared
  #documentStylesheetIds: symbol[] = []; // Para estilos @ForDocument

  protected appNode?: INode;
  protected _pendingContextInitializers?: (() => void)[] = [];

  // Lista de efectos pendientes que se ejecutarán después de la inicialización
  public _pendingEffects?: (() => void)[] = [];
  
  // BehaviorManager para manejar behaviors en elementos nativos hijos
  protected behaviorManager = new BehaviorManager(this);

  constructor() {
    super(); // Llamar al constructor de HTMLElement
    
    // Obtener metadata para verificar si debe usar shadow DOM
    const metadata = AppTree.getMetadata(this.constructor as Constructor<BaseComponent>);
    const useShadowDOM = metadata?.useShadowDOM !== false; // Por defecto true
    
    if (useShadowDOM) {
      this.attachShadow({ mode: "open" });
    }
  }
  
  /**
   * Obtiene el root donde se renderizan los elementos.
   * Puede ser shadowRoot o el elemento mismo si no usa shadow DOM.
   */
  protected get renderRoot(): HTMLElement | ShadowRoot {
    return this.shadowRoot || this;
  }

  /**
   * Registra un efecto pendiente que se ejecutará después de la inicialización
   * Usado por el decorador @Effect para diferir la ejecución
   */
  public queueEffect(effectFn: () => void): void {
    // Si ya está inicializado, ejecutar inmediatamente
    if (this.#isInitialized) {
      queueMicrotask(effectFn);
      return;
    }

    // Si no está inicializado, encolar para después
    if (!this._pendingEffects) {
      this._pendingEffects = [];
    }
    this._pendingEffects.push(effectFn);
  }

  /**
   * Ejecuta todos los efectos pendientes
   * Se llama al final de initializeForJSX()
   */
  private flushPendingEffects(): void {
    if (this._pendingEffects && this._pendingEffects.length > 0) {
      const effects = this._pendingEffects;
      this._pendingEffects = [];

      // Ejecutar cada efecto en un microtask separado
      effects.forEach((effectFn) => {
        queueMicrotask(effectFn);
      });
    }
  }

  // Inicialización controlada por JSX
  public initializeForJSX(): void {
    if (this.#isInitialized) {
      return;
    }

    reactiveContext.untrack(() => {
      // PASO 1: Registrar estilos @Shared si este componente los declara
      this.registerSharedStylesheetsIfNeeded();

      // PASO 2: Registrar estilos @ForDocument si este componente los declara
      this.registerDocumentStylesIfNeeded();

      // PASO 3: Adoptar TODOS los estilos @Shared registrados hasta ahora
      this.adoptSharedStylesheets();

      // PASO 4: Adoptar los estilos LOCALES de este componente
      this.adoptLocalStylesheet();

      // PASO 5: Inicializar contextos @Ctx (requiere que appNode esté disponible)
      this.initializeContexts();

      // PASO 6: Inicializar recursos @Resource
      this.initializeResources();

      // PASO 7: Ejecutar hook de inicialización del usuario si existe
      if (typeof (this as any).onInit === "function") {
        (this as any).onInit();
      }
    });

    this.#isInitialized = true;

    // PASO 8: Ejecutar efectos pendientes (@Effect)
    this.flushPendingEffects();
  }

  connectedCallback() {
    // CASO 1: Ya fue inicializado vía JSX
    if (this.#isInitialized) {
      // Solo ejecutar el hook de conexión si existe
      if (typeof (this as any).onConnected === "function") {
        (this as any).onConnected();
      }
      return;
    }

    // CASO 2: Creado directamente por el navegador
    // Iniciar el proceso async sin bloquear
    this.init().catch(error => {
      console.error('[BaseComponent] Error durante inicialización:', error);
      this.renderError(error);
    });
  }

  /**
   * Bootstrap services declared in @Component({ services: [...] })
   * for a given node. Creates a ScopedContainer with parent chain resolution.
   * Used by both init() (DOM path) and createAndRenderComponent() (JSX path).
   */
  private static bootstrapServicesForNode(
    node: INode,
    metadata: { services?: Constructor[] },
    sync: boolean = false,
  ): void {
    if (!metadata.services?.length) return;

    // Find parent container by walking up the AppTree
    const parentContainer = node.parent
      ? AppTree.findContainerFor(node.parent)
      : undefined;

    const container = new ScopedContainer(parentContainer);

    // First pass: register all services
    for (const ServiceClass of metadata.services) {
      container.register(ServiceClass);
    }

    // Second pass: register dependency relationships
    // (must happen after ALL services are registered, since order in the array is arbitrary)
    for (const ServiceClass of metadata.services) {
      const serviceMeta = getServiceMetadata(ServiceClass);
      if (serviceMeta) {
        for (const dep of serviceMeta.dependencies) {
          // Only register if both are in this scope
          if (metadata.services.includes(dep)) {
            container.registerDependency(ServiceClass, dep);
          }
        }
      }
    }

    // Bootstrap: sync for JSX path, async for DOM path
    if (sync) {
      container.bootstrapSync();
    }

    node.container = container;
  }

  /**
   * Assign __container to a component instance.
   * Uses the node's own container if it has one, otherwise walks up the tree.
   */
  private static assignContainer(instance: BaseComponent, node: INode): void {
    (instance as any).__container = node.container
      ?? AppTree.findContainerFor(node)
      ?? undefined;
  }

  /**
   * Proceso de inicialización asíncrona del componente
   * Incluye renderizado progresivo
   */
  private async init(): Promise<void> {

    // Paso 2: Setup del árbol
    const parentNode = this.findParentNode();
    this.appNode = AppTree.registerInstance(this, parentNode);

    // Paso 2.5: Bootstrap services si este componente los declara
    const metadata = AppTree.getMetadata(this.constructor as Constructor<BaseComponent>);
    if (metadata?.services?.length) {
      BaseComponent.bootstrapServicesForNode(this.appNode, metadata);
      // Await async bootstrap for DOM path
      await this.appNode.container!.bootstrap();
    }
    // Assign container (own or inherited from parent)
    BaseComponent.assignContainer(this, this.appNode);

    // Paso 3: Inicialización normal (contextos, recursos, etc)
    this.initializeForJSX();

    // Paso 4: Limpiar y renderizar vista real
    this.renderRoot.innerHTML = ''; // Limpiar 

    // Paso 5: Renderizar la vista
    if (typeof (this as any).view === "function") {
      const viewResult = (this as any).view();
      
      // Helper simple para detectar iterables
      const isIterable = (value: any): boolean => {
        return value && typeof value === 'object' && typeof value[Symbol.iterator] === 'function';
      };
      
      if (viewResult instanceof Node) {
        this.renderRoot.appendChild(viewResult);
      } else if (isIterable(viewResult)) {
        // Iterar directamente - funciona con arrays, ReactiveArrays, etc.
        for (const child of viewResult) {
          renderChild(this.renderRoot as HTMLElement, child);
        }
      } else if (viewResult != null) {
        renderChild(this.renderRoot as HTMLElement, viewResult);
      }
    }

    // Paso 6: Hook de conexión
    if (typeof (this as any).onConnected === "function") {
      (this as any).onConnected();
    }

    this.#isInitialized = true;
  }

  /**
   * Renderiza un estado de error si la inicialización falla
   */
  private renderError(error: any): void {
    this.renderRoot.innerHTML = `
      <div style="padding: 20px; border: 2px solid #ff4444; background: #fff5f5; border-radius: 4px; margin: 10px;">
        <h3 style="margin: 0 0 10px 0; color: #ff4444;">❌ Error de Inicialización</h3>
        <p style="margin: 0 0 10px 0; color: #333;">El componente <strong>${this.constructor.name}</strong> falló al inicializar.</p>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto; font-size: 12px; border-radius: 3px; color: #333;">${error.stack || error.message || String(error)}</pre>
      </div>
    `;
  }

  /**
  * Encuentra el nodo padre de este componente en el AppTree.
  */
  private findParentNode(): INode | undefined {
    // Empezar desde el parent en el DOM
    let currentElement = this.parentElement;

    // Subir por el árbol del DOM buscando otro BaseComponent
    while (currentElement) {
      // Verificar si este elemento es un BaseComponent
      if (currentElement instanceof BaseComponent) {
        // Encontramos un parent que es un componente de nuestro framework
        const parentNode = AppTree.findByInstance(currentElement);

        if (parentNode) {
          return parentNode;
        }

        // Si el parent no está en el AppTree aún, acceder a su appNode
        if (currentElement.appNode) {
          return currentElement.appNode;
        }
      }
      // Si este elemento tiene un host (está dentro de un shadow DOM),
      // seguir buscando en el host
      if (currentElement instanceof ShadowRoot) {
        currentElement = (currentElement as any).host;
      } else {
        currentElement = currentElement.parentElement;
      }
    }

    // No se encontró ningún parent BaseComponent
    return undefined;
  }

  disconnectedCallback() {
    // Dispose container si este nodo lo tiene
    if (this.appNode?.container) {
      this.appNode.container.dispose();
    }

    // Limpiar estilos globales registrados
    if (this.#globalStylesheetIds.length > 0) {
      globalStylesheets.unregister(this.#globalStylesheetIds);
      this.#globalStylesheetIds = [];
    }

    // Limpiar estilos de documento registrados
    if (this.#documentStylesheetIds.length > 0) {
      globalStylesheets.unregisterDocumentStyles(this.#documentStylesheetIds);
      this.#documentStylesheetIds = [];
    }

    // Limpiar del AppTree
    if (this.appNode) {
      AppTree.unregisterInstance(this.appNode);
    }

    // Limpiar behaviors de elementos nativos hijos
    this.behaviorManager.disconnectAll();

    // Hook del usuario
    if (typeof (this as any).onDisconnected === "function") {
      (this as any).onDisconnected();
    }
  }

  /**
  * Registra las stylesheets @Shared si este componente las declara.
  */
  private registerSharedStylesheetsIfNeeded(): void {
    const metadata = AppTree.getMetadata(
      this.constructor as Constructor<BaseComponent>
    );

    // Verificar si este componente declaró estilos @Shared
    if (metadata?.sharedStylesClasses && metadata.sharedStylesClasses.length > 0) {
      this.#globalStylesheetIds = globalStylesheets.registerShared(
        metadata.sharedStylesClasses,
        this
      );
    }
  }

  /**
   * Registra las stylesheets @ForDocument si este componente las declara.
   */
  private registerDocumentStylesIfNeeded(): void {
    const metadata = AppTree.getMetadata(
      this.constructor as Constructor<BaseComponent>
    );

    // Verificar si este componente declaró estilos @ForDocument
    if (metadata?.documentStylesClasses && metadata.documentStylesClasses.length > 0) {
      this.#documentStylesheetIds = globalStylesheets.registerDocument(
        metadata.documentStylesClasses,
        this
      );
    }
  }

  /**
  * Adopta todas las stylesheets @Shared registradas en el shadow root.
  */
  private adoptSharedStylesheets(): void {
    if (!this.shadowRoot) {
      console.warn('Cannot adopt shared stylesheets: shadow root not available');
      return;
    }

    // Obtener todas las stylesheets @Shared actualmente registradas
    const sharedSheets = globalStylesheets.getSharedStylesheets();

    if (sharedSheets.length > 0) {
      const existingSheets = this.shadowRoot.adoptedStyleSheets;

      // Verificar si las compartidas ya están incluidas
      const existingArray = Array.from(existingSheets);
      const sharedInExisting = sharedSheets.filter(ss => existingArray.includes(ss));

      if (sharedInExisting.length === sharedSheets.length) {
        return;
      }

      // Remover las compartidas que ya están en existing
      const filteredExisting = existingArray.filter(sheet => !sharedSheets.includes(sheet));

      // Prepend shared stylesheets ANTES de las stylesheets del componente
      const newSheets = [...sharedSheets, ...filteredExisting];
      this.shadowRoot.adoptedStyleSheets = newSheets;
    }
  }

  /**
  * Adopta las stylesheets LOCALES de este componente específico.
  */
  private adoptLocalStylesheet(): void {
    if (!this.shadowRoot) {
      console.warn('Cannot adopt local stylesheet: shadow root not available');
      return;
    }

    // Obtener la metadata de este componente desde AppTree
    const metadata = AppTree.getMetadata(
      this.constructor as Constructor<BaseComponent>
    );

    // Verificar si este componente declaró estilos locales
    if (metadata?.stylesClass) {
      const stylesInstance = new metadata.stylesClass();

      // Configurar el host primero (para que @Host esté disponible)
      stylesInstance.setHost(this);

      // Obtener el stylesheet (activa los @Rule effects)
      const stylesheet = stylesInstance.getStyleSheet();

      // Adoptar el stylesheet local (se agregará después de los globales)
      this.shadowRoot.adoptedStyleSheets = [
        ...this.shadowRoot.adoptedStyleSheets,
        stylesheet,
      ];
    }
  }

  private initializeContexts(): void {
    // Ejecutar todos los inicializadores de contexto @Ctx registrados
    if (this._pendingContextInitializers) {
      this._pendingContextInitializers.forEach((initializer) => {
        initializer();
      });
      // Limpiar los inicializadores después de ejecutarlos
      this._pendingContextInitializers = [];
    }
  }

  private initializeResources(): void {
    const resourceInitializers =
      (this.constructor as any)[RESOURCE_PROPERTY_KEYS] || [];

    for (const { key, source } of resourceInitializers) {
      const resource = createResource((signal: AbortSignal) =>
        source.call(this, signal)
      );
      (this as any)[key] = resource;
    }
  }

  jsx(type: any, props: any) {
    // CASO 0: null/undefined - no renderizar nada (como React)
    if (type == null) {
      return null;
    }

    // Si el 'type' es nuestro símbolo de Fragment, simplemente devolvemos los hijos
    if (type === Fragment) {
      return props.children;
    }

    const { children, ...restProps } = props || {};

    // CASO 1: type es una CLASE (componente custom)
    if (typeof type === "function" && type.prototype instanceof BaseComponent) {
      return this.createAndRenderComponent(type, restProps, children);
    }

    // CASO 2: type es una FUNCIÓN (helper como For, Show, etc.)
    // Estas funciones retornan factories (() => Node)
    if (typeof type === "function") {
      // Ejecutar la función con las props
      const result = type({ ...restProps, children });
      
      // Si el resultado es una función (factory), ejecutarla
      if (typeof result === "function") {
        return result();
      }
      
      // Si ya es un nodo, retornarlo directamente
      return result;
    }

    // CASO 3: HTML nativo (div, span, etc.)
    if (typeof type === "string") {
      return this.createNativeElement(
        type,
        restProps,
        ...this.normalizeChildren(children),
      );
    }

    throw new Error(`Unknown component type: ${typeof type} - ${type}`);
  }

  jsxDEV(type: any, props: any) {
    return this.jsx(type, props);
  }

  jsxs(type: any, props: any) {
    return this.jsx(type, props);
  }

  /**
   * Aplica className al host element del componente.
   */
  private applyClassNameToHost(
    instance: BaseComponent,
    classNameValue: any
  ): void {
    // Si es una signal, importar effect solo cuando se necesite
    if (typeof classNameValue === 'object' && classNameValue?.isSignal) {
      import("../reactivity/signals/effect").then(({ effect }) => {
        effect(() => {
          const className = classNameValue.get();
          this.setHostClassName(instance, className);
        }, { priority: "Frame" });
      });
    } else if (typeof classNameValue === "function") {
      import("../reactivity/signals/effect").then(({ effect }) => {
        effect(() => {
          const className = classNameValue();
          this.setHostClassName(instance, className);
        }, { priority: "Frame" });
      });
    } else {
      // Valor estático
      this.setHostClassName(instance, classNameValue);
    }
  }

  /**
   * Establece las clases CSS en el host element.
   */
  private setHostClassName(instance: BaseComponent, className: string | string[]): void {
    if (!className) return;

    // Normalizar a string
    const classStr = Array.isArray(className) ? className.join(' ') : String(className);

    // Aplicar directamente al host element (Light DOM)
    if (classStr.trim()) {
      instance.className = classStr.trim();
    }
  }

  private createAndRenderComponent(
    ComponentClass: typeof BaseComponent,
    props: any,
    children: any,
  ): Node {
    let instance!: BaseComponent;
    reactiveContext.untrack(() => {
      // 1. Crea la instancia del componente
      instance = new ComponentClass();

      // 2. Configura metadatos del elemento
      const tagName = this.convertClassNameToTagName(ComponentClass.name);
      Object.defineProperty(instance, "tagName", {
        value: tagName.toUpperCase(),
        configurable: false,
        enumerable: true,
      });
      Object.defineProperty(instance, "nodeName", {
        value: tagName.toUpperCase(),
        configurable: false,
        enumerable: true,
      });

      // 3. Registra en AppTree usando this.appNode como parent
      const node = AppTree.registerInstance(instance, this.appNode);

      // 4. Asigna el nodo del árbol a la instancia
      instance.appNode = node;

      // 4.5. Bootstrap services si este componente los declara (sync para JSX)
      const childMetadata = AppTree.getMetadata(ComponentClass as unknown as Constructor<BaseComponent>);
      if (childMetadata?.services?.length) {
        BaseComponent.bootstrapServicesForNode(node, childMetadata, true);
      }
      // Assign container (own or inherited from parent)
      BaseComponent.assignContainer(instance, node);

      // 5. Aplica props
      if (props) {
        Object.keys(props).forEach((key) => {
          if (key === "children") return;

          // Manejo especial para className: aplicarlo al host element
          if (key === "className" || key === "class") {
            this.applyClassNameToHost(instance, props[key]);
          } else {
            (instance as any)[key] = props[key];
          }
        });
      }

      // 6. Inicialización del componente (incluye adopción de estilos)
      instance.initializeForJSX();

      // 7. Renderizado directo
      const view = (instance as any).view();

      if (view instanceof Node && instance.shadowRoot) {
        instance.shadowRoot.appendChild(view);
      } else if (Array.isArray(view) && instance.shadowRoot) {
        view.forEach((child) => renderChild(instance.shadowRoot!, child));
      }

      // 8. Renderizar children en LIGHT DOM (para slots)
      if (children) {
        const normalizedChildren = this.normalizeChildren(children);
        normalizedChildren.forEach((child) => {
          renderChild(instance, child); // Light DOM del host
        });
      }
    });

    // 9. Devuelve el elemento completo y renderizado
    return instance;
  }

  private createNativeElement(
    type: string,
    props: Record<string, any> | null,
    ...children: any[]
  ): HTMLElement {
    const el = document.createElement(type);

    // Aplicar propiedades con el BehaviorManager
    if (props) {
      bindProps(el, props, this.behaviorManager);
    }

    // Aplanar hijos por si vienen arrays anidados
    const flatChildren = children.flat();

    // Renderizar cada hijo
    flatChildren.forEach((child) => renderChild(el, child));

    return el;
  }

  private normalizeChildren(children: any): any[] {
    if (!children) return [];
    return Array.isArray(children) ? children : [children];
  }

  private convertClassNameToTagName(className: string): string {
    return className
      .replace(/_/g, "-")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase();
  }
}
