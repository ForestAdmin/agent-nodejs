import type { ResolvedFileUploads } from './types';
import type { Logger } from '../server';
import type { Request, Response, Router } from 'express';

import * as crypto from 'crypto';
import express from 'express';

import { UPLOADED_FILE_PREFIX } from './file-reference';
import { signUploadHandle } from './handles';

const MIME_TYPE_PATTERN = /^[\w.+-]+\/[\w.+-]+$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const SHA256_BASE64_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
const MAX_FILENAME_LENGTH = 128;

// The storage key delimits segments with '/', so keep a conservative charset. Truncation keeps
// the tail so the extension survives. A name made only of dots would let a backend that joins
// paths climb out of the per-upload directory.
function sanitizeFilename(filename: string): string {
  const safe = filename
    .trim()
    .slice(-MAX_FILENAME_LENGTH)
    .replace(/[^\w.\- ()]/g, '_');

  return /^\.+$/.test(safe) ? 'file' : safe;
}

// Accepts the digest as hex (shasum -a 256 output) or base64.
function normalizeSha256(sha256: unknown): string | null | false {
  if (sha256 === undefined || sha256 === null || sha256 === '') return null;
  if (typeof sha256 !== 'string') return false;
  if (SHA256_BASE64_PATTERN.test(sha256)) return sha256;
  if (SHA256_HEX_PATTERN.test(sha256)) return Buffer.from(sha256, 'hex').toString('base64');

  return false;
}

/**
 * Must be mounted behind requireBearerAuth so req.auth carries the caller's identity: the
 * returned handle is bound to that user and can only be redeemed by them.
 */
export default function createFilesRouter(uploads: ResolvedFileUploads, logger: Logger): Router {
  const router = express.Router();

  router.post('/', async (req: Request, res: Response) => {
    const userId = req.auth?.extra?.userId;

    if (userId === undefined || userId === null) {
      res.status(401).json({ error: 'Missing or invalid access token.' });

      return;
    }

    const { filename, mimeType, sha256 } = (req.body ?? {}) as Record<string, unknown>;

    if (typeof filename !== 'string' || !filename.trim()) {
      res.status(400).json({ error: 'filename is required.' });

      return;
    }

    if (typeof mimeType !== 'string' || !MIME_TYPE_PATTERN.test(mimeType)) {
      res.status(400).json({ error: 'mimeType is required, e.g. application/pdf.' });

      return;
    }

    const sha256Base64 = normalizeSha256(sha256);

    if (sha256Base64 === false) {
      res.status(400).json({ error: 'sha256 must be the file digest as hex or base64.' });

      return;
    }

    const safeName = sanitizeFilename(filename);
    const key = `${uploads.keyPrefix}${crypto.randomUUID()}/${safeName}`;

    const destination = await uploads.storage.createUploadUrl({
      key,
      mimeType,
      ...(sha256Base64 && { sha256: sha256Base64 }),
      expiresInSeconds: uploads.uploadUrlTtlSeconds,
    });

    const handle = signUploadHandle(
      {
        key,
        name: safeName,
        mimeType,
        userId: userId as number | string,
        ...(sha256Base64 && { sha256Base64 }),
      },
      uploads.authSecret,
      uploads.handleTtlSeconds,
    );

    res.json({
      uploadUrl: destination.url,
      method: destination.method ?? 'PUT',
      headers: destination.headers ?? { 'Content-Type': mimeType },
      expiresInSeconds: uploads.uploadUrlTtlSeconds,
      maxBytes: uploads.maxBytes,
      fileHandle: `${UPLOADED_FILE_PREFIX}${handle}`,
      usage:
        'Upload the raw file bytes to uploadUrl with the given method and headers, ' +
        'then pass fileHandle as the value of the action file field in executeAction. ' +
        'Provide sha256 in the request to pin the upload to that exact content.',
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- error handlers need arity 4
  router.use((error: Error, req: Request, res: Response, next: express.NextFunction) => {
    logger('Error', `/files error: ${error.message}`);
    if (error.stack) logger('Error', `Stack: ${error.stack}`);

    // The chain also carries requireBearerAuth, which answers by itself.
    if (res.headersSent) return;

    res.status(500).json({ error: 'Failed to create upload URL.' });
  });

  return router;
}
