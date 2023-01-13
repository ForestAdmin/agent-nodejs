import { Client, ClientAuthMethod, Issuer, IssuerMetadata } from 'openid-client';

import { UserInfo } from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';

export default class AuthService {
  constructor(private options: ForestAdminClientOptionsWithDefaults) {}

  async getOpenIdClient(): Promise<Client> {
    // We can't use 'Issuer.discover' because the oidc config is behind an auth-wall.
    const url = '/oidc/.well-known/openid-configuration';
    const config = await ServerUtils.query<IssuerMetadata>(this.options, 'get', url);
    const issuer = new Issuer(config);
    const registration = { token_endpoint_auth_method: 'none' as ClientAuthMethod };

    return issuer.Client.register(registration, { initialAccessToken: this.options.envSecret });
  }

  async getUserInfo(renderingId: number, accessToken: string): Promise<UserInfo> {
    const url = `/liana/v2/renderings/${renderingId}/authorization`;
    const headers = { 'forest-token': accessToken };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await ServerUtils.query<any>(this.options, 'get', url, headers);

    return {
      id: Number(response.data.id),
      email: response.data.attributes.email,
      firstName: response.data.attributes.first_name,
      lastName: response.data.attributes.last_name,
      team: response.data.attributes.teams[0],
      role: response.data.attributes.role,
      permissionLevel: response.data.attributes.permission_level,
      renderingId,
      tags: response.data.attributes.tags?.reduce(
        (memo, { key, value }) => ({ ...memo, [key]: value }),
        {},
      ),
    };
  }
}
