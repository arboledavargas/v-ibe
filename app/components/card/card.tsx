import { BaseComponent, Component, State } from 'signalsframework';
import { CardStyles } from './card.styles';

@Component({ styles:CardStyles })
export class Card extends BaseComponent {

  @State cardTitle: string | undefined;

  view(){
    return <>
      <div className="cardHeader">
        <h2>{this.cardTitle}</h2>
      </div>
      <slot></slot>
    </>
  }
}
