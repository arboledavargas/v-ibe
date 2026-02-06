/**
 * VITE JSX CONTROL FLOW TRANSFORM PLUGIN
 * 
 * Transforma sintaxis JSX especial de control flow (For, Show, Switch)
 * en llamadas de función directas.
 * 
 * Transformaciones:
 * 
 * <For each={arr}>{(item) => ...}</For>
 * ⬇️
 * For({ each: arr, children: (item) => ... })
 * 
 * <Show when={cond}>{content}</Show>
 * ⬇️
 * Show({ when: cond, children: content })
 */

import ts from 'typescript';
import type { Plugin } from 'vite';

/**
 * Lista de componentes que deben transformarse
 * Estos NO son Web Components reales, son funciones helper
 */
const CONTROL_FLOW_COMPONENTS = new Set([
  'For',
  'ForEach',
  'IndexFor',
  'Show',
  'Switch'
]);

export function jsxControlFlowPlugin(): Plugin {
  return {
    name: 'jsx-control-flow-transform',
    enforce: 'pre', // Debe ejecutarse ANTES del transform de React/JSX
    
    transform(code: string, id: string) {
      // Solo procesar archivos TSX/JSX
      if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) {
        return null;
      }
      
      // Quick check: si no hay control flow components, skip
      // Usar regex para match exacto de tag names con word boundaries
      const hasControlFlow = Array.from(CONTROL_FLOW_COMPONENTS).some(
        name => {
          const regex = new RegExp(`<${name}(?:\\s|>|/)`, 'g');
          return regex.test(code);
        }
      );
      
      if (!hasControlFlow) {
        return null;
      }
      
      // Parsear el código
      const sourceFile = ts.createSourceFile(
        id,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      
      // Transformer
      const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
        const visit: ts.Visitor = (node: ts.Node): ts.Node => {
          // Buscar JSX elements que sean control flow components
          if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
            const tagName = getJsxTagName(node);
            
            if (CONTROL_FLOW_COMPONENTS.has(tagName)) {
              // Transformar a function call
              const functionCall = transformControlFlowToFunctionCall(node, context);
              
              // Si el parent es un JSX element, envolver en JsxExpression
              if (isInsideJsx(node)) {
                return ts.factory.createJsxExpression(undefined, functionCall);
              }
              
              return functionCall;
            }
          }
          
          return ts.visitEachChild(node, visit, context);
        };
        
        return (sf: ts.SourceFile) => ts.visitNode(sf, visit) as ts.SourceFile;
      };
      
      // Aplicar transformation
      const result = ts.transform(sourceFile, [transformer]);
      const transformedFile = result.transformed[0] as ts.SourceFile;
      
      // Print back to code
      const printer = ts.createPrinter({
        newLine: ts.NewLineKind.LineFeed,
        removeComments: false
      });
      
      const newCode = printer.printFile(transformedFile);
      
      result.dispose();
      
      return {
        code: newCode,
        map: null
      };
    }
  };
}

/**
 * Verifica si un nodo está dentro de un contexto JSX (como child de otro JSX element)
 */
function isInsideJsx(node: ts.Node): boolean {
  let parent = node.parent;
  
  // Si el parent es JsxElement, estamos dentro de JSX
  if (parent && ts.isJsxElement(parent)) {
    return true;
  }
  
  // Si el parent es JsxExpression que está dentro de JsxElement
  while (parent) {
    if (ts.isJsxElement(parent) || ts.isJsxFragment(parent)) {
      return true;
    }
    parent = parent.parent;
  }
  
  return false;
}

/**
 * Obtiene el tag name de un JSX element
 */
function getJsxTagName(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  if (ts.isJsxElement(node)) {
    const openingElement = node.openingElement;
    const tagNameNode = openingElement.tagName;
    
    if (ts.isIdentifier(tagNameNode)) {
      return tagNameNode.text;
    }
  } else if (ts.isJsxSelfClosingElement(node)) {
    const tagNameNode = node.tagName;
    
    if (ts.isIdentifier(tagNameNode)) {
      return tagNameNode.text;
    }
  }
  
  return '';
}

/**
 * Transforma un JSX control flow element en una function call
 * 
 * <For each={arr}>{(item) => ...}</For>
 * ⬇️
 * For({ each: arr, children: (item) => ... })
 */
function transformControlFlowToFunctionCall(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  context: ts.TransformationContext
): ts.CallExpression {
  const tagName = getJsxTagName(node);
  
  // Extraer props del JSX
  const attributes = ts.isJsxElement(node)
    ? node.openingElement.attributes
    : node.attributes;
  
  // Extraer children (solo para JsxElement, no para SelfClosing)
  let childrenExpression: ts.Expression | undefined;
  
  if (ts.isJsxElement(node)) {
    // Procesar children
    const children = node.children;
    
    if (children.length > 0) {
      // Filtrar children válidos (ignorar whitespace)
      const validChildren = children.filter(child => 
        !ts.isJsxText(child) || child.text.trim().length > 0
      );
      
      // Si hay un solo child, usarlo directamente (no array)
      if (validChildren.length === 1) {
        const child = validChildren[0];
        
        if (ts.isJsxExpression(child) && child.expression) {
          childrenExpression = child.expression;
        } else if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
          // Mantener el JSX tal cual - el visitor principal ya lo transformará
          childrenExpression = child;
        } else if (ts.isJsxText(child)) {
          childrenExpression = ts.factory.createStringLiteral(child.text.trim());
        }
      } else if (validChildren.length > 1) {
        // Múltiples children: crear array
        const childElements = validChildren.map(child => {
          if (ts.isJsxExpression(child) && child.expression) {
            return child.expression;
          }
          if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
            // Mantener el JSX tal cual - el visitor principal ya lo transformará
            return child;
          }
          if (ts.isJsxText(child)) {
            return ts.factory.createStringLiteral(child.text.trim());
          }
          return ts.factory.createNull();
        });
        
        childrenExpression = ts.factory.createArrayLiteralExpression(
          childElements,
          false
        );
      }
    }
  }
  
  // Construir el objeto de props
  const propsProperties: ts.ObjectLiteralElementLike[] = [];
  
  // Agregar props del JSX
  attributes.properties.forEach(prop => {
    if (ts.isJsxAttribute(prop)) {
      const propName = ts.isIdentifier(prop.name) ? prop.name.text : prop.name.getText();
      let propValue: ts.Expression;
      
      if (prop.initializer) {
        if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
          // Mantener la expresión tal cual - el visitor principal ya la transformará
          propValue = prop.initializer.expression;
        } else if (ts.isStringLiteral(prop.initializer)) {
          propValue = prop.initializer;
        } else {
          propValue = ts.factory.createTrue();
        }
      } else {
        propValue = ts.factory.createTrue();
      }
      
      propsProperties.push(
        ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier(propName),
          propValue
        )
      );
    }
  });
  
  // Agregar children como prop si existe
  if (childrenExpression) {
    propsProperties.push(
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier('children'),
        childrenExpression
      )
    );
  }
  
  // Crear el objeto de props
  const propsObject = ts.factory.createObjectLiteralExpression(
    propsProperties,
    true
  );
  
  // Crear la function call: For({ ... })
  const functionCall = ts.factory.createCallExpression(
    ts.factory.createIdentifier(tagName), // Function name
    undefined, // Type arguments
    [propsObject] // Arguments
  );
  
  return functionCall;
}

/**
 * EJEMPLO DE TRANSFORMACIÓN
 * 
 * INPUT:
 * ```tsx
 * <For each={this.items}>
 *   {(item, index) => (
 *     <div key={item.id}>{item.name}</div>
 *   )}
 * </For>
 * ```
 * 
 * OUTPUT:
 * ```tsx
 * For({
 *   each: this.items,
 *   children: (item, index) => (
 *     <div key={item.id}>{item.name}</div>
 *   )
 * })
 * ```
 * 
 * ---
 * 
 * INPUT:
 * ```tsx
 * <Show when={this.isVisible} fallback={<Loading />}>
 *   <Content />
 * </Show>
 * ```
 * 
 * OUTPUT:
 * ```tsx
 * Show({
 *   when: this.isVisible,
 *   fallback: <Loading />,
 *   children: <Content />
 * })
 * ```
 * 
 * ---
 * 
 * INPUT:
 * ```tsx
 * <For each={[]} fallback={<p>Empty</p>}>
 *   {(item) => <div>{item}</div>}
 * </For>
 * ```
 * 
 * OUTPUT:
 * ```tsx
 * For({
 *   each: [],
 *   fallback: <p>Empty</p>,
 *   children: (item) => <div>{item}</div>
 * })
 * ```
 */
