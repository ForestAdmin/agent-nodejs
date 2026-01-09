import type { ClientExt } from './type-overrides';
import type { Tokens, UserInfo } from './types';
import type {
  ForestAdminAuthServiceInterface,
  ForestAdminClientOptionsWithDefaults,
} from '../types';
import type { BaseClient, ClientAuthMethod, IssuerMetadata } from 'openid-client';
import type { ParsedUrlQuery } from 'querystring';

import { Issuer, errors } from 'openid-client';

import { AuthenticationError } from './errors';
import ServerUtils from '../utils/server';

type UserInfoResponse = {
  data: {
    id: string;
    attributes: {
      email: string;
      first_name: string;
      last_name: string;
      teams: string[];
      role: string;
      permission_level: string;
      tags?: Array<{ key: string; value: string }>;
    };
  };
};

export default class AuthService implements ForestAdminAuthServiceInterface {
  protected client: BaseClient;

  constructor(private options: ForestAdminClientOptionsWithDefaults) {}

  /**
   * Initialize the authentication client upfront. This speeds up the first
   * authentication request.
   */
  public async init(): Promise<void> {
    try {
      await this.createClient();
    } catch (e) {
      // Sometimes the authentication client can't be initialized because of a
      // server or network error. We don't want the application to crash.
      this.options.logger(
        'Warn',
        `Error while registering the authentication client. Authentication might not work: ${e.message}`,
      );
    }
  }

  public async getUserInfo(renderingId: number, accessToken: string): Promise<UserInfo> {
    const url = `/liana/v2/renderings/${renderingId}/authorization`;
    const headers = { 'forest-token': accessToken };

    const response = await ServerUtils.query<UserInfoResponse>(this.options, 'get', url, headers);

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
    await this.createClient();

    return this.client.authorizationUrl({
      scope,
      state,
    });
  }

  public async generateTokens({
    query,
    state,
  }: {
    query: ParsedUrlQuery;
    state: string;
  }): Promise<Tokens> {
    await this.createClient();

    try {
      const tokens = await this.client.callback(undefined, query, { state });

      return {
        accessToken: tokens.access_token,
      };
    } catch (e) {
      this.handleError(e);
    }
  }

  protected async createClient() {
    if (this.client) return;

    // We can't use async 'Issuer.discover' because the oidc config is behind an auth-wall.
    const url = '/oidc/.well-known/openid-configuration';
    const config = await ServerUtils.query<IssuerMetadata>(this.options, 'get', url);
    const issuer = new Issuer(config);

    const registration = { token_endpoint_auth_method: 'none' as ClientAuthMethod };

    this.client = await (issuer.Client as ClientExt).register(registration, {
      initialAccessToken: this.options.envSecret,
    });
  }

  private handleError(e: Error) {
    if (e instanceof errors.OPError) {
      throw new AuthenticationError(e);
    }

    throw e;
  }
}
