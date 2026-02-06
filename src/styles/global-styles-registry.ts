/**
 * Global Stylesheets Registry - ACTUALIZADO
 *
 * Este registro administra dos tipos de estilos globales:
 *
 * 1. @Shared: Estilos que se adoptan en todos los shadow roots
 *    - Se comparte UNA instancia de CSSStyleSheet entre todos los componentes
 *    - Eficiente en memoria
 *    - Aplican solo dentro de shadow DOM
 *
 * 2. @ForDocument: Estilos que se aplican al documento real
 *    - Se insertan en el <head> del documento
 *    - Aplican globalmente a todo el documento
 *    - No usan adoptedStyleSheets, sino elementos <style>
 *
 * Ciclo de vida:
 * 1. Un componente declara estilos @Shared y/o @ForDocument
 * 2. El registro crea las instancias y las almacena por tipo
 * 3. Los componentes futuros adoptan los @Shared en sus shadow roots
 * 4. Cuando el componente proveedor se desmonta, limpiamos sus estilos
 */

import { BaseComponent } from "../components/base-component";
import { Constructor } from "../components/types";
import { getStyleScope, type StyleScope } from "./decorators/scope";

/**
 * Entrada para estilos @Shared (shadow roots)
 */
interface SharedStylesheetEntry {
  /** La instancia de CSSStyleSheet que se comparte entre componentes */
  stylesheet: CSSStyleSheet;

  /** El componente que registró este estilo */
  ownerComponent: BaseComponent;

  /** La clase de estilos que generó esta stylesheet */
  styleClass: Constructor<any>;

  /** Identificador único para este registro */
  id: symbol;

  /** La instancia del stylesheet para limpieza posterior */
  styleInstance: any;
}

/**
 * Entrada para estilos @ForDocument (documento real)
 */
interface DocumentStylesheetEntry {
  /** La instancia del stylesheet que maneja el elemento <style> */
  styleInstance: any;

  /** El componente que registró este estilo */
  ownerComponent: BaseComponent;

  /** La clase de estilos */
  styleClass: Constructor<any>;

  /** Identificador único para este registro */
  id: symbol;
}

class GlobalStylesheetsRegistry {
  /**
   * Array de estilos @Shared para shadow roots.
   * El orden es importante: las primeras en el array son las primeras
   * en aplicarse (menor especificidad en la cascada CSS).
   */
  private sharedEntries: SharedStylesheetEntry[] = [];

  /**
   * Array de estilos @ForDocument para el documento.
   */
  private documentEntries: DocumentStylesheetEntry[] = [];

  /**
   * NUEVO: Registra estilos @Shared (para shadow roots).
   * Este método es llamado cuando un componente con estilos @Shared se inicializa.
   *
   * @param styleClasses Array de clases decoradas con @Shared
   * @param ownerComponent El componente que está registrando estos estilos
   * @returns Array de símbolos que identifican cada registro
   */
  public registerShared(
    styleClasses: Constructor<any>[],
    ownerComponent: BaseComponent,
  ): symbol[] {
    const registeredIds: symbol[] = [];

    for (const StyleClass of styleClasses) {
      // Crear una instancia de la clase de estilos
      const styleInstance = new StyleClass();

      // Conectar con el componente host para reactividad
      styleInstance.setHost(ownerComponent);

      // Obtener la CSSStyleSheet generada
      const stylesheet = styleInstance.getStyleSheet();

      // Crear un identificador único
      const id = Symbol(`shared-stylesheet-${StyleClass.name}`);

      // Crear la entrada
      const entry: SharedStylesheetEntry = {
        stylesheet,
        ownerComponent,
        styleClass: StyleClass,
        id,
        styleInstance,
      };

      // Agregar al array de estilos compartidos
      this.sharedEntries.push(entry);
      registeredIds.push(id);
    }

    return registeredIds;
  }

  /**
   * NUEVO: Registra estilos @ForDocument (para el documento real).
   *
   * @param styleClasses Array de clases decoradas con @ForDocument
   * @param ownerComponent El componente que está registrando estos estilos
   * @returns Array de símbolos que identifican cada registro
   */
  public registerDocument(
    styleClasses: Constructor<any>[],
    ownerComponent: BaseComponent,
  ): symbol[] {
    const registeredIds: symbol[] = [];

    for (const StyleClass of styleClasses) {
      // Crear una instancia de la clase de estilos
      const styleInstance = new StyleClass();

      // Conectar con el componente host para reactividad
      styleInstance.setHost(ownerComponent);

      // Aplicar al documento (crea el <style> en <head>)
      styleInstance.applyToDocument();

      // Crear un identificador único
      const id = Symbol(`document-stylesheet-${StyleClass.name}`);

      // Crear la entrada
      const entry: DocumentStylesheetEntry = {
        styleInstance,
        ownerComponent,
        styleClass: StyleClass,
        id,
      };

      // Agregar al array de estilos de documento
      this.documentEntries.push(entry);
      registeredIds.push(id);
    }

    return registeredIds;
  }

  /**
   * Método universal de registro que categoriza automáticamente por scope.
   *
   * @param styleClasses Array de clases de estilos (pueden tener diferentes scopes)
   * @param ownerComponent El componente que está registrando estos estilos
   * @returns Array de símbolos que identifican cada registro
   */
  public register(
    styleClasses: Constructor<any>[],
    ownerComponent: BaseComponent,
  ): symbol[] {
    const categorized = {
      shared: [] as Constructor<any>[],
      document: [] as Constructor<any>[],
    };

    // Categorizar cada clase por su scope
    for (const StyleClass of styleClasses) {
      const scope = getStyleScope(StyleClass);

      if (scope === 'shared') {
        categorized.shared.push(StyleClass);
      } else if (scope === 'document') {
        categorized.document.push(StyleClass);
      } else {
        console.warn(
          `[GlobalStyles] ⚠️ ${StyleClass.name} no tiene decorador @Shared ni @ForDocument. ` +
          `Los estilos globales deben usar uno de estos decoradores.`
        );
      }
    }

    // Registrar cada categoría
    const ids: symbol[] = [];

    if (categorized.shared.length > 0) {
      ids.push(...this.registerShared(categorized.shared, ownerComponent));
    }

    if (categorized.document.length > 0) {
      ids.push(...this.registerDocument(categorized.document, ownerComponent));
    }

    return ids;
  }

  /**
   * Elimina estilos globales registrados por un componente.
   *
   * @param ids Array de símbolos que identifican qué registros eliminar
   */
  public unregister(ids: symbol[]): void {
    for (const id of ids) {
      // Buscar en estilos compartidos
      const sharedIndex = this.sharedEntries.findIndex(entry => entry.id === id);
      if (sharedIndex !== -1) {
        const entry = this.sharedEntries[sharedIndex];

        // Limpiar la instancia del stylesheet
        if (entry.styleInstance && typeof entry.styleInstance.dispose === 'function') {
          entry.styleInstance.dispose();
        }

        this.sharedEntries.splice(sharedIndex, 1);
        continue;
      }

      // Buscar en estilos de documento
      const docIndex = this.documentEntries.findIndex(entry => entry.id === id);
      if (docIndex !== -1) {
        const entry = this.documentEntries[docIndex];

        // Limpiar la instancia del stylesheet (esto remueve el <style> del <head>)
        if (entry.styleInstance && typeof entry.styleInstance.dispose === 'function') {
          entry.styleInstance.dispose();
        }

        this.documentEntries.splice(docIndex, 1);
      }
    }
  }

  /**
   * Alias para unregister - mantiene compatibilidad con código antiguo
   */
  public unregisterDocumentStyles(ids: symbol[]): void {
    this.unregister(ids);
  }

  /**
   * Obtiene todas las stylesheets @Shared activas.
   * Este método es llamado por cada componente para adoptar estilos compartidos.
   *
   * @returns Array de CSSStyleSheet instances listas para ser adoptadas
   */
  public getSharedStylesheets(): CSSStyleSheet[] {
    return this.sharedEntries.map(entry => entry.stylesheet);
  }

  /**
   * DEPRECATED: Usa getSharedStylesheets() en su lugar.
   * Mantenido por compatibilidad temporal.
   */
  public getStylesheets(): CSSStyleSheet[] {
    return this.getSharedStylesheets();
  }

  /**
   * Información de debug para desarrollo.
   */
  public getDebugInfo(): {
    sharedCount: number;
    documentCount: number;
    sharedOwners: string[];
    documentOwners: string[];
  } {
    return {
      sharedCount: this.sharedEntries.length,
      documentCount: this.documentEntries.length,
      sharedOwners: this.sharedEntries.map(e => e.ownerComponent.constructor.name),
      documentOwners: this.documentEntries.map(e => e.ownerComponent.constructor.name),
    };
  }
}

// Exportamos una instancia singleton del registro
export const globalStylesheets = new GlobalStylesheetsRegistry();
