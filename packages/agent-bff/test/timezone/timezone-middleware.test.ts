import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';
import request from 'supertest';

import createTimezoneMiddleware, { TIMEZONE_HEADER } from '../../src/timezone/timezone-middleware';

function buildApp(defaultTimezone?: string) {
  const app = new Koa();
  app.silent = true;
  app.use(bodyParser({ jsonLimit: '16kb' }));
  app.use(createTimezoneMiddleware({ defaultTimezone }));
  app.use(async ctx => {
    ctx.status = 200;
    ctx.body = { timezone: ctx.state.timezone };
  });

  return app.callback();
}

describe('timezone middleware', () => {
  it('resolves the timezone from a JSON body field', async () => {
    const response = await request(buildApp()).post('/agent/x').send({ timezone: 'Asia/Tokyo' });

    expect(response.status).toBe(200);
    expect(response.body.timezone).toBe('Asia/Tokyo');
  });

  it('ignores a non-string body timezone and falls back to the default', async () => {
    const response = await request(buildApp('UTC')).post('/agent/x').send({ timezone: 123 });

    expect(response.status).toBe(200);
    expect(response.body.timezone).toBe('UTC');
  });

  it('prefers the header over the body', async () => {
    const response = await request(buildApp())
      .post('/agent/x')
      .set(TIMEZONE_HEADER, 'America/New_York')
      .send({ timezone: 'Asia/Tokyo' });

    expect(response.status).toBe(200);
    expect(response.body.timezone).toBe('America/New_York');
  });
});
