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
import RecordContractDataSource from './fixtures/record-contract-datasource';

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
