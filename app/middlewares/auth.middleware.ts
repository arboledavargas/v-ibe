import { Service, Inject, Router, RouteMetadata, Redirect } from 'signalsframework';

@Service
export class AuthMiddleware {
  @RouteMetadata('test')
  test!: string;

  @Inject(Router)
  router!: Router;

  @Redirect()
  async checkAuth() {
    this.router.navigate('/404');
    return true;
  }
}
