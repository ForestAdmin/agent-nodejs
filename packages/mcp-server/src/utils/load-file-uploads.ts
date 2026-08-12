import type { FileUploadsOptions } from '../file-uploads/types';

import * as path from 'path';

/**
 * Loads the `fileUploads` options of the standalone server from a module on disk.
 *
 * A storage backend is an object with methods, so it cannot travel through an environment
 * variable like every other standalone option. Without this, file uploads would be reachable
 * only by embedding the server in an agent or by writing a custom entry point.
 *
 * The module default-exports the options, or a function returning them:
 *
 *   module.exports = { storage: myS3Storage, maxBytes: 50 * 1024 * 1024 };
 */
export default async function loadFileUploads(
  modulePath?: string,
): Promise<FileUploadsOptions | undefined> {
  if (!modulePath) return undefined;

  const resolved = path.resolve(process.cwd(), modulePath);
  let loaded: { default?: unknown } & Record<string, unknown>;

  try {
    // require rather than import(): this package is CommonJS, and Node handles an ESM module here
    // too, whereas a file:// specifier breaks under the test runner.
    // eslint-disable-next-line global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires
    loaded = require(resolved);
  } catch (error) {
    throw new Error(
      `Cannot load FOREST_MCP_UPLOAD_STORAGE_MODULE "${modulePath}" (resolved to ${resolved}): ` +
        `${(error as Error).message}`,
    );
  }

  const exported = loaded.default ?? loaded;
  const options = (typeof exported === 'function' ? await exported() : exported) as
    | FileUploadsOptions
    | undefined;

  if (!options?.storage) {
    throw new Error(
      `FOREST_MCP_UPLOAD_STORAGE_MODULE "${modulePath}" must export { storage }, or a function ` +
        'returning it. See the fileUploads section of the mcp-server README.',
    );
  }

  return options;
}
