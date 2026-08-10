import type { RunExclusive } from './semaphore';

import createSemaphore from './semaphore';

/**
 * Storage backend for the action file upload side-channel.
 *
 * Implementations are provided by the host application (S3, GCS, Azure...). The MCP server
 * never sees the file bytes during upload: clients PUT them straight to the URL returned by
 * createUploadUrl, and the server only reads them back when an executeAction call redeems
 * the handle.
 */
export interface UploadStorage {
  /** Return a pre-authorized URL the client can upload a single object to. */
  createUploadUrl(params: {
    key: string;
    mimeType: string;
    /** Base64 sha256 digest the upload must match, when the client pinned one. */
    sha256?: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; method?: string; headers?: Record<string, string> }>;

  /** Read the uploaded object back. Must reject when the object does not exist. */
  download(key: string): Promise<Buffer>;

  /**
   * Size of the uploaded object, used to reject oversized uploads before downloading them.
   * Return undefined when the backend cannot report it cheaply — `maxBytes` is then only
   * enforced after the bytes are in memory, so the process holds the whole object either way.
   */
  getSize(key: string): Promise<number | undefined>;
}

/**
 * Options for the `fileUploads` server option.
 *
 * @experimental The MCP specification is still designing its own file transfer story
 * (SEP-2631). The storage contract is expected to survive, but the `POST /files` route and
 * the handle format may change to follow the specification once it lands.
 */
export interface FileUploadsOptions {
  storage: UploadStorage;
  /** Key prefix for uploaded objects. Defaults to 'mcp-uploads/'. */
  keyPrefix?: string;
  /** Lifetime of the upload URL. Defaults to 15 minutes. */
  uploadUrlTtlSeconds?: number;
  /**
   * Lifetime of the file handle. Defaults to 45 minutes, longer than the upload URL, so a
   * slow upload still leaves time to run the action.
   */
  handleTtlSeconds?: number;
  /** Maximum uploaded file size, enforced when the handle is redeemed. Defaults to 20 MiB. */
  maxBytes?: number;
  /**
   * Maximum handle redemptions running at once per process. Each redemption may hold up to
   * maxBytes plus its base64 copy in memory, so this bounds the worst case. Defaults to 5.
   */
  maxConcurrentDownloads?: number;
}

export interface ResolvedFileUploads {
  storage: UploadStorage;
  keyPrefix: string;
  uploadUrlTtlSeconds: number;
  handleTtlSeconds: number;
  maxBytes: number;
  authSecret: string;
  limitDownload: RunExclusive;
}

const DEFAULT_KEY_PREFIX = 'mcp-uploads/';
const DEFAULT_UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DEFAULT_HANDLE_TTL_SECONDS = 45 * 60;
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 5;

export function resolveFileUploads(
  options: FileUploadsOptions | undefined,
  authSecret: string,
): ResolvedFileUploads | undefined {
  if (!options) return undefined;

  return {
    storage: options.storage,
    keyPrefix: options.keyPrefix ?? DEFAULT_KEY_PREFIX,
    uploadUrlTtlSeconds: options.uploadUrlTtlSeconds ?? DEFAULT_UPLOAD_URL_TTL_SECONDS,
    handleTtlSeconds: options.handleTtlSeconds ?? DEFAULT_HANDLE_TTL_SECONDS,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    authSecret,
    limitDownload: createSemaphore(
      options.maxConcurrentDownloads ?? DEFAULT_MAX_CONCURRENT_DOWNLOADS,
    ),
  };
}
