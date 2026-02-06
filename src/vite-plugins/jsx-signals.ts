/**
 * Plugin de Vite que transforma automáticamente expresiones JSX con 'this' en arrow functions
 * para habilitar reactividad lazy.
 * 
 * Transforma:
 *   <div className={this.active ? 'on' : 'off'}>{this.count}</div>
 * En:
 *   <div className={() => this.active ? 'on' : 'off'}>{() => this.count}</div>
 * 
 * Permite escribir JSX natural mientras el framework detecta dependencias reactivas
 * y re-ejecuta solo cuando cambian las signals. No transforma event handlers (onClick, etc.).
 */
import ts from "typescript";
import type { Plugin } from "vite";

export function jsxSignalsPlugin(): Plugin {
  return {
    name: "jsx-signals",
    enforce: "pre",
    transform(code: string, id: string) {
      if (!id.endsWith(".tsx") && !id.endsWith(".jsx")) {
        return null;
      }

      const sourceFile = ts.createSourceFile(
        id,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
        return (sourceFile) => {
          const visit = (node: ts.Node): ts.Node => {

            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === 'map') {
            }

            // Detectar atributos JSX con expresiones
            if (
              ts.isJsxAttribute(node) &&
              node.initializer &&
              ts.isJsxExpression(node.initializer)
            ) {
              const attributeName = node.name.getText(sourceFile);
              const jsxExpression = node.initializer;

              // No transformar event handlers (onClick, onInput, etc.)
              if (isEventHandler(attributeName)) {
                return ts.visitEachChild(node, visit, context);
              }

              // Solo procesar si la expresión contiene 'this'
              if (
                jsxExpression.expression &&
                containsThis(jsxExpression.expression)
              ) {
                // No envolver si ya es una función (arrow function o function expression)
                // Esto evita el doble wrapping: () => () => value
                if (ts.isArrowFunction(jsxExpression.expression) || 
                    ts.isFunctionExpression(jsxExpression.expression)) {
                  return ts.visitEachChild(node, visit, context);
                }

                // Crear arrow function que envuelve la expresión
                const arrowFunction = ts.factory.createArrowFunction(
                  undefined,
                  undefined,
                  [],
                  undefined,
                  ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                  jsxExpression.expression,
                );

                // Crear nueva expresión JSX con la arrow function
                const newJsxExpression = ts.factory.updateJsxExpression(
                  jsxExpression,
                  arrowFunction,
                );

                // Retornar el atributo actualizado
                return ts.factory.updateJsxAttribute(
                  node,
                  node.name,
                  newJsxExpression,
                );
              }
            }

            // Manejar expresiones JSX regulares (como children) que NO son atributos
            // Manejar expresiones JSX regulares (como children) que NO son atributos
            if (
              ts.isJsxExpression(node) &&
              node.expression &&
              !ts.isJsxAttribute(node.parent)
            ) {
              const expr = node.expression;

              // No envolver si ya es una función
              if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
                return ts.visitEachChild(node, visit, context);
              }

              // Si es un CallExpression (como .map()), descender dentro PRIMERO
              if (ts.isCallExpression(expr)) {
                // ✅ Visitar los hijos primero (esto procesa el JSX dentro del .map())
                const visitedNode = ts.visitEachChild(node, visit, context) as ts.JsxExpression;
                const visitedExpr = visitedNode.expression!;

                // Después, si contiene 'this', envolver
                if (containsThis(visitedExpr)) {

                  const arrowFunction = ts.factory.createArrowFunction(
                    undefined,
                    undefined,
                    [],
                    undefined,
                    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    visitedExpr,
                  );

                  return ts.factory.updateJsxExpression(visitedNode, arrowFunction);
                }

                return visitedNode;
              }

              // Para otras expresiones con 'this', primero visitar hijos y luego envolver
              if (containsThis(expr)) {

                // ✅ Visitar hijos primero
                const visitedNode = ts.visitEachChild(node, visit, context) as ts.JsxExpression;
                const visitedExpr = visitedNode.expression!;

                const arrowFunction = ts.factory.createArrowFunction(
                  undefined,
                  undefined,
                  [],
                  undefined,
                  ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                  visitedExpr,
                );

                return ts.factory.updateJsxExpression(visitedNode, arrowFunction);
              }
            }

            return ts.visitEachChild(node, visit, context);
          };

          // Visitar el SourceFile correctamente
          return ts.visitEachChild(sourceFile, visit, context);
        };
      };

      // Función helper para detectar event handlers
      function isEventHandler(attributeName: string): boolean {
        return attributeName.startsWith("on") && attributeName.length > 2;
      }

      // Función helper para detectar si una expresión contiene 'this'
      function containsThis(expr: ts.Node): boolean {
        let hasThis = false;

        const visitor = (node: ts.Node) => {
          if (hasThis) return;

          // Detectar this.prop, this.method(), this[key], etc.
          if (
            (ts.isPropertyAccessExpression(node) &&
              node.expression.kind === ts.SyntaxKind.ThisKeyword) ||
            (ts.isElementAccessExpression(node) &&
              node.expression.kind === ts.SyntaxKind.ThisKeyword) ||
            (ts.isCallExpression(node) &&
              ts.isPropertyAccessExpression(node.expression) &&
              node.expression.expression.kind === ts.SyntaxKind.ThisKeyword) ||
            node.kind === ts.SyntaxKind.ThisKeyword
          ) {
            hasThis = true;
            return;
          }

          ts.forEachChild(node, visitor);
        };

        visitor(expr);
        return hasThis;
      }

      const result = ts.transform(sourceFile, [transformer]);
      const transformedFile = result.transformed[0] as ts.SourceFile;

      const printer = ts.createPrinter({
        newLine: ts.NewLineKind.LineFeed,
        removeComments: false,
        omitTrailingSemicolon: false,
      });

      const newCode = printer.printFile(transformedFile);

      result.dispose();

      return {
        code: newCode,
        map: null,
      };
    },
  };
}
