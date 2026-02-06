import { BaseStyleSheet, Rule, CSSProperties } from 'signalsframework';

export class ResetStyles extends BaseStyleSheet {
  /* 1. Use a more-intuitive box-sizing model */
  @Rule('*, *::before, *::after')
  get boxSizing(): CSSProperties {
    return {
      boxSizing: 'border-box',
    };
  }

  /* 2. Remove default margin */
  @Rule('*')
  get resetMargin(): CSSProperties {
    return {
      margin: 0,
    };
  }

  /* 4. Add accessible line-height */
  /* 5. Improve text rendering */
  @Rule('body')
  get bodyStyles(): CSSProperties {
    return {
      lineHeight: 1.5,
      WebkitFontSmoothing: 'antialiased',
    };
  }

  /* 6. Improve media defaults */
  @Rule('img, picture, video, canvas, svg')
  get mediaDefaults(): CSSProperties {
    return {
      display: 'block',
      maxWidth: '100%',
    };
  }

  /* 7. Inherit fonts for form controls */
  @Rule('input, button, textarea, select')
  get formControls(): CSSProperties {
    return {
      font: 'inherit',
    };
  }

  /* 8. Avoid text overflows */
  @Rule('p, h1, h2, h3, h4, h5, h6')
  get textOverflow(): CSSProperties {
    return {
      overflowWrap: 'break-word',
    };
  }

  /* 9. Improve line wrapping */
  @Rule('p')
  get paragraphWrap(): CSSProperties {
    return {
      textWrap: 'pretty',
    };
  }

  @Rule('h1, h2, h3, h4, h5, h6')
  get headingWrap(): CSSProperties {
    return {
      textWrap: 'balance',
    };
  }

  /* 10. Create a root stacking context */
  @Rule('#root')
  get rootIsolation(): CSSProperties {
    return {
      isolation: 'isolate',
    };
  }
}
