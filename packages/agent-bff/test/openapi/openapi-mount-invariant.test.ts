import { readFileSync, readdirSync } from 'fs';
import path from 'path';

import * as publicApi from '../../src/index';
import { OPENAPI_PATH } from '../../src/openapi/openapi-routes';

const SRC_DIR = path.join(__dirname, '..', '..', 'src');
const OPENAPI_MODULE_PREFIX = 'openapi/';

const ALLOWED_OPENAPI_IMPORTS: Record<string, string[]> = {
  'cli-core.ts': ['openapi/openapi-routes', 'openapi/unfolded-document'],
  'cli-dispatch.ts': ['openapi/openapi-document', 'openapi/unfolded-document', 'openapi/unfolding'],
};

function sourceFiles(): string[] {
  return readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
    .map(entry => entry.split(path.sep).join('/'))
    .filter(entry => entry.endsWith('.ts'));
}

function relativeImportsOf(file: string): string[] {
  const source = readFileSync(path.join(SRC_DIR, file), 'utf8');

  return [...source.matchAll(/from '(\.[^']*)'/g)].map(match =>
    path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])),
  );
}

function openapiImportsOutsideTheOpenapiDir(): Record<string, string[]> {
  const byFile: Record<string, string[]> = {};
  const outsiders = sourceFiles().filter(file => !file.startsWith(OPENAPI_MODULE_PREFIX));

  for (const file of outsiders) {
    const targets = [
      ...new Set(
        relativeImportsOf(file).filter(target => target.startsWith(OPENAPI_MODULE_PREFIX)),
      ),
    ].sort();

    if (targets.length > 0) byFile[file] = targets;
  }

  return byFile;
}

describe('the OpenAPI document mount point', () => {
  describe('when the served path is read', () => {
    it('should sit under /agent, since that prefix is what the auth chain covers', () => {
      expect(OPENAPI_PATH.startsWith('/agent/')).toBe(true);
    });
  });

  describe('when a module outside src/openapi reaches into it', () => {
    it('should only be the two known mount points, since any other one could serve the document off /agent', () => {
      expect(openapiImportsOutsideTheOpenapiDir()).toEqual(ALLOWED_OPENAPI_IMPORTS);
    });
  });

  describe('when the package public surface is read', () => {
    it('should expose nothing OpenAPI-related, since a consumer could mount it off /agent', () => {
      expect(Object.keys(publicApi).filter(name => /openapi/i.test(name))).toEqual([]);
    });
  });
});
