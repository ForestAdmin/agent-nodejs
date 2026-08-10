import type { FileReference } from './file-reference';
import type { ResolvedFileUploads } from './types';
import type { File } from '@forestadmin/agent-client';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import * as crypto from 'crypto';

import parseFileReference from './file-reference';
import { verifyUploadHandle } from './handles';

// Keyed by reference so one used by several fields is downloaded once; the value is the first
// field that mentioned it, which is what error messages name.
function collectReferences(values: Record<string, unknown>): Map<string, string> {
  const references = new Map<string, string>();

  for (const [field, value] of Object.entries(values)) {
    const candidates = Array.isArray(value) ? value : [value];

    candidates.forEach(candidate => {
      if (parseFileReference(candidate) && !references.has(candidate as string)) {
        references.set(candidate as string, field);
      }
    });
  }

  return references;
}

async function download(
  field: string,
  reference: FileReference,
  claims: ReturnType<typeof verifyUploadHandle>,
  uploads: ResolvedFileUploads,
): Promise<File> {
  const tooLarge = (bytes: number) =>
    new Error(
      `Field "${field}": uploaded file is ${bytes} bytes, above the ${uploads.maxBytes} byte limit`,
    );

  // A pre-authorized upload URL cannot always cap the object size, so the limit is enforced
  // here, before the bytes are read whenever the backend can report a size.
  const size = await uploads.storage.getSize(claims.key);

  if (typeof size === 'number' && Number.isFinite(size) && size > uploads.maxBytes) {
    throw tooLarge(size);
  }

  const buffer = await uploads.storage.download(claims.key);

  if (buffer.length === 0) {
    throw new Error(
      `Field "${field}": uploaded file is empty. Did the upload to uploadUrl succeed?`,
    );
  }

  // Re-checked after download because getSize is advisory, and because the object can be
  // replaced between the two calls.
  if (buffer.length > uploads.maxBytes) throw tooLarge(buffer.length);

  // Even if the upload URL leaked and someone overwrote the object, content substituted after
  // the client pinned a digest cannot be redeemed.
  if (claims.sha256Base64) {
    const digest = crypto.createHash('sha256').update(new Uint8Array(buffer)).digest('base64');

    if (digest !== claims.sha256Base64) {
      throw new Error(`Field "${field}": uploaded file does not match the sha256 it was pinned to`);
    }
  }

  return { buffer, mimeType: claims.mimeType, name: claims.name };
}

/**
 * Only executeAction resolves references. getActionForm echoes field values back to the model,
 * and a resolved file there would put the content back into the model's context.
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

  // Verified before acquiring a download slot: it is pure CPU, and it gates everything
  // expensive, so a batch of forged handles is rejected instead of queueing behind the limit.
  const verified = [...references].map(([reference, field]) => {
    const parsed = parseFileReference(reference);

    if (parsed.kind !== 'uploadHandle') {
      throw new Error(`Field "${field}": unsupported file reference`);
    }

    return {
      field,
      reference,
      parsed,
      claims: verifyUploadHandle(parsed.handle, userId, uploads.authSecret),
    };
  });

  const files = new Map(
    await Promise.all(
      verified.map(
        async ({ field, reference, parsed, claims }): Promise<[string, File]> => [
          reference,
          await uploads.limitDownload(() => download(field, parsed, claims, uploads)),
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
