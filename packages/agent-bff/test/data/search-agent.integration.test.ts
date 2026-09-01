import type { Logger } from '../../src/ports/logger-port';
import type { SchemaFetcher } from '../../src/read-model/forest-schema-client';
import type { TestableAgent } from '@forestadmin/agent-testing';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import { createTestableAgent } from '@forestadmin/agent-testing';
import { bodyParser } from '@koa/bodyparser';
import fs from 'fs/promises';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import net from 'net';
import os from 'os';
import path from 'path';
import request from 'supertest';

import SearchDataSource from './fixtures/search-datasource';
import { createHttpTransport } from '../../src/agent/agent-transport';
import createDataRoutesMiddleware from '../../src/data/data-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import CapabilitiesCache from '../../src/read-model/capabilities-cache';
import ReadModelStore from '../../src/read-model/read-model-store';
import SchemaCache from '../../src/read-model/schema-cache';

const TIMEZONE = 'Europe/Paris';
const AUTH_SECRET = 'b0bdf0a639c16bae8851dd24ee3d79ef0a352e957c5b86cb';
const ENV_SECRET = 'ceba742f5bc73946b34da192816a4d7177b3233fee7769955c29c0e90fd584f2';
const BOOT_TIMEOUT_MS = 60_000;

// agent-testing only deletes a schema file whose name carries this prefix, so reusing it keeps the
// temporary schema cleaned up by `agent.stop()` even though the path is chosen here.
const RESERVED_SCHEMA_PREFIX = 'reserved-forestadmin-schema-test-';

const noopLogger: Logger = () => {};

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;

      server.close(() => resolve(port));
    });
  });
}

function agentToken(): string {
  return jsonwebtoken.sign(
    { id: 1, email: 'forest@forest.com', renderingId: 1, team: 'admin' },
    AUTH_SECRET,
    { expiresIn: '1 hour' },
  );
}

function schemaFetcherFromFile(schemaPath: string): SchemaFetcher {
  return {
    fetchSchema: async () => {
      const { collections } = JSON.parse(await fs.readFile(schemaPath, 'utf8')) as {
        collections: ForestSchemaCollection[];
      };

      return collections;
    },
  };
}

/**
 * The BFF in front of a real agent: the middleware production mounts, the real data client, and a
 * read-model built from the schema the agent just wrote. Only the schema transport is swapped —
 * production fetches it from the Forest server, which plays no part in search.
 */
function buildApp(agentUrl: string, schemaPath: string): Koa {
  const transport = createHttpTransport({ agentUrl });
  const token = agentToken();
  const schemaCache = new SchemaCache({
    fetcher: schemaFetcherFromFile(schemaPath),
    metrics: { increment: () => {}, gauge: () => {} },
  });
  const store = new ReadModelStore(schemaCache, new CapabilitiesCache());
  const app = new Koa();

  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = TIMEZONE;
    ctx.state.agentToken = token;
    await next();
  });
  app.use(createDataRoutesMiddleware({ store, transport, logger: noopLogger }));

  return app;
}

describe('search against a real agent', () => {
  let agent: TestableAgent;
  let app: Koa;

  beforeAll(async () => {
    const port = await findFreePort();
    const schemaPath = path.join(os.tmpdir(), `${RESERVED_SCHEMA_PREFIX}-bff-search-${port}.json`);

    agent = await createTestableAgent(
      forestAgent => {
        forestAgent.addDataSource(async () => new SearchDataSource());
        forestAgent.customizeCollection('books', collection =>
          collection.addManyToOneRelation('author', 'authors', { foreignKey: 'authorId' }),
        );
        forestAgent.customizeCollection('ledgers', collection => collection.disableSearch());
      },
      { authSecret: AUTH_SECRET, envSecret: ENV_SECRET, isProduction: false, port, schemaPath },
    );

    await agent.start();

    app = buildApp(`http://localhost:${port}`, schemaPath);
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await agent?.stop();
  });

  function titlesOf(body: { data: Array<{ title: string }> }): string[] {
    return body.data.map(record => record.title).sort();
  }

  describe('list', () => {
    it('should return only the records the search matches', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/books/list')
        .send({ projection: ['id', 'title'], search: 'foundation' });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation']);
    });

    it('should return every record when no search is sent', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/books/list')
        .send({ projection: ['id', 'title'] });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot', 'The Dispossessed']);
    });

    it('should not match a related record without searchExtended', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/books/list')
        .send({ projection: ['id', 'title'], search: 'asimov' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should match through a relation when searchExtended is true', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/books/list')
        .send({ projection: ['id', 'title'], search: 'asimov', searchExtended: true });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot']);
    });

    // Accepted behaviour, pinned here so it cannot change unnoticed: the search value is a query,
    // and `relation.column:value` crosses a relation with no `searchExtended`. The same path in a
    // filter draws 422 relation_field_not_supported, so this is the one way a request reaches a
    // relation column through the top-level routes.
    it('should cross a relation through the query syntax without searchExtended', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/books/list')
        .send({ projection: ['id', 'title'], search: 'author.name:asimov' });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot']);
    });

    it('should reject the same relation path in a filter, unlike in a search', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/books/list')
        .send({
          projection: ['id', 'title'],
          filter: { field: 'author:name', operator: 'IContains', value: 'asimov' },
        });

      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({ type: 'relation_field_not_supported' });
    });

    it('should intersect the search with the filter rather than replace it', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/books/list')
        .send({
          projection: ['id', 'title'],
          search: 'asimov',
          searchExtended: true,
          filter: { field: 'title', operator: 'IContains', value: 'robot' },
        });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['I, Robot']);
    });

    it('should list everything when the search holds only whitespace', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/books/list')
        .send({ projection: ['id', 'title'], search: '   ' });

      expect(response.status).toBe(200);
      expect(titlesOf(response.body)).toEqual(['Foundation', 'I, Robot', 'The Dispossessed']);
    });
  });

  describe('count', () => {
    it('should count the searched rows, not the whole collection', async () => {
      const searched = await request(app.callback())
        .post('/agent/v1/books/count')
        .send({ search: 'foundation' });
      const all = await request(app.callback()).post('/agent/v1/books/count').send({});

      expect(all.body).toEqual({ count: 3, countStatus: 'available' });
      expect(searched.body).toEqual({ count: 1, countStatus: 'available' });
    });

    it('should count the rows a relation-extended search returns', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/books/count')
        .send({ search: 'asimov', searchExtended: true });

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

    it('should reject a list search rather than return an unfiltered listing', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/ledgers/list')
        .send({ projection: ['id', 'label'], search: 'foundation' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        type: 'validation_error',
        status: 400,
        message: 'Collection is not searchable',
      });
    });

    it('should reject a count search the same way list does', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/ledgers/count')
        .send({ search: 'foundation' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        type: 'validation_error',
        status: 400,
        message: 'Collection is not searchable',
      });
    });

    it('should still serve it when no search is sent', async () => {
      const response = await request(app.callback())
        .post('/agent/v1/ledgers/list')
        .send({ projection: ['id', 'label'] });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });
});
