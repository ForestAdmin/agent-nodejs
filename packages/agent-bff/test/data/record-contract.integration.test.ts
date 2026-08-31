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

import RecordContractDataSource from './fixtures/record-contract-datasource';
import createDataRoutesMiddleware from '../../src/data/data-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import CapabilitiesCache from '../../src/read-model/capabilities-cache';
import ReadModelStore from '../../src/read-model/read-model-store';
import SchemaCache from '../../src/read-model/schema-cache';

const TIMEZONE = 'Europe/Paris';
const AUTH_SECRET = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
const ENV_SECRET = '0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e';
const BOOT_TIMEOUT_MS = 60_000;
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

function buildApp(agentUrl: string, schemaPath: string): Koa {
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
  app.use(createDataRoutesMiddleware({ store, agentUrl, logger: noopLogger }));

  return app;
}

describe('the record contract against a real agent', () => {
  let agent: TestableAgent;
  let app: Koa;

  beforeAll(async () => {
    const port = await findFreePort();
    const schemaPath = path.join(
      os.tmpdir(),
      `${RESERVED_SCHEMA_PREFIX}-bff-record-contract-${port}.json`,
    );

    agent = await createTestableAgent(
      forestAgent => {
        forestAgent.addDataSource(async () => new RecordContractDataSource());
      },
      { authSecret: AUTH_SECRET, envSecret: ENV_SECRET, isProduction: false, port, schemaPath },
    );

    await agent.start();

    app = buildApp(`http://localhost:${port}`, schemaPath);
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await agent?.stop();
  });

  it('should carry the flat id as a string while __forest.primaryKey holds it typed', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/people/list')
      .send({ projection: ['id'] });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        id: '8',
        __forest: { collection: 'people', primaryKey: { id: 8 } },
      },
    ]);
  });

  it('should return a snake_case column under its camelCase key, while projecting its schema name', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/people/list')
      .send({ projection: ['id', 'first_name'] });

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
