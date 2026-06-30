import type { WorkflowExecutor } from '../src/build-workflow-executor';
import type { CliFactories } from '../src/cli-core';

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
import { ConfigurationError } from '../src/errors';

function isJsonLogger(out: string): boolean {
  try {
    JSON.parse(out);

    return true;
  } catch {
    return false;
  }
}

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
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => infoSpy.mockRestore());

  const sample = (logger: ReturnType<typeof pickLogger>): string => {
    logger('Info', 'sample', { k: 'v' });

    return infoSpy.mock.calls[0][0] as string;
  };

  it('returns a pretty (formatted) logger when stdout is a TTY', () => {
    const out = sample(pickLogger(baseArgs, 'Info', fakeStream(true)));
    expect(isJsonLogger(out)).toBe(false);
    expect(out).toContain('sample');
  });

  it('returns a JSON (console) logger when stdout is not a TTY', () => {
    const out = sample(pickLogger(baseArgs, 'Info', fakeStream(false)));
    expect(isJsonLogger(out)).toBe(true);
  });

  it('forces a pretty logger with --pretty even when stdout is not a TTY', () => {
    const out = sample(pickLogger({ ...baseArgs, pretty: true }, 'Info', fakeStream(false)));
    expect(isJsonLogger(out)).toBe(false);
  });

  it('forces a JSON logger with --json even when stdout is a TTY', () => {
    const out = sample(pickLogger({ ...baseArgs, json: true }, 'Info', fakeStream(true)));
    expect(isJsonLogger(out)).toBe(true);
  });

  it('gives --json precedence when both flags are set', () => {
    const out = sample(
      pickLogger({ ...baseArgs, pretty: true, json: true }, 'Info', fakeStream(true)),
    );
    expect(isJsonLogger(out)).toBe(true);
  });

  it('filters log calls below the requested level', () => {
    const logger = pickLogger({ ...baseArgs, json: true }, 'Warn', fakeStream(false));
    logger('Info', 'noisy');
    expect(infoSpy).not.toHaveBeenCalled();
  });
});

describe('readEnvConfig', () => {
  const args = { help: false, version: false, inMemory: false, pretty: false, json: false };

  it('returns a full config when all required vars are present', () => {
    const config = readEnvConfig(baseEnv, args);

    expect(config.mode).toBe('database');
    expect(config.databaseUrl).toBe('postgres://u:p@localhost:5432/wfe');
    // DATABASE_SSL defaults to true (managed Postgres requires TLS).
    expect(config.databaseSsl).toBe(true);
    expect(config.executorOptions).toEqual(
      expect.objectContaining({
        envSecret: 'env-secret',
        authSecret: 'auth-secret',
        agentUrl: 'http://localhost:3351',
        httpPort: DEFAULT_HTTP_PORT,
      }),
    );
  });

  it.each(['true', 'TRUE', 'True', '1', 'yes', 'on'])(
    'parses DATABASE_SSL=%s as enabled',
    value => {
      expect(readEnvConfig({ ...baseEnv, DATABASE_SSL: value }, args).databaseSsl).toBe(true);
    },
  );

  it.each(['false', '0', 'no', 'off'])('parses DATABASE_SSL=%s as disabled', value => {
    expect(readEnvConfig({ ...baseEnv, DATABASE_SSL: value }, args).databaseSsl).toBe(false);
  });

  it.each([undefined, ''])('defaults DATABASE_SSL to true when %p', value => {
    expect(readEnvConfig({ ...baseEnv, DATABASE_SSL: value }, args).databaseSsl).toBe(true);
  });

  it('throws ConfigurationError on a non-boolean DATABASE_SSL', () => {
    expect(() => readEnvConfig({ ...baseEnv, DATABASE_SSL: 'enabled' }, args)).toThrow(
      'DATABASE_SSL must be a boolean (true/false); got "enabled"',
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

  describe('database connection from parts', () => {
    const baseEnvNoUrl = (() => {
      const env = { ...baseEnv };
      delete env.DATABASE_URL;

      return env;
    })();

    it('builds the connection string from parts when DATABASE_URL is unset', () => {
      const config = readEnvConfig(
        {
          ...baseEnvNoUrl,
          DATABASE_HOST: 'db.example.com',
          DATABASE_NAME: 'mydb',
          DATABASE_USER: 'user',
          DATABASE_PASSWORD: 'pass',
          DATABASE_PORT: '6543',
        },
        args,
      );

      expect(config.databaseUrl).toBe('postgres://user:pass@db.example.com:6543/mydb');
    });

    it('defaults the port to 5432 when DATABASE_PORT is unset', () => {
      const config = readEnvConfig(
        {
          ...baseEnvNoUrl,
          DATABASE_HOST: 'db.example.com',
          DATABASE_NAME: 'mydb',
          DATABASE_USER: 'user',
          DATABASE_PASSWORD: 'pass',
        },
        args,
      );

      expect(config.databaseUrl).toBe('postgres://user:pass@db.example.com:5432/mydb');
    });

    it('omits the password segment when DATABASE_PASSWORD is unset', () => {
      const config = readEnvConfig(
        {
          ...baseEnvNoUrl,
          DATABASE_HOST: 'db.example.com',
          DATABASE_NAME: 'mydb',
          DATABASE_USER: 'user',
        },
        args,
      );

      expect(config.databaseUrl).toBe('postgres://user@db.example.com:5432/mydb');
    });

    it('brackets an IPv6 host so the connection URI is well-formed', () => {
      const config = readEnvConfig(
        {
          ...baseEnvNoUrl,
          DATABASE_HOST: '2001:db8::1',
          DATABASE_NAME: 'mydb',
          DATABASE_USER: 'user',
        },
        args,
      );

      expect(config.databaseUrl).toBe('postgres://user@[2001:db8::1]:5432/mydb');
    });

    it('does not double-bracket an already-bracketed IPv6 host', () => {
      const config = readEnvConfig(
        {
          ...baseEnvNoUrl,
          DATABASE_HOST: '[::1]',
          DATABASE_NAME: 'mydb',
          DATABASE_USER: 'user',
        },
        args,
      );

      expect(config.databaseUrl).toBe('postgres://user@[::1]:5432/mydb');
    });

    it('url-encodes special characters in the user and password', () => {
      const config = readEnvConfig(
        {
          ...baseEnvNoUrl,
          DATABASE_HOST: 'db.example.com',
          DATABASE_NAME: 'mydb',
          DATABASE_USER: 'u@ser',
          DATABASE_PASSWORD: 'p@ss:word',
        },
        args,
      );

      expect(config.databaseUrl).toBe('postgres://u%40ser:p%40ss%3Aword@db.example.com:5432/mydb');
    });

    it('prefers DATABASE_URL over the individual parts when both are set', () => {
      const config = readEnvConfig(
        {
          ...baseEnv,
          DATABASE_HOST: 'db.example.com',
          DATABASE_NAME: 'mydb',
          DATABASE_USER: 'user',
        },
        args,
      );

      expect(config.databaseUrl).toBe('postgres://u:p@localhost:5432/wfe');
    });

    it('throws ConfigurationError when only some parts are set', () => {
      expect(() =>
        readEnvConfig({ ...baseEnvNoUrl, DATABASE_HOST: 'db.example.com' }, args),
      ).toThrow(ConfigurationError);
      expect(() =>
        readEnvConfig({ ...baseEnvNoUrl, DATABASE_HOST: 'db.example.com' }, args),
      ).toThrow(/DATABASE_NAME, DATABASE_USER/);
    });

    it('throws ConfigurationError when DATABASE_PORT is non-numeric', () => {
      expect(() =>
        readEnvConfig(
          {
            ...baseEnvNoUrl,
            DATABASE_HOST: 'db.example.com',
            DATABASE_NAME: 'mydb',
            DATABASE_USER: 'user',
            DATABASE_PORT: 'abc',
          },
          args,
        ),
      ).toThrow(/DATABASE_PORT must be a positive integer/);
    });

    it('reports the missing database vars when neither DATABASE_URL nor parts are set', () => {
      expect(() => readEnvConfig(baseEnvNoUrl, args)).toThrow(
        /DATABASE_URL \(or DATABASE_HOST, DATABASE_NAME, DATABASE_USER\)/,
      );
    });

    it('ignores database parts in --in-memory mode and does not throw on partial parts', () => {
      const config = readEnvConfig(
        { ...baseEnvNoUrl, DATABASE_HOST: 'db.example.com' },
        { ...args, inMemory: true },
      );

      expect(config.mode).toBe('in-memory');
      expect(config.databaseUrl).toBeUndefined();
    });
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

  it.each(['Debug', 'Info', 'Warn', 'Error'] as const)(
    'parses LOG_LEVEL=%s into loggerLevel',
    level => {
      const config = readEnvConfig({ ...baseEnv, LOG_LEVEL: level }, args);

      expect(config.executorOptions.loggerLevel).toBe(level);
    },
  );

  it('falls back to default loggerLevel (Info) when LOG_LEVEL is unset', () => {
    const config = readEnvConfig(baseEnv, args);

    expect(config.executorOptions.loggerLevel).toBe('Info');
  });

  it('falls back to default loggerLevel when LOG_LEVEL is empty string', () => {
    const config = readEnvConfig({ ...baseEnv, LOG_LEVEL: '' }, args);

    expect(config.executorOptions.loggerLevel).toBe('Info');
  });

  it.each([
    ['info', 'Info'],
    ['INFO', 'Info'],
    ['debug', 'Debug'],
    ['WARN', 'Warn'],
    ['error', 'Error'],
  ] as const)('parses case-insensitive LOG_LEVEL=%s into %s', (input, expected) => {
    const config = readEnvConfig({ ...baseEnv, LOG_LEVEL: input }, args);

    expect(config.executorOptions.loggerLevel).toBe(expected);
  });

  it.each(['trace', 'fatal', 'verbose', 'xxx'])(
    'throws ConfigurationError on invalid LOG_LEVEL=%s',
    value => {
      expect(() => readEnvConfig({ ...baseEnv, LOG_LEVEL: value }, args)).toThrow(
        `LOG_LEVEL must be one of Debug, Info, Warn, Error (got "${value}")`,
      );
    },
  );

  it('LOG_LEVEL error is a ConfigurationError instance (typed boundary error)', () => {
    expect(() => readEnvConfig({ ...baseEnv, LOG_LEVEL: 'oops' }, args)).toThrow(
      ConfigurationError,
    );
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
    return jest.fn();
  }

  it('logs resolved defaults when env-derived options are undefined', () => {
    const logger = makeLogger();

    logStartup(logger as never, {
      mode: 'database',
      databaseSsl: false,
      executorOptions: {
        envSecret: 'e',
        authSecret: 'a',
        agentUrl: 'http://agent',
        httpPort: DEFAULT_HTTP_PORT,
      },
    });

    expect(logger).toHaveBeenCalledWith(
      'Info',
      'Workflow executor starting',
      expect.objectContaining({
        forestServerUrl: DEFAULT_FOREST_SERVER_URL,
        pollingIntervalS: DEFAULT_POLLING_INTERVAL_S,
      }),
    );
  });

  it('reports the database TLS state in database mode', () => {
    const logger = makeLogger();

    logStartup(logger as never, {
      mode: 'database',
      databaseSsl: true,
      executorOptions: {
        envSecret: 'e',
        authSecret: 'a',
        agentUrl: 'http://agent',
        httpPort: DEFAULT_HTTP_PORT,
      },
    });

    expect(logger).toHaveBeenCalledWith(
      'Info',
      'Workflow executor starting',
      expect.objectContaining({ databaseSsl: true }),
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
        // DATABASE_SSL defaults to true, so TLS is configured.
        database: {
          uri: 'postgres://u:p@localhost:5432/wfe',
          dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
        },
      }),
    );
    expect(factories.buildInMemory).not.toHaveBeenCalled();
    expect(executor.start).toHaveBeenCalled();
  });

  it('enables TLS (no cert verification) on the database when DATABASE_SSL=true', async () => {
    const { factories } = makeFactories();
    await runCli([], { ...baseEnv, DATABASE_SSL: 'true' }, factories);

    expect(factories.buildDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        database: {
          uri: 'postgres://u:p@localhost:5432/wfe',
          dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
        },
      }),
    );
  });

  it('configures database TLS by default when DATABASE_SSL is unset', async () => {
    const { factories } = makeFactories();
    await runCli([], baseEnv, factories);

    const call = (factories.buildDatabase as jest.Mock).mock.calls[0][0];
    expect(call.database).toEqual({
      uri: 'postgres://u:p@localhost:5432/wfe',
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    });
  });

  it('does not configure database TLS when DATABASE_SSL=false', async () => {
    const { factories } = makeFactories();
    await runCli([], { ...baseEnv, DATABASE_SSL: 'false' }, factories);

    const call = (factories.buildDatabase as jest.Mock).mock.calls[0][0];
    expect(call.database).toEqual({ uri: 'postgres://u:p@localhost:5432/wfe' });
  });

  it('injects a JSON logger into executorOptions when --json is set', async () => {
    const { factories } = makeFactories();
    await runCli(['--json'], baseEnv, factories);

    const call = (factories.buildDatabase as jest.Mock).mock.calls[0][0];
    expect(typeof call.logger).toBe('function');
    call.logger('Info', 'probe', { k: 'v' });
    const out = infoSpy.mock.calls.at(-1)?.[0] as string;
    expect(isJsonLogger(out)).toBe(true);
  });

  it('injects a pretty logger when --pretty is set', async () => {
    const { factories } = makeFactories();
    await runCli(['--pretty'], baseEnv, factories);

    const call = (factories.buildDatabase as jest.Mock).mock.calls[0][0];
    expect(typeof call.logger).toBe('function');
    call.logger('Info', 'probe', { k: 'v' });
    const out = infoSpy.mock.calls.at(-1)?.[0] as string;
    expect(isJsonLogger(out)).toBe(false);
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
