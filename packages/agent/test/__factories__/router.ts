import { Factory } from 'fishery';
import Router from '@koa/router';

export default Factory.define<Router>(() => new Router());
