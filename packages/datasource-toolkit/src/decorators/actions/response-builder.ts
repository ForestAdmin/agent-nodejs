import { Readable } from 'stream';

import { ActionResponse, ActionResponseType } from '../../interfaces/action';

export default class ResponseBuilder {
  private done: boolean;
  private response: ActionResponse;

  constructor(response: ActionResponse) {
    this.done = false;
    this.response = response;
  }

  success(message: string, options?: { type?: 'html' | 'text'; invalidated?: string[] }): void {
    this.checkNotDone();
    Object.assign(this.response, {
      type: ActionResponseType.Success,
      message: message ?? 'Success',
      format: options?.type ?? 'text',
      invalidated: new Set(options?.invalidated ?? []),
    });
  }

  error(message: string): void {
    this.checkNotDone();
    Object.assign(this.response, {
      type: ActionResponseType.Error,
      message: message ?? 'Error',
    });
  }

  webhook(
    url: string,
    method: 'GET' | 'POST' = 'POST',
    headers: unknown = {},
    body: unknown = {},
  ): void {
    this.checkNotDone();
    Object.assign(this.response, {
      type: ActionResponseType.Webhook,
      url,
      method,
      headers,
      body,
    });
  }

  file(
    mimeType: string,
    name: string,
    streamOrBufferOrString: Readable | Uint8Array | string,
  ): void {
    this.checkNotDone();
    Object.assign(this.response, {
      type: ActionResponseType.File,
      name,
      mimeType,
      stream:
        streamOrBufferOrString instanceof Readable
          ? streamOrBufferOrString
          : Readable.from([streamOrBufferOrString]),
    });
  }

  redirectTo(path: string): void {
    this.checkNotDone();
    Object.assign(this.response, { type: ActionResponseType.Redirect, path });
  }

  private checkNotDone() {
    if (this.done) {
      throw new Error(
        'success(), error(), webhook(), file() and redirectTo() can only be called once',
      );
    }

    this.done = true;
  }
}
