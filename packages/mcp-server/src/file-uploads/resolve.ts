import type { ResolvedFileUploads } from './types';
import type { File } from '@forestadmin/agent-client';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import * as crypto from 'crypto';

import parseFileReference from './file-reference';
import { verifyUploadHandle } from './handles';

function collectReferences(values: Record<string, unknown>): Set<string> {
  const references = new Set<string>();

  for (const value of Object.values(values)) {
    const candidates = Array.isArray(value) ? value : [value];

    candidates.forEach(candidate => {
      if (parseFileReference(candidate)) references.add(candidate as string);
    });
  }

  return references;
}

async function loadFile(
  reference: string,
  userId: number | string,
  uploads: ResolvedFileUploads,
): Promise<File> {
  const { handle } = parseFileReference(reference);
  const claims = verifyUploadHandle(handle, userId, uploads.authSecret);

  // A pre-authorized upload URL cannot always cap the object size, so the limit is enforced
  // here, before the bytes are read whenever the backend can report a size.
  const size = await uploads.storage.getSize(claims.key);

  if (size !== undefined && size > uploads.maxBytes) {
    throw new Error(`Uploaded file is ${size} bytes, above the ${uploads.maxBytes} byte limit`);
  }

  const buffer = await uploads.storage.download(claims.key);

  if (buffer.length === 0) {
    throw new Error('Uploaded file is empty. Did the upload to uploadUrl succeed?');
  }

  if (buffer.length > uploads.maxBytes) {
    throw new Error(
      `Uploaded file is ${buffer.length} bytes, above the ${uploads.maxBytes} byte limit`,
    );
  }

  // Even if the upload URL leaked and someone overwrote the object, substituted content
  // cannot be redeemed.
  if (claims.sha256) {
    const digest = crypto.createHash('sha256').update(new Uint8Array(buffer)).digest('base64');

    if (digest !== claims.sha256) {
      throw new Error('Uploaded file does not match the sha256 it was pinned to');
    }
  }

  return { buffer, mimeType: claims.mimeType, name: claims.name };
}

/**
 * Replaces the file references in action form values with the uploaded objects. agent-client
 * encodes them for the agent, so the model only ever exchanges the small reference.
 *
 * References are resolved concurrently and deduplicated, so one referenced by several fields
 * is downloaded once.
 *
 * Only executeAction resolves them. getActionForm echoes field values back to the model, and
 * a resolved file there would put the content back into the model's context.
 */
export default async function resolveUploadedFileValues(
  values: Record<string, unknown>,
  authInfo: AuthInfo | undefined,
  uploads: ResolvedFileUploads | undefined,
): Promise<Record<string, unknown>> {
  const references = collectReferences(values);

  if (references.size === 0) return values;

  if (!uploads) {
    throw new Error(
      'File uploads are not configured on this server. ' +
        'Ask the administrator to set the fileUploads option to enable action file fields.',
    );
  }

  const userId = authInfo?.extra?.userId as number | string | undefined;

  if (userId === undefined || userId === null) {
    throw new Error('Cannot resolve uploaded files without an authenticated user');
  }

  const files = new Map(
    await Promise.all(
      [...references].map(
        async (reference): Promise<[string, File]> => [
          reference,
          await uploads.limitDownload(() => loadFile(reference, userId, uploads)),
        ],
      ),
    ),
  );

  const substitute = (value: unknown) =>
    files.has(value as string) ? files.get(value as string) : value;

  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [
      field,
      Array.isArray(value) ? value.map(substitute) : substitute(value),
    ]),
  );
}
