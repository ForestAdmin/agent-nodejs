import type { WorkflowExecutor } from '../src/build-workflow-executor';
import type { CliFactories } from '../src/cli-core';

import ConsoleLogger from '../src/adapters/console-logger';
import PrettyLogger from '../src/adapters/pretty-logger';
import {
  logStartup,
  parseArgs,
  pickLogger,
  printHelp,
  printVersion,
  readEnvConfig,
  runCli,
} from '../src/cli-core';
import {
  DEFAULT_FOREST_SERVER_URL,
  DEFAULT_HTTP_PORT,
  DEFAULT_MAX_CHAIN_DEPTH,
  DEFAULT_POLLING_INTERVAL_S,
  DEFAULT_SCHEMA_CACHE_TTL_S,
  DEFAULT_STEP_TIMEOUT_S,
  DEFAULT_STOP_TIMEOUT_S,
} from '../src/defaults';

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

const fakeStream = (isTTY: boolean) => ({ isTTY } as unknown as NodeJS.WriteStream);

describe('parseArgs', () => {
  it('returns all false for empty argv', () => {
    expect(parseArgs([])).toEqual({
      help: false,
      version: false,
      inMemory: false,
      pretty: false,
      json: false,
    });
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

  it('parses --pretty', () => {
    expect(parseArgs(['--pretty']).pretty).toBe(true);
  });

  it('parses --json', () => {
    expect(parseArgs(['--json']).json).toBe(true);
  });

  it('throws on unknown argument', () => {
    expect(() => parseArgs(['--nope'])).toThrow('Unknown argument: --nope');
  });
});

describe('pickLogger', () => {
  const baseArgs = { help: false, version: false, inMemory: false, pretty: false, json: false };

  it('returns PrettyLogger when stdout is a TTY', () => {
    expect(pickLogger(baseArgs, fakeStream(true))).toBeInstanceOf(PrettyLogger);
  });

  it('returns ConsoleLogger when stdout is not a TTY', () => {
    expect(pickLogger(baseArgs, fakeStream(false))).toBeInstanceOf(ConsoleLogger);
  });

  it('forces PrettyLogger with --pretty even when stdout is not a TTY', () => {
    expect(pickLogger({ ...baseArgs, pretty: true }, fakeStream(false))).toBeInstanceOf(
      PrettyLogger,
    );
  });

  it('forces ConsoleLogger with --json even when stdout is a TTY', () => {
    expect(pickLogger({ ...baseArgs, json: true }, fakeStream(true))).toBeInstanceOf(ConsoleLogger);
  });

  it('gives --json precedence when both flags are set', () => {
    expect(pickLogger({ ...baseArgs, pretty: true, json: true }, fakeStream(true))).toBeInstanceOf(
      ConsoleLogger,
    );
  });
});

describe('readEnvConfig', () => {
  const args = { help: false, version: false, inMemory: false, pretty: false, json: false };

  it('returns a full config when all required vars are present', () => {
    const config = readEnvConfig(baseEnv, args);

    expect(config.mode).toBe('database');
    expect(config.databaseUrl).toBe('postgres://u:p@localhost:5432/wfe');
    expect(config.executorOptions).toEqual(
      expect.objectContaining({
        envSecret: 'env-secret',
        authSecret: 'auth-secret',
        agentUrl: 'http://localhost:3351',
        httpPort: DEFAULT_HTTP_PORT,
      }),
    );
  });

  it('parses numeric env vars as numbers', () => {
    const config = readEnvConfig(
      {
        ...baseEnv,
        HTTP_PORT: '5000',
        POLLING_INTERVAL_S: '1000',
        STOP_TIMEOUT_S: '10000',
        STEP_TIMEOUT_S: '60000',
        MAX_CHAIN_DEPTH: '10',
        SCHEMA_CACHE_TTL_S: '120000',
      },
      args,
    );

    expect(config.executorOptions.httpPort).toBe(5000);
    expect(config.executorOptions.pollingIntervalS).toBe(1000);
    expect(config.executorOptions.stopTimeoutS).toBe(10000);
    expect(config.executorOptions.stepTimeoutS).toBe(60000);
    expect(config.executorOptions.maxChainDepth).toBe(10);
    expect(config.executorOptions.schemaCacheTtlS).toBe(120000);
  });

  it('leaves schemaCacheTtlS undefined when SCHEMA_CACHE_TTL_S is unset (default applied downstream in build)', () => {
    const config = readEnvConfig(baseEnv, args);

    expect(config.executorOptions.schemaCacheTtlS).toBeUndefined();
  });

  it('throws ConfigurationError when SCHEMA_CACHE_TTL_S is non-numeric', () => {
    expect(() => readEnvConfig({ ...baseEnv, SCHEMA_CACHE_TTL_S: 'abc' }, args)).toThrow(
      /SCHEMA_CACHE_TTL_S must be a positive integer/,
    );
  });

  it('leaves stepTimeoutS undefined when STEP_TIMEOUT_S is unset (default applied downstream in build)', () => {
    const config = readEnvConfig(baseEnv, args);

    expect(config.executorOptions.stepTimeoutS).toBeUndefined();
  });

  it('leaves maxChainDepth undefined when MAX_CHAIN_DEPTH is unset (default applied downstream in build)', () => {
    const config = readEnvConfig(baseEnv, args);

    expect(config.executorOptions.maxChainDepth).toBeUndefined();
  });

  it.each(['abc', '30s', '1_000', 'NaN'])(
    'throws ConfigurationError when STEP_TIMEOUT_S is non-numeric (%s)',
    value => {
      expect(() => readEnvConfig({ ...baseEnv, STEP_TIMEOUT_S: value }, args)).toThrow(
        /STEP_TIMEOUT_S must be a positive integer/,
      );
    },
  );

  it('throws ConfigurationError when STEP_TIMEOUT_S is 0', () => {
    expect(() => readEnvConfig({ ...baseEnv, STEP_TIMEOUT_S: '0' }, args)).toThrow(
      /STEP_TIMEOUT_S must be a positive integer/,
    );
  });

  it('throws ConfigurationError when STEP_TIMEOUT_S is negative', () => {
    expect(() => readEnvConfig({ ...baseEnv, STEP_TIMEOUT_S: '-100' }, args)).toThrow(
      /STEP_TIMEOUT_S must be a positive integer/,
    );
  });

  it('throws ConfigurationError when STEP_TIMEOUT_S is a float', () => {
    expect(() => readEnvConfig({ ...baseEnv, STEP_TIMEOUT_S: '1.5' }, args)).toThrow(
      /STEP_TIMEOUT_S must be a positive integer/,
    );
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

  it('sets forceAiError when FORCE_AI_ERROR=true', () => {
    const config = readEnvConfig({ ...baseEnv, FORCE_AI_ERROR: 'true' }, args);

    expect(config.executorOptions.forceAiError).toBe(true);
  });

  it('omits forceAiError when FORCE_AI_ERROR is not set', () => {
    const config = readEnvConfig(baseEnv, args);

    expect(config.executorOptions.forceAiError).toBeUndefined();
  });

  it('omits forceAiError when FORCE_AI_ERROR=false', () => {
    const config = readEnvConfig({ ...baseEnv, FORCE_AI_ERROR: 'false' }, args);

    expect(config.executorOptions.forceAiError).toBeUndefined();
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
    expect(output).toContain('--pretty');
    expect(output).toContain('--json');
    expect(output).toContain('FOREST_ENV_SECRET');
    expect(output).toContain('NO_COLOR');
    expect(output).toContain('SIGTERM');
  });

  it('printHelp prints every default value from defaults.ts', () => {
    printHelp();
    const output = logSpy.mock.calls.map(call => call[0]).join('\n');

    expect(output).toContain(`Default: ${DEFAULT_HTTP_PORT}`);
    expect(output).toContain(`Default: ${DEFAULT_FOREST_SERVER_URL}`);
    expect(output).toContain(`Default: ${DEFAULT_POLLING_INTERVAL_S}`);
    expect(output).toContain(`Default: ${DEFAULT_STOP_TIMEOUT_S}`);
    expect(output).toContain(`default: ${DEFAULT_STEP_TIMEOUT_S}`);
    expect(output).toContain(`default: ${DEFAULT_MAX_CHAIN_DEPTH}`);
    expect(output).toContain(`default: ${DEFAULT_SCHEMA_CACHE_TTL_S}`);
  });

  it('printVersion prints a version string', () => {
    printVersion();

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('logStartup', () => {
  function makeLogger() {
    return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  }

  it('logs resolved defaults when env-derived options are undefined', () => {
    const logger = makeLogger();

    logStartup(logger as never, {
      mode: 'database',
      executorOptions: {
        envSecret: 'e',
        authSecret: 'a',
        agentUrl: 'http://agent',
        httpPort: DEFAULT_HTTP_PORT,
      },
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Workflow executor starting',
      expect.objectContaining({
        forestServerUrl: DEFAULT_FOREST_SERVER_URL,
        pollingIntervalS: DEFAULT_POLLING_INTERVAL_S,
      }),
    );
  });
});

describe('runCli', () => {
  let infoSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
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

  it('injects the picked logger into executorOptions', async () => {
    const { factories } = makeFactories();
    await runCli(['--json'], baseEnv, factories);

    const call = (factories.buildDatabase as jest.Mock).mock.calls[0][0];
    expect(call.logger).toBeInstanceOf(ConsoleLogger);
  });

  it('injects a PrettyLogger when --pretty is set', async () => {
    const { factories } = makeFactories();
    await runCli(['--pretty'], baseEnv, factories);

    const call = (factories.buildDatabase as jest.Mock).mock.calls[0][0];
    expect(call.logger).toBeInstanceOf(PrettyLogger);
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
    const output = [...logSpy.mock.calls, ...infoSpy.mock.calls, ...errorSpy.mock.calls]
      .map(call => call.join(' '))
      .join('\n');

    expect(output).not.toContain('env-secret');
    expect(output).not.toContain('auth-secret');
  });

  it('emits a startup info log via the injected logger', async () => {
    const { factories } = makeFactories();
    await runCli(['--json'], baseEnv, factories);

    const output = infoSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(output).toContain('Workflow executor starting');
    expect(output).toContain('Workflow executor ready');
  });

  it('logs aiConfig as "forced-error (dev only)" when FORCE_AI_ERROR=true', async () => {
    const { factories } = makeFactories();
    await runCli(['--json'], { ...baseEnv, FORCE_AI_ERROR: 'true' }, factories);

    const output = infoSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(output).toContain('forced-error (dev only)');
  });

  it('logs aiConfig with provider/model when aiConfigurations are set', async () => {
    const { factories } = makeFactories();
    await runCli(
      ['--json'],
      { ...baseEnv, AI_PROVIDER: 'openai', AI_MODEL: 'gpt-4o', AI_API_KEY: 'sk-x' },
      factories,
    );

    const output = infoSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(output).toContain('local (openai / gpt-4o)');
  });

  it('logs a structured error when executor.start() fails and rethrows', async () => {
    const failingExecutor = {
      start: jest.fn().mockRejectedValue(new Error('db unreachable')),
      stop: jest.fn(),
      state: 'idle',
    } as unknown as WorkflowExecutor;
    const factories: CliFactories = {
      buildDatabase: jest.fn().mockReturnValue(failingExecutor),
      buildInMemory: jest.fn().mockReturnValue(failingExecutor),
    };

    await expect(runCli(['--json'], baseEnv, factories)).rejects.toThrow('db unreachable');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('Workflow executor failed to start');
    expect(errorOutput).toContain('db unreachable');
  });
});
