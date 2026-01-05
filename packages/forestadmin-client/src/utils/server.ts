import type { ForestAdminClientOptionsWithDefaults } from '../types';
import type { ResponseError } from 'superagent';

import superagent from 'superagent';

import { ForbiddenError } from '..';

type HttpOptions = Pick<ForestAdminClientOptionsWithDefaults, 'envSecret' | 'forestServerUrl'>;

type BearerHttpOptions = Pick<ForestAdminClientOptionsWithDefaults, 'forestServerUrl'>;

type QueryWithBearerTokenOptions = {
  forestServerUrl: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  bearerToken: string;
  headers?: Record<string, string>;
  body?: string | object;
  maxTimeAllowed?: number;
};

export default class ServerUtils {
  /** Query Forest-Admin server */
  static async query<T = unknown>(
    options: HttpOptions,
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    headers: Record<string, string> = {},
    body?: string | object,
    maxTimeAllowed = 10000, // Set a default value if not provided
  ): Promise<T> {
    return this.queryWithHeaders(
      options,
      method,
      path,
      { 'forest-secret-key': options.envSecret, ...headers },
      body,
      maxTimeAllowed,
    );
  }

  /** Query Forest-Admin server with Bearer token authentication */
  static async queryWithBearerToken<T = unknown>(
    options: QueryWithBearerTokenOptions,
  ): Promise<T> {
    const { forestServerUrl, method, path, bearerToken, headers = {}, body, maxTimeAllowed } =
      options;

    return this.queryWithHeaders(
      { forestServerUrl },
      method,
      path,
      { Authorization: `Bearer ${bearerToken}`, ...headers },
      body,
      maxTimeAllowed,
    );
  }

  /** Internal method to query with arbitrary headers */
  private static async queryWithHeaders<T = unknown>(
    options: BearerHttpOptions,
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    headers: Record<string, string>,
    body?: string | object,
    maxTimeAllowed = 10000,
  ): Promise<T> {
    let url;

    try {
      url = new URL(path, options.forestServerUrl).toString();
      const request = superagent[method](url).timeout(maxTimeAllowed);

      if (headers) request.set(headers);

      const response = await request.send(body);

      return response.body;
    } catch (error) {
      if (error.timeout) {
        throw new Error(
          `The request to Forest Admin server has timed out while trying to reach ${url} at ${new Date().toISOString()}. Message: ${
            error.message
          }`,
        );
      }

      this.handleResponseError(error);
    }
  }

  private static handleResponseError(e: Error): void {
    if (/certificate/i.test(e.message)) {
      throw new Error(
        'Forest Admin server TLS certificate cannot be verified. ' +
          'Please check that your system time is set properly. ' +
          `Original error: ${e.message}`,
      );
    }

    if ((e as ResponseError).response) {
      const status = (e as ResponseError)?.response?.status;
      const message = (e as ResponseError)?.response?.body?.errors?.[0]?.detail;

      // 0 == offline, 502 == bad gateway from proxy
      if (status === 0 || status === 502) {
        throw new Error('Failed to reach Forest Admin server. Are you online?');
      }

      if (status === 403) {
        throw new ForbiddenError(message);
      }

      if (status === 404) {
        throw new Error(
          '[404] Forest Admin server failed to find the' +
            ' project related to the envSecret you configured.' +
            ' Can you check that you copied it properly in the Forest initialization?',
        );
      }

      if (status === 503) {
        throw new Error(
          'Forest is in maintenance for a few minutes. We are upgrading your experience in ' +
            'the forest. We just need a few more minutes to get it right.',
        );
      }

      // If the server has something to say about the error, we display it.
      if (message) throw new Error(message);

      throw new Error(
        'An unexpected error occurred while contacting the Forest Admin server. ' +
          'Please contact support@forestadmin.com for further investigations.',
      );
    }

    throw e;
  }
}
