import { BaseComponent } from "../components/base-component";
import { HOST_KEY } from "../behaviors/constants";

/**
 * BaseStyleSheet - Core styling system for the framework
 *
 * This class provides reactive CSS styling for components using the @Rule decorator.
 * It manages a CSSStyleSheet internally and supports both Shadow DOM and document-level styles.
 *
 * Usage with @Rule decorator:
 * ```typescript
 * class MyStyles extends BaseStyleSheet {
 *   @State width = 100;
 *
 *   @Rule(':host')
 *   get hostStyles() {
 *     return {
 *       display: 'grid',
 *       width: this.width,  // Reactive!
 *     };
 *   }
 * }
 * ```
 */
export class BaseStyleSheet {
  protected stylesheet: CSSStyleSheet;
  protected ruleIndexMap: Map<string, number>;
  protected cleanupFunctions: (() => void)[] = [];
  protected selectorSymbolMap: Map<string, symbol> = new Map();

  // For @ForDocument styles - stores the <style> element in <head>
  protected documentStyleElement: HTMLStyleElement | null = null;
  protected documentRuleMap: Map<string, { index: number; effect: any }> = new Map();

  constructor() {
    this.stylesheet = new CSSStyleSheet();
    this.ruleIndexMap = new Map();
  }

  /**
   * Returns the internal CSSStyleSheet
   * Used by @UseStyles decorator to attach styles to components
   */
  public getStyleSheet(): CSSStyleSheet {
    return this.stylesheet;
  }

  /**
   * Sets the host component and initializes styles
   * Called by @UseStyles decorator when attaching styles to a component
   */
  public setHost(component: BaseComponent): void {
    // Inject the host component into the field decorated with @Host
    // Try constructor first (set by addInitializer), then metadata
    const hostKey = (this.constructor as any)[HOST_KEY];
    if (hostKey) {
      (this as any)[hostKey] = component;
    }

    // Call the styles() hook if it exists
    // This allows subclasses to perform custom initialization
    if (typeof (this as any).styles === 'function') {
      (this as any).styles();
    }
  }

  /**
   * Applies styles to the document (<head>) instead of Shadow DOM
   * Used by @ForDocument decorator for global styles
   *
   * Creates a <style> element and syncs reactive CSS rules to it
   */
  public applyToDocument(): void {
    // Create a <style> element in <head> if it doesn't exist
    if (!this.documentStyleElement) {
      this.documentStyleElement = document.createElement('style');
      this.documentStyleElement.setAttribute('data-framework-document-styles', this.constructor.name);
      document.head.appendChild(this.documentStyleElement);
    }

    // Sync the internal CSSStyleSheet to the document <style> element
    this.syncDocumentStyles();
  }

  /**
   * Synchronizes the internal CSSStyleSheet with the document <style> element
   * Called automatically when rules update in @ForDocument mode
   */
  private syncDocumentStyles(): void {
    if (!this.documentStyleElement) return;

    // Convert all rules to CSS text
    const cssText = Array.from(this.stylesheet.cssRules)
      .map(rule => rule.cssText)
      .join('\n');

    // Update the <style> element content
    this.documentStyleElement.textContent = cssText;
  }

  /**
   * Updates a specific CSS rule in the stylesheet
   * This is the core method used by @Rule decorator to update reactive styles
   *
   * @param selector - The CSS selector for this rule
   * @param cssText - The complete CSS rule text (including selector and braces)
   * @param indexKey - Unique symbol to track this rule's position
   */
  protected updateSpecificRule(
    selector: string,
    cssText: string,
    indexKey: symbol,
  ): void {
    try {
      const currentIndex = (this as any)[indexKey];

      // Delete existing rule if it exists
      if (
        currentIndex !== undefined &&
        currentIndex < this.stylesheet.cssRules.length
      ) {
        this.stylesheet.deleteRule(currentIndex);
        this.adjustIndicesAfterDeletion(currentIndex);
        this.ruleIndexMap.delete(selector);
      }

      // Insert new rule at the end
      const newIndex = this.stylesheet.insertRule(
        cssText,
        this.stylesheet.cssRules.length,
      );
      (this as any)[indexKey] = newIndex;
      this.ruleIndexMap.set(selector, newIndex);

      // Sync to document if this is a @ForDocument stylesheet
      if (this.documentStyleElement) {
        this.syncDocumentStyles();
      }
    } catch (error) {
      console.error("Error updating rule:", error);
      console.error("Problematic CSS:", cssText);
    }
  }

  /**
   * Adjusts all rule indices after a rule deletion
   * This ensures the index tracking remains correct
   */
  private adjustIndicesAfterDeletion(deletedIndex: number): void {
    // Update the rule index map
    for (const [selector, index] of this.ruleIndexMap.entries()) {
      if (index > deletedIndex) {
        this.ruleIndexMap.set(selector, index - 1);
      }
    }

    // Update symbol-based indices
    const symbolKeys = Object.getOwnPropertySymbols(this);
    for (const symbolKey of symbolKeys) {
      const currentIndex = (this as any)[symbolKey];
      if (typeof currentIndex === "number" && currentIndex > deletedIndex) {
        (this as any)[symbolKey] = currentIndex - 1;
      }
    }
  }

  /**
   * Registers a cleanup function to be called on disposal
   * Used by @Rule decorator to clean up reactive effects
   */
  public registerCleanup(cleanupFn: () => void): void {
    this.cleanupFunctions.push(cleanupFn);
  }

  /**
   * Cleans up all resources
   * Called when the component is destroyed
   */
  public dispose(): void {
    // Clear all CSS rules
    while (this.stylesheet.cssRules.length > 0) {
      this.stylesheet.deleteRule(0);
    }

    // Remove document <style> element if it exists
    if (this.documentStyleElement && this.documentStyleElement.parentNode) {
      this.documentStyleElement.parentNode.removeChild(this.documentStyleElement);
      this.documentStyleElement = null;
    }

    // Run all cleanup functions (disposes reactive effects)
    this.cleanupFunctions.forEach((cleanup) => cleanup());
    this.cleanupFunctions.length = 0;

    // Clear all maps
    this.ruleIndexMap.clear();
    this.selectorSymbolMap.clear();
    this.documentRuleMap.clear();
  }

  /**
   * Returns debug information about the stylesheet
   * Useful for development and debugging
   */
  public getDebugInfo(): {
    totalRules: number;
    ruleIndexMap: Map<string, number>;
  } {
    return {
      totalRules: this.stylesheet.cssRules.length,
      ruleIndexMap: new Map(this.ruleIndexMap),
    };
  }

  /**
   * Optional hook for subclasses to implement
   * Called after setHost() to perform custom initialization
   *
   * Note: With @Rule decorator, this is typically not needed
   * as decorators automatically register rules
   */
  protected styles(): void {
    // Subclasses can override this for custom initialization
  }
}
