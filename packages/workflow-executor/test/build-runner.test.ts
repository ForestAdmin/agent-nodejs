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
  createRemoteAgentClient: jest.fn().mockReturnValue({}),
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
  it('returns an object with start and stop methods', () => {
    const executor = buildInMemoryExecutor(BASE_OPTIONS);

    expect(executor.start).toBeDefined();
    expect(executor.stop).toBeDefined();
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

  it('creates AgentClientAgentPort with empty collectionSchemas', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(AgentClientAgentPort).toHaveBeenCalledWith({
      client: expect.anything(),
      collectionSchemas: {},
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
  const DB_OPTIONS = {
    ...BASE_OPTIONS,
    database: { uri: 'postgres://localhost/mydb', dialect: 'postgres' },
  };

  it('returns an object with start and stop methods', () => {
    const executor = buildDatabaseExecutor(DB_OPTIONS);

    expect(executor.start).toBeDefined();
    expect(executor.stop).toBeDefined();
  });

  it('creates a DatabaseStore as runStore', () => {
    buildDatabaseExecutor(DB_OPTIONS);

    expect(DatabaseStore).toHaveBeenCalledTimes(1);
    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ runStore: expect.any(DatabaseStore) }),
    );
  });

  it('creates Sequelize with uri, dialect, and logging disabled by default', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { Sequelize } = require('sequelize');

    buildDatabaseExecutor(DB_OPTIONS);

    expect(Sequelize).toHaveBeenCalledWith('postgres://localhost/mydb', {
      dialect: 'postgres',
      logging: false,
    });
  });

  it('enables Sequelize logging when database.logging is true', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { Sequelize } = require('sequelize');

    buildDatabaseExecutor({
      ...BASE_OPTIONS,
      database: { uri: 'postgres://localhost/mydb', dialect: 'postgres', logging: true },
    });

    expect(Sequelize).toHaveBeenCalledWith('postgres://localhost/mydb', {
      dialect: 'postgres',
      // eslint-disable-next-line no-console
      logging: console.log,
    });
  });

  it('shares the same common dependencies as buildInMemoryExecutor', () => {
    buildDatabaseExecutor(DB_OPTIONS);

    expect(ForestServerWorkflowPort).toHaveBeenCalledWith({
      envSecret: BASE_OPTIONS.envSecret,
      forestServerUrl: 'https://api.forestadmin.com',
    });
    expect(AgentClientAgentPort).toHaveBeenCalledWith({
      client: expect.anything(),
      collectionSchemas: {},
    });
  });
});
