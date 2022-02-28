import { Readable } from 'stream';

import { ActionResult, ActionResultType } from '../../interfaces/action';

export default class ResponseBuilder {
  success(
    message: string,
    options?: { type?: 'html' | 'text'; invalidated?: string[] },
  ): ActionResult {
    return {
      type: ActionResultType.Success,
      message: message ?? 'Success',
      format: options?.type ?? 'text',
      invalidated: new Set(options?.invalidated ?? []),
    };
  }

  error(message: string): ActionResult {
    return {
      type: ActionResultType.Error,
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
      type: ActionResultType.Webhook,
      url,
      method,
      headers,
      body,
    };
  }

  file(
    mimeType: string,
    name: string,
    streamOrBufferOrString: Readable | Uint8Array | string,
  ): ActionResult {
    return {
      type: ActionResultType.File,
      name,
      mimeType,
      stream:
        streamOrBufferOrString instanceof Readable
          ? streamOrBufferOrString
          : Readable.from([streamOrBufferOrString]),
    };
  }

  redirectTo(path: string): ActionResult {
    return { type: ActionResultType.Redirect, path };
  }
}
