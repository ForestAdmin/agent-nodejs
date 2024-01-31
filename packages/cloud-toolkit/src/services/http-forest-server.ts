import { Table } from '@forestadmin/datasource-sql';
import axios, { AxiosError } from 'axios';

import { BusinessError } from '../errors';

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
    try {
      const response = await axios({
        url: `${this.serverUrl}/api/full-hosted-agent/introspection`,
        method: 'GET',
        headers: {
          'forest-secret-key': this.secretKey,
          Authorization: `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status !== 200) {
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

      throw new BusinessError(
        `Failed to retrieve database schema from Forest Admin server: ${error.message}.${details}`,
      );
    }
  }
}
