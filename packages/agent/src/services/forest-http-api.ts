import superagent, { Response } from 'superagent';
import { IpRange } from '../types';

export default class ForestHttpApi {
  private readonly forestServerUrl: string;
  private readonly envSecret: string;

  constructor(forestServerUrl: string, envSecret: string) {
    if (!forestServerUrl || !envSecret) {
      throw new Error(
        `forestServerUrl: ${forestServerUrl} and envSecret ${envSecret} must be present.`,
      );
    }

    this.forestServerUrl = forestServerUrl;
    this.envSecret = envSecret;
  }

  async getIpWhitelist(): Promise<{
    isFeatureEnabled: boolean;
    ipRanges: Array<IpRange>;
  }> {
    try {
      const response: Response = await superagent
        .get(`${this.forestServerUrl}/liana/v1/ip-whitelist-rules`)
        .set('forest-secret-key', this.envSecret);

      return {
        isFeatureEnabled: response.body.attributes.use_ip_whitelist,
        ipRanges: response.body.attributes.rules,
      };
    } catch {
      throw new Error('An error occurred while retrieving your IP whitelist.');
    }
  }
}
