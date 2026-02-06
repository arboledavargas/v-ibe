/**
 * Decoradores de Scope para Estilos
 *
 * Estos decoradores marcan las clases de estilos con su alcance (scope):
 * - @Shared: Los estilos se aplican a todos los shadow roots (compartidos globalmente)
 * - @ForDocument: Los estilos se aplican al documento real (en el <head>)
 *
 * Si una clase de estilos no tiene ningún decorador, se considera "local"
 * y solo se aplica al componente específico que la declara.
 */

const STYLE_SCOPE_KEY = Symbol('styleScope');

export type StyleScope = 'local' | 'shared' | 'document';

/**
 * Marca una clase de estilos como compartida globalmente.
 * Los estilos @Shared se insertan en todos los shadow roots de la aplicación.
 *
 * Uso:
 * ```typescript
 * @Shared
 * class GlobalTheme extends BaseStyleSheet {
 *   styles() {
 *     return (
 *       <>
 *         <Rule selector=":host">
 *           color: {() => this.theme.primaryColor};
 *         </Rule>
 *       </>
 *     );
 *   }
 * }
 * ```
 */
export function Shared<T extends { new (...args: any[]): {} }>(
  target: T,
  context?: ClassDecoratorContext
): T {
  (target as any)[STYLE_SCOPE_KEY] = 'shared';
  return target;
}

/**
 * Marca una clase de estilos para aplicarse al documento completo.
 * Los estilos @ForDocument se insertan en el <head> del documento.
 *
 * Uso:
 * ```typescript
 * @ForDocument
 * class DocumentReset extends BaseStyleSheet {
 *   styles() {
 *     return (
 *       <>
 *         <Rule selector="*, *::before, *::after">
 *           box-sizing: border-box;
 *         </Rule>
 *         <Rule selector="body">
 *           margin: 0;
 *           padding: 0;
 *         </Rule>
 *       </>
 *     );
 *   }
 * }
 * ```
 */
export function ForDocument<T extends { new (...args: any[]): {} }>(
  target: T,
  context?: ClassDecoratorContext
): T {
  // Marcar la clase con el scope 'document'
  (target as any)[STYLE_SCOPE_KEY] = 'document';

  return target;
}

/**
 * Obtiene el scope de una clase de estilos.
 * Si no tiene decorador, retorna 'local' por defecto.
 */
export function getStyleScope(StyleClass: any): StyleScope {
  return (StyleClass as any)[STYLE_SCOPE_KEY] || 'local';
}
