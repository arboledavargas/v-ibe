import {
  BaseComponent,
  Component,
  State,
  Route,
  RouteView,
  Router,
  Inject,
} from "signalsframework";
import { AuthMiddleware } from './middlewares/auth.middleware';

@Component()
export default class App extends BaseComponent {

  @Inject(Router)
  router!: Router;

  @State currentCardIndex: number = 0;

  @Route('/content', {
    metadata: { test: 'test metadata'},
    policies: [ AuthMiddleware ]
  })
  async loadContent(){
    return await import('./pages/content.page')
  }

  @Route('/404')
  async notFound() {
    return await import('./pages/404.page')
  }

  navigate = () => {
    this.router.navigate("/content")
  }

  view() {
    return <div>
      <h1>header</h1>
      <button onClick={this.navigate}>Navigate</button>
      <RouteView></RouteView>
      <h2>Footer</h2>
    </div>
  }
}
