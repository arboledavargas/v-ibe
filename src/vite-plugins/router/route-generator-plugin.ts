import type { Plugin, ViteDevServer } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'node:crypto';
import { scanDirectory, type ParsedRoute } from '../../router/static-analysis/scanner';

/**
 * Opciones de configuración para el plugin de generación de rutas
 * 
 * IMPORTANTE: Todas las rutas son relativas al directorio raíz del proyecto del usuario,
 * no al directorio del framework. El plugin se ejecuta en el contexto del proyecto
 * donde está instalado el framework como dependencia.
 */
export interface RouteGeneratorPluginOptions {
  /**
   * Directorio raíz donde buscar archivos con decoradores @Route
   * Relativo al root del proyecto del usuario
   * @default 'app'
   */
  srcDir?: string;
  
  /**
   * Ruta donde se generará el archivo de rutas
   * Relativo al root del proyecto del usuario
   * @default 'app/router/generated-routes.ts'
   */
  outputPath?: string;
  
  /**
   * Extensiones de archivo a escanear
   * @default ['.ts', '.tsx']
   */
  extensions?: string[];
  
  /**
   * Directorios a excluir del escaneo
   * @default ['node_modules', 'dist', 'build', '.git']
   */
  exclude?: string[];
  
  /**
   * Activar logs detallados
   * @default false
   */
  verbose?: boolean;
}

const DEFAULT_OPTIONS: Required<RouteGeneratorPluginOptions> = {
  srcDir: 'app',
  outputPath: 'app/router/generated-routes.ts',
  extensions: ['.ts', '.tsx'],
  exclude: ['node_modules', 'dist', 'build', '.git', 'framework'],
  verbose: false,
};

/**
 * Plugin de Vite para generación automática de rutas
 * 
 * Escanea el proyecto del usuario buscando decoradores @Route y genera un archivo
 * TypeScript con todas las rutas encontradas para registro automático en el Trie.
 * 
 * El plugin trabaja en el contexto del proyecto donde el framework está instalado,
 * por lo que todas las rutas son relativas al proyecto del usuario, no al framework.
 * 
 * @example
 * ```typescript
 * // vite.config.ts (en el proyecto del usuario)
 * import { routeGeneratorPlugin } from 'signalsframework/vite-plugins';
 * 
 * export default defineConfig({
 *   plugins: [
 *     routeGeneratorPlugin({
 *       srcDir: 'app',                              // carpeta del usuario
 *       outputPath: 'app/router/generated-routes.ts', // genera aquí
 *       verbose: true
 *     })
 *   ]
 * });
 * ```
 */
export function routeGeneratorPlugin(options: RouteGeneratorPluginOptions = {}): Plugin {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let server: ViteDevServer | undefined;
  let projectRoot: string;
  
  return {
    name: 'vite-plugin-route-generator',
    
    configResolved(resolvedConfig) {
      projectRoot = resolvedConfig.root;
      log(config, `\n🚀 Route Generator Plugin initialized`);
      log(config, `   Project root: ${projectRoot}`);
      log(config, `   Scanning: ${config.srcDir}`);
      log(config, `   Output: ${config.outputPath}\n`);
    },
    
    async buildStart() {
      log(config, '\n🔍 Scanning for routes...\n');
      await generateRoutesFile(projectRoot, config);
    },
    
    configureServer(devServer) {
      server = devServer;
      
      // Watch para cambios en archivos con @Route
      devServer.watcher.on('change', async (filePath) => {
        if (shouldProcessFile(filePath, config)) {
          log(config, `\n📝 File changed: ${path.basename(filePath)}`);
          await regenerateRoutes(projectRoot, config, server);
        }
      });
      
      devServer.watcher.on('add', async (filePath) => {
        if (shouldProcessFile(filePath, config)) {
          log(config, `\n➕ File added: ${path.basename(filePath)}`);
          await regenerateRoutes(projectRoot, config, server);
        }
      });
      
      devServer.watcher.on('unlink', async (filePath) => {
        if (shouldProcessFile(filePath, config)) {
          log(config, `\n➖ File removed: ${path.basename(filePath)}`);
          await regenerateRoutes(projectRoot, config, server);
        }
      });
    },
  };
}

/**
 * Genera el archivo de rutas escaneando el directorio configurado
 */
async function generateRoutesFile(
  projectRoot: string,
  config: Required<RouteGeneratorPluginOptions>
): Promise<void> {
  const srcPath = path.resolve(projectRoot, config.srcDir);
  
  try {
    const result = await scanDirectory(srcPath, {
      extensions: config.extensions,
      exclude: config.exclude,
      verbose: false, // Silencioso para no contaminar logs
    });
    
    if (result.totalRoutes === 0) {
      log(config, `⚠️  No routes found in ${config.srcDir}`);
      log(config, `   Make sure you have classes decorated with @Route`);
      return;
    }
    
    log(config, `✅ Found ${result.totalRoutes} routes in ${result.filesWithRoutes} files`);
    
    const generatedCode = generateTypeScriptCode(result.routes, projectRoot, config);
    const outputPath = path.resolve(projectRoot, config.outputPath);
    
    await ensureDirectoryExists(path.dirname(outputPath));
    await fs.writeFile(outputPath, generatedCode, 'utf-8');
    
    log(config, `✅ Routes file generated: ${config.outputPath}\n`);
  } catch (error) {
    console.error('❌ Error generating routes:', error);
    console.error('   Check that the srcDir exists and contains valid TypeScript files');
    throw error;
  }
}

/**
 * Regenera el archivo de rutas y notifica al servidor de desarrollo
 */
async function regenerateRoutes(
  projectRoot: string,
  config: Required<RouteGeneratorPluginOptions>,
  server?: ViteDevServer
): Promise<void> {
  await generateRoutesFile(projectRoot, config);
  
  if (server) {
    const outputPath = path.resolve(projectRoot, config.outputPath);
    const module = server.moduleGraph.getModuleById(outputPath);
    
    if (module) {
      server.moduleGraph.invalidateModule(module);
      server.ws.send({
        type: 'full-reload',
        path: '*',
      });
      log(config, '🔄 Hot reload triggered\n');
    }
  }
}

/**
 * Genera el código TypeScript con todas las rutas
 */
function generateTypeScriptCode(
  routes: ParsedRoute[], 
  projectRoot: string,
  config: Required<RouteGeneratorPluginOptions>
): string {
  const imports = generateImports(routes, projectRoot, config);
  const routesArray = generateRoutesArray(routes, projectRoot, config);
  const typeDefinitions = generateTypeDefinitions(routes);
  const routeTypes = generateRouteTypes(routes);
  
  return `/**
 * 🚀 Auto-generated routes file
 * 
 * This file is automatically generated by vite-plugin-route-generator.
 * Do not edit manually - your changes will be overwritten!
 * 
 * Generated at: ${new Date().toISOString()}
 * Total routes: ${routes.length}
 */

${imports}

${typeDefinitions}

${routeTypes}

/**
 * Array de todas las rutas encontradas en el proyecto
 * 
 * Este array es importado automáticamente por el Router durante el bootstrap.
 * No necesitas importarlo manualmente.
 */
const generatedRoutes: GeneratedRoute[] = ${routesArray};

export default generatedRoutes;
`;
}

/**
 * Genera los imports necesarios (policies)
 * Los componentes se cargan con dynamic imports, pero policies necesitan imports estáticos
 */
function generateImports(routes: ParsedRoute[], projectRoot: string, config: Required<RouteGeneratorPluginOptions>): string {
  const policyImports = generatePolicyImports(routes, projectRoot, config);
  
  if (policyImports.length === 0) {
    return '// All components are lazy loaded with dynamic imports';
  }
  
  return `// Policy imports
${policyImports}

// All components are lazy loaded with dynamic imports`;
}

/**
 * Genera imports de policies usadas en las rutas
 */
function generatePolicyImports(
  routes: ParsedRoute[], 
  projectRoot: string,
  config: Required<RouteGeneratorPluginOptions>
): string {
  // Extraer todas las políticas únicas
  const policySet = new Map<string, string>();
  
  routes.forEach(route => {
    if (route.policies && route.policies.length > 0) {
      route.policies.forEach((policyName: string) => {
        if (!policySet.has(policyName)) {
          // Buscar el archivo de la política
          const policyPath = findPolicyFile(policyName, projectRoot, config);
          if (policyPath) {
            policySet.set(policyName, policyPath);
          }
        }
      });
    }
  });
  
  // Generar imports
  const imports: string[] = [];
  policySet.forEach((filePath, policyName) => {
    const relativePath = getRelativeImportPath(filePath, projectRoot, config);
    imports.push(`import { ${policyName} } from '${relativePath}';`);
  });
  
  return imports.join('\n');
}

/**
 * Busca el archivo que contiene una policy
 * Asume que está en srcDir/policies/ o srcDir/policy/
 */
function findPolicyFile(
  policyName: string,
  projectRoot: string,
  config: Required<RouteGeneratorPluginOptions>
): string | null {
  const srcDir = path.resolve(projectRoot, config.srcDir);
  
  // Posibles ubicaciones de políticas
  const possiblePaths = [
    path.join(srcDir, 'policies', `${kebabCase(policyName)}.ts`),
    path.join(srcDir, 'policies', `${kebabCase(policyName)}.tsx`),
    path.join(srcDir, 'policy', `${kebabCase(policyName)}.ts`),
    path.join(srcDir, 'policy', `${kebabCase(policyName)}.tsx`),
    path.join(srcDir, 'policies', `${camelToKebab(policyName)}.policy.ts`),
    path.join(srcDir, 'policies', `${camelToKebab(policyName)}.policy.tsx`),
  ];
  
  // Intentar encontrar el archivo
  for (const possiblePath of possiblePaths) {
    try {
      // Si existe, retornarlo
      if (existsSync(possiblePath)) {
        return possiblePath;
      }
    } catch {
      continue;
    }
  }
  
  // Si no se encuentra, asumir convención de nombres
  return path.join(srcDir, 'policies', `${camelToKebab(policyName)}.policy.ts`);
}

/**
 * Convierte PascalCase a kebab-case
 */
function camelToKebab(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/-?policy$/, ''); // Remover "policy" y el guion antes si existe
}

/**
 * Convierte nombre a kebab-case simple
 */
function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Genera el array de rutas con toda la información
 * Usa dynamic imports para lazy loading de componentes
 */
function generateRoutesArray(
  routes: ParsedRoute[],
  projectRoot: string,
  config: Required<RouteGeneratorPluginOptions>
): string {
  const routeObjects = routes.map((route) => {
    const relativePath = getRelativeImportPath(route.filePath, projectRoot, config);
    const metadata = route.metadata ? JSON.stringify(route.metadata) : 'undefined';
    const policies = route.policies
      ? `[${route.policies.join(', ')}]`
      : 'undefined';
    const slot = route.slot ? `'${route.slot}'` : 'undefined';

    // Generar UUID único para esta ruta
    const routeId = randomUUID();

    return `  {
    id: '${routeId}',
    path: '${route.path}',
    className: '${route.className}',
    loader: async (signal?: AbortSignal) => {
      const module = await import('${relativePath}');
      return { default: module.${route.className} };
    },
    metadata: ${metadata},
    policies: ${policies},
    slot: ${slot},
  }`;
  });

  return `[\n${routeObjects.join(',\n')}\n]`;
}

/**
 * Genera las definiciones de tipos TypeScript
 */
function generateTypeDefinitions(routes: ParsedRoute[]): string {
  return `// Types will be defined after Routes type is generated
`;
}

/**
 * Extrae los parámetros de una ruta
 * Ejemplo: '/store/:storeId/product/:productId' -> ['storeId', 'productId']
 */
function extractRouteParams(path: string): string[] {
  const matches = path.match(/:([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return matches.map(match => match.slice(1)); // Remover el ':'
}

/**
 * Genera los tipos de TypeScript para las rutas
 * Incluye tipos para paths y parámetros con autocompletado
 */
function generateRouteTypes(routes: ParsedRoute[]): string {
  // Crear un mapa de path a parámetros para evitar duplicados
  const pathParamsMap = new Map<string, string[]>();
  routes.forEach(route => {
    if (!pathParamsMap.has(route.path)) {
      pathParamsMap.set(route.path, extractRouteParams(route.path));
    }
  });
  
  // Generar tipos condicionales para parámetros (sin duplicados)
  const paramTypes = Array.from(pathParamsMap.entries()).map(([path, params]) => {
    if (params.length === 0) {
      return `  '${path}': Record<string, never>;`;
    }
    
    const paramObject = params.map(p => `${p}: string`).join('; ');
    return `  '${path}': { ${paramObject} };`;
  }).join('\n');
  
  return `/**
 * 🎯 Tipos de rutas generados automáticamente
 * 
 * Estos tipos proporcionan autocompletado y validación de tipos para router.navigate()
 */

/**
 * Mapeo de todas las rutas a sus parámetros requeridos
 * 
 * @example
 * // Ruta sin parámetros
 * Routes['/'] -> Record<string, never>
 * 
 * @example
 * // Ruta con parámetros
 * Routes['/store/:storeId'] -> { storeId: string }
 * 
 * @example
 * // Obtener todas las rutas disponibles
 * type AllPaths = keyof Routes; // '/' | '/callback' | '/store/:storeId' | ...
 */
export type Routes = {
${paramTypes}
};

/**
 * Tipo para una ruta generada
 * El path está tipado con las rutas disponibles (keyof Routes)
 */
export interface GeneratedRoute {
  id: string;
  path: keyof Routes;
  className: string;
  loader: (signal?: AbortSignal) => Promise<{ default: any }>;
  metadata?: Record<string, any>;
  policies?: (new (...args: any[]) => any)[];
  slot?: string;
}
`;
}



/**
 * Obtiene la ruta relativa para el import
 * Calcula la ruta desde donde estará el archivo generado hacia el archivo del componente
 */
function getRelativeImportPath(
  absolutePath: string, 
  projectRoot: string,
  config: Required<RouteGeneratorPluginOptions>
): string {
  // Directorio donde estará el archivo generado
  const outputDir = path.dirname(path.join(projectRoot, config.outputPath));
  
  // Calcular ruta relativa desde el archivo generado hacia el componente
  const relativePath = path.relative(outputDir, absolutePath);
  
  // Remover extensión y normalizar
  const withoutExt = relativePath.replace(/\.(ts|tsx)$/, '');
  const normalized = withoutExt.startsWith('.') ? withoutExt : `./${withoutExt}`;
  
  return normalized.replace(/\\/g, '/');
}

/**
 * Verifica si un archivo debe ser procesado por el plugin
 */
function shouldProcessFile(
  filePath: string,
  config: Required<RouteGeneratorPluginOptions>
): boolean {
  // Verificar extensión
  if (!config.extensions.some(ext => filePath.endsWith(ext))) {
    return false;
  }
  
  // Verificar exclusiones
  if (config.exclude.some(excluded => filePath.includes(excluded))) {
    return false;
  }
  
  // No procesar el archivo generado
  if (filePath.includes('generated-routes')) {
    return false;
  }
  
  return true;
}

/**
 * Asegura que un directorio existe, creándolo si es necesario
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Logger condicional
 */
function log(config: Required<RouteGeneratorPluginOptions>, message: string): void {
  if (config.verbose) {
    console.log(message);
  }
}