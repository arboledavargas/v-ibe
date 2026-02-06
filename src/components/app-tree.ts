import { BaseComponent } from "./base-component";
import { Constructor } from "../DI/types";
import type { ComponentMetadata, INode } from "./types";
import { ISignal, isSignal } from "../reactivity/signals/signal";

export class AppTree {
  // --- 1. REGISTRO DE METADATA ---
  // CAMBIO: La clave ahora es la clase (Constructor), no un string (tagName).
  private static metadataRegistry = new Map<
    Constructor<BaseComponent>,
    ComponentMetadata
  >();

  // --- 2. ÁRBOL DE INSTANCIAS ---
  private static nodes = new Map<string, INode>();
  private static root: INode | null = null;

  // --- MÉTODOS PARA GESTIONAR METADATA ---

  /**
   * Registra la metadata de una clase de Componente.
   * Se llama desde el decorador @Component.
   */
  static registerMetadata(metadata: ComponentMetadata) {
    // CAMBIO: Usamos metadata.target (la clase) como clave.
    // Asumimos que la metadata contiene una propiedad 'target' que es el constructor de la clase.
    // Esto es estándar en los decoradores de TypeScript.
    this.metadataRegistry.set(metadata.componentClass, metadata);
  }

  /**
   * Obtiene la metadata para una clase de componente específica.
   */
  // CAMBIO: El método ahora espera una clase (Constructor) en lugar de un tagName (string).
  static getMetadata(
    componentClass: Constructor<BaseComponent>,
  ): ComponentMetadata | undefined {
    return this.metadataRegistry.get(componentClass);
  }

  // --- MÉTODOS PARA GESTIONAR INSTANCIAS ---

  /**
   * Registra una instancia de componente en el árbol jerárquico.
   * Se llama desde connectedCallback.
   */
  static registerInstance(instance: BaseComponent, parent?: INode): INode {
    // CAMBIO: Obtenemos los metadatos usando el constructor de la instancia.
    // 'instance.constructor' nos da la referencia a la clase que se usó para crear el objeto.
    const metadata = this.getMetadata(
      instance.constructor as Constructor<BaseComponent>,
    );

    if (!metadata) {
      throw new Error(
        // El mensaje de error es más preciso ahora.
        `Intentando instanciar <${instance.tagName}> pero sus metadatos no fueron registrados. ¿Olvidaste el decorador @Component en la clase ${instance.constructor.name}?`,
      );
    }

    const node: INode = {
      id: crypto.randomUUID(),
      metadata,
      instance,
      parent,
      children: [],
    };

    this.nodes.set(node.id, node);

    if (parent) {
      parent.children.push(node);
    } else {
      this.root = node;
    }

    return node;
  }

  /**
   * Elimina una instancia del árbol jerárquico.
   * Se llama desde disconnectedCallback.
   */
  static unregisterInstance(node: INode) {
    if (node.parent) {
      node.parent.children = node.parent.children.filter((c) => c !== node);
    } else if (this.root === node) {
      this.root = null;
    }
    this.nodes.delete(node.id);
  }

  // --- MÉTODOS DE BÚSQUEDA (sin cambios, siguen siendo útiles) ---

  static getRoot(): INode | null {
    return this.root;
  }

  static findByTag(tagName: string): INode[] {
    const lowerCaseTag = tagName.toLowerCase();
    return [...this.nodes.values()].filter(
      (n) => n.metadata.tagName.toLowerCase() === lowerCaseTag,
    );
  }

  static findByInstance(instance: BaseComponent): INode | undefined {
    return [...this.nodes.values()].find((n) => n.instance === instance);
  }

  static getParentFor(instance: BaseComponent): INode | undefined {
    const node = this.findByInstance(instance);
    return node ? node.parent : undefined;
  }

  /**
   * Busca recursivamente hacia arriba desde un nodo inicial una propiedad
   * que represente una señal de contexto (ej: "$level").
   * @param signalPropName El nombre de la propiedad de la señal (ej: "$level").
   * @param startNode El nodo desde el cual comenzar la búsqueda hacia arriba.
   * @returns La señal encontrada o undefined.
   */
  static findContextSignalFor(
    signalPropName: string,
    startNode: INode | undefined,
  ): ISignal<any> | undefined {
    // comenzamos la búsqueda DESDE el nodo de inicio, no desde su padre.
    let currentNode = startNode;

    while (currentNode) {
      const instance = currentNode.instance as any;

      // Primero, comprobamos si el NODO ACTUAL
      // provee la señal que buscamos.
      if (instance && signalPropName in instance) {
        const potentialSignal = instance[signalPropName];
        if (isSignal(potentialSignal)) {
          return potentialSignal; // ¡Encontrada!
        }
      }

      // Si no se encontró aquí, AHORA SÍ subimos al siguiente ancestro.
      currentNode = currentNode.parent;
    }

    return undefined; // No se encontró en la cadena de ancestros.
  }
}
