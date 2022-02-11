import { ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { IssuerMetadata } from 'openid-client';
import { JSONAPIDocument } from 'json-api-serializer';
import superagent, { Response, ResponseError } from 'superagent';

import { ForestAdminHttpDriverOptions } from '../types';

export type IpWhitelistConfiguration = {
  isFeatureEnabled: boolean;
  ipRules: Array<{
    type: number;
    ipMinimum?: string;
    ipMaximum?: string;
    ip?: string;
    range?: string;
  }>;
};

export type UserInfo = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  team: string;
  renderingId: number;
  role: string;
  tags: { key: string; value: string }[];
};

export type ScopeByCollection = {
  [collectionName: string]: {
    conditionTree: ConditionTree;
    dynamicScopesValues: Record<string, Record<string, unknown>>;
  };
};

type HttpOptions = Pick<ForestAdminHttpDriverOptions, 'forestServerUrl' | 'envSecret'>;

export default class ForestHttpApi {
  static async getIpWhitelistConfiguration(
    options: HttpOptions,
  ): Promise<IpWhitelistConfiguration> {
    try {
      const response: Response = await superagent
        .get(new URL('/liana/v1/ip-whitelist-rules', options.forestServerUrl).toString())
        .set('forest-secret-key', options.envSecret);

      const { attributes } = response.body.data;

      return { isFeatureEnabled: attributes.use_ip_whitelist, ipRules: attributes.rules };
    } catch {
      throw new Error('An error occurred while retrieving your IP whitelist.');
    }
  }

  static async getOpenIdIssuerMetadata(options: HttpOptions): Promise<IssuerMetadata> {
    try {
      const response: Response = await superagent
        .get(new URL('/oidc/.well-known/openid-configuration', options.forestServerUrl).toString())
        .set('forest-secret-key', options.envSecret);

      return response.body;
    } catch {
      throw new Error('Failed to fetch open-id issuer metadata.');
    }
  }

  static async getUserInformation(
    options: HttpOptions,
    renderingId: number,
    accessToken: string,
  ): Promise<UserInfo> {
    try {
      const url = new URL(
        `/liana/v2/renderings/${renderingId}/authorization`,
        options.forestServerUrl,
      );

      const response = await superagent
        .get(url.toString())
        .set('forest-token', accessToken)
        .set('forest-secret-key', options.envSecret);

      const { attributes } = response.body.data;

      return {
        id: response.body.id,
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

  static async hasSchema(options: HttpOptions, hash: string): Promise<boolean> {
    const response = await superagent
      .post(new URL('/forest/apimaps/hashcheck', options.forestServerUrl).toString())
      .send({ schemaFileHash: hash })
      .set('forest-secret-key', options.envSecret);

    return !response?.body?.sendSchema;
  }

  static async uploadSchema(options: HttpOptions, apimap: JSONAPIDocument): Promise<void> {
    try {
      await superagent
        .post(new URL('/forest/apimaps', options.forestServerUrl).toString())
        .send(apimap)
        .set('forest-secret-key', options.envSecret);
    } catch (e) {
      // Sending the schema to forestadmin-server is mandatory: crash the server gracefully
      let message: string;

      switch ((e as ResponseError).response?.status) {
        case 0:
          message = 'Cannot send the apimap to Forest. Are you online?';
          break;
        case 404:
          message =
            'Cannot find the project related to the envSecret you configured. ' +
            'Can you check on Forest that you copied it properly in the Forest initialization?';
          break;
        case 503:
          message =
            'Forest is in maintenance for a few minutes. ' +
            'We are upgrading your experience in the forest. ' +
            'We just need a few more minutes to get it right.';
          break;
        default:
          message =
            'An error occured with the apimap sent to Forest. ' +
            'Please contact support@forestadmin.com for further investigations.';
      }

      throw new Error(message);
    }
  }

  static async getScopes(options: HttpOptions, renderingId: number): Promise<ScopeByCollection> {
    try {
      const response = await superagent
        .get(`${options.forestServerUrl}/liana/scopes`)
        .set('forest-secret-key', options.envSecret)
        .query(`renderingId=${renderingId}`);

      const result = {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [collection, data] of Object.entries<any>(response.body)) {
        result[collection] = {
          conditionTree: ConditionTreeFactory.fromPlainObject(data.scope.filter),
          dynamicScopeValues: data.scope.dynamicScopesValues?.users ?? {},
        };
      }

      return result;
    } catch (e) {
      throw new Error('Failed to retrieve scopes.');
    }
  }
}
