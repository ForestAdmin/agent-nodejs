import { Readable } from 'stream';

import { ActionResult } from '../../interfaces/action';

export default class ResultBuilder {
  /**
   * Returns a success response from the action
   * @param message the success message to return
   * @param options available options to return
   * @example
   * .success('<blinkee>Success!</blinkee>', { type: 'html' });
   */
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

  /**
   * Returns an error response from the action
   * @param message the error message to return
   * @param html the html content to display
   * @example
   * .error('Failed to refund the customer!');
   */
  error(message?: string, html?: string): ActionResult {
    return {
      type: 'Error',
      message: message ?? 'Error',
      html,
    };
  }

  /**
   * Returns a webhook that the UI will trigger
   * @param url the url of the webhook
   * @param method the HTTP method of the webhook
   * @param headers an object representing the list of headers to send with the webhook
   * @param body an object representing the body of the HTTP request
   * @example
   * .webhook('http://my-company-name', 'POST', {}, { adminToken: 'my-admin-token' });
   */
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

  /**
   * Returns a file that will be downloaded
   * @param streamOrBufferOrString the actual file to download
   * @param name the name of the file
   * @param mimeType the mime type of the file
   * @example
   * .file('This is my file content', 'download.txt', 'text/plain');
   */
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

  /**
   * Returns to the UI that a redirection is needed
   * @param path the path to redirect to
   * @example
   * .redirectTo('https://www.google.com');
   */
  redirectTo(path: string): ActionResult {
    return { type: 'Redirect', path };
  }
}
