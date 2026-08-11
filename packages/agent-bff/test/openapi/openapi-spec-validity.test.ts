import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { generateOpenApiDocument, serializeOpenApi } from '../../src/openapi/openapi-document';

const REDOCLY_BIN = path.join(
  path.dirname(require.resolve('@redocly/cli/package.json')),
  'bin/cli.js',
);

describe('the generated OpenAPI document', () => {
  let directory: string;

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'bff-openapi-'));
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('should pass redocly lint, which is what a consumer runs before generating a client', () => {
    const file = path.join(directory, 'openapi.json');
    writeFileSync(file, serializeOpenApi(generateOpenApiDocument('1.0.0')));

    const result = spawnSync(process.execPath, [REDOCLY_BIN, 'lint', file], { encoding: 'utf8' });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect({ status: result.status, output }).toEqual({
      status: 0,
      output: expect.stringContaining('is valid'),
    });
  });
});
