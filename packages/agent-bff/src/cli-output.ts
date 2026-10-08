import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

import { extractErrorMessage } from './errors';

export const DEFAULT_OUTPUT_FILE = 'openapi.json';

export const OUTPUT_FLAG = '--output';

export interface OutputOption {
  file?: string;
  extras: string[];
}

export function parseOutputOption(rest: string[]): OutputOption {
  const index = rest.indexOf(OUTPUT_FLAG);

  if (index === -1) return { extras: rest };

  const candidate = rest[index + 1];
  const takesValue = candidate !== undefined && candidate !== '' && !candidate.startsWith('-');

  return {
    file: takesValue ? candidate : DEFAULT_OUTPUT_FILE,
    extras: [...rest.slice(0, index), ...rest.slice(index + (takesValue ? 2 : 1))],
  };
}

export function writeOutputFile(file: string, document: string): { exitCode: number } {
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
