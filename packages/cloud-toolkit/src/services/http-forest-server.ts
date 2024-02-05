import { Table } from '@forestadmin/datasource-sql';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

import { BusinessError } from '../errors';

async function handledAxios<T>(
  axiosRequestConfig: AxiosRequestConfig,
  { errorMessage }: { errorMessage: string },
): Promise<T> {
  try {
    const response = await axios(axiosRequestConfig);

    if (response.status < 400) {
      throw new BusinessError(
        `Expected 200 OK, received ${response.status} ${response.statusText}`,
      );
    }

    return response.data;
  } catch (e) {
    const error: Error = e;

    let details;

    if (error instanceof AxiosError) {
      const errors: { detail: string; status: number }[] = error.response?.data?.errors;
      details = errors?.map(innerError => `\n 🚨 ${innerError.detail}`);
    }

    const detailsOrEmpty = details ? `. ${details}` : '';
    throw new BusinessError(`${errorMessage}: ${error.message}${detailsOrEmpty}`);
  }
}

export default class HttpForestServer {
  private readonly serverUrl: string;
  private readonly secretKey: string;
  private readonly bearerToken: string;
  constructor(serverUrl: string, secretKey: string, bearerToken: string) {
    this.serverUrl = serverUrl;
    this.secretKey = secretKey;
    this.bearerToken = bearerToken;
  }

  async getIntrospection(): Promise<Table[]> {
    return handledAxios(
      {
        url: `${this.serverUrl}/api/full-hosted-agent/introspection`,
        method: 'GET',
        headers: {
          'forest-secret-key': this.secretKey,
          Authorization: `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      },
      {
        errorMessage: 'Failed to retrieve database schema from Forest Admin server',
      },
    );
  }

  async postUploadRequest(contentLength: number) {
    return handledAxios<{
      url: string;
      fields: Record<string, string>;
    }>(
      {
        url: `${this.serverUrl}/api/full-hosted-agent/upload-request`,
        method: 'POST',
        headers: {
          'forest-secret-key': this.secretKey,
          Authorization: `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          contentLength,
        },
      },
      {
        errorMessage: 'Failed to request upload url from Forest Admin server',
      },
    );
  }

  async postPublish() {
    return handledAxios<{ subscriptionId: string }>(
      {
        url: `${this.serverUrl}/api/full-hosted-agent/publish`,
        method: 'POST',
        headers: {
          'forest-secret-key': this.secretKey,
          Authorization: `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      },
      {
        errorMessage: 'Failed to request publication of code customization',
      },
    );
  }

  async getLastPublishedCodeDetails() {
    return handledAxios<{
      date: Date;
      relativeDate: string;
      user: { name: string; email: string };
    } | null>(
      {
        url: `${this.serverUrl}/api/full-hosted-agent/last-published-code-details`,
        method: 'GET',
        headers: {
          'forest-secret-key': this.secretKey,
          Authorization: `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      },
      { errorMessage: `Failed to retrieve last published code details.` },
    );
  }
}
