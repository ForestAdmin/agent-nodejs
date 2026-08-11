import type BFFHttpServer from './http/bff-http-server';
import type { Logger } from './ports/logger-port';

import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

import runCli from './cli-core';
import { extractErrorMessage } from './errors';
import { generateOpenApiDocument, serializeOpenApi } from './openapi/openapi-document';
import version from './version';

export const DEFAULT_OUTPUT_FILE = 'openapi.json';

const OUTPUT_FLAG = '--output';

export const USAGE = `Usage: forest-bff [command]

Commands:
  (none)      Start the BFF server, configured from the environment.
  openapi     Write the OpenAPI document to stdout. Needs no configuration.
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

export function renderOpenApi(): string {
  return `${serializeOpenApi(generateOpenApiDocument(version))}\n`;
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

function writeOpenApiFile(file: string): DispatchOutcome {
  const asDirectory = file.endsWith('/') || file.endsWith(path.sep);
  const destination = path.resolve(
    process.cwd(),
    asDirectory ? path.join(file, DEFAULT_OUTPUT_FILE) : file,
  );

  try {
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, renderOpenApi());
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

  if (file !== undefined) {
    return writeOpenApiFile(file);
  }

  process.stdout.write(renderOpenApi());

  return { exitCode: 0 };
}
