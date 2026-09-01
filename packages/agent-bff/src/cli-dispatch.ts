import type BFFHttpServer from './http/bff-http-server';
import type { Logger } from './ports/logger-port';

import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

import createConsoleLogger from './adapters/console-logger';
import { AI_QUERY_ROUTE } from './ai/ai-routes-middleware';
import { resolveOAuthConfig, resolveUnfoldSource } from './build-bff';
import runCli from './cli-core';
import { parseConfig } from './config/env-config';
import { extractErrorMessage } from './errors';
import { generateOpenApiDocument, serializeOpenApi } from './openapi/openapi-document';
import buildUnfoldedDocument, { issueOpenApiAgentToken } from './openapi/unfolded-document';
import { isFullyDegraded } from './openapi/unfolding';
import version from './version';

export const DEFAULT_OUTPUT_FILE = 'openapi.json';

const OUTPUT_FLAG = '--output';

export const USAGE = `Usage: forest-bff [command]

Commands:
  (none)      Start the BFF server, configured from the environment.
  openapi     Write the OpenAPI document to stdout. Needs no configuration, but
              a deployment configured to reach its Forest schema and its agent
              (FOREST_SERVER_URL, FOREST_ENV_SECRET, FOREST_AUTH_SECRET,
              AGENT_URL) unfolds one path per collection, relation and action
              instead of the generic ones.
              --output [file]  Write to a file instead of stdout, defaulting
                               to ${DEFAULT_OUTPUT_FILE} in the current directory.

Options:
  -h, --help     Show this help and exit.
  -v, --version  Show the package version and exit.`;

export const HINT = "Run 'forest-bff --help' for usage.";

const HELP_FLAGS = new Set(['-h', '--help']);
const VERSION_FLAGS = new Set(['-v', '--version']);

export interface DispatchOutcome {
  exitCode: number;
  server?: BFFHttpServer;
}

const UNFOLD_VARS = [
  'FOREST_SERVER_URL',
  'FOREST_ENV_SECRET',
  'FOREST_AUTH_SECRET',
  'AGENT_URL',
] as const;

const NOTHING_TO_UNFOLD = `${UNFOLD_VARS.join(', ')} must all be set to unfold it`;

function wantsUnfolding(env: NodeJS.ProcessEnv): boolean {
  return UNFOLD_VARS.every(name => (env[name] ?? '').trim() !== '');
}

function publishesAiQuery(env: NodeJS.ProcessEnv, logger: Logger): boolean {
  try {
    return resolveOAuthConfig(parseConfig(env)) !== undefined;
  } catch (error) {
    const reason = extractErrorMessage(error);

    logger(
      'Warn',
      `Omitting ${AI_QUERY_ROUTE} from the document: the configuration could not be read (${reason})`,
    );

    return false;
  }
}

/**
 * Unfolds when the deployment is configured to be inspected, and emits the generic document when it
 * is not configured at all — the command keeps working without configuration. A deployment that IS
 * configured but whose schema cannot be read fails instead of quietly degrading: it asked for the
 * unfolded document, and a generic one would look like a complete answer.
 */
export async function renderOpenApi(env: NodeJS.ProcessEnv, logger: Logger): Promise<string> {
  const authSecret = env.FOREST_AUTH_SECRET;

  // `parseConfig` validates the WHOLE server configuration, including settings the export has nothing
  // to do with (HTTP_PORT, the OAuth keys, the default timezone). A deployment that never asked for an
  // unfolded document must not see its export die on one of those, so the config is parsed only once
  // the four variables unfolding needs are all present — and from there a bad value is a real failure.
  const unfoldable =
    authSecret && wantsUnfolding(env)
      ? { source: resolveUnfoldSource(parseConfig(env), logger), authSecret }
      : undefined;

  const hasAiQueryRoute = publishesAiQuery(env, logger);

  if (!unfoldable?.source) {
    logger('Warn', `Emitting the generic OpenAPI document: ${NOTHING_TO_UNFOLD}`);

    return `${serializeOpenApi(generateOpenApiDocument(version, { hasAiQueryRoute }))}\n`;
  }

  const { source } = unfoldable;
  const readModel = await source.store.getReadModel();
  const { document, unfolding } = await buildUnfoldedDocument(
    source,
    readModel,
    () => issueOpenApiAgentToken(unfoldable.authSecret),
    { version, hasAiQueryRoute },
  );

  // Not one collection came back with its field set, so the agent was unreachable throughout. The
  // paths are real but every field schema is free-form, which is not the document this command
  // promises — a CI job regenerating it needs something to branch on, and the degraded notes buried
  // in the descriptions are not it. One odd collection stays a warning, not a failure.
  if (isFullyDegraded(unfolding)) {
    throw new Error(
      'No collection could be described: the agent answered no capabilities call, so every field ' +
        'schema in the document would be free-form. Check AGENT_URL and the agent, then retry.',
    );
  }

  return `${document}\n`;
}

function rejectCli(reason: string): DispatchOutcome {
  process.stderr.write(`${reason}\n${HINT}\n`);

  return { exitCode: 1 };
}

interface OutputOption {
  file?: string;
  extras: string[];
}

function parseOutputOption(rest: string[]): OutputOption {
  const index = rest.indexOf(OUTPUT_FLAG);

  if (index === -1) return { extras: rest };

  const candidate = rest[index + 1];
  const takesValue = candidate !== undefined && candidate !== '' && !candidate.startsWith('-');

  return {
    file: takesValue ? candidate : DEFAULT_OUTPUT_FILE,
    extras: [...rest.slice(0, index), ...rest.slice(index + (takesValue ? 2 : 1))],
  };
}

function writeOpenApiFile(file: string, document: string): DispatchOutcome {
  const asDirectory = file.endsWith('/') || file.endsWith(path.sep);
  const destination = path.resolve(
    process.cwd(),
    asDirectory ? path.join(file, DEFAULT_OUTPUT_FILE) : file,
  );

  try {
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, document);
  } catch (error) {
    process.stderr.write(`Cannot write ${destination}: ${extractErrorMessage(error)}\n`);

    return { exitCode: 1 };
  }

  process.stderr.write(`Wrote the OpenAPI document to ${destination}\n`);

  return { exitCode: 0 };
}

export default async function dispatchCli(
  argv: string[],
  env: NodeJS.ProcessEnv,
  logger?: Logger,
): Promise<DispatchOutcome> {
  const [subcommand, ...rest] = argv;

  if (subcommand === undefined) {
    return { exitCode: 0, server: await runCli(env, logger) };
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
    return writeOpenApiFile(file, document);
  }

  process.stdout.write(document);

  return { exitCode: 0 };
}
