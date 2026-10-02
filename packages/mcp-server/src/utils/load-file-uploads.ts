import type { FileUploadsOptions } from '../file-uploads/types';

import * as path from 'path';

// A module is free to throw a non-Error, and reading .message off it yields undefined.
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Attached rather than passed to the constructor: the error cause option needs a newer lib than
// this package targets, while Node itself carries the property fine.
const withCause = (message: string, cause: unknown) => Object.assign(new Error(message), { cause });

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
    // "cannot find it" and "it ran and failed" send the operator to different places, and only the
    // first is about the path they configured.
    // The quoted name, not the whole message: a module whose own dependency is missing reports
    // MODULE_NOT_FOUND too, with the resolved path in the require stack rather than as the subject.
    const absent =
      (error as NodeJS.ErrnoException)?.code === 'MODULE_NOT_FOUND' &&
      String((error as Error)?.message).includes(`'${resolved}'`);

    throw withCause(
      absent
        ? `FOREST_MCP_UPLOAD_STORAGE_MODULE "${modulePath}" was not found (resolved to ${resolved}).`
        : `FOREST_MCP_UPLOAD_STORAGE_MODULE "${modulePath}" failed while loading: ${describe(
            error,
          )}`,
      error,
    );
  }

  const exported = loaded?.default ?? loaded;
  let options: FileUploadsOptions | undefined;

  try {
    options = (typeof exported === 'function' ? await exported() : exported) as FileUploadsOptions;
  } catch (error) {
    // The sync path above is wrapped; a rejecting factory would otherwise surface with no mention
    // of the module it came from.
    throw withCause(
      `FOREST_MCP_UPLOAD_STORAGE_MODULE "${modulePath}" failed while building the options: ${describe(
        error,
      )}`,
      error,
    );
  }

  // An object without a storage key is legitimate — it selects the in-memory store. Nothing at all
  // is a mistake, most likely a module that forgot to export.
  if (!options || typeof options !== 'object') {
    throw new Error(
      `FOREST_MCP_UPLOAD_STORAGE_MODULE "${modulePath}" must export the fileUploads options, or a ` +
        'function returning them. See the fileUploads section of the mcp-server README.',
    );
  }

  // Whoever sets this variable did it *for* the storage: a bad import or a factory that returned
  // early leaves `{ storage: undefined }`, which the server would silently replace with the
  // in-memory store — putting a deliberately replicated deployment on the one backend that cannot
  // serve it. A missing method fails later, on the first user's upload, so it is checked here too.
  if ('storage' in options) {
    const storage = options.storage as unknown as Record<string, unknown> | undefined;
    const missing = ['createUploadUrl', 'download', 'getSize'].filter(
      method => typeof storage?.[method] !== 'function',
    );

    if (missing.length) {
      throw new Error(
        `FOREST_MCP_UPLOAD_STORAGE_MODULE "${modulePath}" exports a storage missing ` +
          `${missing.join(', ')}. An UploadStorage implements createUploadUrl, download and ` +
          'getSize. Omit the storage entirely to use the in-memory store on purpose.',
      );
    }
  }

  return options;
}
