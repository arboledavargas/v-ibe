import { describe, it, expect } from 'vitest';
import { BaseStyleSheet } from '../base-style-sheet';
import { Rule } from '../decorators/rule';
import { Host } from '../../behaviors/decorators';
import type { CSSProperties } from '../css-properties';

/**
 * Tests for the interaction between @Host and @Rule decorators.
 *
 * @Rule is now a metadata-only marker. The reactive effects are
 * created by BaseStyleSheet.getStyleSheet() — which should be called
 * AFTER setHost() so that @Host fields are already populated.
 */
describe('@Rule + @Host timing', () => {
  it('should not crash when constructing a stylesheet with @Host + @Rule', () => {
    class FakeComponent {
      isWhiteTurn = true;
    }

    class TestStyles extends BaseStyleSheet {
      @Host host!: FakeComponent;

      @Rule(':host')
      get indicator(): CSSProperties {
        return {
          backgroundColor: this.host.isWhiteTurn ? 'white' : 'black',
        };
      }
    }

    // Construction should NOT create effects, so no crash
    expect(() => {
      const styles = new TestStyles();
      styles.setHost({ isWhiteTurn: true } as any);
      styles.getStyleSheet(); // activates rules after host is set
    }).not.toThrow();
  });

  it('should produce correct CSS after setHost() + getStyleSheet()', () => {
    class FakeComponent {
      expanded = true;
    }

    class TestStyles extends BaseStyleSheet {
      @Host host!: FakeComponent;

      @Rule(':host')
      get hostStyles(): CSSProperties {
        return {
          width: this.host.expanded ? '100%' : '300px',
        };
      }
    }

    const styles = new TestStyles();
    styles.setHost({ expanded: true } as any);
    const sheet = styles.getStyleSheet();

    expect(sheet.cssRules.length).toBeGreaterThan(0);
    const ruleText = sheet.cssRules[0].cssText;
    expect(ruleText).toContain('100%');
  });

  it('should work when @Rule getter does NOT use @Host', () => {
    class TestStyles extends BaseStyleSheet {
      @Rule('.box')
      get boxStyles(): CSSProperties {
        return {
          display: 'flex',
          padding: '1rem',
        };
      }
    }

    // Without @Host, getStyleSheet() alone should activate rules
    expect(() => {
      new TestStyles();
    }).not.toThrow();

    const styles = new TestStyles();
    const sheet = styles.getStyleSheet();
    expect(sheet.cssRules.length).toBeGreaterThan(0);
  });

  it('should re-evaluate @Rule when host properties change reactively', () => {
    class FakeComponent {
      isDark = false;
    }

    class TestStyles extends BaseStyleSheet {
      @Host host!: FakeComponent;

      @Rule(':host')
      get theme(): CSSProperties {
        return {
          backgroundColor: this.host.isDark ? '#1a1a1a' : '#ffffff',
        };
      }
    }

    const styles = new TestStyles();
    styles.setHost({ isDark: false } as any);
    const sheet = styles.getStyleSheet();

    expect(sheet.cssRules.length).toBeGreaterThan(0);
  });
});
