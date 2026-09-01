import type { Action, AgentActionClient } from '../../src/action/agent-action-client';
import type { Logger } from '../../src/ports/logger-port';
import type ReadModelStore from '../../src/read-model/read-model-store';

import {
  ActionFormValidationError,
  ActionRequiresApprovalError,
  AgentHttpError,
  UnknownActionFieldError,
} from '@forestadmin/agent-client';
import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';
import request from 'supertest';

import createActionRoutesMiddleware from '../../src/action/action-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import SchemaUnavailableError from '../../src/read-model/errors';
import ReadModel from '../../src/read-model/read-model';
import { action, collection, column } from '../read-model/fixtures';

const TIMEZONE = 'Europe/Paris';

const noopLogger: Logger = () => {};

function storeOf(readModel: ReadModel | Error): ReadModelStore {
  return {
    getReadModel: async () => {
      if (readModel instanceof Error) throw readModel;

      return readModel;
    },
  } as unknown as ReadModelStore;
}

interface FakeField {
  name: string;
  type: string;
  value: unknown;
  isRequired: boolean;
  enumValues?: string[];
}

function makeAction({
  fields = [],
  layout = [],
  skipped = [],
  postChange,
  execute = jest.fn(),
  setFields = jest.fn(async () => {}),
}: {
  fields?: FakeField[];
  layout?: unknown[];
  skipped?: string[];
  postChange?: { fields?: FakeField[]; layout?: unknown[] };
  execute?: jest.Mock;
  setFields?: jest.Mock;
} = {}) {
  const state = { fields: [...fields], layout: [...layout] };
  const tryToSetFields = jest.fn(async () => {
    if (postChange) {
      state.fields = postChange.fields ?? state.fields;
      state.layout = postChange.layout ?? state.layout;
    }

    return skipped;
  });

  const form: Action & { tryToSetFields: jest.Mock; execute: jest.Mock; setFields: jest.Mock } = {
    execute,
    setFields,
    tryToSetFields,
    getFields: () =>
      state.fields.map(f => ({
        getName: () => f.name,
        getType: () => f.type,
        getValue: () => f.value,
        isRequired: () => f.isRequired,
      })),
    getEnumField: (name: string) => ({
      getOptions: () => state.fields.find(f => f.name === name)?.enumValues,
    }),
    getLayout: () => ({ layout: state.layout }),
  };

  return form;
}

function clientOf(
  form: Action,
  loadAction: jest.Mock = jest.fn(async () => form),
): AgentActionClient & { loadAction: jest.Mock } {
  return { loadAction };
}

function buildApp(
  store: ReadModelStore,
  client: AgentActionClient,
  {
    agentToken = 'agent-jwt',
    logger = noopLogger,
    timezone = TIMEZONE,
  }: { agentToken?: string | null; logger?: Logger; timezone?: string } = {},
) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = timezone;
    if (agentToken !== null) ctx.state.agentToken = agentToken;
    await next();
  });
  app.use(
    createActionRoutesMiddleware({
      store,
      agentUrl: 'https://agent.example.com',
      logger,
      createClient: () => client,
    }),
  );

  return app;
}

const readModel = new ReadModel([
  collection('users', [column('id')], [action('approve', '/forest/_actions/users/0/approve')]),
]);

function buildAppWithTerminal(client: AgentActionClient) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = TIMEZONE;
    ctx.state.agentToken = 'agent-jwt';
    await next();
  });
  app.use(
    createActionRoutesMiddleware({
      store: storeOf(readModel),
      agentUrl: 'https://agent.example.com',
      logger: noopLogger,
      createClient: () => client,
    }),
  );
  app.use(async ctx => {
    ctx.status = 204;
  });

  return app;
}

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
      ctx.state.agentToken = 'agent-jwt';
      await next();
    });
    app.use(
      createActionRoutesMiddleware({
        store: storeOf(readModel),
        agentUrl: 'https://agent.example.com',
        timeoutMs: 2500,
        logger: noopLogger,
        createClient,
      }),
    );

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: {} });

    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 2500 }));
  });

  it('leaves the action client timeout undefined when none is configured', async () => {
    const createClient = jest.fn(
      () => clientOf(makeAction({ fields: [], layout: [], skipped: [] })) as AgentActionClient,
    );
    const app = new Koa();
    app.silent = true;
    app.use(createErrorMiddleware({ logger: noopLogger }));
    app.use(bodyParser());
    app.use(async (ctx, next) => {
      ctx.state.timezone = TIMEZONE;
      ctx.state.agentToken = 'agent-jwt';
      await next();
    });
    app.use(
      createActionRoutesMiddleware({
        store: storeOf(readModel),
        agentUrl: 'https://agent.example.com',
        logger: noopLogger,
        createClient,
      }),
    );

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: {} });

    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined }));
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

  it('maps an approval-gated action to 403 action_requires_approval with the allowed roles', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new ActionRequiresApprovalError('Needs approval', [7, 9]);
      }),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: 'action_requires_approval',
      status: 403,
      details: { roleIdsAllowedToApprove: [7, 9] },
    });
  });

  it('keeps an empty roleIdsAllowedToApprove array in the 403 details', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new ActionRequiresApprovalError('Needs approval', []);
      }),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(403);
    expect(response.body.error.details).toEqual({ roleIdsAllowedToApprove: [] });
  });

  it('omits details when the approval error carries no roleIdsAllowedToApprove', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new ActionRequiresApprovalError('Needs approval');
      }),
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ type: 'action_requires_approval', status: 403 });
    expect(response.body.error.details).toBeUndefined();
  });

  it('maps a transport 5xx to agent_unavailable, distinct from the action-Error 400', async () => {
    const form = makeAction({
      execute: jest.fn(async () => {
        throw new AgentHttpError(502, null);
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
