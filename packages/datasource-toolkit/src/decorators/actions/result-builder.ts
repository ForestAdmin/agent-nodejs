import { Readable } from 'stream';

import { ActionResult } from '../../interfaces/action';

export default class ResultBuilder {
  success(
    message?: string,
    options?: { type?: 'html' | 'text'; invalidated?: string[] },
  ): ActionResult {
    return {
      type: 'Success',
      message: message ?? 'Success',
      format: options?.type ?? 'text',
      invalidated: new Set(options?.invalidated ?? []),
    };
  }

  error(message?: string): ActionResult {
    return {
      type: 'Error',
      message: message ?? 'Error',
    };
  }

  webhook(
    url: string,
    method: 'GET' | 'POST' = 'POST',
    headers: Record<string, string> = {},
    body: unknown = {},
  ): ActionResult {
    return {
      type: 'Webhook',
      url,
      method,
      headers,
      body,
    };
  }

  file(
    streamOrBufferOrString: Readable | Uint8Array | string,
    name = 'file',
    mimeType = 'application/octet-stream',
  ): ActionResult {
    return {
      type: 'File',
      name,
      mimeType,
      stream:
        streamOrBufferOrString instanceof Readable
          ? streamOrBufferOrString
          : Readable.from([streamOrBufferOrString]),
    };
  }

  redirectTo(path: string): ActionResult {
    return { type: 'Redirect', path };
  }
}
