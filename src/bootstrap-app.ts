import { bootstrap } from './DI/bootstrap';

/**
 * Options for bootstrapping the application
 */
export interface BootstrapAppOptions {
  /**
   * Root component tag name to render
   * @default 'route-view'
   */
  rootComponent?: string;

  /**
   * Target element to append the root component to
   * @default document.body
   */
  target?: HTMLElement;
}

/**
 * Bootstraps the application by:
 * 1. Initializing the DI container (registers and bootstraps all @Service classes)
 * 2. Rendering the root component
 * 
 * This is the recommended way to start your application.
 * 
 * @param options - Bootstrap options
 * 
 * @example Basic usage
 * ```typescript
 * import { bootstrapApp } from 'signalsframework';
 * 
 * await bootstrapApp();
 * ```
 * 
 * @example Custom root component
 * ```typescript
 * import { bootstrapApp } from 'signalsframework';
 * 
 * await bootstrapApp({
 *   rootComponent: 'my-app'
 * });
 * ```
 * 
 * @example Custom target
 * ```typescript
 * import { bootstrapApp } from 'signalsframework';
 * 
 * await bootstrapApp({
 *   target: document.getElementById('app-root')!
 * });
 * ```
 */
export async function bootstrapApp(options: BootstrapAppOptions = {}): Promise<void> {
  const {
    rootComponent = 'route-view',
    target = document.body
  } = options;

  try {
    // 1. Bootstrap DI container
    await bootstrap();

    // 2. Create and append root component
    const rootElement = document.createElement(rootComponent);
    target.appendChild(rootElement);
  } catch (error) {
    console.error('[Bootstrap] Error durante la inicialización:', error);
    
    // Show error in the UI
    target.innerHTML = `
      <div style="padding: 20px; border: 2px solid #ff4444; background: #fff5f5; border-radius: 4px; margin: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #ff4444;">❌ Error de Bootstrap</h3>
        <p style="margin: 0 0 10px 0; color: #333;">La aplicación falló al inicializar.</p>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto; font-size: 12px; border-radius: 3px; color: #333;">${error instanceof Error ? error.stack : String(error)}</pre>
      </div>
    `;
    
    throw error;
  }
}
