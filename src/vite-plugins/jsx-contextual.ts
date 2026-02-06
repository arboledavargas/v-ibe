// vite-plugin-jsx-contextual.ts
import { Plugin } from "vite";
import ts from "typescript";

/**
 * Transforma TODAS las llamadas a `jsx`, `jsxs`, `jsxDEV`
 * en `this.jsx`, `this.jsxs`, `this.jsxDEV`
 * incluso si están anidadas.
 */
export function jsxContextualPlugin(): Plugin {
  return {
    name: "vite-plugin-jsx-contextual",
    enforce: "post", // Run AFTER esbuild transforms JSX

    transform(code, id) {
      if (!id.endsWith(".tsx") && !id.endsWith(".jsx")) return;

      const sourceFile = ts.createSourceFile(
        id,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      const transformerFactory: ts.TransformerFactory<ts.SourceFile> = (
        context,
      ) => {
        const visitor: ts.Visitor = (node) => {
          if (ts.isCallExpression(node)) {
            if (
              ts.isIdentifier(node.expression) &&
              ["jsx", "jsxs", "jsxDEV"].includes(node.expression.text)
            ) {
              const newExpr = ts.factory.createPropertyAccessExpression(
                ts.factory.createThis(),
                ts.factory.createIdentifier(node.expression.text),
              );

              const newArgs = node.arguments.map((arg) =>
                ts.visitNode(arg, visitor) as ts.Expression,
              );

              return ts.factory.updateCallExpression(
                node,
                newExpr,
                node.typeArguments,
                newArgs,
              );
            }
          }

          return ts.visitEachChild(node, visitor, context);
        };

        // ✅ aseguramos que siempre devolvemos un `SourceFile`
        return (sf: ts.SourceFile) => ts.visitEachChild(sf, visitor, context);
      };

      const result = ts.transform(sourceFile, [transformerFactory]);
      const transformed = result.transformed[0] as ts.SourceFile;

      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
      const newCode = printer.printFile(transformed);

      result.dispose();

      return {
        code: newCode,
        map: null,
      };
    },
  };
}
