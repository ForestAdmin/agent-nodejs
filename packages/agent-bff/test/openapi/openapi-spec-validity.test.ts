import type { OpenAPIObject } from 'openapi3-ts/oas31';

import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import unfoldingFixture from './fixtures';
import { generateOpenApiDocument, serializeOpenApi } from '../../src/openapi/openapi-document';

const REDOCLY_BIN = path.join(
  path.dirname(require.resolve('@redocly/cli/package.json')),
  'bin/cli.js',
);

describe.each([
  ['generic', () => generateOpenApiDocument('1.0.0', { hasAiQueryRoute: true })],
  [
    'unfolded',
    () =>
      generateOpenApiDocument('1.0.0', { unfolding: unfoldingFixture(), hasAiQueryRoute: true }),
  ],
])('the %s OpenAPI document', (name, build: () => OpenAPIObject) => {
  let directory: string;
  let status: number | null;
  let output: string;

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'bff-openapi-'));
    const file = path.join(directory, `${name}.json`);
    writeFileSync(file, serializeOpenApi(build()));

    const result = spawnSync(process.execPath, [REDOCLY_BIN, 'lint', file], { encoding: 'utf8' });
    status = result.status;
    output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('should pass redocly lint, which is what a consumer runs before generating a client', () => {
    expect({ status, output }).toEqual({
      status: 0,
      output: expect.stringContaining('is valid'),
    });
  });

  it('should lint clean, now that the context contract uses the session scheme', () => {
    expect(output).not.toMatch(/You have \d+ warning/);
    expect(output).not.toMatch(/You have \d+ error/);
  });
});
