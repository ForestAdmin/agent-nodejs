import Router from '@koa/router';
import Koa from 'koa';

export default function startKoaV2() {
  const app = new Koa();
  const router = new Router();

  router.get('/', ctx => {
    ctx.response.body = { error: null, framework: 'Koa' };
  });

  app.use(router.routes()).use(router.allowedMethods());

  return app;
}
