/**
 * Static Analysis Module for Route Decorators
 * 
 * Este módulo proporciona herramientas para analizar estáticamente
 * decoradores @Route en archivos TypeScript y extraer información
 * sobre las rutas de la aplicación.
 * 
 * @module static-analysis
 * @packageDocumentation
 */

export { parseRouteDecorators, type ParsedRoute } from './parser';
export { 
  scanDirectory, 
  printScanSummary,
  type ScanResult,
  type ScanOptions 
} from './scanner';

/**
 * @example Parser básico
 * ```typescript
 * import { parseRouteDecorators } from '@framework/router/static-analysis';
 * 
 * const routes = parseRouteDecorators('./src/pages/products.ts');
 * console.log(routes);
 * // [
 * //   {
 * //     path: '/products',
 * //     className: 'ProductsPage',
 * //     filePath: './src/pages/products.ts',
 * //     raw: '@Route("/products")'
 * //   }
 * // ]
 * ```
 * 
 * @example Scanner de directorios
 * ```typescript
 * import { scanDirectory } from '@framework/router/static-analysis';
 * 
 * const result = await scanDirectory('./src/pages');
 * console.log(`Found ${result.totalRoutes} routes in ${result.filesWithRoutes} files`);
 * ```
 */