import { BaseStyleSheet, Rule, CSSProperties } from 'signalsframework';

export class CardStyles extends BaseStyleSheet {
  @Rule(':host')
  get hostStyles(): CSSProperties {
    return {
      backgroundColor: '#DFDDD2',
      display: 'flex',
      padding: '37px 37px 21px 37px',
      width: 325,
      height: '100%',
      borderRadius: 20,
    };
  }

  @Rule('.cardHeader h2')
  get cardHeaderH2Styles(): CSSProperties {
    return {
      fontFamily: '"DM Sans", sans-serif',
      fontOpticalSizing: 'auto',
      fontWeight: 500,
      fontStyle: 'normal',
      fontSize: 16,
    };
  }
}
