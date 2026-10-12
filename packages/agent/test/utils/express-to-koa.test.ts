import type { IncomingMessage, ServerResponse } from 'http';

import Koa from 'koa';
import request from 'supertest';

import expressToKoa from '../../src/utils/express-to-koa';

type Req = IncomingMessage & { originalUrl?: string };

function koaHostStripping(prefix: string) {
  const seen: Array<{ url?: string; originalUrl?: string }> = [];
  const app = new Koa();
  app.use(async (ctx, next) => {
    if (ctx.path.startsWith(`${prefix}/`)) ctx.url = ctx.url.slice(prefix.length);
    await next();
  });
  app.use(
    expressToKoa((req: Req, res: ServerResponse) => {
      seen.push({ url: req.url, originalUrl: req.originalUrl });
      res.end();
    }),
  );

  return { app, seen };
}

describe('expressToKoa', () => {
  it('should hand the callback the url Koa received before the host rewrote it', async () => {
    const { app, seen } = koaHostStripping('/host');

    await request(app.callback()).get('/host/api/health?probe=1');

    expect(seen).toEqual([{ url: '/api/health?probe=1', originalUrl: '/host/api/health?probe=1' }]);
  });

  it('should keep an originalUrl already set on the request', async () => {
    const app = new Koa();
    const seen: Array<string | undefined> = [];
    app.use(async (ctx, next) => {
      (ctx.req as Req).originalUrl = '/set-by-host';
      await next();
    });
    app.use(
      expressToKoa((req: Req, res: ServerResponse) => {
        seen.push(req.originalUrl);
        res.end();
      }),
    );

    await request(app.callback()).get('/anything');

    expect(seen).toEqual(['/set-by-host']);
  });
});
