import type { ResolvedFileUploads } from '../file-uploads/types';
import type { UploadTarget } from '../file-uploads/upload-target';
import type { Logger } from '../server';
import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import * as crypto from 'crypto';
import { z } from 'zod';

import EphemeralStorage from '../file-uploads/ephemeral-storage';
import {
  assertMediaType,
  createUploadTarget,
  issueFileHandle,
  requireFileUploads,
  requireUserId,
} from '../file-uploads/upload-target';
import registerToolWithLogging from '../utils/tool-with-logging';

export const UPLOAD_ACTION_FILE_TOOL = 'uploadActionFile';

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const BASE64_BLOCK_LENGTH = 4;
const BYTES_PER_BASE64_BLOCK = 3;
const MILLISECONDS_PER_SECOND = 1000;

interface UploadActionFileArgument {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export function maxBase64Length(maxBytes: number): number {
  return Math.ceil(maxBytes / BYTES_PER_BASE64_BLOCK) * BASE64_BLOCK_LENGTH;
}

function decodedLength(contentBase64: string): number {
  if (contentBase64.length % BASE64_BLOCK_LENGTH !== 0 || !BASE64_PATTERN.test(contentBase64)) {
    throw new Error('contentBase64 must be the file content in standard base64, without a prefix.');
  }

  const padding = contentBase64.endsWith('==') ? 2 : Number(contentBase64.endsWith('='));

  return (contentBase64.length / BASE64_BLOCK_LENGTH) * BYTES_PER_BASE64_BLOCK - padding;
}

function decodeWithinLimit(contentBase64: string, maxBytes: number): Buffer {
  if (contentBase64.length > maxBase64Length(maxBytes)) {
    throw new Error(`The file is above the ${maxBytes} byte limit.`);
  }

  const size = decodedLength(contentBase64);

  if (size > maxBytes) {
    throw new Error(`The file is ${size} bytes, above the ${maxBytes} byte limit.`);
  }

  return Buffer.from(contentBase64, 'base64');
}

async function putToRemoteStorage(
  fileUploads: ResolvedFileUploads,
  target: UploadTarget,
  body: Buffer,
): Promise<void> {
  const destination = await fileUploads.storage.createUploadUrl({
    key: target.key,
    mimeType: target.mimeType,
    sha256: target.sha256Base64,
    expiresInSeconds: fileUploads.uploadUrlTtlSeconds,
  });

  const response = await fetch(destination.url, {
    method: destination.method ?? 'PUT',
    headers: destination.headers ?? { 'Content-Type': target.mimeType },
    body: new Uint8Array(body),
    redirect: 'error',
    signal: AbortSignal.timeout(fileUploads.downloadTimeoutSeconds * MILLISECONDS_PER_SECOND),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function putToStorage(
  fileUploads: ResolvedFileUploads,
  target: UploadTarget,
  body: Buffer,
  logger: Logger,
): Promise<void> {
  const { storage } = fileUploads;

  if (storage instanceof EphemeralStorage) {
    await storage.createUploadUrl({ key: target.key });

    try {
      storage.put(target.key, body);
    } catch (error) {
      throw new Error(`Could not store the file: ${(error as Error).message}`);
    }

    return;
  }

  try {
    await putToRemoteStorage(fileUploads, target, body);
  } catch (error) {
    logger(
      'Warn',
      `[fileUploads] uploadActionFile could not store ${target.key}: ${(error as Error).message}`,
    );
    throw new Error('Could not store the file: the storage backend refused it or did not answer.');
  }
}

async function uploadActionFile(
  options: UploadActionFileArgument,
  fileUploads: ResolvedFileUploads,
  userId: number | string,
  logger: Logger,
): Promise<{ fileHandle: string; name: string; mimeType: string; size: number }> {
  assertMediaType(options.mimeType);

  const body = decodeWithinLimit(options.contentBase64, fileUploads.maxBytes);
  const sha256Base64 = crypto.createHash('sha256').update(new Uint8Array(body)).digest('base64');
  const target = createUploadTarget(fileUploads, options.filename, options.mimeType, sha256Base64);

  await putToStorage(fileUploads, target, body, logger);

  return {
    fileHandle: issueFileHandle(target, userId, fileUploads),
    name: target.name,
    mimeType: target.mimeType,
    size: body.length,
  };
}

export default function declareUploadActionFileTool(
  mcpServer: McpServer,
  ctx: ToolContext,
): string {
  return registerToolWithLogging(
    mcpServer,
    UPLOAD_ACTION_FILE_TOOL,
    {
      title: 'Upload a file for an action form field',
      description:
        'Called by the Forest Admin records view only, never by the model: models use ' +
        'requestActionFileUpload. Stores the base64 file content and returns a fileHandle to ' +
        'pass as the value of a File or FileList field in executeAction.',
      inputSchema: {
        filename: z.string().trim().min(1).describe('Original file name.'),
        mimeType: z.string().describe('Media type of the file, e.g. "application/pdf".'),
        contentBase64: (ctx.fileUploads
          ? z.string().max(maxBase64Length(ctx.fileUploads.maxBytes))
          : z.string()
        ).describe('File content, standard base64 without a prefix.'),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async (options: UploadActionFileArgument, extra) => {
      const fileUploads = requireFileUploads(ctx.fileUploads);
      const userId = requireUserId(extra.authInfo);
      const result = await fileUploads.limitUploadPerUser(String(userId), () =>
        uploadActionFile(options, fileUploads, userId, ctx.logger),
      );

      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
    ctx.logger,
  );
}
