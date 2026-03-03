import type { AgentTestClient, ForestServerSandbox } from '../src';
import type { Agent } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { SchemaPathManager, createAgentTestClient, createForestServerSandbox } from '../src';

const ENV_SECRET = 'ceba742f5bc73946b34da192816a4d7177b3233fee7769955c29c0e90fd584f2';
const AUTH_SECRET = 'a-random-auth-secret-for-testing';
const STORAGE = '/tmp/database-test-sandbox-real-agent.db';

describe('createForestServerSandbox with a real agent', () => {
  let sandbox: ForestServerSandbox;
  let agent: Agent;
  let client: AgentTestClient;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  let schemaPath: string;

  beforeAll(async () => {
    // 1. Create database
    sequelize = await buildSequelizeInstance({ dialect: 'sqlite', storage: STORAGE }, () => {});
    sequelize.define(
      'users',
      {
        firstName: { type: DataTypes.STRING },
        lastName: { type: DataTypes.STRING },
      },
      { tableName: 'users' },
    );
    await sequelize.sync({ force: true });

    // 2. Start the mock Forest Admin server (port 0 = random available port)
    sandbox = await createForestServerSandbox(0);
    const serverUrl = `http://127.0.0.1:${sandbox.port}`;

    // 3. Start a REAL agent pointing at the mock server
    schemaPath = SchemaPathManager.generateTemporarySchemaPath();
    agent = createAgent({
      envSecret: ENV_SECRET,
      authSecret: AUTH_SECRET,
      forestServerUrl: serverUrl,
      schemaPath,
      isProduction: false,
      loggerLevel: 'Error',
    });

    agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage: STORAGE }));

    agent.customizeCollection('users', collection => {
      collection.addField('fullName', {
        columnType: 'String',
        dependencies: ['firstName', 'lastName'],
        getValues: records => records.map(r => `${r.firstName} ${r.lastName}`),
      });
    });

    agent.mountOnStandaloneServer(0, '127.0.0.1');
    await agent.start();

    // 4. Create the test client
    client = await createAgentTestClient({
      agentForestEnvSecret: ENV_SECRET,
      agentForestAuthSecret: AUTH_SECRET,
      agentUrl: `http://127.0.0.1:${agent.standaloneServerPort}`,
      serverUrl,
      agentSchemaPath: schemaPath,
    });
  }, 30_000);

  afterAll(async () => {
    await agent?.stop();
    await sandbox?.stop();
    await sequelize?.close();
    await SchemaPathManager.removeTemporarySchemaPath(schemaPath);
  });

  it('should list records', async () => {
    await sequelize.models.users.create({ firstName: 'John', lastName: 'Doe' });

    const users = await client.collection('users').list<{ firstName: string }>();
    expect(users).toEqual(expect.arrayContaining([expect.objectContaining({ firstName: 'John' })]));
  });

  it('should return computed fields', async () => {
    const [user] = await client.collection('users').list<{ fullName: string }>({
      filters: { field: 'firstName', operator: 'Equal', value: 'John' },
    });

    expect(user.fullName).toBe('John Doe');
  });

  it('should create a record', async () => {
    await client.collection('users').create({ firstName: 'Jane', lastName: 'Smith' });

    const users = await client.collection('users').list<{ firstName: string }>({
      filters: { field: 'firstName', operator: 'Equal', value: 'Jane' },
    });

    expect(users).toHaveLength(1);
    expect(users[0].firstName).toBe('Jane');
  });

  it('should count records', async () => {
    const count = await client.collection('users').count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
