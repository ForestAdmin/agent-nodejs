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

  it('maps a client-status http error (e.g. malformed body) to a structured 4xx', async () => {
    const { callback } = buildApp(() => {
      const error = Object.assign(new Error('Unexpected token in JSON'), { status: 400 });
      throw error;
    });

    const res = await request(callback).get('/');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { type: 'invalid_request', status: 400, message: 'Invalid request' },
    });
  });

  it('maps a known client status to its specific type (413 → payload_too_large)', async () => {
    const { callback } = buildApp(() => {
      const error = Object.assign(new Error('Payload too large'), { status: 413 });
      throw error;
    });

    const res = await request(callback).get('/');

    expect(res.status).toBe(413);
    expect(res.body.error.type).toBe('payload_too_large');
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
