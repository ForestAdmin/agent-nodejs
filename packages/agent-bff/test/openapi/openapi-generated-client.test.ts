import type { Action, AgentActionClient } from '../../src/action/agent-action-client';
import type { AgentDataClient } from '../../src/data/agent-data-client';
import type { Logger } from '../../src/ports/logger-port';
import type ReadModelStore from '../../src/read-model/read-model-store';
import type { Server } from 'http';

import { bodyParser } from '@koa/bodyparser';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import Koa from 'koa';
import path from 'path';

import createActionRoutesMiddleware from '../../src/action/action-routes-middleware';
import { BFF_KEY_HEADER } from '../../src/api-key/api-key-middleware';
import dispatchCli from '../../src/cli-dispatch';
import createDataRoutesMiddleware from '../../src/data/data-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import ReadModel from '../../src/read-model/read-model';
import createTimezoneMiddleware, { TIMEZONE_HEADER } from '../../src/timezone/timezone-middleware';
import { action, collection, column, relation } from '../read-model/fixtures';

const MARK_AS_PAID = 'Mark as paid';
const GENERATE_INVOICE = 'Générer la facture';
// A name carrying the path separator: raw in the document it would not resolve to any route.
const SPLIT_INVOICE = 'Facture 50/50';

// One fixture for both sides: the document is generated from this schema and these capabilities, and
// the chain the generated client calls runs on the very same ones. Two sources would let the test go
// green while the document described a surface the runtime does not have.
const SCHEMA = [
  collection(
    'users',
    [column('id'), column('email'), relation('orders', 'HasMany', 'orders.userId')],
    [
      action(MARK_AS_PAID, '/forest/users/actions/mark-as-paid'),
      action(GENERATE_INVOICE, '/forest/users/actions/generer-la-facture'),
      action(SPLIT_INVOICE, '/forest/users/actions/facture-50-50'),
    ],
  ),
  collection('orders', [column('id')]),
];

// Deliberately a single operator: it makes the negative control below unambiguous, since any other
// operator is then out of the documented set without being unmappable (which would answer 500).
const CAPABILITIES = { fields: [{ name: 'id', type: 'Number', operators: ['equal'] }] };

const DOCUMENTED_OPERATOR = 'Equal';
const UNDOCUMENTED_OPERATOR = 'GreaterThan';

const fetchSchema = jest.fn().mockResolvedValue(SCHEMA);
const fetchCapabilities = jest.fn().mockResolvedValue(CAPABILITIES);

jest.mock('../../src/read-model/forest-schema-client', () => ({
  __esModule: true,
  default: class {
    // eslint-disable-next-line class-methods-use-this
    fetchSchema() {
      return fetchSchema();
    }
  },
}));

jest.mock('../../src/read-model/agent-capabilities-fetcher', () => ({
  __esModule: true,
  default: () => fetchCapabilities,
}));

const ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  HTTP_PORT: '0',
} satisfies NodeJS.ProcessEnv;

const TIMEZONE = 'Europe/Paris';
const API_KEY = 'fixture-bff-key';
const RECORD_ID = '1';

const GENERATED_DIR = path.join(__dirname, '.generated');
const DOCUMENT_FILE = path.join(GENERATED_DIR, 'openapi.json');
const CLIENT_DIR = path.join(GENERATED_DIR, 'client');
const SDK_FILE = path.join(CLIENT_DIR, 'sdk.gen.ts');

const CODEGEN_BIN = path.join(
  path.dirname(require.resolve('@hey-api/openapi-ts/package.json')),
  'bin/run.js',
);

const CODEGEN_TIMEOUT_MS = 60_000;

const noopLogger: Logger = () => undefined;

interface CallResult {
  response: { status: number };
  data?: unknown;
  error?: unknown;
}

type Call = (options?: Record<string, unknown>) => Promise<CallResult>;

interface GeneratedClient {
  setConfig: (config: Record<string, unknown>) => unknown;
}

const OPERATIONS = [
  'listRecordsUsers',
  'countRecordsUsers',
  'listRecordsOrders',
  'countRecordsOrders',
  'listRelatedRecordsUsersOrders',
  'countRelatedRecordsUsersOrders',
  'getActionFormUsersMarkAsPaid',
  'executeActionUsersMarkAsPaid',
  'getActionFormUsersGNRerLaFacture',
  'executeActionUsersGNRerLaFacture',
  'getActionFormUsersFacture5050',
  'executeActionUsersFacture5050',
] as const;

const dataClient: AgentDataClient = {
  list: async () => [{ id: 1, email: 'someone@example.com' }],
  countRaw: async () => ({ count: 1 }),
  listRelation: async () => [{ id: 7 }],
  countRelationRaw: async () => ({ count: 1 }),
};

function makeAction(): Action {
  return {
    tryToSetFields: async () => [],
    setFields: async () => undefined,
    execute: async () => ({ success: 'Done' }),
    getFields: () => [
      {
        getName: () => 'comment',
        getType: () => 'String',
        getReference: () => null,
        getValue: () => null,
        isRequired: () => false,
      },
    ],
    getEnumField: () => ({ getOptions: () => undefined }),
    getLayout: () => ({ layout: [] }),
  };
}

const actionClient: AgentActionClient = { loadAction: async () => makeAction() };

function storeOf(readModel: ReadModel): ReadModelStore {
  return {
    getReadModel: async () => readModel,
    getCapabilities: async () => ({ capabilities: CAPABILITIES, readModel }),
  } as unknown as ReadModelStore;
}

type AuthCallback = (scheme: { name?: string }) => string | undefined;

const SCHEME_AWARE_AUTH: AuthCallback = scheme =>
  scheme.name === BFF_KEY_HEADER ? API_KEY : undefined;

const receivedKeys: string[] = [];
const receivedAuthorizations: string[] = [];

function buildApp(): Koa {
  const store = storeOf(new ReadModel(SCHEMA));
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    receivedKeys.push(ctx.get(BFF_KEY_HEADER));
    receivedAuthorizations.push(ctx.get('Authorization'));
    // Auth is out of this test's scope (the gate is its own ticket): the request arrives with agent
    // credentials already resolved, exactly as the auth chain would have left it.
    ctx.state.agentToken = 'agent-jwt';
    await next();
  });
  app.use(createTimezoneMiddleware({ defaultTimezone: TIMEZONE }));
  app.use(
    createDataRoutesMiddleware({
      store,
      agentUrl: ENV.AGENT_URL,
      logger: noopLogger,
      createClient: () => dataClient,
    }),
  );
  app.use(
    createActionRoutesMiddleware({
      store,
      agentUrl: ENV.AGENT_URL,
      logger: noopLogger,
      createClient: () => actionClient,
    }),
  );

  return app;
}

function documentedOperators(document: {
  components: { schemas: Record<string, { properties?: { operator?: { enum?: string[] } } }> };
}): string[] {
  const leaf = document.components.schemas['FilterLeaf_users-1'];

  return leaf?.properties?.operator?.enum ?? [];
}

describe('a client generated from the emitted OpenAPI document', () => {
  let codegenOutput: string;
  let configure: (auth: AuthCallback) => unknown;
  let document: ReturnType<typeof JSON.parse>;
  let sdk: Record<string, Call>;
  let server: Server;

  beforeAll(async () => {
    rmSync(GENERATED_DIR, { recursive: true, force: true });

    // The command writes its own progress to stderr. Silenced so the run stays readable, but kept:
    // it is the only account of why an emission failed.
    // Read out before restoring, not after: `mockRestore` clears `mock.calls`, so a message built
    // from the spy afterwards would always be empty — which is the whole account of a failure here.
    const stderr = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    let written = '';
    const emitted = await dispatchCli(
      ['openapi', '--output', DOCUMENT_FILE],
      ENV,
      noopLogger,
    ).finally(() => {
      written = stderr.mock.calls.flat().join('');
      stderr.mockRestore();
    });

    if (emitted.exitCode !== 0) {
      throw new Error(`The CLI could not emit the document: ${written}`.trim());
    }

    // Timed out rather than left to the `beforeAll` deadline: `spawnSync` blocks the event loop, so a
    // codegen child that hangs would hang the whole Jest run until CI kills the job. `--no-log-file`
    // because a failing run otherwise drops an `openapi-ts-error-*.log` in the working directory.
    const result = spawnSync(
      process.execPath,
      [CODEGEN_BIN, '--input', DOCUMENT_FILE, '--output', CLIENT_DIR, '--silent', '--no-log-file'],
      {
        encoding: 'utf8',
        timeout: CODEGEN_TIMEOUT_MS,
        // Cleared so a Node warning inherited from the parent cannot land in the output this file
        // asserts on: what is measured here is the document, not the runner's flags.
        env: { ...process.env, NODE_OPTIONS: '' },
      },
    );
    codegenOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    // Before requiring anything it generated: a failed codegen leaves no `sdk.gen.ts`, and the
    // MODULE_NOT_FOUND that follows would bury the tool's own account of what it choked on. The file
    // is checked as well as the status, because this codegen reports some failures — a missing input
    // among them — on its output while still exiting 0.
    if (result.status !== 0 || !existsSync(SDK_FILE)) {
      throw new Error(
        `The codegen could not consume the document (status ${result.status}${
          result.error ? `, ${result.error.message}` : ''
        }): ${codegenOutput || `nothing was written to ${SDK_FILE}`}`.trim(),
      );
    }

    document = JSON.parse(readFileSync(DOCUMENT_FILE, 'utf8'));

    // eslint-disable-next-line global-require, import/no-dynamic-require
    sdk = require(SDK_FILE);
    // eslint-disable-next-line global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires
    const { client } = require(path.join(CLIENT_DIR, 'client.gen.ts')) as {
      client: GeneratedClient;
    };

    server = buildApp().listen(0);
    const { port } = server.address() as { port: number };

    configure = auth =>
      client.setConfig({
        baseUrl: `http://127.0.0.1:${port}`,
        auth,
        headers: { [TIMEZONE_HEADER]: TIMEZONE },
      });
    configure(SCHEME_AWARE_AUTH);
  }, CODEGEN_TIMEOUT_MS * 2);

  afterAll(async () => {
    // Awaited: a fire-and-forget close can leave the port open into the next suite.
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    }

    rmSync(GENERATED_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    receivedKeys.length = 0;
    receivedAuthorizations.length = 0;
  });

  describe('when a standard codegen reads the document', () => {
    it('should generate without a warning, since a warning is the document confusing the tool', () => {
      expect(codegenOutput).toBe('');
    });

    it('should expose one function per documented operation, named after its operationId', () => {
      expect(OPERATIONS.filter(name => typeof sdk[name] !== 'function')).toEqual([]);
    });

    it('should carry the documented operator set into the generated types', () => {
      const types = readFileSync(path.join(CLIENT_DIR, 'types.gen.ts'), 'utf8');

      const operators = documentedOperators(document);

      // Asserted against the literal first: both sides of the filter below derive from the document,
      // so an empty enum would satisfy it vacuously.
      expect(operators).toEqual([DOCUMENTED_OPERATOR]);
      expect(operators.filter(operator => !types.includes(`'${operator}'`))).toEqual([]);
    });
  });

  describe('when the generated client lists and counts a collection', () => {
    it('should reach the collection list endpoint', async () => {
      const { response, data } = await sdk.listRecordsUsers({
        body: { projection: ['id'], sort: [{ field: 'id', direction: 'asc' }] },
      });

      expect({ status: response.status, data }).toEqual({
        status: 200,
        data: {
          data: [
            {
              id: 1,
              email: 'someone@example.com',
              __forest: { collection: 'users', primaryKey: { id: '1' } },
            },
          ],
          meta: { countStatus: 'not_requested' },
        },
      });
    });

    it('should reach the collection count endpoint', async () => {
      const { response, data } = await sdk.countRecordsUsers({ body: {} });

      expect({ status: response.status, data }).toEqual({
        status: 200,
        data: { count: 1, countStatus: 'available' },
      });
    });

    it('should send the credential under the documented security scheme', async () => {
      await sdk.countRecordsUsers({ body: {} });

      expect(receivedKeys).toEqual([API_KEY]);
    });

    it('should send the key alone when the caller reads the scheme it is answering', async () => {
      await sdk.countRecordsUsers({ body: {} });

      expect(receivedAuthorizations).toEqual(['']);
    });

    it('should send both credentials when the caller answers every scheme with the same token', async () => {
      configure(() => API_KEY);

      try {
        await sdk.countRecordsUsers({ body: {} });
      } finally {
        configure(SCHEME_AWARE_AUTH);
      }

      expect({ keys: receivedKeys, authorizations: receivedAuthorizations }).toEqual({
        keys: [API_KEY],
        authorizations: [`Bearer ${API_KEY}`],
      });
    });
  });

  describe('when the generated client lists and counts a relation', () => {
    it('should reach the relation list endpoint', async () => {
      const { response, data } = await sdk.listRelatedRecordsUsersOrders({
        body: { parentId: RECORD_ID, projection: ['id'] },
      });

      expect({ status: response.status, data }).toEqual({
        status: 200,
        data: {
          data: [{ id: 7, __forest: { collection: 'orders', primaryKey: { id: '7' } } }],
          meta: { countStatus: 'not_requested' },
        },
      });
    });

    it('should reach the relation count endpoint', async () => {
      const { response, data } = await sdk.countRelatedRecordsUsersOrders({
        body: { parentId: RECORD_ID },
      });

      expect({ status: response.status, data }).toEqual({
        status: 200,
        data: { count: 1, countStatus: 'available' },
      });
    });
  });

  describe('when the generated client drives an action', () => {
    it('should load the form', async () => {
      const { response, data } = await sdk.getActionFormUsersMarkAsPaid({
        body: { recordIds: [RECORD_ID] },
      });

      expect({ status: response.status, data }).toEqual({
        status: 200,
        data: {
          fields: [{ name: 'comment', type: 'String', value: null, isRequired: false }],
          canExecute: true,
          requiredFields: [],
          skippedFields: [],
          layout: [],
        },
      });
    });

    it('should execute the action', async () => {
      const { response, data } = await sdk.executeActionUsersMarkAsPaid({
        body: { recordIds: [RECORD_ID], values: { comment: 'paid' } },
      });

      expect({ status: response.status, data }).toEqual({
        status: 200,
        data: { type: 'success', message: 'Done', invalidated: [], html: null },
      });
    });

    it('should reach an action whose name carries an accent', async () => {
      const form = await sdk.getActionFormUsersGNRerLaFacture({ body: { recordIds: [RECORD_ID] } });
      const executed = await sdk.executeActionUsersGNRerLaFacture({
        body: { recordIds: [RECORD_ID] },
      });

      expect([form.response.status, executed.response.status]).toEqual([200, 200]);
    });

    // The separator is what makes this more than a formality: a raw name would split the path into
    // segments the route cannot match, so only a percent-encoded document resolves here.
    it('should reach an action whose name carries the path separator', async () => {
      const form = await sdk.getActionFormUsersFacture5050({ body: { recordIds: [RECORD_ID] } });
      const executed = await sdk.executeActionUsersFacture5050({
        body: { recordIds: [RECORD_ID] },
      });

      expect([form.response.status, executed.response.status]).toEqual([200, 200]);
    });
  });

  describe("when the generated client filters on a documented field's operator", () => {
    it('should document exactly the capabilities operator, normalized', () => {
      expect(documentedOperators(document)).toEqual([DOCUMENTED_OPERATOR]);
    });

    it('should be accepted for every operator the document advertises', async () => {
      const statuses = await Promise.all(
        documentedOperators(document).map(async operator => {
          const { response } = await sdk.listRecordsUsers({
            body: { filter: { field: 'id', operator, value: 1 } },
          });

          return [operator, response.status];
        }),
      );

      expect(statuses).toEqual([[DOCUMENTED_OPERATOR, 200]]);
    });

    it('should be rejected for an operator the document leaves out, so the enum means something', async () => {
      const { response, error } = await sdk.listRecordsUsers({
        body: { filter: { field: 'id', operator: UNDOCUMENTED_OPERATOR, value: 1 } },
      });

      expect({ status: response.status, error }).toEqual({
        status: 400,
        error: {
          error: {
            type: 'invalid_filter_operator',
            status: 400,
            message: expect.stringContaining('id'),
            details: { field: 'id', validOperators: [DOCUMENTED_OPERATOR] },
          },
        },
      });
    });
  });
});
