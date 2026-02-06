import { BaseComponent, Component } from 'signalsframework';

@Component()
export default class ContentPage extends BaseComponent {
  view(){
    return <h3>Content page</h3>
  }
}
