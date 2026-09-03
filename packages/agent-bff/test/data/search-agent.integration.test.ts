import type { TestableAgent } from '@forestadmin/agent-testing';
import type Koa from 'koa';

import { createTestableAgent } from '@forestadmin/agent-testing';
import os from 'os';
import path from 'path';
import request from 'supertest';

import {
  AUTH_SECRET,
  BOOT_TIMEOUT_MS,
  ENV_SECRET,
  RESERVED_SCHEMA_PREFIX,
  buildApp,
  findFreePort,
} from './fixtures/live-agent-harness';
import SearchDataSource from './fixtures/search-datasource';

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
