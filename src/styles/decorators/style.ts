export function Style(selector: string) {
  return function <This extends object, Value>(
    target: (this: This) => Value,
    context: ClassGetterDecoratorContext<This, Value>,
  ): void {
    if (context.kind !== "getter") {
      throw new Error("@Rule solo se puede aplicar a getters de clase.");
    }

    context.addInitializer(function () {
      // Solo registrar la regla, no crear el effect todavía
      if (!(this.constructor as any).__pendingRules) {
        (this.constructor as any).__pendingRules = [];
      }

      (this.constructor as any).__pendingRules.push({
        selector,
        styleGetter: target.bind(this),
        ruleIndexKey: Symbol(`css_rule_index_${String(context.name)}`),
      });
    });
  };
}
