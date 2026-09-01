import express from 'express';
import jsonwebtoken from 'jsonwebtoken';
import { tmpdir } from 'os';
import path from 'path';
import supertest from 'supertest';

import RecordContractDataSource from './fixtures/record-contract-datasource';
import Agent from '../../src/agent';
import MockForestServer from '../__helper__/mock-forest-server';

const AUTH_SECRET = 'test-auth-secret-32-chars-min!!!';
const ENV_SECRET = '0'.repeat(64);
const BOOT_TIMEOUT_MS = 30_000;

const COLLECTION_PERMISSIONS = {
  collection: {
    browseEnabled: true,
    readEnabled: true,
    editEnabled: true,
    addEnabled: true,
    deleteEnabled: true,
    exportEnabled: true,
  },
  actions: {},
};

const COLLECTIONS = [
  {
    name: 'people',
    fields: [
      { field: 'id', type: 'Number', isPrimaryKey: true },
      { field: 'first_name', type: 'String' },
    ],
  },
];

function sessionToken(): string {
  return jsonwebtoken.sign(
    {
      type: 'bff_access',
      sid: 'session-1',
      id: 1,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      team: 'admin',
      rendering_id: '1',
      permission_level: 'admin',
      tags: {},
    },
    AUTH_SECRET,
    { expiresIn: '1h' },
  );
}

describe('the record contract of the embedded BFF', () => {
  let mockForestServer: MockForestServer;
  let agent: Agent;
  let app: express.Express;

  beforeAll(async () => {
    mockForestServer = new MockForestServer();
    mockForestServer
      .get('/liana/v4/permissions/environment', {
        collections: { people: COLLECTION_PERMISSIONS },
      })
      .setupDefaultRoutes({ envSecret: ENV_SECRET, collections: COLLECTIONS })
      .setupSuperagentMock()
      .setupFetchMock();

    agent = new Agent({
      authSecret: AUTH_SECRET,
      envSecret: ENV_SECRET,
      forestServerUrl: 'https://api.forestadmin.com',
      forestAppUrl: 'https://app.forestadmin.com',
      isProduction: false,
      schemaPath: path.join(tmpdir(), `.forestadmin-schema-bff-record-${Date.now()}.json`),
      logger: () => undefined,
    })
      .addDataSource(async () => new RecordContractDataSource())
      .addBff({});

    app = express();
    agent.mountOnExpress(app);

    await agent.start();
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await agent?.stop();
    mockForestServer?.restore();
  });

  function post(url: string, body: unknown) {
    return supertest(app)
      .post(url)
      .set('Authorization', `Bearer ${sessionToken()}`)
      .set('X-Forest-Timezone', 'Europe/Paris')
      .send(body as object);
  }

  it('should carry the flat id as a string while __forest.primaryKey holds it typed', async () => {
    const response = await post('/bff/agent/v1/people/list', { projection: ['id'] });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        id: '8',
        __forest: { collection: 'people', primaryKey: { id: 8 } },
      },
    ]);
  });

  it('should return a snake_case column under its camelCase key, while projecting its schema name', async () => {
    const response = await post('/bff/agent/v1/people/list', { projection: ['id', 'first_name'] });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        id: '8',
        firstName: 'Ada',
        __forest: { collection: 'people', primaryKey: { id: 8 } },
      },
    ]);
  });
});
