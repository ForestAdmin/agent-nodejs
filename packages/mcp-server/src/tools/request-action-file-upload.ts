import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import * as crypto from 'crypto';
import { z } from 'zod';

import { UPLOADED_FILE_PREFIX } from '../file-uploads/file-reference';
import { signUploadHandle } from '../file-uploads/handles';
import registerToolWithLogging from '../utils/tool-with-logging';

const MIME_TYPE_PATTERN = /^[\w.+-]+\/[\w.+-]+$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const SHA256_BASE64_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
const MAX_FILENAME_LENGTH = 128;
const REQUIRED_SCOPE = 'mcp:action';

// Names the requirement rather than a menu path: the setting that satisfies it is not in the same
// place in every client, and on a managed workspace the end user may have no access to it at all.
const UPLOAD_PREREQUISITE =
  'Uploading requires an outbound HTTP request from your environment. A hosted code execution ' +
  'sandbox runs on its own network and reaches only allowed hosts, so the host of uploadUrl must ' +
  'be publicly reachable — a localhost or private address never is from there — and allowed for ' +
  'outbound traffic in that environment. Where that is configured depends on the client, and on a ' +
  'managed workspace it may be an administrator setting rather than a user one. A blocked or ' +
  'unreachable request is a client configuration issue, not an expired handle: report it as such ' +
  'instead of requesting another destination.';

interface RequestActionFileUploadArgument {
  filename: string;
  mimeType: string;
  sha256?: string;
}

// The storage key delimits segments with '/', so keep a conservative charset. Truncation keeps
// the tail so the extension survives. A name made only of dots would let a backend that joins
// paths climb out of the per-upload directory.
function sanitizeFilename(filename: string): string {
  const safe = filename
    .trim()
    .slice(-MAX_FILENAME_LENGTH)
    // Unicode-aware: ASCII \w turns `facture-été.pdf` into `facture-_t_.pdf`, so the accented
    // letters vanish while the spaces and parentheses survive. Same key safety, no `/`.
    .replace(/[^\p{L}\p{N}._\- ()]/gu, '_');

  return !safe || /^\.+$/.test(safe) ? 'file' : safe;
}

function normalizeSha256(sha256: string | undefined): string | undefined {
  if (!sha256) return undefined;
  if (SHA256_BASE64_PATTERN.test(sha256)) return sha256;
  if (SHA256_HEX_PATTERN.test(sha256)) return Buffer.from(sha256, 'hex').toString('base64');

  throw new Error('sha256 must be the file digest as hex or base64.');
}

export default function declareRequestActionFileUploadTool(
  mcpServer: McpServer,
  ctx: ToolContext,
): string {
  const { logger, fileUploads } = ctx;

  return registerToolWithLogging(
    mcpServer,
    'requestActionFileUpload',
    {
      title: 'Request an upload destination for an action file field',
      description: `Get a destination to upload a file to, then reference it in an action form field.

Call this whenever getActionForm shows a field of type "File" or "FileList". Never inline base64 file content as a field value: it would be far larger than any payload limit.

Workflow:
1. Compute the file's sha256 and call this tool with the filename, mimeType and sha256. The digest pins the destination to that exact content — without it, on some backends anyone who reads the upload url in a log can replace the bytes before the action runs. Skip it only when you cannot compute a digest.
2. Upload the raw bytes to the returned uploadUrl, with the returned method and every returned header. Some backends sign a pinned sha256 into a checksum header and reject the upload without it, so apply the headers as returned rather than assuming which ones matter. A pinned digest is re-verified when the action runs either way. The bytes must not pass through this tool or through your own output.
3. Pass the returned fileHandle string as the value of the file field in executeAction.

${UPLOAD_PREREQUISITE}

The url accepts one upload: to send different bytes, call this tool again for a fresh destination. The handle expires too, so run the upload and the action without a long pause in between.`,
      inputSchema: {
        filename: z
          .string()
          .trim()
          .min(1)
          .describe('Original file name, e.g. "invoice-2026-01.pdf".'),
        mimeType: z.string().describe('Media type of the file, e.g. "application/pdf".'),
        sha256: z
          .string()
          .optional()
          .describe(
            'Sha256 digest of the file, hex or base64. Pins the destination to that exact ' +
              'content; compute it and pass it whenever you can.',
          ),
      },
    },
    async (options: RequestActionFileUploadArgument, extra) => {
      if (!fileUploads) {
        throw new Error(
          'File uploads are not configured on this server. ' +
            'Ask the administrator to set the fileUploads option to enable action file fields.',
        );
      }

      const userId = extra.authInfo?.extra?.userId as number | string | undefined;

      if (userId === undefined || userId === null) {
        throw new Error('Cannot request a file upload without an authenticated user');
      }

      // /mcp only requires mcp:read, but this mints a pre-authorized write into the host's
      // storage. The route this tool replaced enforced mcp:action, so it is enforced here.
      if (!extra.authInfo?.scopes?.includes(REQUIRED_SCOPE)) {
        throw new Error(`Requesting a file upload requires the "${REQUIRED_SCOPE}" scope.`);
      }

      if (!MIME_TYPE_PATTERN.test(options.mimeType)) {
        throw new Error(
          `"${options.mimeType}" is not a media type. Expected a type/subtype pair, e.g. application/pdf.`,
        );
      }

      const sha256Base64 = normalizeSha256(options.sha256);
      const safeName = sanitizeFilename(options.filename);
      const key = `${fileUploads.keyPrefix}${crypto.randomUUID()}/${safeName}`;

      const destination = await fileUploads.storage.createUploadUrl({
        key,
        mimeType: options.mimeType,
        ...(sha256Base64 && { sha256: sha256Base64 }),
        expiresInSeconds: fileUploads.uploadUrlTtlSeconds,
      });

      const handle = signUploadHandle(
        {
          key,
          name: safeName,
          mimeType: options.mimeType,
          userId,
          ...(sha256Base64 && { sha256Base64 }),
        },
        fileUploads.authSecret,
        fileUploads.handleTtlSeconds,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              uploadUrl: destination.url,
              method: destination.method ?? 'PUT',
              headers: destination.headers ?? { 'Content-Type': options.mimeType },
              expiresInSeconds: fileUploads.uploadUrlTtlSeconds,
              maxBytes: fileUploads.maxBytes,
              fileHandle: `${UPLOADED_FILE_PREFIX}${handle}`,
              // Repeated in the response so the model has the diagnosis in context at the moment
              // its upload fails, not only when it first read the tool description.
              prerequisite: UPLOAD_PREREQUISITE,
            }),
          },
        ],
      };
    },
    logger,
  );
}
