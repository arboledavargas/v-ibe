import { BaseStyleSheet, Rule, CSSProperties } from 'signalsframework';

export class CardPickerStyles extends BaseStyleSheet {
  @Rule(':host')
  get hostStyles(): CSSProperties {
    return {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
    };
  }

  @Rule('.pickerContainer')
  get pickerContainerStyles(): CSSProperties {
    return {
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      justifyContent: 'center',
    };
  }

  @Rule('.dot')
  get dotStyles(): CSSProperties {
    return {
      width: 12,
      height: 12,
      borderRadius: '50%',
      backgroundColor: '#C4C2B8',
      cursor: 'pointer',
      transition: 'all 0.3s ease-in-out',
    };
  }

  @Rule('.dot:hover')
  get dotHoverStyles(): CSSProperties {
    return {
      backgroundColor: '#A8A69C',
      transform: 'scale(1.2)',
    };
  }

  @Rule('.dot.active')
  get dotActiveStyles(): CSSProperties {
    return {
      backgroundColor: 'Red',
      transform: 'scale(1.3)',
    };
  }
}
