import type { RunExclusive } from './semaphore';
import type { Logger } from '../server';

import createSemaphore from './semaphore';

/** Storage backend for the action file upload side-channel. See the README for the flow. */
export interface UploadStorage {
  /** The URL must be reachable by the MCP client, which is what uploads the bytes. */
  createUploadUrl(params: {
    key: string;
    mimeType: string;
    /** Advisory: the server re-verifies the digest after download regardless. */
    sha256?: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; method?: string; headers?: Record<string, string> }>;

  /** Must reject when the object does not exist. */
  download(key: string): Promise<Buffer>;

  /**
   * Size of the uploaded object, used to reject oversized uploads before downloading them.
   * Return undefined when the backend cannot report it cheaply — `maxBytes` is then only
   * enforced after the bytes are in memory, so the process holds the whole object either way.
   */
  getSize(key: string): Promise<number | undefined>;
}

/**
 * @experimental The MCP specification is still designing its own file transfer story
 * (SEP-2631). The storage contract is expected to survive, but the `requestFileUpload` tool
 * and the handle format may change to follow the specification once it lands.
 */
export interface FileUploadsOptions {
  storage: UploadStorage;
  keyPrefix?: string;
  uploadUrlTtlSeconds?: number;
  /** Must stay longer than uploadUrlTtlSeconds, so a slow upload leaves time to run the action. */
  handleTtlSeconds?: number;
  maxBytes?: number;
  maxConcurrentDownloads?: number;
  /**
   * How long a single storage read may take. Keep it well under the request timeout of the
   * clients calling the agent, so a slow backend fails here rather than being cut mid-flight.
   * Defaults to 15 seconds.
   */
  downloadTimeoutSeconds?: number;
}

export interface ResolvedFileUploads {
  storage: UploadStorage;
  keyPrefix: string;
  uploadUrlTtlSeconds: number;
  handleTtlSeconds: number;
  maxBytes: number;
  downloadTimeoutSeconds: number;
  authSecret: string;
  limitDownload: RunExclusive;
}

const DEFAULT_KEY_PREFIX = 'mcp-uploads/';
const DEFAULT_UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DEFAULT_HANDLE_TTL_SECONDS = 45 * 60;
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 5;
const DEFAULT_DOWNLOAD_TIMEOUT_SECONDS = 15;

function positiveInteger(field: keyof FileUploadsOptions, value: number | undefined): number {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid fileUploads.${field} "${value}": it must be a positive integer.`);
  }

  return value;
}

export function resolveFileUploads(
  options: FileUploadsOptions | undefined,
  authSecret: string,
  logger?: Logger,
): ResolvedFileUploads | undefined {
  if (!options) return undefined;

  if (!options.storage) throw new Error('fileUploads.storage is required.');

  const uploadUrlTtlSeconds =
    positiveInteger('uploadUrlTtlSeconds', options.uploadUrlTtlSeconds) ??
    DEFAULT_UPLOAD_URL_TTL_SECONDS;
  const handleTtlSeconds =
    positiveInteger('handleTtlSeconds', options.handleTtlSeconds) ?? DEFAULT_HANDLE_TTL_SECONDS;

  // A handle expiring before its upload URL means uploads succeed and every redemption then
  // fails with a bare "jwt expired".
  if (handleTtlSeconds <= uploadUrlTtlSeconds) {
    logger?.(
      'Warn',
      `fileUploads.handleTtlSeconds=${handleTtlSeconds} is shorter than ` +
        `fileUploads.uploadUrlTtlSeconds=${uploadUrlTtlSeconds}: a slow upload will finish with ` +
        'an already expired handle.',
    );
  }

  return {
    storage: options.storage,
    keyPrefix: options.keyPrefix ?? DEFAULT_KEY_PREFIX,
    uploadUrlTtlSeconds,
    handleTtlSeconds,
    maxBytes: positiveInteger('maxBytes', options.maxBytes) ?? DEFAULT_MAX_BYTES,
    downloadTimeoutSeconds:
      positiveInteger('downloadTimeoutSeconds', options.downloadTimeoutSeconds) ??
      DEFAULT_DOWNLOAD_TIMEOUT_SECONDS,
    authSecret,
    limitDownload: createSemaphore(
      positiveInteger('maxConcurrentDownloads', options.maxConcurrentDownloads) ??
        DEFAULT_MAX_CONCURRENT_DOWNLOADS,
    ),
  };
}
