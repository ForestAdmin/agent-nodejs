import type { Action, AgentActionClient } from '../../src/action/agent-action-client';
import type { Logger } from '../../src/ports/logger-port';
import type ReadModelStore from '../../src/read-model/read-model-store';

import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';

import createActionRoutesMiddleware from '../../src/action/action-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import ReadModel from '../../src/read-model/read-model';
import { action, collection, column } from '../read-model/fixtures';

export const TIMEZONE = 'Europe/Paris';

export const noopLogger: Logger = () => {};

export function storeOf(readModel: ReadModel | Error): ReadModelStore {
  return {
    getReadModel: async () => {
      if (readModel instanceof Error) throw readModel;

      return readModel;
    },
  } as unknown as ReadModelStore;
}

export interface FakeField {
  name: string;
  type: string | [string];
  value: unknown;
  isRequired: boolean;
  enumValues?: string[];
  reference?: string | null;
}

export function makeAction({
  fields = [],
  layout = [],
  skipped = [],
  postChange,
  postSet,
  execute = jest.fn(),
  setFields,
}: {
  fields?: FakeField[];
  layout?: unknown[];
  skipped?: string[];
  postChange?: { fields?: FakeField[]; layout?: unknown[] };
  postSet?: { fields?: FakeField[]; layout?: unknown[] };
  execute?: jest.Mock;
  setFields?: jest.Mock;
} = {}) {
  const state = { fields: [...fields], layout: [...layout] };

  // Mirrors the real Action: setFields assigns each submitted value onto the matching field
  // (unknown fields would throw there; tests that need that pass their own setFields mock), and a
  // change hook can rebuild the fields in place, which is what a postSet fixture simulates.
  const applyValues = async (values: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(values)) {
      const field = state.fields.find(f => f.name === name);
      if (field) field.value = value;
    }

    if (postSet) {
      state.fields = postSet.fields ?? state.fields;
      state.layout = postSet.layout ?? state.layout;
    }
  };

  const tryToSetFields = jest.fn(async () => {
    if (postChange) {
      state.fields = postChange.fields ?? state.fields;
      state.layout = postChange.layout ?? state.layout;
    }

    return skipped;
  });

  const form: Action & { tryToSetFields: jest.Mock; execute: jest.Mock; setFields: jest.Mock } = {
    execute,
    setFields: setFields ?? jest.fn(applyValues),
    tryToSetFields,
    getFields: () =>
      state.fields.map(f => ({
        getName: () => f.name,
        getType: () => f.type,
        getReference: () => f.reference ?? null,
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

export function clientOf(
  form: Action,
  loadAction: jest.Mock = jest.fn(async () => form),
): AgentActionClient & { loadAction: jest.Mock } {
  return { loadAction };
}

export function buildApp(
  store: ReadModelStore,
  client: AgentActionClient,
  {
    agentToken = 'agent-token',
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

export const readModel = new ReadModel([
  collection('users', [column('id')], [action('approve', '/forest/_actions/users/0/approve')]),
]);

export function buildAppWithTerminal(client: AgentActionClient) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = TIMEZONE;
    ctx.state.agentToken = 'agent-token';
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
