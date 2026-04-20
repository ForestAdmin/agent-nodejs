import type { WorkflowExecutor } from '../src/build-workflow-executor';
import type { CliFactories } from '../src/cli-core';

import { parseArgs, printHelp, printVersion, readEnvConfig, runCli } from '../src/cli-core';

const baseEnv: NodeJS.ProcessEnv = {
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_AUTH_SECRET: 'auth-secret',
  AGENT_URL: 'http://localhost:3351',
  DATABASE_URL: 'postgres://u:p@localhost:5432/wfe',
};

function makeFakeExecutor(): WorkflowExecutor {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    state: 'running',
  } as unknown as WorkflowExecutor;
}

function makeFactories() {
  const executor = makeFakeExecutor();
  const factories: CliFactories = {
    buildDatabase: jest.fn().mockReturnValue(executor),
    buildInMemory: jest.fn().mockReturnValue(executor),
  };

  return { factories, executor };
}

describe('parseArgs', () => {
  it('returns all false for empty argv', () => {
    expect(parseArgs([])).toEqual({ help: false, version: false, inMemory: false });
  });

  it('parses --help and -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('parses --version and -v', () => {
    expect(parseArgs(['--version']).version).toBe(true);
    expect(parseArgs(['-v']).version).toBe(true);
  });

  it('parses --in-memory', () => {
    expect(parseArgs(['--in-memory']).inMemory).toBe(true);
  });

  it('throws on unknown argument', () => {
    expect(() => parseArgs(['--nope'])).toThrow('Unknown argument: --nope');
  });
});

describe('readEnvConfig', () => {
  const args = { help: false, version: false, inMemory: false };

  it('returns a full config when all required vars are present', () => {
    const config = readEnvConfig(baseEnv, args);

    expect(config.mode).toBe('database');
    expect(config.databaseUrl).toBe('postgres://u:p@localhost:5432/wfe');
    expect(config.executorOptions).toEqual(
      expect.objectContaining({
        envSecret: 'env-secret',
        authSecret: 'auth-secret',
        agentUrl: 'http://localhost:3351',
        httpPort: 3400,
      }),
    );
  });

  it('parses numeric env vars as numbers', () => {
    const config = readEnvConfig(
      { ...baseEnv, HTTP_PORT: '5000', POLLING_INTERVAL_MS: '1000', STOP_TIMEOUT_MS: '10000' },
      args,
    );

    expect(config.executorOptions.httpPort).toBe(5000);
    expect(config.executorOptions.pollingIntervalMs).toBe(1000);
    expect(config.executorOptions.stopTimeoutMs).toBe(10000);
  });

  it('aggregates all missing required env vars in a single error', () => {
    expect(() => readEnvConfig({}, args)).toThrow(
      /FOREST_ENV_SECRET[\s\S]*FOREST_AUTH_SECRET[\s\S]*AGENT_URL[\s\S]*DATABASE_URL/,
    );
  });

  it('does not require DATABASE_URL in --in-memory mode', () => {
    const envWithoutDb = { ...baseEnv };
    delete envWithoutDb.DATABASE_URL;
    const config = readEnvConfig(envWithoutDb, { ...args, inMemory: true });

    expect(config.mode).toBe('in-memory');
    expect(config.databaseUrl).toBeUndefined();
  });

  it('still requires FOREST_ENV_SECRET etc. in --in-memory mode', () => {
    expect(() => readEnvConfig({}, { ...args, inMemory: true })).toThrow(/FOREST_ENV_SECRET/);
  });

  it('builds aiConfigurations when AI vars are set', () => {
    const config = readEnvConfig(
      { ...baseEnv, AI_PROVIDER: 'anthropic', AI_MODEL: 'claude', AI_API_KEY: 'sk-xxx' },
      args,
    );

    expect(config.executorOptions.aiConfigurations).toEqual([
      { name: 'default', provider: 'anthropic', model: 'claude', apiKey: 'sk-xxx' },
    ]);
  });

  it('omits aiConfigurations when no AI vars are set', () => {
    const config = readEnvConfig(baseEnv, args);

    expect(config.executorOptions.aiConfigurations).toBeUndefined();
  });

  it('throws when AI config is partially set', () => {
    expect(() =>
      readEnvConfig({ ...baseEnv, AI_PROVIDER: 'anthropic', AI_MODEL: 'claude' }, args),
    ).toThrow('AI config must be all-or-nothing');
  });

  it('throws on invalid AI_PROVIDER', () => {
    expect(() =>
      readEnvConfig({ ...baseEnv, AI_PROVIDER: 'bogus', AI_MODEL: 'm', AI_API_KEY: 'k' }, args),
    ).toThrow('AI_PROVIDER must be "anthropic" or "openai"');
  });
});

describe('printHelp / printVersion', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('printHelp prints usage with env vars and flags', () => {
    printHelp();
    const output = logSpy.mock.calls.map(call => call[0]).join('\n');

    expect(output).toContain('Usage: forest-workflow-executor');
    expect(output).toContain('--in-memory');
    expect(output).toContain('FOREST_ENV_SECRET');
    expect(output).toContain('SIGTERM');
  });

  it('printVersion prints a version string', () => {
    printVersion();

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('runCli', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('returns null and prints help on --help without building an executor', async () => {
    const { factories } = makeFactories();
    const result = await runCli(['--help'], baseEnv, factories);

    expect(result).toBeNull();
    expect(factories.buildDatabase).not.toHaveBeenCalled();
    expect(factories.buildInMemory).not.toHaveBeenCalled();
  });

  it('returns null and prints version on --version', async () => {
    const { factories } = makeFactories();
    const result = await runCli(['--version'], baseEnv, factories);

    expect(result).toBeNull();
    expect(factories.buildDatabase).not.toHaveBeenCalled();
  });

  it('throws before building the executor when env is invalid', async () => {
    const { factories } = makeFactories();

    await expect(runCli([], {}, factories)).rejects.toThrow(
      /Missing required environment variables/,
    );
    expect(factories.buildDatabase).not.toHaveBeenCalled();
    expect(factories.buildInMemory).not.toHaveBeenCalled();
  });

  it('builds a database executor in default mode and starts it', async () => {
    const { factories, executor } = makeFactories();
    await runCli([], baseEnv, factories);

    expect(factories.buildDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: 'env-secret',
        authSecret: 'auth-secret',
        agentUrl: 'http://localhost:3351',
        database: { uri: 'postgres://u:p@localhost:5432/wfe' },
      }),
    );
    expect(factories.buildInMemory).not.toHaveBeenCalled();
    expect(executor.start).toHaveBeenCalled();
  });

  it('builds an in-memory executor with --in-memory', async () => {
    const env = { ...baseEnv };
    delete env.DATABASE_URL;
    const { factories, executor } = makeFactories();
    await runCli(['--in-memory'], env, factories);

    expect(factories.buildInMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: 'env-secret',
        agentUrl: 'http://localhost:3351',
      }),
    );
    expect(factories.buildDatabase).not.toHaveBeenCalled();
    expect(executor.start).toHaveBeenCalled();
  });

  it('does not log any secret during startup', async () => {
    const { factories } = makeFactories();
    await runCli([], baseEnv, factories);
    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');

    expect(output).not.toContain('env-secret');
    expect(output).not.toContain('auth-secret');
  });
});
