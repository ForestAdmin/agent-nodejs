import { Table } from '@forestadmin/datasource-sql';
import * as axios from 'axios';
import * as fs from 'fs';

import latestVersion from './latest-version';
import { BusinessError, ValidationError } from '../errors';
import { CodeCustomizationDetails, Log } from '../types';

async function handledAxios<T>(
  axiosRequestConfig: axios.AxiosRequestConfig,
  { errorMessage }: { errorMessage: string },
): Promise<T> {
  try {
    return (await axios.default(axiosRequestConfig)).data;
  } catch (e) {
    const error: Error = e;
    let details = '';

    if (error instanceof axios.AxiosError) {
      const errors: { detail: string; status: number }[] = error.response?.data?.errors;
      details = errors?.map(innerError => `🚨 ${innerError.detail}`).join(`\n`);
    }

    if (e.response?.status === 400) {
      throw new ValidationError(details);
    } else {
      const baseMessage = `${errorMessage}: ${error.message}\n${details}`.trim();

      if (e.response?.status === 401 || e.response?.status === 403) {
        const loginMessage =
          " You can try to login again by running 'npx @forestadmin/forest-cloud@latest login'";
        throw new BusinessError(`${baseMessage}\n${loginMessage}`);
      }

      throw new BusinessError(baseMessage);
    }
  }
}

export default class HttpServer {
  private readonly serverUrl: string;
  private readonly headers: object;
  constructor(serverUrl: string, secretKey: string, bearerToken: string) {
    this.serverUrl = serverUrl;
    this.headers = {
      'forest-secret-key': secretKey,
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    };
  }

  public static async downloadCloudCustomizerTemplate(destination: string) {
    const response = await axios.default({
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
        headers: this.headers,
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
        headers: this.headers,
        data: { contentLength },
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
        headers: this.headers,
      },
      {
        errorMessage: 'Failed to request publication of code customization',
      },
    );
  }

  async getLastPublishedCodeDetails(): Promise<CodeCustomizationDetails> {
    return handledAxios<CodeCustomizationDetails | null>(
      {
        url: `${this.serverUrl}/api/full-hosted-agent/last-published-code-details`,
        method: 'GET',
        headers: this.headers,
      },
      { errorMessage: `Failed to retrieve last published code details` },
    );
  }

  async getLogs({
    limit,
    from,
    to,
    orderByRecentFirst,
  }: {
    limit: number;
    from: string;
    to: string;
    orderByRecentFirst: boolean;
  }): Promise<Log[]> {
    const base = `${this.serverUrl}/api/full-hosted-agent/logs`;

    return (
      await handledAxios<{ logs: Log[] }>(
        {
          // eslint-disable-next-line max-len
          url: `${base}?limit=${limit}&from=${from}&to=${to}&order-by-recent-first=${orderByRecentFirst}`,
          method: 'GET',
          headers: this.headers,
        },
        { errorMessage: `Failed to retrieve logs` },
      )
    ).logs;
  }

  static async getLatestVersion(packageName: string): Promise<string> {
    return latestVersion(packageName);
  }
}
