import * as ts from 'typescript';

export interface ParsedRoute {
  path: string;
  className: string;
  filePath: string;
  metadata?: Record<string, any>;
  policies?: string[];
  slot?: string;
  raw: string;
}

/**
 * Parser básico de decoradores @Route
 * Lee un archivo TypeScript y detecta decoradores @Route
 */
export function parseRouteDecorators(filePath: string): ParsedRoute[] {
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
  });
  
  const sourceFile = program.getSourceFile(filePath);
  
  if (!sourceFile) {
    throw new Error(`Could not load source file: ${filePath}`);
  }
  
  const routes: ParsedRoute[] = [];
  
  // Asegurar que sourceFile no es undefined para TypeScript
  const sourceFileNonNull: ts.SourceFile = sourceFile;
  
  function visit(node: ts.Node) {
    // Buscar clases
    if (ts.isClassDeclaration(node)) {
      const className = node.name?.getText(sourceFileNonNull) || 'AnonymousClass';
      
      // En TypeScript 5.x, los decoradores están en getDecorators
      let decorators: readonly ts.Decorator[] | undefined;
      
      if (ts.canHaveDecorators(node)) {
        decorators = ts.getDecorators(node);
      }
      
      // Fallback para versiones antiguas de TypeScript
      if (!decorators && (node as any).decorators) {
        decorators = (node as any).decorators;
      }
      
      if (decorators && decorators.length > 0) {
        decorators.forEach(decorator => {
          const text = decorator.getText(sourceFileNonNull);
          
          // Detectar si es un decorador @Route
          if (text.includes('@Route') || text.includes('Route(')) {
            // Intentar extraer el path del decorador
            const parsedRoute = parseRouteDecoratorExpression(decorator, sourceFileNonNull, className, filePath);
            
            if (parsedRoute) {
              routes.push(parsedRoute);
            } else {
              // Fallback: guardar la información raw
              routes.push({
                raw: text,
                className,
                filePath,
                path: '', // No pudimos extraer el path
              });
            }
          }
        });
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFileNonNull);
  
  return routes;
}

/**
 * Intenta parsear la expresión del decorador @Route para extraer el path y config
 */
function parseRouteDecoratorExpression(
  decorator: ts.Decorator,
  sourceFile: ts.SourceFile,
  className: string,
  filePath: string
): ParsedRoute | null {
  const expression = decorator.expression;
  
  // @Route('/path')
  if (ts.isCallExpression(expression)) {
    const args = expression.arguments;
    
    if (args.length > 0) {
      const pathArg = args[0];
      
      // El primer argumento debe ser un string literal
      if (ts.isStringLiteral(pathArg)) {
        const path = pathArg.text;
        const raw = decorator.getText(sourceFile);
        
        const result: ParsedRoute = {
          path,
          className,
          filePath,
          raw,
        };
        
        // Si hay un segundo argumento (config), intentar parsearlo
        if (args.length > 1) {
          const configArg = args[1];
          
          if (ts.isObjectLiteralExpression(configArg)) {
            const config = parseConfigObject(configArg, sourceFile);
            
            if (config.metadata) {
              result.metadata = config.metadata;
            }
            
            if (config.policies) {
              result.policies = config.policies;
            }
            
            if (config.slot) {
              result.slot = config.slot;
            }
          }
        }
        
        return result;
      }
    }
  }
  
  return null;
}

/**
 * Parsea el objeto de configuración del decorador @Route
 */
function parseConfigObject(
  objectLiteral: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile
): { metadata?: Record<string, any>; policies?: string[]; slot?: string } {
  const config: { metadata?: Record<string, any>; policies?: string[]; slot?: string } = {};
  
  objectLiteral.properties.forEach(prop => {
    if (ts.isPropertyAssignment(prop)) {
      const name = prop.name.getText(sourceFile);
      
      if (name === 'policies' && ts.isArrayLiteralExpression(prop.initializer)) {
        // Extraer nombres de las políticas
        config.policies = prop.initializer.elements
          .map(el => el.getText(sourceFile))
          .filter(Boolean);
      } else if (name === 'metadata' && ts.isObjectLiteralExpression(prop.initializer)) {
        // Parsear metadata completa
        config.metadata = parseMetadataObject(prop.initializer, sourceFile);
      } else if (name === 'slot' && ts.isStringLiteral(prop.initializer)) {
        // Extraer el nombre del slot
        config.slot = prop.initializer.text;
      }
    }
  });
  
  return config;
}

/**
 * Parsea un objeto literal de metadata y extrae sus valores
 */
function parseMetadataObject(
  objectLiteral: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile
): Record<string, any> {
  const metadata: Record<string, any> = {};
  
  objectLiteral.properties.forEach(prop => {
    if (ts.isPropertyAssignment(prop)) {
      const key = prop.name.getText(sourceFile);
      const value = parseValue(prop.initializer, sourceFile);
      metadata[key] = value;
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      // { key } syntax
      const key = prop.name.getText(sourceFile);
      metadata[key] = key; // Shorthand properties are just the key name
    }
  });
  
  return metadata;
}

/**
 * Parsea un valor de TypeScript a su valor JavaScript
 */
function parseValue(node: ts.Expression, sourceFile: ts.SourceFile): any {
  // Boolean literals
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  
  // String literals
  if (ts.isStringLiteral(node)) {
    return node.text;
  }
  
  // Numeric literals
  if (ts.isNumericLiteral(node)) {
    const num = parseFloat(node.text);
    return isNaN(num) ? node.text : num;
  }
  
  // Null/Undefined
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
    return undefined;
  }
  
  // Object literals (nested objects)
  if (ts.isObjectLiteralExpression(node)) {
    return parseMetadataObject(node, sourceFile);
  }
  
  // Array literals
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map(el => parseValue(el, sourceFile));
  }
  
  // Template strings
  if (ts.isTemplateExpression(node)) {
    // For template strings, we'll just get the text representation
    return node.getText(sourceFile);
  }
  
  // For other expressions (identifiers, property access, etc.), return the text
  // This handles cases like: metadata: { flag: someConstant }
  return node.getText(sourceFile);
}