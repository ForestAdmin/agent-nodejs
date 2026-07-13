/* eslint-disable no-console */

import type { Logger, LoggerLevel } from './ports/logger-port';
import type { AiConfiguration } from '@forestadmin/ai-proxy';

import { z } from 'zod';

import createConsoleLogger from './adapters/console-logger';
import createPrettyLogger from './adapters/pretty-logger';
import {
  type DatabaseExecutorOptions,
  type ExecutorOptions,
  type WorkflowExecutor,
} from './build-workflow-executor';
import {
  DEFAULT_AI_INVOKE_TIMEOUT_S,
  DEFAULT_FOREST_SERVER_URL,
  DEFAULT_HTTP_PORT,
  DEFAULT_LOGGER_LEVEL,
  DEFAULT_MAX_CHAIN_DEPTH,
  DEFAULT_POLLING_INTERVAL_S,
  DEFAULT_SCHEMA_CACHE_TTL_S,
  DEFAULT_STEP_TIMEOUT_S,
  DEFAULT_STOP_TIMEOUT_S,
} from './defaults';
import { ConfigurationError, extractErrorMessage } from './errors';

const POSITIVE_INT = z.coerce.number().int().positive();
const LOGGER_LEVEL_SCHEMA = z.enum(['Debug', 'Info', 'Warn', 'Error']);

function parsePositiveIntEnv(name: string, raw: string | undefined): number | undefined {
  if (!raw) return undefined;

  const parsed = POSITIVE_INT.safeParse(raw);

  if (!parsed.success) {
    throw new ConfigurationError(`${name} must be a positive integer (got "${raw}")`);
  }

  return parsed.data;
}

function parseLoggerLevelEnv(raw: string | undefined): LoggerLevel | undefined {
  if (!raw) return undefined;

  const normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  const parsed = LOGGER_LEVEL_SCHEMA.safeParse(normalized);

  if (!parsed.success) {
    throw new ConfigurationError(
      `LOG_LEVEL must be one of Debug, Info, Warn, Error (got "${raw}")`,
    );
  }

  return parsed.data;
}

const TRUTHY = ['true', '1', 'yes', 'on'];
const FALSY = ['false', '0', 'no', 'off'];

function parseBooleanEnv(name: string, raw: string | undefined, defaultValue = false): boolean {
  if (!raw) return defaultValue;

  const value = raw.trim().toLowerCase();
  if (TRUTHY.includes(value)) return true;
  if (FALSY.includes(value)) return false;

  throw new ConfigurationError(`${name} must be a boolean (true/false); got "${raw}"`);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const { version } = require('../package.json') as { version: string };

const BINARY_NAME = 'forest-workflow-executor';

export interface CliArgs {
  help: boolean;
  version: boolean;
  inMemory: boolean;
  pretty: boolean;
  json: boolean;
}

export interface CliConfig {
  executorOptions: ExecutorOptions;
  databaseUrl?: string;
  databaseSsl: boolean;
  databaseSchema?: string;
  mode: 'in-memory' | 'database';
}

export interface CliFactories {
  buildInMemory: (options: ExecutorOptions) => WorkflowExecutor;
  buildDatabase: (options: DatabaseExecutorOptions) => WorkflowExecutor;
}

export function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    help: false,
    version: false,
    inMemory: false,
    pretty: false,
    json: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case '--help':
      case '-h':
        result.help = true;
        break;
      case '--version':
      case '-v':
        result.version = true;
        break;
      case '--in-memory':
        result.inMemory = true;
        break;
      case '--pretty':
        result.pretty = true;
        break;
      case '--json':
        result.json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return result;
}

// Priority: --json → Console; --pretty → Pretty; TTY → Pretty; else Console (piped/docker/k8s/CI).
// NO_COLOR is respected by picocolors so pretty output stays monochrome where ANSI is banned.
export function pickLogger(
  args: CliArgs,
  level: LoggerLevel,
  stdout: NodeJS.WriteStream = process.stdout,
): Logger {
  if (args.json) return createConsoleLogger(level);
  if (args.pretty) return createPrettyLogger(level);

  return stdout.isTTY ? createPrettyLogger(level) : createConsoleLogger(level);
}

function parseAiConfig(env: NodeJS.ProcessEnv): AiConfiguration[] | undefined {
  const { AI_PROVIDER, AI_MODEL, AI_API_KEY } = env;
  const fields = [AI_PROVIDER, AI_MODEL, AI_API_KEY];
  const setCount = fields.filter(Boolean).length;

  if (setCount === 0) return undefined;

  if (setCount !== fields.length) {
    throw new Error(
      'AI config must be all-or-nothing: set AI_PROVIDER, AI_MODEL and AI_API_KEY together or leave all unset.',
    );
  }

  if (AI_PROVIDER !== 'anthropic' && AI_PROVIDER !== 'openai') {
    throw new Error(`AI_PROVIDER must be "anthropic" or "openai", got "${AI_PROVIDER}"`);
  }

  return [
    {
      name: 'default',
      provider: AI_PROVIDER,
      model: AI_MODEL as string,
      apiKey: AI_API_KEY as string,
    },
  ];
}

const DEFAULT_DATABASE_PORT = 5432;
const DATABASE_PARTS = ['DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_USER'] as const;

function buildDatabaseUrlFromParts(env: NodeJS.ProcessEnv): string | undefined {
  const { DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD } = env;

  if (DATABASE_PARTS.every(key => !env[key])) return undefined;

  const missing = DATABASE_PARTS.filter(key => !env[key]);

  if (missing.length > 0) {
    throw new ConfigurationError(
      `When DATABASE_URL is not set, the connection is built from parts; ` +
        `also set: ${missing.join(', ')}.`,
    );
  }

  const port = parsePositiveIntEnv('DATABASE_PORT', DATABASE_PORT) ?? DEFAULT_DATABASE_PORT;
  const user = encodeURIComponent(DATABASE_USER as string);
  const auth = DATABASE_PASSWORD ? `${user}:${encodeURIComponent(DATABASE_PASSWORD)}` : user;
  const rawHost = DATABASE_HOST as string;
  const host = rawHost.includes(':') && !rawHost.startsWith('[') ? `[${rawHost}]` : rawHost;
  const database = encodeURIComponent(DATABASE_NAME as string);

  return `postgres://${auth}@${host}:${port}/${database}`;
}

function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  return env.DATABASE_URL || buildDatabaseUrlFromParts(env);
}

export function readEnvConfig(env: NodeJS.ProcessEnv, args: CliArgs): CliConfig {
  const requiredBase = ['FOREST_ENV_SECRET', 'FOREST_AUTH_SECRET', 'AGENT_URL'] as const;
  const missing: string[] = requiredBase.filter(key => !env[key]);

  const databaseUrl = args.inMemory ? undefined : resolveDatabaseUrl(env);

  if (!args.inMemory && !databaseUrl) {
    missing.push(
      'DATABASE_URL (or DATABASE_HOST, DATABASE_NAME, DATABASE_USER); required unless --in-memory',
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
        `Run \`${BINARY_NAME} --help\` for the full list.`,
    );
  }

  const aiConfigurations = parseAiConfig(env);

  const executorOptions: ExecutorOptions = {
    envSecret: env.FOREST_ENV_SECRET as string,
    authSecret: env.FOREST_AUTH_SECRET as string,
    agentUrl: env.AGENT_URL as string,
    httpPort: parsePositiveIntEnv('HTTP_PORT', env.HTTP_PORT) ?? DEFAULT_HTTP_PORT,
    forestServerUrl: env.FOREST_SERVER_URL,
    pollingIntervalS: parsePositiveIntEnv('POLLING_INTERVAL_S', env.POLLING_INTERVAL_S),
    stopTimeoutS: parsePositiveIntEnv('STOP_TIMEOUT_S', env.STOP_TIMEOUT_S),
    stepTimeoutS: parsePositiveIntEnv('STEP_TIMEOUT_S', env.STEP_TIMEOUT_S),
    aiInvokeTimeoutS: parsePositiveIntEnv('AI_INVOKE_TIMEOUT_S', env.AI_INVOKE_TIMEOUT_S),
    maxChainDepth: parsePositiveIntEnv('MAX_CHAIN_DEPTH', env.MAX_CHAIN_DEPTH),
    schemaCacheTtlS: parsePositiveIntEnv('SCHEMA_CACHE_TTL_S', env.SCHEMA_CACHE_TTL_S),
    loggerLevel: parseLoggerLevelEnv(env.LOG_LEVEL) ?? DEFAULT_LOGGER_LEVEL,
    ...(aiConfigurations && { aiConfigurations }),
    ...(env.FORCE_AI_ERROR === 'true' && { forceAiError: true }),
  };

  return {
    executorOptions,
    databaseUrl,
    // Defaults to true: managed Postgres (RDS, Supabase, Railway…) requires TLS.
    // Set DATABASE_SSL=false for a local/dev database without TLS.
    databaseSsl: parseBooleanEnv('DATABASE_SSL', env.DATABASE_SSL, true),
    // Unset (or blank) falls back to the DEFAULT_SCHEMA ('forest') in resolveSchema.
    databaseSchema: env.DATABASE_SCHEMA?.trim() || undefined,
    mode: args.inMemory ? 'in-memory' : 'database',
  };
}

export function printHelp(): void {
  console.log(`Usage: ${BINARY_NAME} [options]

Run the Forest Admin workflow executor.

Options:
  --in-memory       Use an in-memory run store (no DB needed, not for prod)
  --pretty          Force colorized human-readable logs (default when stdout is a TTY)
  --json            Force structured JSON logs (default when stdout is not a TTY)
  --help, -h        Show this help
  --version, -v     Show version

Required environment variables:
  FOREST_ENV_SECRET   Forest Admin project environment secret
  FOREST_AUTH_SECRET  JWT signing secret (shared with your agent)
  AGENT_URL           URL of your running Forest Admin agent
  DATABASE_URL        Postgres connection string (not needed with --in-memory)

Database connection (use DATABASE_URL, or build it from parts when it is unset):
  DATABASE_HOST         Database host
  DATABASE_NAME         Database name
  DATABASE_USER         Database user
  DATABASE_PASSWORD     Database password (optional)
  DATABASE_PORT         Database port (default: ${DEFAULT_DATABASE_PORT})

Optional environment variables:
  DATABASE_SSL          Connect to the database over TLS (default: true; set "false" for a local DB without TLS)
  DATABASE_SCHEMA       Postgres schema for the executor's tables (default: forest)
  HTTP_PORT              Default: ${DEFAULT_HTTP_PORT}
  FOREST_SERVER_URL      Default: ${DEFAULT_FOREST_SERVER_URL}
  POLLING_INTERVAL_S    Default: ${DEFAULT_POLLING_INTERVAL_S}
  STOP_TIMEOUT_S        Default: ${DEFAULT_STOP_TIMEOUT_S}
  STEP_TIMEOUT_S        Max duration of a step in seconds (default: ${DEFAULT_STEP_TIMEOUT_S})
  AI_INVOKE_TIMEOUT_S   Max duration of a single AI provider invocation in seconds (default: ${DEFAULT_AI_INVOKE_TIMEOUT_S})
  MAX_CHAIN_DEPTH        Max steps auto-executed per run before yielding (default: ${DEFAULT_MAX_CHAIN_DEPTH})
  SCHEMA_CACHE_TTL_S    Collection schema cache TTL in seconds (default: ${DEFAULT_SCHEMA_CACHE_TTL_S})
  LOG_LEVEL              Debug | Info | Warn | Error (default: ${DEFAULT_LOGGER_LEVEL})
  NO_COLOR               Set to any value to disable ANSI colors in pretty logs
  FORCE_AI_ERROR         Set to "true" to make every AI call fail (dev only, to test error paths)

AI configuration (all-or-nothing — falls back to server AI if any is missing):
  AI_PROVIDER            'anthropic' | 'openai'
  AI_MODEL               Model name (e.g. claude-sonnet-4-6)
  AI_API_KEY             Provider API key

Signals:
  SIGTERM / SIGINT  Graceful shutdown (drain in-flight, then exit)`);
}

export function printVersion(): void {
  console.log(version);
}

export function logStartup(logger: Logger, config: CliConfig): void {
  const { executorOptions: opts, mode, databaseSsl, databaseSchema } = config;
  let aiLabel: string;

  if (opts.forceAiError) {
    aiLabel = 'forced-error (dev only)';
  } else if (opts.aiConfigurations?.length) {
    aiLabel = `local (${opts.aiConfigurations[0].provider} / ${opts.aiConfigurations[0].model})`;
  } else {
    aiLabel = 'server fallback';
  }

  logger('Info', 'Workflow executor starting', {
    mode,
    databaseSsl: mode === 'database' ? databaseSsl : undefined,
    databaseSchema: mode === 'database' ? databaseSchema ?? 'forest' : undefined,
    forestServerUrl: opts.forestServerUrl ?? DEFAULT_FOREST_SERVER_URL,
    agentUrl: opts.agentUrl,
    httpPort: opts.httpPort,
    pollingIntervalS: opts.pollingIntervalS ?? DEFAULT_POLLING_INTERVAL_S,
    loggerLevel: opts.loggerLevel ?? DEFAULT_LOGGER_LEVEL,
    aiConfig: aiLabel,
  });
}

export async function runCli(
  argv: string[],
  env: NodeJS.ProcessEnv,
  factories: CliFactories,
): Promise<WorkflowExecutor | null> {
  const args = parseArgs(argv);

  if (args.help) {
    printHelp();

    return null;
  }

  if (args.version) {
    printVersion();

    return null;
  }

  const config = readEnvConfig(env, args);
  const logger = pickLogger(args, config.executorOptions.loggerLevel ?? DEFAULT_LOGGER_LEVEL);
  config.executorOptions.logger = logger;

  logStartup(logger, config);

  try {
    let executor: WorkflowExecutor;

    if (config.mode === 'in-memory') {
      executor = factories.buildInMemory(config.executorOptions);
    } else {
      const databaseOptions: DatabaseExecutorOptions = {
        ...config.executorOptions,
        database: {
          uri: config.databaseUrl as string,
          ...(config.databaseSchema && { schema: config.databaseSchema }),
          ...(config.databaseSsl && {
            dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
          }),
        },
      };
      executor = factories.buildDatabase(databaseOptions);
    }

    await executor.start();
    logger('Info', 'Workflow executor ready', {
      url: `http://localhost:${config.executorOptions.httpPort}`,
    });

    return executor;
  } catch (error) {
    logger('Error', 'Workflow executor failed to start', {
      error: extractErrorMessage(error),
    });
    throw error;
  }
}
