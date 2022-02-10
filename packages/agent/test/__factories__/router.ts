import Router from '@koa/router';
import { Factory } from 'fishery';

export class RouterFactory extends Factory<Router> {
  mockAllMethods() {
    return this.afterBuild(router => {
      router.get = jest.fn();
      router.delete = jest.fn();
      router.use = jest.fn();
      router.post = jest.fn();
      router.put = jest.fn();
    });
  }
}

export default RouterFactory.define(() => new Router());
