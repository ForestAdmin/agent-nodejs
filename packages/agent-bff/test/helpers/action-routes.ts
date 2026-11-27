import type { Action, AgentActionClient } from '../../src/action/agent-action-client';
import type { Logger } from '../../src/ports/logger-port';
import type ReadModelStore from '../../src/read-model/read-model-store';

import {
  ActionOutcomeUnknownError,
  ActionValuesNotExecutableError,
} from '@forestadmin/agent-client';
import describeActionForm from '@forestadmin/agent-client/dist/action-fields/form-description';
import mayHaveRun from '@forestadmin/agent-client/dist/agent-error';
import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';

import createActionRoutesMiddleware from '../../src/action/action-routes-middleware';
import { createHttpTransport } from '../../src/agent/agent-transport';
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

  const reader = {
    getFields: () =>
      state.fields.map(f => ({
        getName: () => f.name,
        getType: () => f.type,
        getEffectiveTypeName: () => (Array.isArray(f.type) ? `${f.type[0]}List` : f.type),
        getReference: () => f.reference ?? null,
        getValue: () => f.value,
        isRequired: () => f.isRequired,
        getPlainField: () => ({}),
        getMultipleChoiceField: () => ({ getOptions: () => undefined }),
      })),
    getEnumField: (name: string) => ({
      getOptions: () => state.fields.find(f => f.name === name)?.enumValues,
    }),
  };

  const form: Action & { tryToSetFields: jest.Mock; execute: jest.Mock; setFields: jest.Mock } = {
    execute,
    setFields: setFields ?? jest.fn(applyValues),
    tryToSetFields,
    getLayout: () => ({ layout: state.layout }),
    describeForm(overrides?: Record<string, unknown>) {
      return describeActionForm(reader, overrides);
    },
  };

  return form;
}

export function clientOf(
  form: Action,
  loadAction: jest.Mock = jest.fn(async () => form),
): AgentActionClient & { loadAction: jest.Mock } {
  return {
    loadAction,
    executeAction: async ({ beforeCall, fill, maxTimeAllowed, ...params }) => {
      await beforeCall();
      const loaded: Action = await loadAction(params);
      await fill(loaded);
      const { requiredFields, invalidValues } = loaded.describeForm();

      if (requiredFields.length > 0 || invalidValues.length > 0) {
        throw new ActionValuesNotExecutableError(requiredFields, invalidValues);
      }

      try {
        return await loaded.execute(maxTimeAllowed === undefined ? undefined : { maxTimeAllowed });
      } catch (error) {
        if (mayHaveRun(error)) throw new ActionOutcomeUnknownError(error);
        throw error;
      }
    },
  };
}

export function buildApp(
  store: ReadModelStore,
  client: AgentActionClient,
  {
    agentToken = 'agent-token',
    logger = noopLogger,
    timezone = TIMEZONE,
    actionTimeoutMs,
  }: {
    agentToken?: string | null;
    logger?: Logger;
    timezone?: string;
    actionTimeoutMs?: number;
  } = {},
) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = timezone;
    ctx.state.authMode = 'api-key';
    ctx.state.apiKeyIdentity = { renderingId: 1 };
    if (agentToken !== null) ctx.state.agentToken = agentToken;
    await next();
  });
  app.use(
    createActionRoutesMiddleware({
      forestServerUrl: 'https://api.forestadmin.test',
      store,
      transport: createHttpTransport({ agentUrl: 'https://agent.example.com' }),
      logger,
      createClient: () => client,
      actionTimeoutMs,
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
    ctx.state.authMode = 'api-key';
    ctx.state.apiKeyIdentity = { renderingId: 1 };
    ctx.state.agentToken = 'agent-token';
    await next();
  });
  app.use(
    createActionRoutesMiddleware({
      forestServerUrl: 'https://api.forestadmin.test',
      store: storeOf(readModel),
      transport: createHttpTransport({ agentUrl: 'https://agent.example.com' }),
      logger: noopLogger,
      createClient: () => client,
    }),
  );
  app.use(async ctx => {
    ctx.status = 204;
  });

  return app;
}
