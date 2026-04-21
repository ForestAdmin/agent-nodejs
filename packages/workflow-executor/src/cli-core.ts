/* eslint-disable no-console */

import type {
  DatabaseExecutorOptions,
  ExecutorOptions,
  WorkflowExecutor,
} from './build-workflow-executor';
import type { Logger } from './ports/logger-port';
import type { AiConfiguration } from '@forestadmin/ai-proxy';

import ConsoleLogger from './adapters/console-logger';
import PrettyLogger from './adapters/pretty-logger';
import { ConfigurationError } from './errors';

function parsePositiveIntEnv(name: string, raw: string | undefined): number | undefined {
  if (!raw) return undefined;

  const n = Number(raw);

  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new ConfigurationError(`${name} must be a positive integer (got "${raw}")`);
  }

  return n;
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

/**
 * Pick the logger based on (in priority order):
 *   1. --json flag     → ConsoleLogger (structured, machine-parseable)
 *   2. --pretty flag   → PrettyLogger (colorized, human-readable)
 *   3. stdout is a TTY → PrettyLogger (interactive terminal)
 *   4. otherwise       → ConsoleLogger (piped, redirected, docker, k8s, CI)
 *
 * `NO_COLOR` is respected by picocolors so pretty output stays monochrome
 * in environments that ban ANSI codes.
 */
export function pickLogger(args: CliArgs, stdout: NodeJS.WriteStream = process.stdout): Logger {
  if (args.json) return new ConsoleLogger();
  if (args.pretty) return new PrettyLogger();

  return stdout.isTTY ? new PrettyLogger() : new ConsoleLogger();
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

export function readEnvConfig(env: NodeJS.ProcessEnv, args: CliArgs): CliConfig {
  const requiredBase = ['FOREST_ENV_SECRET', 'FOREST_AUTH_SECRET', 'AGENT_URL'] as const;
  const missing: string[] = requiredBase.filter(key => !env[key]);

  if (!args.inMemory && !env.DATABASE_URL) {
    missing.push('DATABASE_URL (required unless --in-memory)');
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
    httpPort: env.HTTP_PORT ? Number(env.HTTP_PORT) : 3400,
    forestServerUrl: env.FOREST_SERVER_URL,
    pollingIntervalMs: parsePositiveIntEnv('POLLING_INTERVAL_MS', env.POLLING_INTERVAL_MS),
    stopTimeoutMs: parsePositiveIntEnv('STOP_TIMEOUT_MS', env.STOP_TIMEOUT_MS),
    stepTimeoutMs: parsePositiveIntEnv('STEP_TIMEOUT_MS', env.STEP_TIMEOUT_MS),
    ...(aiConfigurations && { aiConfigurations }),
  };

  return {
    executorOptions,
    databaseUrl: env.DATABASE_URL,
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

Optional environment variables:
  HTTP_PORT              Default: 3400
  FOREST_SERVER_URL      Default: https://api.forestadmin.com
  POLLING_INTERVAL_MS    Default: 5000
  STOP_TIMEOUT_MS        Default: 30000
  STEP_TIMEOUT_MS        Max duration of a step in ms (default: 300000 = 5 minutes)
  NO_COLOR               Set to any value to disable ANSI colors in pretty logs

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
  const { executorOptions: opts, mode } = config;
  const aiLabel = opts.aiConfigurations?.length
    ? `local (${opts.aiConfigurations[0].provider} / ${opts.aiConfigurations[0].model})`
    : 'server fallback';

  logger.info('Workflow executor starting', {
    mode,
    forestServerUrl: opts.forestServerUrl ?? 'https://api.forestadmin.com',
    agentUrl: opts.agentUrl,
    httpPort: opts.httpPort,
    pollingIntervalMs: opts.pollingIntervalMs ?? 5000,
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
  const logger = pickLogger(args);
  config.executorOptions.logger = logger;

  logStartup(logger, config);

  try {
    let executor: WorkflowExecutor;

    if (config.mode === 'in-memory') {
      executor = factories.buildInMemory(config.executorOptions);
    } else {
      const databaseOptions: DatabaseExecutorOptions = {
        ...config.executorOptions,
        database: { uri: config.databaseUrl as string },
      };
      executor = factories.buildDatabase(databaseOptions);
    }

    await executor.start();
    logger.info('Workflow executor ready', {
      url: `http://localhost:${config.executorOptions.httpPort}`,
    });

    return executor;
  } catch (error) {
    logger.error('Workflow executor failed to start', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
