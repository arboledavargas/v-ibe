/**
 * Setup file que se ejecuta antes de cada test
 * Aquí puedes configurar mocks globales, polyfills, etc.
 */

import { vi } from 'vitest';

// Si necesitas polyfills para el navegador, agrégalos aquí
// Por ejemplo, para requestIdleCallback que no existe en jsdom:
if (typeof globalThis.requestIdleCallback === 'undefined') {
  globalThis.requestIdleCallback = (callback: IdleRequestCallback) => {
    const start = Date.now();
    return setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 1) as any;
  };
}

if (typeof globalThis.cancelIdleCallback === 'undefined') {
  globalThis.cancelIdleCallback = (id: number) => {
    clearTimeout(id);
  };
}

// Mock del módulo virtual de rutas generadas
// Este mock permite que los tests funcionen sin necesidad del plugin de Vite
vi.mock('/virtual:generated-routes', () => ({
  routes: []
}));

// Resetear console.log para tests si quieres
// globalThis.console.log = vi.fn();
