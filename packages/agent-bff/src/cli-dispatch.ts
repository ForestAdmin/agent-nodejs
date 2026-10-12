import type BFFHttpServer from './http/bff-http-server';
import type { Logger } from './ports/logger-port';

import createConsoleLogger from './adapters/console-logger';
import runCli from './cli-core';
import { DEFAULT_OUTPUT_FILE, OUTPUT_FLAG, parseOutputOption, writeOutputFile } from './cli-output';
import renderOpenApi from './openapi/render-openapi';
import version from './version';

export { DEFAULT_OUTPUT_FILE };

export const USAGE = `Usage: forest-bff [command]

Commands:
  (none)      Start the BFF server, configured from the environment.
  openapi     Write the OpenAPI document to stdout. Needs no configuration, but
              a deployment configured to reach its Forest schema and its agent
              (FOREST_ENV_SECRET, FOREST_AUTH_SECRET, AGENT_URL) unfolds one
              path per collection, relation and action instead of the generic
              ones.
              --output [file]  Write to a file instead of stdout, defaulting
                               to ${DEFAULT_OUTPUT_FILE} in the current directory.

Options:
  -h, --help     Show this help and exit.
  -v, --version  Show the package version and exit.`;

export const HINT = "Run 'forest-bff --help' for usage.";

export const DEPRECATION_WARNING =
  'forest-bff is deprecated: it keeps working, but new deployments should run forest-gateway ' +
  '(@forestadmin/gateway). Moving changes the API URL to /api: ' +
  'https://docs.forestadmin.com/product/embed/gateway-standalone';

const HELP_FLAGS = new Set(['-h', '--help']);
const VERSION_FLAGS = new Set(['-v', '--version']);

export interface DispatchOutcome {
  exitCode: number;
  server?: BFFHttpServer;
}

function rejectCli(reason: string): DispatchOutcome {
  process.stderr.write(`${reason}\n${HINT}\n`);

  return { exitCode: 1 };
}

export default async function dispatchCli(
  argv: string[],
  env: NodeJS.ProcessEnv,
  logger?: Logger,
): Promise<DispatchOutcome> {
  const [subcommand, ...rest] = argv;

  if (subcommand === undefined) {
    const bootLogger = logger ?? createConsoleLogger();
    bootLogger('Warn', DEPRECATION_WARNING);

    return { exitCode: 0, server: await runCli(env, bootLogger) };
  }

  if (HELP_FLAGS.has(subcommand)) {
    process.stdout.write(`${USAGE}\n`);

    return { exitCode: 0 };
  }

  if (VERSION_FLAGS.has(subcommand)) {
    process.stdout.write(`${version}\n`);

    return { exitCode: 0 };
  }

  if (subcommand !== 'openapi') {
    return rejectCli(
      subcommand === OUTPUT_FLAG
        ? `${OUTPUT_FLAG} only applies to the openapi command`
        : `Unknown command: ${subcommand}`,
    );
  }

  const { file, extras } = parseOutputOption(rest);

  if (extras.length > 0) {
    return rejectCli(
      `openapi accepts only --output, got: ${extras.map(extra => JSON.stringify(extra)).join(' ')}`,
    );
  }

  const document = await renderOpenApi(env, logger ?? createConsoleLogger());

  if (file !== undefined) {
    return writeOutputFile(file, document);
  }

  process.stdout.write(document);

  return { exitCode: 0 };
}
