import type { Server } from 'http';
import type supertest from 'supertest';

import { buildBff, parseConfig } from '@forestadmin/agent-bff';
import express from 'express';
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

type Post = (url: string, body: unknown) => supertest.Test;

function titlesOf(body: { data: Array<{ title: string }> }): string[] {
  return body.data.map(record => record.title).sort();
}

/**
 * The contract the data routes owe whichever transport carries them. Run twice: once over the
 * in-process dispatcher an embedded BFF uses, once over the socket a standalone deployment uses.
 * Both go through a real agent, so a behaviour that only one transport gets right fails here.
 */
function itServesTheDataContract(post: () => Post) {
  describe('list', () => {
    it('should list the records the agent serves', async () => {
      const response = await post()('/agent/v1/books/list', { projection: ['id', 'title'] });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot', 'The Dispossessed']);
    });

    it('should return only what the search matches', async () => {
      const response = await post()('/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: 'foundation',
      });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation']);
    });

    it('should not match a related record without searchExtended', async () => {
      const response = await post()('/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: 'asimov',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should reach a relation when searchExtended is set', async () => {
      const response = await post()('/agent/v1/books/list', {
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
      const response = await post()('/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: 'author.name:asimov',
      });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot']);
    });

    it('should reject the same relation path in a filter, unlike in a search', async () => {
      const response = await post()('/agent/v1/books/list', {
        projection: ['id', 'title'],
        filter: { field: 'author:name', operator: 'IContains', value: 'asimov' },
      });

      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({ type: 'relation_field_not_supported' });
    });

    it('should intersect the search with the filter rather than replace it', async () => {
      const response = await post()('/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: 'asimov',
        searchExtended: true,
        filter: { field: 'title', operator: 'IContains', value: 'robot' },
      });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['I, Robot']);
    });

    it('should list everything when the search holds only whitespace', async () => {
      const response = await post()('/agent/v1/books/list', {
        projection: ['id', 'title'],
        search: '   ',
      });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot', 'The Dispossessed']);
    });
  });

  describe('count', () => {
    it('should count the searched rows rather than the collection', async () => {
      const searched = await post()('/agent/v1/books/count', { search: 'foundation' });
      const all = await post()('/agent/v1/books/count', {});

      expect(all.body).toEqual({ count: 3, countStatus: 'available' });
      expect(searched.body).toEqual({ count: 1, countStatus: 'available' });
    });

    it('should count the rows a relation-extended search returns', async () => {
      const response = await post()('/agent/v1/books/count', {
        search: 'asimov',
        searchExtended: true,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ count: 2, countStatus: 'available' });
    });
  });

  describe('a collection whose search is disabled', () => {
    it('should surface the agent-side refusal as the BFF error contract', async () => {
      const response = await post()('/agent/v1/ledgers/list', {
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

    it('should refuse a count search the same way list does', async () => {
      const response = await post()('/agent/v1/ledgers/count', { search: 'foundation' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        type: 'validation_error',
        status: 400,
        message: 'Collection is not searchable',
      });
    });

    it('should still serve it when no search is sent', async () => {
      const response = await post()('/agent/v1/ledgers/list', { projection: ['id', 'label'] });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });
}

function agentOptions(schemaSuffix: string) {
  return {
    authSecret: AUTH_SECRET,
    envSecret: ENV_SECRET,
    forestServerUrl: 'https://api.forestadmin.com',
    forestAppUrl: 'https://app.forestadmin.com',
    isProduction: false,
    schemaPath: path.join(tmpdir(), `.forestadmin-schema-bff-${schemaSuffix}-${Date.now()}.json`),
    logger: () => undefined,
  };
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

    agent = new Agent(agentOptions('embedded'))
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

  function authenticated(url: string, body: unknown) {
    return request(app)
      .post(url)
      .set('Authorization', `Bearer ${sessionToken()}`)
      .set('X-Forest-Timezone', 'Europe/Paris')
      .send(body as object);
  }

  describe('/bff/health', () => {
    it('should report ok with the surfaces this deployment was configured for', async () => {
      const response = await request(app).get('/bff/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        configured: { oauth: false, ai: false, cors: true, openapi: false },
      });
    });
  });

  describe('over the in-process transport', () => {
    itServesTheDataContract(() => (url, body) => authenticated(`/bff${url}`, body));
  });

  // The standalone deployment's only route to the agent, and the configuration shipping today: a
  // BFF built with an AGENT_URL, reaching the agent over a real socket instead of the dispatcher.
  describe('over the http transport', () => {
    let httpServer: Server;
    let bffCallback: Parameters<typeof request>[0];

    beforeAll(async () => {
      httpServer = await new Promise<Server>(resolve => {
        const server = app.listen(0, () => resolve(server));
      });
      const { port } = httpServer.address() as { port: number };

      const { callback } = await buildBff({
        config: parseConfig({
          FOREST_AUTH_SECRET: AUTH_SECRET,
          FOREST_ENV_SECRET: ENV_SECRET,
          FOREST_SERVER_URL: 'https://api.forestadmin.com',
          FOREST_APP_URL: 'https://app.forestadmin.com',
          AGENT_URL: `http://127.0.0.1:${port}`,
          BFF_OPENAPI_ENABLED: 'false',
        }),
        logger: () => undefined,
      });
      bffCallback = callback;
    }, BOOT_TIMEOUT_MS);

    afterAll(async () => {
      await new Promise(resolve => {
        httpServer.close(resolve);
      });
    });

    itServesTheDataContract(
      () => (url, body) =>
        request(bffCallback)
          .post(url)
          .set('Authorization', `Bearer ${sessionToken()}`)
          .set('X-Forest-Timezone', 'Europe/Paris')
          .send(body as object),
    );
  });

  describe('the allow-list against a host that answers the preflight itself', () => {
    /** A permissive host CORS, the kind an Express app registers without thinking about it. */
    function permissiveHostCors(): express.RequestHandler {
      return (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();

          return;
        }

        next();
      };
    }

    async function hostWithPermissiveCorsInFront() {
      const hosted = new Agent(agentOptions('host-cors'))
        .addDataSource(async () => new SearchDataSource())
        .addBff({ allowedOrigins: ['https://my-app.com'] });
      const hostApp = express();
      hostApp.use(permissiveHostCors());
      hosted.mountOnExpress(hostApp);
      await hosted.start();

      return { hosted, hostApp };
    }

    // The preflight is lost to the host — nothing downstream can take it back — so the allow-list
    // has to hold on the request that follows, which is the one with the side effects.
    it(
      'should refuse the request a permissive host preflight let through',
      async () => {
        const { hosted, hostApp } = await hostWithPermissiveCorsInFront();

        try {
          const preflight = await request(hostApp)
            .options('/bff/agent/v1/books/list')
            .set('Origin', 'https://forbidden.example.com')
            .set('Access-Control-Request-Method', 'POST');

          const actual = await request(hostApp)
            .post('/bff/agent/v1/books/list')
            .set('Origin', 'https://forbidden.example.com')
            .set('Authorization', `Bearer ${sessionToken()}`)
            .set('X-Forest-Timezone', 'Europe/Paris')
            .send({ projection: ['id', 'title'] });

          // The host did answer the preflight, permissively: that part is out of our hands.
          expect(preflight.headers['access-control-allow-origin']).toBe('*');
          // What is in our hands: the collection is never read for that origin.
          expect(actual.status).toBe(403);
          expect(actual.body.error).toMatchObject({ type: 'origin_not_allowed' });
        } finally {
          await hosted.stop();
        }
      },
      BOOT_TIMEOUT_MS,
    );

    it(
      'should still serve an allow-listed origin through the same host',
      async () => {
        const { hosted, hostApp } = await hostWithPermissiveCorsInFront();

        try {
          const response = await request(hostApp)
            .post('/bff/agent/v1/books/list')
            .set('Origin', 'https://my-app.com')
            .set('Authorization', `Bearer ${sessionToken()}`)
            .set('X-Forest-Timezone', 'Europe/Paris')
            .send({ projection: ['id', 'title'] });

          expect(response.status).toBe(200);
        } finally {
          await hosted.stop();
        }
      },
      BOOT_TIMEOUT_MS,
    );
  });

  describe('when the host serves the agent under a sub-path of its own', () => {
    async function hostWithSubPath() {
      const hosted = new Agent(agentOptions('sub-path'))
        .addDataSource(async () => new SearchDataSource())
        .addBff({ allowedOrigins: ['https://my-app.com'], openapiEnabled: true });
      const mounted = express();
      hosted.mountOnExpress(mounted);
      const hostApp = express();
      hostApp.use('/api', mounted);
      await hosted.start();

      return { hosted, hostApp };
    }

    it(
      'should answer under the host prefix and nowhere else',
      async () => {
        const { hosted, hostApp } = await hostWithSubPath();

        try {
          expect((await request(hostApp).get('/api/bff/health')).status).toBe(200);
          expect((await request(hostApp).get('/bff/health')).status).toBe(404);
        } finally {
          await hosted.stop();
        }
      },
      BOOT_TIMEOUT_MS,
    );

    // Routing works either way — Express strips its own prefix. What breaks without deriving the
    // prefix per request is everything the BFF *emits*: a generated client and the docs viewer both
    // aim at `/bff/...`, which the host does not serve.
    it(
      'should carry the host prefix into the document and the docs page',
      async () => {
        const { hosted, hostApp } = await hostWithSubPath();

        try {
          const document = await request(hostApp)
            .get('/api/bff/agent/openapi.json')
            .set('Authorization', `Bearer ${sessionToken()}`);
          const page = await request(hostApp).get('/api/bff/docs');

          expect(document.status).toBe(200);
          expect(document.body.servers).toEqual([{ url: '/api/bff' }]);
          expect(page.status).toBe(200);
          expect(page.text).toContain('/api/bff/agent/openapi.json');
          expect(page.text).toContain('/api/bff/docs/redoc.standalone.js');
        } finally {
          await hosted.stop();
        }
      },
      BOOT_TIMEOUT_MS,
    );
  });

  describe('the agent routes next to it', () => {
    it('should keep answering on their own prefix', async () => {
      const response = await request(app).get('/forest');

      expect(response.status).toBe(200);
    });

    it('should not claim a url that merely starts with the same letters', async () => {
      const response = await request(app).get('/bffalo');

      expect(response.status).toBe(404);
    });
  });

  describe('once the agent is stopped', () => {
    it(
      'should stop answering rather than dispatch into a dead stack',
      async () => {
        const stoppedAgent = new Agent(agentOptions('stop'))
          .addDataSource(async () => new SearchDataSource())
          .addBff({});

        const stoppedApp = express();
        stoppedAgent.mountOnExpress(stoppedApp);
        await stoppedAgent.start();
        await stoppedAgent.stop();

        const response = await request(stoppedApp).get('/bff/health');

        expect(response.status).toBe(503);
        expect(response.body.error).toMatchObject({ type: 'bff_stopped' });
      },
      BOOT_TIMEOUT_MS,
    );
  });

  describe('the host registration order', () => {
    async function startAgentOn(hostApp: express.Express, mountFirst: boolean) {
      const orderAgent = new Agent({
        authSecret: AUTH_SECRET,
        envSecret: ENV_SECRET,
        forestServerUrl: 'https://api.forestadmin.com',
        forestAppUrl: 'https://hostApp.forestadmin.com',
        isProduction: false,
        schemaPath: path.join(tmpdir(), `.forestadmin-schema-bff-order-${Date.now()}.json`),
        logger: () => undefined,
      })
        .addDataSource(async () => new SearchDataSource())
        .addBff({});

      if (mountFirst) orderAgent.mountOnExpress(hostApp);
      hostApp.use(express.json());
      if (!mountFirst) orderAgent.mountOnExpress(hostApp);

      await orderAgent.start();

      return orderAgent;
    }

    function listBooks(hostApp: express.Express) {
      return supertest(hostApp)
        .post('/bff/agent/v1/books/list')
        .set('Authorization', `Bearer ${sessionToken()}`)
        .set('X-Forest-Timezone', 'Europe/Paris')
        .send({ projection: ['id', 'title'], search: 'foundation' });
    }

    it(
      'should serve normally when the agent is mounted before the host body parser',
      async () => {
        const hostApp = express();
        const orderAgent = await startAgentOn(hostApp, true);

        try {
          const response = await listBooks(hostApp);

          expect(response.status).toBe(200);
          expect(response.body.data).toHaveLength(1);
        } finally {
          await orderAgent.stop();
        }
      },
      BOOT_TIMEOUT_MS,
    );

    // Pinned rather than fixed: a body parser that ran first has already consumed the stream, and
    // nothing downstream can put it back. Failing loudly beats serving a request whose filters,
    // projection and search silently went missing.
    it(
      'should fail loudly when a host body parser consumed the stream first',
      async () => {
        const hostApp = express();
        const orderAgent = await startAgentOn(hostApp, false);

        try {
          const response = await listBooks(hostApp);

          expect(response.status).toBe(500);
          expect(response.body.error).toMatchObject({ type: 'stream.not.readable' });
        } finally {
          await orderAgent.stop();
        }
      },
      BOOT_TIMEOUT_MS,
    );
  });
});
