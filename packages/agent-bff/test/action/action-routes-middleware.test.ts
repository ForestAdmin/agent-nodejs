import type { AgentActionClient } from '../../src/action/agent-action-client';
import type { Logger } from '../../src/ports/logger-port';

import {
  ActionFormValidationError,
  AgentHttpError,
  ApprovalRequestCreationError,
  InvalidActionFileValueError,
  UnknownActionFieldError,
} from '@forestadmin/agent-client';
import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';
import request from 'supertest';

import createActionRoutesMiddleware from '../../src/action/action-routes-middleware';
import { createHttpTransport } from '../../src/agent/agent-transport';
import { AgentTimeoutError } from '../../src/agent/create-agent-http-requester';
import createErrorMiddleware from '../../src/http/error-middleware';
import SchemaUnavailableError from '../../src/read-model/errors';
import {
  TIMEZONE,
  buildApp,
  buildAppWithTerminal,
  clientOf,
  makeAction,
  noopLogger,
  readModel,
  storeOf,
} from '../helpers/action-routes';

const TRANSPORT = createHttpTransport({ agentUrl: 'https://agent.example.com' });

describe('action routes middleware', () => {
  it('forwards the configured agent timeout to the action client', async () => {
    const createClient = jest.fn(
      () => clientOf(makeAction({ fields: [], layout: [], skipped: [] })) as AgentActionClient,
    );
    const app = new Koa();
    app.silent = true;
    app.use(createErrorMiddleware({ logger: noopLogger }));
    app.use(bodyParser());
    app.use(async (ctx, next) => {
      ctx.state.timezone = TIMEZONE;
      ctx.state.authMode = 'api-key';
      ctx.state.apiKeyIdentity = { renderingId: 1 };
      ctx.state.agentToken = 'agent-jwt';
      await next();
    });
    app.use(
      createActionRoutesMiddleware({
        forestServerUrl: 'https://api.forestadmin.test',
        store: storeOf(readModel),
        transport: createHttpTransport({ agentUrl: 'https://agent.example.com', timeoutMs: 2500 }),
        logger: noopLogger,
        createClient,
      }),
    );

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: {} });

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ transport: expect.objectContaining({ url: expect.any(String) }) }),
    );
  });

  it('rebuilds the client on every call, with that call own agent token', async () => {
    const createClient = jest.fn(
      () => clientOf(makeAction({ fields: [], layout: [], skipped: [] })) as AgentActionClient,
    );
    const app = new Koa();
    app.silent = true;
    app.use(createErrorMiddleware({ logger: noopLogger }));
    app.use(bodyParser());
    app.use(async (ctx, next) => {
      ctx.state.timezone = TIMEZONE;
      ctx.state.authMode = 'api-key';
      ctx.state.apiKeyIdentity = { renderingId: 1 };
      ctx.state.agentToken = ctx.get('x-agent-token');
      await next();
    });
    app.use(
      createActionRoutesMiddleware({
        forestServerUrl: 'https://api.forestadmin.test',
        store: storeOf(readModel),
        transport: TRANSPORT,
        logger: noopLogger,
        createClient,
      }),
    );

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .set('x-agent-token', 'jwt-1')
      .send({ recordIds: ['42'], values: {} });
    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .set('x-agent-token', 'jwt-2')
      .send({ recordIds: ['42'], values: {} });

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(createClient).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ token: 'jwt-1', transport: TRANSPORT }),
    );
    expect(createClient).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ token: 'jwt-2', transport: TRANSPORT }),
    );
  });

  it('returns the full form shape with fields, canExecute, requiredFields, skippedFields and layout', async () => {
    const form = makeAction({
      fields: [{ name: 'reason', type: 'String', value: null, isRequired: true }],
      layout: [{ component: 'input', fieldId: 'reason' }],
      skipped: [],
    });
    const app = buildApp(storeOf(readModel), clientOf(form));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: {} });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      fields: [{ name: 'reason', type: 'String', value: null, isRequired: true }],
      canExecute: false,
      requiredFields: ['reason'],
      skippedFields: [],
      layout: [{ component: 'input', fieldId: 'reason' }],
    });
  });

  it('lists unknown submitted values in skippedFields', async () => {
    const form = makeAction({
      fields: [{ name: 'reason', type: 'String', value: 'x', isRequired: false }],
      skipped: ['ghost'],
    });
    const app = buildApp(storeOf(readModel), clientOf(form));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: { ghost: 1 } });

    expect(form.tryToSetFields).toHaveBeenCalledWith({ ghost: 1 });
    expect(response.body.skippedFields).toEqual(['ghost']);
  });

  it('reports canExecute true when every required field has a value', async () => {
    const form = makeAction({
      fields: [{ name: 'reason', type: 'String', value: 'ok', isRequired: true }],
    });
    const app = buildApp(storeOf(readModel), clientOf(form));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'] });

    expect(response.body).toMatchObject({ canExecute: true, requiredFields: [] });
  });

  it('reads fields and layout after tryToSetFields when a change hook rebuilds the form', async () => {
    const form = makeAction({
      fields: [{ name: 'reason', type: 'String', value: null, isRequired: true }],
      layout: [{ component: 'input', fieldId: 'reason' }],
      postChange: {
        fields: [{ name: 'comment', type: 'String', value: 'added', isRequired: false }],
        layout: [{ component: 'input', fieldId: 'comment' }],
      },
    });
    const app = buildApp(storeOf(readModel), clientOf(form));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: { reason: 'x' } });

    expect(response.body.fields).toEqual([
      { name: 'comment', type: 'String', value: 'added', isRequired: false },
    ]);
    expect(response.body.layout).toEqual([{ component: 'input', fieldId: 'comment' }]);
  });

  it('never executes the action while loading its form', async () => {
    const form = makeAction();
    const app = buildApp(storeOf(readModel), clientOf(form));

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'] });

    expect(form.execute).not.toHaveBeenCalled();
  });

  it('answers a plain 504 when a change hook times out, since the form runs nothing', async () => {
    const form = makeAction();
    form.tryToSetFields.mockRejectedValue(new AgentTimeoutError('Timeout of 10000ms exceeded'));
    const app = buildApp(storeOf(readModel), clientOf(form), { actionTimeoutMs: 30_000 });

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: { reason: 'x' } });

    expect(response.status).toBe(504);
    expect(response.body.error).toEqual({
      type: 'agent_timeout',
      status: 504,
      message: 'The agent did not respond in time',
    });
  });

  it('passes an opaque composite recordId through unchanged', async () => {
    const form = makeAction();
    const loadAction = jest.fn(async () => form);
    const app = buildApp(storeOf(readModel), clientOf(form, loadAction));

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['1|2'] });

    expect(loadAction).toHaveBeenCalledWith({
      collection: 'users',
      actionName: 'approve',
      recordIds: ['1|2'],
      timezone: TIMEZONE,
    });
  });

  it('coerces a numeric zero recordId to a string so it survives the downstream filter', async () => {
    const form = makeAction();
    const loadAction = jest.fn(async () => form);
    const app = buildApp(storeOf(readModel), clientOf(form, loadAction));

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: [0] });

    expect(loadAction).toHaveBeenCalledWith({
      collection: 'users',
      actionName: 'approve',
      recordIds: ['0'],
      timezone: TIMEZONE,
    });
  });

  it('accepts an empty recordIds array for a global action', async () => {
    const form = makeAction();
    const loadAction = jest.fn(async () => form);
    const app = buildApp(storeOf(readModel), clientOf(form, loadAction));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: [] });

    expect(response.status).toBe(200);
    expect(loadAction).toHaveBeenCalledWith({
      collection: 'users',
      actionName: 'approve',
      recordIds: [],
      timezone: TIMEZONE,
    });
  });

  it('forwards the request-resolved timezone to the action form load', async () => {
    const form = makeAction();
    const loadAction = jest.fn(async () => form);
    const app = buildApp(storeOf(readModel), clientOf(form, loadAction), {
      timezone: 'America/New_York',
    });

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'] });

    expect(loadAction).toHaveBeenCalledWith({
      collection: 'users',
      actionName: 'approve',
      recordIds: ['42'],
      timezone: 'America/New_York',
    });
  });

  it('returns 400 invalid_request with no agent call when recordIds is missing', async () => {
    const loadAction = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadAction));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ values: {} });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ type: 'invalid_request', status: 400 });
    expect(loadAction).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_request when recordIds is not an array', async () => {
    const loadAction = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadAction));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: '42' });

    expect(response.status).toBe(400);
    expect(loadAction).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_request when values is not an object', async () => {
    const loadAction = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadAction));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: 'nope' });

    expect(response.status).toBe(400);
    expect(loadAction).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_request when the body carries a misspelled values, with no agent call', async () => {
    const loadAction = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadAction));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], valeus: { amount: 1 } });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      type: 'invalid_request',
      status: 400,
      message: 'Request body cannot carry "valeus"',
    });
    expect(loadAction).not.toHaveBeenCalled();
  });

  it('returns 404 unknown_action for an action that is not exposed', async () => {
    const loadAction = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadAction));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/ghost/form')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ type: 'unknown_action', status: 404 });
    expect(loadAction).not.toHaveBeenCalled();
  });

  it('maps an agent failure on form load through the error contract', async () => {
    const loadAction = jest.fn(async () => {
      throw new AgentHttpError(
        403,
        { errors: [{ status: 403, name: 'ForbiddenError' }] },
        undefined,
      );
    });
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadAction));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ type: 'forbidden', status: 403 });
  });

  it('maps an agent failure on tryToSetFields through the error contract', async () => {
    const form = makeAction();
    form.tryToSetFields.mockRejectedValueOnce(
      new AgentHttpError(422, { errors: [{ status: 422, name: 'UnprocessableError' }] }, undefined),
    );
    const app = buildApp(storeOf(readModel), clientOf(form));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: { reason: 'x' } });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({ type: 'unprocessable_entity', status: 422 });
  });

  it('returns 401 when no agent token is available', async () => {
    const loadAction = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadAction), {
      agentToken: null,
    });

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(401);
    expect(loadAction).not.toHaveBeenCalled();
  });

  it('falls through to the next middleware for a non-POST request on the form path', async () => {
    const loadAction = jest.fn();
    const app = buildAppWithTerminal(clientOf(makeAction(), loadAction));

    const response = await request(app.callback()).get('/agent/v1/users/actions/approve/form');

    expect(response.status).toBe(204);
    expect(loadAction).not.toHaveBeenCalled();
  });

  it('falls through to the next middleware for a path that is not an action form route', async () => {
    const loadAction = jest.fn();
    const app = buildAppWithTerminal(clientOf(makeAction(), loadAction));

    const response = await request(app.callback()).post('/agent/v1/users/list').send({});

    expect(response.status).toBe(204);
    expect(loadAction).not.toHaveBeenCalled();
  });

  it('returns 503 schema_unavailable when the schema cannot be loaded', async () => {
    const app = buildApp(storeOf(new SchemaUnavailableError()), clientOf(makeAction()));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ type: 'schema_unavailable', status: 503 });
  });
});

describe('action execute', () => {
  function execApp(client: AgentActionClient, logger?: Logger) {
    return buildApp(storeOf(readModel), client, logger ? { logger } : {});
  }

  it('sets the submitted values then executes the action', async () => {
    const setFields = jest.fn(async () => {});
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({ setFields, execute });
    const loadAction = jest.fn(async () => form);

    await request(execApp(clientOf(form, loadAction)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { reason: 'x' } });

    expect(loadAction).toHaveBeenCalledWith({
      collection: 'users',
      actionName: 'approve',
      recordIds: ['42'],
      timezone: TIMEZONE,
    });
    expect(setFields).toHaveBeenCalledWith({ reason: 'x' });
    expect(execute).toHaveBeenCalledTimes(1);
    // Order is the behaviour named by this test: executing before the values are applied would run
    // the action on an empty form.
    expect(setFields.mock.invocationCallOrder[0]).toBeLessThan(execute.mock.invocationCallOrder[0]);
  });

  it('forwards the request-resolved timezone to the action execute load', async () => {
    const form = makeAction();
    const loadAction = jest.fn(async () => form);
    const app = buildApp(storeOf(readModel), clientOf(form, loadAction), {
      timezone: 'Asia/Tokyo',
    });

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(loadAction).toHaveBeenCalledWith({
      collection: 'users',
      actionName: 'approve',
      recordIds: ['42'],
      timezone: 'Asia/Tokyo',
    });
  });

  it('normalizes a Success result to 200 with invalidated as an array', async () => {
    const form = makeAction({
      execute: jest.fn(async () => ({
        success: 'Refunded',
        html: '<b>ok</b>',
        refresh: { relationships: ['orders'] },
      })),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      type: 'success',
      message: 'Refunded',
      invalidated: ['orders'],
      html: '<b>ok</b>',
    });
  });

  it('normalizes a Webhook result to 200 passing its fields through verbatim', async () => {
    const form = makeAction({
      execute: jest.fn(async () => ({
        webhook: { url: 'https://x.test', method: 'POST', headers: { a: '1' }, body: { b: 2 } },
      })),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      type: 'webhook',
      url: 'https://x.test',
      method: 'POST',
      headers: { a: '1' },
      body: { b: 2 },
    });
  });

  it('normalizes a Redirect result to 200 with the path', async () => {
    const form = makeAction({ execute: jest.fn(async () => ({ redirectTo: '/orders/1' })) });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ type: 'redirect', path: '/orders/1' });
  });

  // The agent streams a File result with no JSON marker, so it reaches the BFF as a binary body,
  // not as an object carrying a recognizable key.
  it.each([
    ['an unrecognized object payload', {} as unknown],
    ['a File result streamed as a binary body', Buffer.from('%PDF-1.4 invoice')],
  ])('returns 501 unsupported_action_result for %s', async (_label, payload) => {
    const form = makeAction({ execute: jest.fn(async () => payload) });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(501);
    expect(response.body).toEqual({
      error: { type: 'unsupported_action_result', status: 501 },
    });
  });

  it('logs a bounded shape hint instead of enumerating a binary payload byte by byte', async () => {
    const logger = jest.fn();
    const form = makeAction({ execute: jest.fn(async () => Buffer.alloc(4096, 1)) });

    const response = await request(execApp(clientOf(form), logger).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(501);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      'Unrecognized action execute result mapped to 501',
      { shape: 'Buffer(4096)' },
    );
  });

  it('logs the key names for an unrecognized plain-object payload', async () => {
    const logger = jest.fn();
    const form = makeAction({ execute: jest.fn(async () => ({ mystery: 1, other: 2 })) });

    await request(execApp(clientOf(form), logger).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(logger).toHaveBeenCalledWith(
      'Warn',
      'Unrecognized action execute result mapped to 501',
      { shape: 'object{mystery,other}' },
    );
  });

  it('wraps a native action Error in the error envelope, carrying html in details', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new ActionFormValidationError('Refund failed', '<strong>Nope</strong>');
      }),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        type: 'action_error',
        status: 400,
        message: 'Refund failed',
        details: { html: '<strong>Nope</strong>' },
      },
    });
  });

  it('sanitizes the html carried by a native action Error in details', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new ActionFormValidationError(
          'Refund failed',
          '<strong>Nope</strong><img src=x onerror="alert(1)">',
        );
      }),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        type: 'action_error',
        status: 400,
        message: 'Refund failed',
        details: { html: '<strong>Nope</strong>' },
      },
    });
  });

  it('omits details when the action Error html is entirely active markup', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new ActionFormValidationError('Refund failed', '<script>alert(1)</script>');
      }),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { type: 'action_error', status: 400, message: 'Refund failed' },
    });
  });

  it('omits details when the action Error html is not a string', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new ActionFormValidationError('Refund failed', { evil: 1 } as unknown as string);
      }),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { type: 'action_error', status: 400, message: 'Refund failed' },
    });
  });

  it('omits details entirely when the action Error carries no html', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new ActionFormValidationError('Refund failed');
      }),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { type: 'action_error', status: 400, message: 'Refund failed' },
    });
    expect(Object.keys(response.body.error)).not.toContain('details');
  });

  it('logs the agent body as the cause when the action Error carries no structured detail', async () => {
    const logger = jest.fn();
    const agentError = new AgentHttpError(422, {}, '<!DOCTYPE html><html>Cannot POST</html>');
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new ActionFormValidationError(
          'The action form values were rejected.',
          undefined,
          agentError,
        );
      }),
    });

    const response = await request(execApp(clientOf(form), logger).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.body.error.message).toBe('The action form values were rejected.');
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      'Agent action 4xx carried no structured error; client message is generic',
      { httpStatus: 422, cause: '<!DOCTYPE html><html>Cannot POST</html>' },
    );
  });

  it('keeps a successful action result flat, discriminated by body.type', async () => {
    const form = makeAction({ execute: jest.fn(async () => ({ success: 'Refunded' })) });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(200);
    expect(response.body.type).toBe('success');
    expect(response.body.error).toBeUndefined();
  });

  it('rejects an unknown submitted field as 400 invalid_request', async () => {
    const setFields = jest.fn(async () => {
      throw new UnknownActionFieldError('ghost');
    });
    const execute = jest.fn();
    const form = makeAction({ setFields, execute });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { ghost: 1 } });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ type: 'invalid_request', status: 400 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('maps a non-unknown-field setFields rejection through the agent error contract', async () => {
    const setFields = jest.fn(async () => {
      throw new AgentHttpError(422, { errors: [{ status: 422, name: 'UnprocessableError' }] });
    });
    const execute = jest.fn();
    const form = makeAction({ setFields, execute });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { reason: 'x' } });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({ type: 'unprocessable_entity', status: 422 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('maps a malformed file value from setFields to 400 invalid_request, not a 502', async () => {
    const setFields = jest.fn(async () => {
      throw new InvalidActionFileValueError(
        'Field "doc" expects a file: pass { buffer, mimeType, name }.',
      );
    });
    const execute = jest.fn();
    const form = makeAction({ setFields, execute });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { doc: 42 } });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ type: 'invalid_request', status: 400 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('maps a raw network failure from setFields to 502, never to a 400', async () => {
    const setFields = jest.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const execute = jest.fn();
    const form = makeAction({ setFields, execute });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { reason: 'x' } });

    expect(response.status).toBe(502);
    expect(response.body.error).toMatchObject({ type: 'network_error', status: 502 });
    expect(execute).not.toHaveBeenCalled();
  });

  function approvalClient(executeAction: jest.Mock): AgentActionClient {
    return { loadAction: jest.fn(), executeAction };
  }

  it('answers 202 with the id of the approval request filed in place of the action', async () => {
    const executeAction = jest.fn(async () => ({
      approvalRequested: true,
      approvalRequest: { id: 'req_42' },
    }));

    const response = await request(execApp(approvalClient(executeAction)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      type: 'approval_requested',
      approvalRequest: { id: 'req_42' },
    });
  });

  it('hands the approval request message to the action client', async () => {
    const executeAction = jest.fn(async () => ({
      approvalRequested: true,
      approvalRequest: { id: 'req_42' },
    }));

    await request(execApp(approvalClient(executeAction)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], approvalRequestMessage: 'Refund a duplicate payment' });

    expect(executeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        actionName: 'approve',
        approvalRequestMessage: 'Refund a duplicate payment',
      }),
    );
  });

  it('refuses an approval request message that is not a string', async () => {
    const executeAction = jest.fn();

    const response = await request(execApp(approvalClient(executeAction)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], approvalRequestMessage: { text: 'why' } });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      type: 'invalid_request',
      message: 'approvalRequestMessage must be a string',
    });
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('answers 503 approval_request_failed when the approval request could not be filed', async () => {
    const logger = jest.fn();
    const executeAction = jest.fn(async () => {
      throw new ApprovalRequestCreationError(new Error('forest server down'));
    });

    const response = await request(execApp(approvalClient(executeAction), logger).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(503);
    expect(response.body.error).toEqual({
      type: 'approval_request_failed',
      status: 503,
      message:
        'The action requires an approval, and the approval request could not be filed, so the action was not run',
    });
    expect(logger).toHaveBeenCalledWith(
      'Error',
      'The approval request of an action could not be filed',
      { cause: 'forest server down' },
    );
  });

  it('answers 503 approval_request_failed when the filed request came back without an id', async () => {
    const executeAction = jest.fn(async () => ({ approvalRequested: true }));

    const response = await request(execApp(approvalClient(executeAction)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(503);
    expect(response.body.error.type).toBe('approval_request_failed');
  });

  it('bounds the execute call with the configured action timeout', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({ execute });
    const app = buildApp(storeOf(readModel), clientOf(form), { actionTimeoutMs: 30_000 });

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(execute).toHaveBeenCalledWith({ maxTimeAllowed: 30_000 });
  });

  describe('when the agent does not answer the execute in time', () => {
    it('answers 504 agent_timeout and says the outcome is unknown', async () => {
      const form = makeAction({
        execute: jest.fn(async () => {
          throw new AgentTimeoutError('Timeout of 30000ms exceeded');
        }),
      });

      const response = await request(execApp(clientOf(form)).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(504);
      expect(response.body.error).toEqual({
        type: 'agent_timeout',
        status: 504,
        message:
          'The agent did not respond in time. The action may still have run: check its outcome before retrying.',
        details: { outcome: 'unknown' },
      });
    });

    it.each([
      ['a connection reset', Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })],
      ['a gateway 502', new AgentHttpError(502, null, '<html>Bad Gateway</html>')],
      ['a gateway 504', new AgentHttpError(504, null, '<html>Gateway Timeout</html>')],
    ])('says the outcome is unknown on %s, since the agent may have run it', async (_, cause) => {
      const form = makeAction({
        execute: jest.fn(async () => {
          throw cause;
        }),
      });

      const response = await request(execApp(clientOf(form)).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(504);
      expect(response.body.error).toMatchObject({
        type: 'agent_timeout',
        details: { outcome: 'unknown' },
      });
    });

    it('names the collection, the action and the records in the warning', async () => {
      const logger = jest.fn();
      const form = makeAction({
        execute: jest.fn(async () => {
          throw new AgentTimeoutError('Timeout of 30000ms exceeded');
        }),
      });

      await request(execApp(clientOf(form), logger).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(logger).toHaveBeenCalledWith('Warn', 'Action execute got no answer: outcome unknown', {
        collection: 'users',
        actionName: 'approve',
        recordIds: ['42'],
        cause: 'Timeout of 30000ms exceeded',
      });
    });

    it('keeps a refused connection a failure, since the agent was never reached', async () => {
      const form = makeAction({
        execute: jest.fn(async () => {
          throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
        }),
      });

      const response = await request(execApp(clientOf(form)).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(502);
      expect(response.body.error).toMatchObject({ type: 'network_error' });
    });
  });

  describe('when the agent times out before the execute', () => {
    it('answers a plain 504 when setFields times out, since nothing ran', async () => {
      const form = makeAction({
        setFields: jest.fn(async () => {
          throw new AgentTimeoutError('Timeout of 10000ms exceeded');
        }),
      });

      const response = await request(execApp(clientOf(form)).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(504);
      expect(response.body.error).toEqual({
        type: 'agent_timeout',
        status: 504,
        message: 'The agent did not respond in time',
      });
    });

    it('answers a plain 504 when loading the action times out', async () => {
      const loadAction = jest.fn(async () => {
        throw new AgentTimeoutError('Timeout of 10000ms exceeded');
      });

      const response = await request(execApp(clientOf(makeAction(), loadAction)).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(504);
      expect(response.body.error.details).toBeUndefined();
    });
  });

  it('maps a transport 5xx to agent_unavailable, distinct from the action-Error 400', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new AgentHttpError(503, null);
      }),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ type: 'agent_unavailable', status: 503 });
  });

  it('returns 400 invalid_request with no agent call when recordIds is missing', async () => {
    const loadAction = jest.fn();
    const form = makeAction();

    const response = await request(execApp(clientOf(form, loadAction)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ values: {} });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ type: 'invalid_request', status: 400 });
    expect(loadAction).not.toHaveBeenCalled();
  });

  it('returns 404 unknown_action for an action that is not exposed', async () => {
    const loadAction = jest.fn();
    const form = makeAction();

    const response = await request(execApp(clientOf(form, loadAction)).callback())
      .post('/agent/v1/users/actions/ghost/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ type: 'unknown_action', status: 404 });
    expect(loadAction).not.toHaveBeenCalled();
  });
});
