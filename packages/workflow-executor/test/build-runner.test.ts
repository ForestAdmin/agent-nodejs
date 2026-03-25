import AgentClientAgentPort from '../src/adapters/agent-client-agent-port';
import ForestServerWorkflowPort from '../src/adapters/forest-server-workflow-port';
import { buildRunnerInDatabase, buildRunnerInMemory } from '../src/build-runner';
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

describe('buildRunnerInMemory', () => {
  it('returns a Runner instance', () => {
    const runner = buildRunnerInMemory(BASE_OPTIONS);

    expect(runner).toBeInstanceOf(Runner);
  });

  it('creates an InMemoryStore as runStore', () => {
    buildRunnerInMemory(BASE_OPTIONS);

    expect(InMemoryStore).toHaveBeenCalledTimes(1);
    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ runStore: expect.any(InMemoryStore) }),
    );
  });

  it('creates ForestServerWorkflowPort with default forestServerUrl', () => {
    buildRunnerInMemory(BASE_OPTIONS);

    expect(ForestServerWorkflowPort).toHaveBeenCalledWith({
      envSecret: BASE_OPTIONS.envSecret,
      forestServerUrl: 'https://api.forestadmin.com',
    });
  });

  it('creates ForestServerWorkflowPort with custom forestServerUrl', () => {
    buildRunnerInMemory({ ...BASE_OPTIONS, forestServerUrl: 'https://custom.example.com' });

    expect(ForestServerWorkflowPort).toHaveBeenCalledWith({
      envSecret: BASE_OPTIONS.envSecret,
      forestServerUrl: 'https://custom.example.com',
    });
  });

  it('creates AgentClientAgentPort with empty collectionSchemas', () => {
    buildRunnerInMemory(BASE_OPTIONS);

    expect(AgentClientAgentPort).toHaveBeenCalledWith({
      client: expect.anything(),
      collectionSchemas: {},
    });
  });

  it('passes pollingIntervalMs with default value of 5000', () => {
    buildRunnerInMemory(BASE_OPTIONS);

    expect(MockedRunner).toHaveBeenCalledWith(expect.objectContaining({ pollingIntervalMs: 5000 }));
  });

  it('passes custom pollingIntervalMs', () => {
    buildRunnerInMemory({ ...BASE_OPTIONS, pollingIntervalMs: 1000 });

    expect(MockedRunner).toHaveBeenCalledWith(expect.objectContaining({ pollingIntervalMs: 1000 }));
  });

  it('passes secrets to Runner config', () => {
    buildRunnerInMemory(BASE_OPTIONS);

    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: BASE_OPTIONS.envSecret,
        authSecret: BASE_OPTIONS.authSecret,
      }),
    );
  });

  it('passes optional httpPort', () => {
    buildRunnerInMemory({ ...BASE_OPTIONS, httpPort: 3000 });

    expect(MockedRunner).toHaveBeenCalledWith(expect.objectContaining({ httpPort: 3000 }));
  });
});

describe('buildRunnerInDatabase', () => {
  const DB_OPTIONS = {
    ...BASE_OPTIONS,
    database: { uri: 'postgres://localhost/mydb', dialect: 'postgres' },
  };

  it('returns a Runner instance', () => {
    const runner = buildRunnerInDatabase(DB_OPTIONS);

    expect(runner).toBeInstanceOf(Runner);
  });

  it('creates a DatabaseStore as runStore', () => {
    buildRunnerInDatabase(DB_OPTIONS);

    expect(DatabaseStore).toHaveBeenCalledTimes(1);
    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ runStore: expect.any(DatabaseStore) }),
    );
  });

  it('creates Sequelize with uri, dialect, and logging disabled by default', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { Sequelize } = require('sequelize');

    buildRunnerInDatabase(DB_OPTIONS);

    expect(Sequelize).toHaveBeenCalledWith('postgres://localhost/mydb', {
      dialect: 'postgres',
      logging: false,
    });
  });

  it('enables Sequelize logging when database.logging is true', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { Sequelize } = require('sequelize');

    buildRunnerInDatabase({
      ...BASE_OPTIONS,
      database: { uri: 'postgres://localhost/mydb', dialect: 'postgres', logging: true },
    });

    expect(Sequelize).toHaveBeenCalledWith('postgres://localhost/mydb', {
      dialect: 'postgres',
      // eslint-disable-next-line no-console
      logging: console.log,
    });
  });

  it('shares the same common dependencies as buildRunnerInMemory', () => {
    buildRunnerInDatabase(DB_OPTIONS);

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
