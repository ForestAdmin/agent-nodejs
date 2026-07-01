import Koa from 'koa';
import request from 'supertest';

import { BffHttpError } from '../../src/http/bff-http-error';
import createErrorMiddleware from '../../src/http/error-middleware';

function buildApp(thrower: () => never) {
  const logs: string[] = [];
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: (_l, message) => logs.push(message) }));
  app.use(async () => thrower());

  return { callback: app.callback(), logs };
}

describe('error middleware', () => {
  it('serializes a typed error to the structured body with details', async () => {
    const { callback } = buildApp(() => {
      throw new BffHttpError(422, 'custom', 'boom', { field: 'x' });
    });

    const res = await request(callback).get('/');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: { type: 'custom', status: 422, message: 'boom', details: { field: 'x' } },
    });
  });

  it('maps an unknown error to 500 internal_error and logs it', async () => {
    const { callback, logs } = buildApp(() => {
      throw new Error('unexpected');
    });

    const res = await request(callback).get('/');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { type: 'internal_error', status: 500, message: 'Internal server error' },
    });
    expect(logs).toContain('Unhandled BFF edge error');
  });
});
