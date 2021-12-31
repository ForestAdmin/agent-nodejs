import { IssuerMetadata } from 'openid-client';
import superagent, { Response } from 'superagent';

export declare type IpRange = {
  ipMinimum: string;
  ipMaximum: string;
};

export default class ForestHttpApi {
  private readonly forestServerUrl: string;
  private readonly envSecret: string;

  constructor(forestServerUrl: string, envSecret: string) {
    if (!forestServerUrl || !envSecret) {
      throw new Error(
        `forestServerUrl: ${forestServerUrl} and envSecret: ${envSecret} must be present.`,
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

  async getOpenIdConfiguration(): Promise<IssuerMetadata> {
    try {
      const response: Response = await superagent
        .get(new URL('/oidc/.well-known/openid-configuration', this.forestServerUrl))
        .set('forest-secret-key', this.envSecret);

      return response.body;
    } catch {
      throw new Error('Failed to fetch openid-configuration');
    }
  }

  async getUserAuthorizationInformations(
    renderingId: string,
    accessToken: string,
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    team: string;
    renderingId: string;
  }> {
    try {
      const response = await superagent
        .get(new URL(`/liana/v2/renderings/${renderingId}/authorization`, this.forestServerUrl))
        .set('forest-token', accessToken)
        .set('forest-secret-key', this.envSecret);

      const { attributes } = response.body.data;

      return {
        id: response.body.data.id,
        email: attributes.email,
        firstName: attributes.first_name,
        lastName: attributes.last_name,
        team: attributes.teams[0],
        renderingId,
      };
    } catch {
      throw new Error('Failed to retrieve authorization informations');
    }
  }
}
