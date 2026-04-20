/* eslint-disable no-console */

import type {
  DatabaseExecutorOptions,
  ExecutorOptions,
  WorkflowExecutor,
} from './build-workflow-executor';
import type { AiConfiguration } from '@forestadmin/ai-proxy';

// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const { version } = require('../package.json') as { version: string };

const BINARY_NAME = 'forest-workflow-executor';

export interface CliArgs {
  help: boolean;
  version: boolean;
  inMemory: boolean;
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
  const result: CliArgs = { help: false, version: false, inMemory: false };

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
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return result;
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
    pollingIntervalMs: env.POLLING_INTERVAL_MS ? Number(env.POLLING_INTERVAL_MS) : undefined,
    stopTimeoutMs: env.STOP_TIMEOUT_MS ? Number(env.STOP_TIMEOUT_MS) : undefined,
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

export function logStartup(config: CliConfig): void {
  const { executorOptions: opts, mode } = config;
  const pollingMs = opts.pollingIntervalMs ?? 5000;
  const forestServerUrl = opts.forestServerUrl ?? 'https://api.forestadmin.com';
  const aiLabel = opts.aiConfigurations?.length
    ? `local (${opts.aiConfigurations[0].provider} / ${opts.aiConfigurations[0].model})`
    : 'server fallback (no local AI)';

  console.log(`[${BINARY_NAME}] Starting (${mode} mode)`);
  console.log(`  Forest server    : ${forestServerUrl}`);
  console.log(`  Agent URL        : ${opts.agentUrl}`);
  console.log(`  HTTP port        : ${opts.httpPort}`);
  console.log(`  Polling interval : ${pollingMs}ms`);
  console.log(`  AI config        : ${aiLabel}`);
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
  logStartup(config);

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
  console.log(`[${BINARY_NAME}] Ready on http://localhost:${config.executorOptions.httpPort}`);

  return executor;
}
