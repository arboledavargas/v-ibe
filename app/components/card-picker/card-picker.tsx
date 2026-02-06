import { BaseComponent, Component, State } from 'signalsframework';
import { CardPickerStyles } from './card-picker.styles';

@Component({ styles: CardPickerStyles })
export class CardPicker extends BaseComponent {

  @State totalCards: number = 0;
  @State activeIndex: number = 0;
  @State onPickCard?: (index: number) => void;

  handleDotClick(index: number) {
    if (this.onPickCard) {
      this.onPickCard(index);
    }
  }

  view() {
    return <div className="pickerContainer">
      {Array.from({ length: this.totalCards }).map((_, index) => (
        <div
        className={`dot ${index === this.activeIndex ? 'active' : ''}`}
        onClick={() => this.handleDotClick(index)}
        />
      ))}
    </div>
  }
}
