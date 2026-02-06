import fs from 'fs/promises';
import path from 'path';
import { parseRouteDecorators, ParsedRoute } from './parser';

// Re-export ParsedRoute for external use
export type { ParsedRoute };

/**
 * Resultado del escaneo de directorios
 */
export interface ScanResult {
  routes: ParsedRoute[];
  filesScanned: number;
  filesWithRoutes: number;
  totalRoutes: number;
}

/**
 * Opciones para el scanner
 */
export interface ScanOptions {
  extensions?: string[];
  exclude?: string[];
  verbose?: boolean;
}

const DEFAULT_OPTIONS: Required<ScanOptions> = {
  extensions: ['.ts', '.tsx'],
  exclude: ['node_modules', 'dist', 'build', '.git'],
  verbose: false,
};

/**
 * Escanea recursivamente un directorio buscando archivos con decoradores @Route
 */
export async function scanDirectory(
  dirPath: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  log(config, `\n🔍 Scanning directory: ${dirPath}`);
  
  const files = await getAllTypeScriptFiles(dirPath, config);
  log(config, `📂 Found ${files.length} TypeScript files`);
  
  const routes = await extractRoutesFromFiles(files, config);
  
  const filesWithRoutes = new Set(routes.map(r => r.filePath)).size;
  
  return {
    routes,
    filesScanned: files.length,
    filesWithRoutes,
    totalRoutes: routes.length,
  };
}

/**
 * Obtiene todos los archivos TypeScript de forma recursiva
 */
async function getAllTypeScriptFiles(
  dirPath: string,
  config: Required<ScanOptions>
): Promise<string[]> {
  const files: string[] = [];
  
  await traverseDirectory(dirPath, async (filePath) => {
    if (isTypeScriptFile(filePath, config)) {
      files.push(filePath);
    }
  }, config);
  
  return files;
}

/**
 * Recorre recursivamente un directorio ejecutando una función por cada archivo
 */
async function traverseDirectory(
  dirPath: string,
  onFile: (filePath: string) => Promise<void>,
  config: Required<ScanOptions>
): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (shouldExcludeDirectory(entry.name, config)) {
          continue;
        }
        await traverseDirectory(fullPath, onFile, config);
      } else if (entry.isFile()) {
        await onFile(fullPath);
      }
    }
  } catch (error) {
    log(config, `⚠️  Cannot read directory: ${dirPath}`);
  }
}

/**
 * Verifica si un archivo es TypeScript según las extensiones configuradas
 */
function isTypeScriptFile(
  filePath: string,
  config: Required<ScanOptions>
): boolean {
  return config.extensions.some(ext => filePath.endsWith(ext));
}

/**
 * Verifica si un directorio debe ser excluido del escaneo
 */
function shouldExcludeDirectory(
  dirName: string,
  config: Required<ScanOptions>
): boolean {
  return config.exclude.includes(dirName);
}

/**
 * Extrae rutas de todos los archivos encontrados
 */
async function extractRoutesFromFiles(
  files: string[],
  config: Required<ScanOptions>
): Promise<ParsedRoute[]> {
  const allRoutes: ParsedRoute[] = [];
  
  for (const filePath of files) {
    const hasRoutes = await quickCheckForRouteDecorator(filePath);
    
    if (!hasRoutes) {
      continue;
    }
    
    try {
      const routes = parseRouteDecorators(filePath);
      
      if (routes.length > 0) {
        log(config, `  ✓ ${path.basename(filePath)}: ${routes.length} route(s)`);
        allRoutes.push(...routes);
      }
    } catch (error) {
      log(config, `  ✗ Error parsing ${filePath}: ${error}`);
    }
  }
  
  return allRoutes;
}

/**
 * Verifica rápidamente si un archivo contiene decoradores @Route
 * sin hacer parsing completo del AST
 */
async function quickCheckForRouteDecorator(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.includes('@Route');
  } catch {
    return false;
  }
}

/**
 * Logger condicional basado en verbose mode
 */
function log(config: Required<ScanOptions>, message: string): void {
  if (config.verbose) {
    console.log(message);
  }
}

/**
 * Imprime un resumen bonito del escaneo
 */
export function printScanSummary(result: ScanResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCAN SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files scanned:      ${result.filesScanned}`);
  console.log(`Files with routes:  ${result.filesWithRoutes}`);
  console.log(`Total routes found: ${result.totalRoutes}`);
  console.log('='.repeat(60) + '\n');
}