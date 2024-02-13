import { Table } from '@forestadmin/datasource-sql';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import * as fs from 'fs';

import { BusinessError } from '../errors';

async function handledAxios<T>(
  axiosRequestConfig: AxiosRequestConfig,
  { errorMessage }: { errorMessage: string },
): Promise<T> {
  try {
    return (await axios(axiosRequestConfig)).data;
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

export default class HttpServer {
  private readonly serverUrl: string;
  private readonly secretKey: string;
  private readonly bearerToken: string;
  constructor(serverUrl: string, secretKey: string, bearerToken: string) {
    this.serverUrl = serverUrl;
    this.secretKey = secretKey;
    this.bearerToken = bearerToken;
  }

  public static async downloadCloudCustomizerTemplate(destination: string) {
    const response = await axios({
      url: 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip',
      method: 'get',
      responseType: 'stream',
    });

    const stream: fs.WriteStream = fs.createWriteStream(destination);
    response.data.pipe(stream);

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
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
      { errorMessage: `Failed to retrieve last published code details` },
    );
  }
}
