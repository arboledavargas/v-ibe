import { RESOURCE_PROPERTY_KEYS } from "../../reactivity/decorators/resource";
import { AppTree } from "../app-tree";
import { BaseStyleSheet } from "../../styles/base-style-sheet";
import { getStyleScope } from "../../styles/decorators/scope";

export interface ComponentConfig {
  /**
   * Clase(s) de estilos del componente.
   * El scope se determina por el decorador de cada clase:
   * - Sin decorador: Local
   * - @Shared: Shadow roots
   * - @ForDocument: Documento
   */
  styles?: (new () => BaseStyleSheet) | (new () => BaseStyleSheet)[];
  
  /**
   * Si es false, el componente no usará Shadow DOM.
   * Por defecto es true (usa Shadow DOM).
   * Útil para componentes que necesitan heredar estilos del documento (ej: Link con activeClass).
   */
  useShadowDOM?: boolean;
}

function convertClassNameToTagName(className: string): string {
  const kebabCase = className
    .replace(/_/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

  return `use-${kebabCase}`;
}

/**
 * Decorador @Component para registrar componentes web.
 * Uso: @Component() o @Component({ styles: [MyStyles] })
 */
export function Component(config: ComponentConfig = {}): any {
  return function (
    ComponentClass: Constructor,
    context: ClassDecoratorContext,
  ) {
    const tagName = convertClassNameToTagName(ComponentClass.name);
    const resourceKeys = (context?.metadata as any)?.resourceKeys || [];
    (ComponentClass as any)[RESOURCE_PROPERTY_KEYS] = resourceKeys;

    // Categorizar estilos por scope
    let categorizedStyles = {
      local: [] as any[],
      shared: [] as any[],
      document: [] as any[]
    };

    // Procesar estilos del usuario
    if (config?.styles) {
      const stylesArray = Array.isArray(config.styles) ? config.styles : [config.styles];

      stylesArray.forEach(StyleClass => {
        const scope = getStyleScope(StyleClass);
        categorizedStyles[scope].push(StyleClass);
      });
    }

    // Registrar metadata en AppTree
    AppTree.registerMetadata({
      tagName,
      componentClass: ComponentClass,
      resourceKeys,
      stylesClass: categorizedStyles.local[0],
      localStyles: categorizedStyles.local.length > 0 ? categorizedStyles.local : undefined,
      sharedStylesClasses: categorizedStyles.shared.length > 0 ? categorizedStyles.shared : undefined,
      documentStylesClasses: categorizedStyles.document.length > 0 ? categorizedStyles.document : undefined,
      useShadowDOM: config.useShadowDOM !== false, // Por defecto true
    });

    // Registrar Custom Element
    if (!customElements.get(tagName)) {
      customElements.define(tagName, ComponentClass as CustomElementConstructor);
    } else {
      console.warn(`[Component] ⚠ Tag "${tagName}" ya registrado`);
    }

    return ComponentClass;
  };
}
