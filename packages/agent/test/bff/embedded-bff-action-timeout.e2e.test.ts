import type express from 'express';

import {
  createSessionTokenCodec,
  createTokenCipher,
  deriveBffAccessKey,
} from '@forestadmin/agent-bff';
import expressApp from 'express';
import { readFileSync } from 'fs';
import jsonwebtoken from 'jsonwebtoken';
import { tmpdir } from 'os';
import path from 'path';
import request from 'supertest';

import SearchDataSource from './fixtures/search-datasource';
import Agent from '../../src/agent';
import MockForestServer from '../__helper__/mock-forest-server';

const AUTH_SECRET = 'test-auth-secret-32-chars-min!!!';
const ENV_SECRET = '0'.repeat(64);
const BOOT_TIMEOUT_MS = 30_000;
const TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const SESSION = { sid: 'session-1', userId: 1, renderingId: 1 };

const AGENT_TIMEOUT_MS = 200;
const ACTION_TIMEOUT_MS = 1_500;
const ACTION_OUTLASTING_BOTH_TIMEOUTS_MS = 2_500;
const ACTION_OUTLASTING_AGENT_TIMEOUT_ONLY_MS = 600;

const ALLOW = {
  triggerEnabled: true,
  triggerConditions: [],
  approvalRequired: false,
  approvalRequiredConditions: [],
  userApprovalEnabled: false,
  userApprovalConditions: [],
  selfApprovalEnabled: false,
};

const COLLECTION_PERMISSIONS = {
  collection: {
    browseEnabled: true,
    readEnabled: true,
    editEnabled: true,
    addEnabled: true,
    deleteEnabled: true,
    exportEnabled: true,
  },
  actions: { slow: ALLOW, medium: ALLOW },
};

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

/** The Forest server bearer the session carries, sealed the way the BFF's OAuth exchange seals it. */
function sealedServerAccess(): string {
  const codec = createSessionTokenCodec(createTokenCipher(TOKEN_ENCRYPTION_KEY), {
    now: Date.now,
    sessionTtlSeconds: 3600,
    logger: () => undefined,
  });

  return codec.sealServerAccess(
    SESSION,
    jsonwebtoken.sign({ id: SESSION.userId }, 'forest-server-secret', { expiresIn: '1h' }),
  );
}

function sessionToken(): string {
  return jsonwebtoken.sign(
    {
      type: 'bff_access',
      sid: SESSION.sid,
      server_access: sealedServerAccess(),
      id: SESSION.userId,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      team: 'admin',
      rendering_id: '1',
      permission_level: 'admin',
      tags: {},
    },
    deriveBffAccessKey(TOKEN_ENCRYPTION_KEY),
    { expiresIn: '1h' },
  );
}

interface SchemaFile {
  collections: Array<{ name: string; fields: unknown[]; actions: Array<{ id: string }> }>;
  meta: Record<string, unknown>;
}

/** The agent's own generated schema, served the way the Forest server serves it (JSON:API). */
function forestSchemaFrom(schemaPath: string) {
  const { collections, meta } = JSON.parse(readFileSync(schemaPath, 'utf8')) as SchemaFile;

  return {
    data: collections.map(({ name, fields, actions }) => ({
      id: name,
      type: 'collections',
      attributes: { name, fields },
      relationships: {
        actions: { data: actions.map(action => ({ id: action.id, type: 'actions' })) },
      },
    })),
    included: collections.flatMap(({ actions }) =>
      actions.map(action => ({ id: action.id, type: 'actions', attributes: action })),
    ),
    meta,
  };
}

describe('embedded BFF action execute timeout', () => {
  const schemaPath = path.join(
    tmpdir(),
    `.forestadmin-schema-bff-action-timeout-${Date.now()}.json`,
  );
  const statusUpdates: string[] = [];
  let slowActionFinished: Promise<void>;
  let markSlowActionFinished: () => void;
  let mockForestServer: MockForestServer;
  let agent: Agent;
  let app: express.Express;

  beforeAll(async () => {
    mockForestServer = new MockForestServer();
    mockForestServer
      .get('/liana/v4/permissions/environment', {
        collections: { books: COLLECTION_PERMISSIONS, authors: COLLECTION_PERMISSIONS },
      })
      .get('/liana/forest-schema', () => forestSchemaFrom(schemaPath))
      .patch(/\/api\/activity-logs-requests\/[^/]+\/[^/]+\/status/, (url: string) => {
        statusUpdates.push(url);

        return {};
      })
      .setupDefaultRoutes({ envSecret: ENV_SECRET })
      .setupSuperagentMock()
      .setupFetchMock();

    agent = new Agent({
      authSecret: AUTH_SECRET,
      envSecret: ENV_SECRET,
      forestServerUrl: 'https://api.forestadmin.com',
      forestAppUrl: 'https://app.forestadmin.com',
      isProduction: false,
      schemaPath,
      logger: () => undefined,
    })
      .addDataSource(async () => new SearchDataSource())
      .addBff({
        tokenEncryptionKey: TOKEN_ENCRYPTION_KEY,
        agentTimeoutMs: AGENT_TIMEOUT_MS,
        actionTimeoutMs: ACTION_TIMEOUT_MS,
      });

    agent.customizeCollection('books', collection =>
      collection
        .addAction('slow', {
          scope: 'Global',
          execute: async (_context, resultBuilder) => {
            await sleep(ACTION_OUTLASTING_BOTH_TIMEOUTS_MS);
            markSlowActionFinished();

            return resultBuilder.success('slow done');
          },
        })
        .addAction('medium', {
          scope: 'Global',
          execute: async (_context, resultBuilder) => {
            await sleep(ACTION_OUTLASTING_AGENT_TIMEOUT_ONLY_MS);

            return resultBuilder.success('medium done');
          },
        }),
    );

    app = expressApp();
    agent.mountOnExpress(app);
    await agent.start();
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await agent?.stop();
    mockForestServer?.restore();
  });

  beforeEach(() => {
    statusUpdates.length = 0;
    slowActionFinished = new Promise(resolve => {
      markSlowActionFinished = resolve;
    });
  });

  function execute(action: string) {
    return request(app)
      .post(`/bff/agent/v1/books/actions/${action}/execute`)
      .set('Authorization', `Bearer ${sessionToken()}`)
      .set('X-Forest-Timezone', 'Europe/Paris')
      .send({ recordIds: [] });
  }

  it('should answer 504 with an unknown outcome, leave the log pending, and let the action finish', async () => {
    const response = await execute('slow');

    expect(response.status).toBe(504);
    expect(response.body.error).toEqual({
      type: 'agent_timeout',
      status: 504,
      message:
        'The agent did not respond in time. The action may still have run: check its outcome before retrying.',
      details: { outcome: 'unknown' },
    });

    await slowActionFinished;
    await sleep(50);
    expect(statusUpdates).toEqual([]);
  });

  it('should give the execute the action timeout rather than the shorter agent one', async () => {
    const response = await execute('medium');

    expect(response.status).toBe(200);
    expect(statusUpdates).toHaveLength(1);
  });
});
