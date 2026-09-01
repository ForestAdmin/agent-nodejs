import express from 'express';
import jsonwebtoken from 'jsonwebtoken';
import { tmpdir } from 'os';
import path from 'path';
import supertest from 'supertest';

import SearchDataSource from './fixtures/search-datasource';
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
    name: 'authors',
    fields: [
      { field: 'id', type: 'Number', isPrimaryKey: true },
      { field: 'name', type: 'String' },
    ],
  },
  {
    name: 'books',
    fields: [
      { field: 'id', type: 'Number', isPrimaryKey: true },
      { field: 'title', type: 'String' },
      { field: 'authorId', type: 'Number' },
    ],
  },
  {
    name: 'ledgers',
    fields: [
      { field: 'id', type: 'Number', isPrimaryKey: true },
      { field: 'label', type: 'String' },
    ],
  },
];

/** What the third-party UI presents. Signed like the BFF's own OAuth mode signs it. */
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

describe('embedded BFF', () => {
  let mockForestServer: MockForestServer;
  let agent: Agent;
  let app: express.Express;

  beforeAll(async () => {
    mockForestServer = new MockForestServer();
    mockForestServer
      // Registered first: the first matching route wins, and the default one only grants the
      // collections of the sqlite fixture.
      .get('/liana/v4/permissions/environment', {
        collections: {
          authors: COLLECTION_PERMISSIONS,
          books: COLLECTION_PERMISSIONS,
          ledgers: COLLECTION_PERMISSIONS,
        },
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
      schemaPath: path.join(tmpdir(), `.forestadmin-schema-bff-${Date.now()}.json`),
      logger: () => undefined,
    })
      .addDataSource(async () => new SearchDataSource())
      .addBff({ allowedOrigins: ['https://my-app.com'] });

    app = express();
    agent.mountOnExpress(app);

    agent.customizeCollection('books', collection =>
      collection.addManyToOneRelation('author', 'authors', { foreignKey: 'authorId' }),
    );
    agent.customizeCollection('ledgers', collection => collection.disableSearch());

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

  describe('/bff/health', () => {
    it('should report ok with the features this deployment switched on', async () => {
      const response = await supertest(app).get('/bff/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        features: { oauth: false, ai: false, cors: true, openapi: false },
      });
    });
  });

  function titlesOf(body: { data: Array<{ title: string }> }): string[] {
    return body.data.map(record => record.title).sort();
  }

  describe('data routes', () => {
    it('should list the records the agent serves, through the in-process transport', async () => {
      const response = await post('/bff/agent/v1/books/list', { projection: ['id', 'title'] });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot', 'The Dispossessed']);
    });

    it('should return only what the search matches', async () => {
      const response = await post('/bff/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: 'foundation',
      });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation']);
    });

    it('should not match a related record without searchExtended', async () => {
      const response = await post('/bff/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: 'asimov',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should reach a relation when searchExtended is set', async () => {
      const response = await post('/bff/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: 'asimov',
        searchExtended: true,
      });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot']);
    });

    // Accepted behaviour, pinned here so it cannot change unnoticed: the search value is a query,
    // and `relation.column:value` crosses a relation with no `searchExtended`. The same path in a
    // filter draws 422 relation_field_not_supported, so this is the one way a request reaches a
    // relation column through the top-level routes.
    it('should cross a relation through the query syntax without searchExtended', async () => {
      const response = await post('/bff/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: 'author.name:asimov',
      });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot']);
    });

    it('should reject the same relation path in a filter, unlike in a search', async () => {
      const response = await post('/bff/agent/v1/books/list', {
        projection: ['id', 'title'],
        filter: { field: 'author:name', operator: 'IContains', value: 'asimov' },
      });

      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({ type: 'relation_field_not_supported' });
    });

    it('should intersect the search with the filter rather than replace it', async () => {
      const response = await post('/bff/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: 'asimov',
        searchExtended: true,
        filter: { field: 'title', operator: 'IContains', value: 'robot' },
      });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['I, Robot']);
    });

    it('should list everything when the search holds only whitespace', async () => {
      const response = await post('/bff/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: '   ',
      });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot', 'The Dispossessed']);
    });

    it('should count the searched rows rather than the collection', async () => {
      const searched = await post('/bff/agent/v1/books/count', { search: 'foundation' });
      const all = await post('/bff/agent/v1/books/count', {});

      expect(all.body).toEqual({ count: 3, countStatus: 'available' });
      expect(searched.body).toEqual({ count: 1, countStatus: 'available' });
    });

    it('should count the rows a relation-extended search returns', async () => {
      const response = await post('/bff/agent/v1/books/count', {
        search: 'asimov',
        searchExtended: true,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ count: 2, countStatus: 'available' });
    });
  });

  describe('a collection whose search is disabled', () => {
    // Outside production the agent dumps every handled error to stderr, so the two rejections
    // asserted here would drown the suite output in expected stack traces.
    let consoleError: jest.SpyInstance;

    beforeAll(() => {
      consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
      consoleError.mockRestore();
    });

    it('should surface an agent-side refusal as the BFF error contract', async () => {
      const response = await post('/bff/agent/v1/ledgers/list', {
        projection: ['id', 'label'],
        search: 'foundation',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        type: 'validation_error',
        status: 400,
        message: 'Collection is not searchable',
      });
    });

    it('should reject a count search the same way list does', async () => {
      const response = await post('/bff/agent/v1/ledgers/count', { search: 'foundation' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        type: 'validation_error',
        status: 400,
        message: 'Collection is not searchable',
      });
    });

    it('should still serve it when no search is sent', async () => {
      const response = await post('/bff/agent/v1/ledgers/list', { projection: ['id', 'label'] });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('the agent routes next to it', () => {
    it('should keep answering on their own prefix', async () => {
      const response = await supertest(app).get('/forest');

      expect(response.status).toBe(200);
    });

    it('should not claim a url that merely starts with the same letters', async () => {
      const response = await supertest(app).get('/bffalo');

      expect(response.status).toBe(404);
    });
  });

  describe('once the agent is stopped', () => {
    it(
      'should stop answering rather than dispatch into a dead stack',
      async () => {
        const stoppedAgent = new Agent({
          authSecret: AUTH_SECRET,
          envSecret: ENV_SECRET,
          forestServerUrl: 'https://api.forestadmin.com',
          forestAppUrl: 'https://app.forestadmin.com',
          isProduction: false,
          schemaPath: path.join(tmpdir(), `.forestadmin-schema-bff-stop-${Date.now()}.json`),
          logger: () => undefined,
        })
          .addDataSource(async () => new SearchDataSource())
          .addBff({});

        const stoppedApp = express();
        stoppedAgent.mountOnExpress(stoppedApp);
        await stoppedAgent.start();
        await stoppedAgent.stop();

        const response = await supertest(stoppedApp).get('/bff/health');

        expect(response.status).toBe(503);
        expect(response.body.error).toMatchObject({ type: 'bff_not_started' });
      },
      BOOT_TIMEOUT_MS,
    );
  });
});
