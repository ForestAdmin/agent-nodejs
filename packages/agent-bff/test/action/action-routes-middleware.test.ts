import type { ActionForm, AgentActionClient } from '../../src/action/agent-action-client';
import type { Logger } from '../../src/ports/logger-port';
import type ReadModelStore from '../../src/read-model/read-model-store';

import { AgentHttpError } from '@forestadmin/agent-client';
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
}: {
  fields?: FakeField[];
  layout?: unknown[];
  skipped?: string[];
  postChange?: { fields?: FakeField[]; layout?: unknown[] };
  execute?: jest.Mock;
} = {}) {
  const state = { fields: [...fields], layout: [...layout] };
  const tryToSetFields = jest.fn(async () => {
    if (postChange) {
      state.fields = postChange.fields ?? state.fields;
      state.layout = postChange.layout ?? state.layout;
    }

    return skipped;
  });

  const form: ActionForm & { tryToSetFields: jest.Mock; execute: jest.Mock } = {
    execute,
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
  form: ActionForm,
  loadActionForm: jest.Mock = jest.fn(async () => form),
): AgentActionClient & { loadActionForm: jest.Mock } {
  return { loadActionForm };
}

function buildApp(
  store: ReadModelStore,
  client: AgentActionClient,
  { agentToken = 'agent-jwt' }: { agentToken?: string | null } = {},
) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = TIMEZONE;
    if (agentToken !== null) ctx.state.agentToken = agentToken;
    await next();
  });
  app.use(
    createActionRoutesMiddleware({
      store,
      agentUrl: 'https://agent.example.com',
      logger: noopLogger,
      createClient: () => client,
    }),
  );

  return app;
}

const readModel = new ReadModel([
  collection('users', [column('id')], [action('approve', '/forest/_actions/users/0/approve')]),
]);

describe('action routes middleware', () => {
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
    const loadActionForm = jest.fn(async () => form);
    const app = buildApp(storeOf(readModel), clientOf(form, loadActionForm));

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['1|2'] });

    expect(loadActionForm).toHaveBeenCalledWith('users', 'approve', ['1|2']);
  });

  it('coerces a numeric zero recordId to a string so it survives the downstream filter', async () => {
    const form = makeAction();
    const loadActionForm = jest.fn(async () => form);
    const app = buildApp(storeOf(readModel), clientOf(form, loadActionForm));

    await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: [0] });

    expect(loadActionForm).toHaveBeenCalledWith('users', 'approve', ['0']);
  });

  it('accepts an empty recordIds array for a global action', async () => {
    const form = makeAction();
    const loadActionForm = jest.fn(async () => form);
    const app = buildApp(storeOf(readModel), clientOf(form, loadActionForm));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: [] });

    expect(response.status).toBe(200);
    expect(loadActionForm).toHaveBeenCalledWith('users', 'approve', []);
  });

  it('returns 400 invalid_request with no agent call when recordIds is missing', async () => {
    const loadActionForm = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadActionForm));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ values: {} });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ type: 'invalid_request', status: 400 });
    expect(loadActionForm).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_request when recordIds is not an array', async () => {
    const loadActionForm = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadActionForm));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: '42' });

    expect(response.status).toBe(400);
    expect(loadActionForm).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_request when values is not an object', async () => {
    const loadActionForm = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadActionForm));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'], values: 'nope' });

    expect(response.status).toBe(400);
    expect(loadActionForm).not.toHaveBeenCalled();
  });

  it('returns 404 unknown_action for an action that is not exposed', async () => {
    const loadActionForm = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadActionForm));

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/ghost/form')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ type: 'unknown_action', status: 404 });
    expect(loadActionForm).not.toHaveBeenCalled();
  });

  it('maps an agent failure on form load through the error contract', async () => {
    const loadActionForm = jest.fn(async () => {
      throw new AgentHttpError(
        403,
        { errors: [{ status: 403, name: 'ForbiddenError' }] },
        undefined,
      );
    });
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadActionForm));

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
    const loadActionForm = jest.fn();
    const app = buildApp(storeOf(readModel), clientOf(makeAction(), loadActionForm), {
      agentToken: null,
    });

    const response = await request(app.callback())
      .post('/agent/v1/users/actions/approve/form')
      .send({ recordIds: ['42'] });

    expect(response.status).toBe(401);
    expect(loadActionForm).not.toHaveBeenCalled();
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
