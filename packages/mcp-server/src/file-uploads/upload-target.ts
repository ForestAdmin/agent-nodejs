import type { ResolvedFileUploads } from './types';

import * as crypto from 'crypto';

import { UPLOADED_FILE_PREFIX } from './file-reference';
import { signUploadHandle } from './handles';

const MIME_TYPE_PATTERN = /^[\w.+-]+\/[\w.+-]+$/;
const MAX_FILENAME_LENGTH = 128;

export interface UploadTarget {
  key: string;
  name: string;
  mimeType: string;
  sha256Base64?: string;
}

export function sanitizeFilename(filename: string): string {
  const safe = filename
    .trim()
    .slice(-MAX_FILENAME_LENGTH)
    .replace(/[^\p{L}\p{N}._\- ()]/gu, '_');

  return !safe || /^\.+$/.test(safe) ? 'file' : safe;
}

export function assertMediaType(mimeType: string): void {
  if (!MIME_TYPE_PATTERN.test(mimeType)) {
    throw new Error(
      `"${mimeType}" is not a media type. Expected a type/subtype pair, e.g. application/pdf.`,
    );
  }
}

export function requireUserId(
  authInfo: { extra?: Record<string, unknown> } | undefined,
): number | string {
  const userId = authInfo?.extra?.userId as number | string | undefined;

  if (userId === undefined || userId === null) {
    throw new Error('Cannot request a file upload without an authenticated user');
  }

  return userId;
}

export function requireFileUploads(
  fileUploads: ResolvedFileUploads | undefined,
): ResolvedFileUploads {
  if (!fileUploads) {
    throw new Error(
      'File uploads are not configured on this server. ' +
        'Ask the administrator to set the fileUploads option to enable action file fields.',
    );
  }

  return fileUploads;
}

export function createUploadTarget(
  fileUploads: ResolvedFileUploads,
  filename: string,
  mimeType: string,
  sha256Base64?: string,
): UploadTarget {
  const name = sanitizeFilename(filename);

  return {
    key: `${fileUploads.keyPrefix}${crypto.randomUUID()}/${name}`,
    name,
    mimeType,
    ...(sha256Base64 && { sha256Base64 }),
  };
}

export function issueFileHandle(
  target: UploadTarget,
  userId: number | string,
  fileUploads: ResolvedFileUploads,
): string {
  const handle = signUploadHandle(
    { ...target, userId },
    fileUploads.authSecret,
    fileUploads.handleTtlSeconds,
  );

  return `${UPLOADED_FILE_PREFIX}${handle}`;
}
