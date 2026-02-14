import { BaseComponent } from "./base-component"; // Está bien importar clases para usarlas en tipos
import { BaseStyleSheet } from "../styles/base-style-sheet";
import type { ScopedContainer } from "../DI/scoped-container";

// Tipo para un constructor de clase
export type Constructor<T = {}> = new (...args: any[]) => T;

// Metadata que define un "plano" de componente
export type ComponentMetadata = {
  tagName: string;
  componentClass: Constructor<any>;
  routePath?: string;
  viewPropertyName?: string;
  resourceKeys: string[];

  // ESTILOS LOCALES: Se aplican solo al componente específico
  stylesClass?: new () => BaseStyleSheet;
  localStyles?: Constructor<any>[];

  // ESTILOS @Shared: Se aplican a todos los shadow roots
  sharedStylesClasses?: Constructor<any>[];

  // ESTILOS @ForDocument: Se aplican al documento real (en <head>)
  documentStylesClasses?: Constructor<any>[];

  // Si es false, el componente no usa Shadow DOM
  useShadowDOM?: boolean;

  // Servicios que este componente provee a sus hijos
  services?: Constructor[];
};

// Nodo que representa una "instancia" viva en el árbol
export interface INode {
  id: string;
  metadata: ComponentMetadata;
  instance: BaseComponent;
  parent?: INode;
  children: INode[];
  contextStore?: object;
  container?: ScopedContainer;
}
