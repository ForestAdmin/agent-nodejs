import { IssuerMetadata } from 'openid-client';
import superagent, { Response } from 'superagent';

export type IpRule = {
  type: number;
  ipMinimum?: string;
  ipMaximum?: string;
  ip?: string;
  range?: string;
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
    ipRules: Array<IpRule>;
  }> {
    try {
      const response: Response = await superagent
        .get(new URL('/liana/v1/ip-whitelist-rules', this.forestServerUrl))
        .set('forest-secret-key', this.envSecret);

      const { use_ip_whitelist: isFeatureEnabled, rules: ipRules } = response.body.data.attributes;

      return { isFeatureEnabled, ipRules };
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
      throw new Error('Failed to fetch openid-configuration.');
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
    role: string;
    tags: { key: string; value: string }[];
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
        role: attributes.role,
        tags: attributes.tags,
        renderingId,
      };
    } catch {
      throw new Error('Failed to retrieve authorization informations.');
    }
  }
}
