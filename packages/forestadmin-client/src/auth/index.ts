import { BaseClient, ClientAuthMethod, Issuer, IssuerMetadata, errors } from 'openid-client';
import { ParsedUrlQuery } from 'querystring';

import { AuthenticationError } from './errors';
import { ClientExt } from './type-overrides';
import { Tokens, UserInfo } from './types';
import { ForestAdminAuthServiceInterface, ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';

export default class AuthService implements ForestAdminAuthServiceInterface {
  private client: BaseClient;

  constructor(private options: ForestAdminClientOptionsWithDefaults) {}

  public async init(): Promise<void> {
    if (this.client) return;

    // We can't use 'Issuer.discover' because the oidc config is behind an auth-wall.
    const url = '/oidc/.well-known/openid-configuration';
    const config = await ServerUtils.query<IssuerMetadata>(this.options, 'get', url);
    const issuer = new Issuer(config);
    const registration = { token_endpoint_auth_method: 'none' as ClientAuthMethod };

    this.client = await (issuer.Client as ClientExt).register(registration, {
      initialAccessToken: this.options.envSecret,
    });
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

  public async generateAuthorizationUrl({
    scope,
    state,
  }: {
    scope: string;
    state: string;
  }): Promise<string> {
    if (!this.client) throw new Error('AuthService not initialized');

    const url = this.client.authorizationUrl({
      scope,
      state,
    });

    return url;
  }

  public async generateTokens({
    query,
    state,
  }: {
    query: ParsedUrlQuery;
    state: string;
  }): Promise<Tokens> {
    if (!this.client) throw new Error('AuthService not initialized');

    try {
      const tokens = await this.client.callback(undefined, query, { state });

      return {
        accessToken: tokens.access_token,
      };
    } catch (e) {
      this.handleError(e);
    }
  }

  private handleError(e: Error) {
    if (e instanceof errors.OPError) {
      throw new AuthenticationError(e);
    }

    throw e;
  }
}
