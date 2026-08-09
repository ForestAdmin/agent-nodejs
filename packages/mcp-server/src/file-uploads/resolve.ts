import type { ResolvedFileUploads } from './types';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import * as crypto from 'crypto';

import { UPLOADED_FILE_PREFIX, verifyUploadHandle } from './handles';

function isHandle(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(UPLOADED_FILE_PREFIX);
}

function collectHandles(values: Record<string, unknown>): Set<string> {
  const handles = new Set<string>();

  for (const value of Object.values(values)) {
    if (isHandle(value)) handles.add(value);
    else if (Array.isArray(value)) value.filter(isHandle).forEach(v => handles.add(v as string));
  }

  return handles;
}

async function loadAsDataUri(
  handle: string,
  userId: number | string,
  uploads: ResolvedFileUploads,
): Promise<string> {
  const claims = verifyUploadHandle(
    handle.slice(UPLOADED_FILE_PREFIX.length),
    userId,
    uploads.authSecret,
  );

  // A pre-authorized upload URL cannot always cap the object size, so the limit is
  // enforced here, before the bytes are read when the backend can report a size.
  const size = await uploads.storage.getSize?.(claims.key);

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

  // When the handle carries a sha256, re-verify the digest on the downloaded bytes. Even
  // if the upload URL leaked and someone overwrote the object, substituted content cannot
  // be redeemed.
  if (claims.sha256) {
    const digest = crypto.createHash('sha256').update(new Uint8Array(buffer)).digest('base64');

    if (digest !== claims.sha256) {
      throw new Error('Uploaded file does not match the sha256 it was pinned to');
    }
  }

  return `data:${claims.mimeType};name=${claims.name};base64,${buffer.toString('base64')}`;
}

/**
 * Replaces "$uploadedFile:<handle>" values in action form values with the uploaded
 * object re-encoded as the data URI the agent expects for File fields. The model only
 * ever exchanges the small handle. The base64 payload exists in memory here and in the
 * outbound call to the agent.
 *
 * Handles are resolved concurrently and deduplicated, so a handle referenced by several
 * fields is downloaded once.
 *
 * Only executeAction resolves handles. getActionForm echoes field values back to
 * the model, and a resolved data URI there would put the file content back into
 * the model's context.
 */
export default async function resolveUploadedFileValues(
  values: Record<string, unknown>,
  authInfo: AuthInfo | undefined,
  uploads: ResolvedFileUploads | undefined,
): Promise<Record<string, unknown>> {
  const handles = collectHandles(values);

  if (handles.size === 0) return values;

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

  const dataUris = new Map(
    await Promise.all(
      [...handles].map(
        async (handle): Promise<[string, string]> => [
          handle,
          await uploads.limitDownload(() => loadAsDataUri(handle, userId, uploads)),
        ],
      ),
    ),
  );

  const substitute = (value: unknown) => (isHandle(value) ? dataUris.get(value) : value);

  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [
      field,
      Array.isArray(value) ? value.map(substitute) : substitute(value),
    ]),
  );
}
