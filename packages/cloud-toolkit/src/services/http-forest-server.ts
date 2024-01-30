import { Table } from '@forestadmin/datasource-sql';
import axios from 'axios';

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
