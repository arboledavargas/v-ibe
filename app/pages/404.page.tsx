import { BaseComponent, Component } from 'signalsframework';

@Component()
export default class NotFoundPage extends BaseComponent {

  view(){
    return <div>404</div>
  }
}
