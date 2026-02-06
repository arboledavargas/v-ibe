import { BaseStyleSheet, Rule, CSSProperties } from 'signalsframework';

export class FontStyles extends BaseStyleSheet {
  @Rule('.text-medium')
  get textMedium(): CSSProperties {
    return {
      fontFamily: '"DM Sans", sans-serif',
      fontOpticalSizing: 'auto',
      fontWeight: 500,
      fontStyle: 'normal',
    };
  }

  @Rule('.title-small')
  get titleSmall(): CSSProperties {
    return {
      fontFamily: '"DM Sans", sans-serif',
      fontOpticalSizing: 'auto',
      fontWeight: 500,
      fontStyle: 'normal',
    };
  }
}
