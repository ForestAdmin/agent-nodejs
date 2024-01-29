import { Table } from '@forestadmin/datasource-sql';
import axios from 'axios';

export default class HttpForestServer {
  private readonly serverUrl: string | undefined;
  private readonly secretKey: string | undefined;
  private readonly bearerToken: string | undefined;
  constructor(
    serverUrl: string | undefined,
    secretKey: string | undefined,
    bearerToken: string | undefined,
  ) {
    this.serverUrl = serverUrl || 'https://api.forestadmin.com';
    this.secretKey = secretKey;
    this.bearerToken = bearerToken;
  }

  async getIntrospection(): Promise<Table[]> {
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
      throw new Error(`Fails to retrieve introspection`);
    }

    return response.data;
  }
}
