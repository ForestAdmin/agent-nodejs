import AgentClientAgentPort from '../src/adapters/agent-client-agent-port';
import ForestServerWorkflowPort from '../src/adapters/forest-server-workflow-port';
import { buildDatabaseExecutor, buildInMemoryExecutor } from '../src/build-runner';
import Runner from '../src/runner';
import DatabaseStore from '../src/stores/database-store';
import InMemoryStore from '../src/stores/in-memory-store';

jest.mock('../src/runner');
jest.mock('../src/stores/in-memory-store');
jest.mock('../src/stores/database-store');
jest.mock('../src/adapters/agent-client-agent-port');
jest.mock('../src/adapters/forest-server-workflow-port');
jest.mock('@forestadmin/ai-proxy', () => ({
  AiClient: jest.fn(),
}));
jest.mock('@forestadmin/agent-client', () => ({
  createRemoteAgentClient: jest.fn().mockReturnValue({ fake: 'client' }),
}));
jest.mock('sequelize', () => ({
  Sequelize: jest.fn(),
}));

const MockedRunner = Runner as jest.MockedClass<typeof Runner>;

const BASE_OPTIONS = {
  envSecret: 'a'.repeat(64),
  authSecret: 'test-secret',
  agentUrl: 'http://localhost:3310',
  aiConfigurations: [
    { name: 'default', provider: 'openai' as const, model: 'gpt-4o', apiKey: 'sk-test' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildInMemoryExecutor', () => {
  it('returns a WorkflowExecutor backed by a Runner', () => {
    const executor = buildInMemoryExecutor(BASE_OPTIONS);

    expect(executor).toBeInstanceOf(Runner);
  });

  it('creates an InMemoryStore as runStore', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(InMemoryStore).toHaveBeenCalledTimes(1);
    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ runStore: expect.any(InMemoryStore) }),
    );
  });

  it('creates ForestServerWorkflowPort with default forestServerUrl', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(ForestServerWorkflowPort).toHaveBeenCalledWith({
      envSecret: BASE_OPTIONS.envSecret,
      forestServerUrl: 'https://api.forestadmin.com',
    });
  });

  it('creates ForestServerWorkflowPort with custom forestServerUrl', () => {
    buildInMemoryExecutor({ ...BASE_OPTIONS, forestServerUrl: 'https://custom.example.com' });

    expect(ForestServerWorkflowPort).toHaveBeenCalledWith({
      envSecret: BASE_OPTIONS.envSecret,
      forestServerUrl: 'https://custom.example.com',
    });
  });

  it('creates remote agent client with the provided agentUrl', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { createRemoteAgentClient } = require('@forestadmin/agent-client');

    buildInMemoryExecutor(BASE_OPTIONS);

    expect(createRemoteAgentClient).toHaveBeenCalledWith({ url: 'http://localhost:3310' });
  });

  it('passes remote agent client to AgentClientAgentPort', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(AgentClientAgentPort).toHaveBeenCalledWith({
      client: { fake: 'client' },
      collectionSchemas: {},
    });
  });

  it('creates AiClient with the provided aiConfigurations', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { AiClient } = require('@forestadmin/ai-proxy');

    buildInMemoryExecutor(BASE_OPTIONS);

    expect(AiClient).toHaveBeenCalledWith({
      aiConfigurations: BASE_OPTIONS.aiConfigurations,
    });
  });

  it('passes pollingIntervalMs with default value of 5000', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(MockedRunner).toHaveBeenCalledWith(expect.objectContaining({ pollingIntervalMs: 5000 }));
  });

  it('passes custom pollingIntervalMs', () => {
    buildInMemoryExecutor({ ...BASE_OPTIONS, pollingIntervalMs: 1000 });

    expect(MockedRunner).toHaveBeenCalledWith(expect.objectContaining({ pollingIntervalMs: 1000 }));
  });

  it('passes secrets to Runner config', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: BASE_OPTIONS.envSecret,
        authSecret: BASE_OPTIONS.authSecret,
      }),
    );
  });

  it('passes optional httpPort', () => {
    buildInMemoryExecutor({ ...BASE_OPTIONS, httpPort: 3000 });

    expect(MockedRunner).toHaveBeenCalledWith(expect.objectContaining({ httpPort: 3000 }));
  });
});

describe('buildDatabaseExecutor', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { Sequelize: MockedSequelize } = require('sequelize');

  const DB_OPTIONS = {
    ...BASE_OPTIONS,
    database: { uri: 'postgres://localhost/mydb', dialect: 'postgres' as const },
  };

  it('returns a WorkflowExecutor backed by a Runner', () => {
    const executor = buildDatabaseExecutor(DB_OPTIONS);

    expect(executor).toBeInstanceOf(Runner);
  });

  it('creates a DatabaseStore as runStore', () => {
    buildDatabaseExecutor(DB_OPTIONS);

    expect(DatabaseStore).toHaveBeenCalledTimes(1);
    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ runStore: expect.any(DatabaseStore) }),
    );
  });

  it('creates Sequelize with uri and passes remaining options through', () => {
    buildDatabaseExecutor(DB_OPTIONS);

    expect(MockedSequelize).toHaveBeenCalledWith('postgres://localhost/mydb', {
      dialect: 'postgres',
    });
  });

  it('passes extra Sequelize options (logging, pool, ssl, etc.)', () => {
    buildDatabaseExecutor({
      ...BASE_OPTIONS,
      database: {
        uri: 'postgres://localhost/mydb',
        dialect: 'postgres',
        logging: false,
        pool: { max: 10, min: 2 },
      },
    });

    expect(MockedSequelize).toHaveBeenCalledWith('postgres://localhost/mydb', {
      dialect: 'postgres',
      logging: false,
      pool: { max: 10, min: 2 },
    });
  });

  it('creates Sequelize with options only when no uri is provided', () => {
    buildDatabaseExecutor({
      ...BASE_OPTIONS,
      database: { dialect: 'postgres', host: 'db.example.com', port: 5432, database: 'mydb' },
    });

    expect(MockedSequelize).toHaveBeenCalledWith({
      dialect: 'postgres',
      host: 'db.example.com',
      port: 5432,
      database: 'mydb',
    });
  });

  it('shares the same common dependencies as buildInMemoryExecutor', () => {
    buildDatabaseExecutor(DB_OPTIONS);

    expect(ForestServerWorkflowPort).toHaveBeenCalledWith({
      envSecret: BASE_OPTIONS.envSecret,
      forestServerUrl: 'https://api.forestadmin.com',
    });
    expect(AgentClientAgentPort).toHaveBeenCalledWith({
      client: { fake: 'client' },
      collectionSchemas: {},
    });
  });
});
