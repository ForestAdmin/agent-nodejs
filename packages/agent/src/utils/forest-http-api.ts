/* eslint-disable @typescript-eslint/no-explicit-any */

import { ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { IssuerMetadata } from 'openid-client';
import { JSONAPIDocument } from 'json-api-serializer';
import hashObject from 'object-hash';
import superagent, { Response, ResponseError } from 'superagent';

import { ForestAdminHttpDriverOptions } from '../types';

export type IpWhitelistConfig = {
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
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  team: string;
  renderingId: number;
  role: string;
  tags: { key: string; value: string }[];
};

export type RenderingPerms = {
  actions: Set<string>;
  collections: {
    [collectionName: string]: {
      actionsByUser: { [actionName: string]: Set<number> };
      scopes: {
        conditionTree: ConditionTree;
        dynamicScopeValues: { [userId: number]: { [replacementKey: string]: unknown } };
      };
    };
  };
};

type HttpOptions = Pick<
  ForestAdminHttpDriverOptions,
  'envSecret' | 'forestServerUrl' | 'isProduction'
>;

export default class ForestHttpApi {
  static async getIpWhitelistConfiguration(options: HttpOptions): Promise<IpWhitelistConfig> {
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

      const { attributes, id } = response.body.data;

      return {
        id: Number(id),
        email: attributes.email,
        firstName: attributes.first_name,
        lastName: attributes.last_name,
        team: attributes.teams[0],
        role: attributes.role,
        tags: attributes.tags?.reduce((memo, { key, value }) => ({ ...memo, [key]: value }), {}),
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

  static async getPermissions(options: HttpOptions, renderingId: number): Promise<RenderingPerms> {
    const response = await superagent
      .get(`${options.forestServerUrl}/liana/v3/permissions`)
      .set('forest-secret-key', options.envSecret)
      .query(`renderingId=${renderingId}`);

    if (!response.body?.meta?.rolesACLActivated) {
      throw new Error('Roles V2 are unsupported');
    }

    const result = { actions: new Set<string>(), collections: {} };
    if (options.isProduction)
      result.actions = ForestHttpApi.decodeChartPermissions(response.body.stats);

    for (const [name, settings] of Object.entries<any>(response.body.data.collections)) {
      const scopes = response.body.data.renderings[renderingId][name].scope;

      result.collections[name] = {
        actionsByUser: options.isProduction ? ForestHttpApi.decodeActionPermissions(settings) : {},
        scopes: ForestHttpApi.decodeScopePermissions(scopes),
      };
    }

    return result;
  }

  /** Helper to format permissions into something easy to validate against */
  private static decodeChartPermissions(chartsByType: any): Set<string> {
    const serverCharts = Object.values<any>(chartsByType).flat();
    const frontendCharts = serverCharts.map(chart => ({
      type: chart.type,
      filters: chart.filter ?? null,
      aggregate: chart.aggregator ?? null,
      aggregate_field: chart.aggregateFieldName ?? null,
      collection: chart.sourceCollectionId ?? null,
      time_range: chart.timeRange ?? null,
      group_by_date_field: (chart.type === 'Line' && chart.groupByFieldName) || null,
      group_by_field: (chart.type !== 'Line' && chart.groupByFieldName) || null,
      limit: chart.limit ?? null,
      label_field: chart.labelFieldName ?? null,
      relationship_field: chart.relationshipFieldName ?? null,
    }));

    const hashes = frontendCharts.map(chart =>
      hashObject(chart, { respectType: false, excludeKeys: key => chart[key] === null }),
    );

    return new Set<string>(hashes.map(hash => `chart:${hash}`));
  }

  /** Helper to format permissions into something easy to validate against */
  private static decodeActionPermissions(
    settings: any,
  ): RenderingPerms['collections'][string]['actionsByUser'] {
    const actionsByUser = {};

    for (const [actionName, userIds] of Object.entries<any>(settings.collection)) {
      const shortName = actionName.substring(0, actionName.length - 'Enabled'.length);
      actionsByUser[shortName] = new Set<number>(userIds);
    }

    for (const [actionName, actionPerms] of Object.entries<any>(settings.actions)) {
      const userIds = actionPerms.triggerEnabled;
      actionsByUser[`custom:${actionName}`] = new Set<number>(userIds);
    }

    return actionsByUser;
  }

  /** Helper to format permissions into something easy to validate against */
  private static decodeScopePermissions(
    scopes: any,
  ): RenderingPerms['collections'][string]['scopes'] {
    return (
      scopes && {
        conditionTree: ConditionTreeFactory.fromPlainObject(scopes.filter),
        dynamicScopeValues: scopes.dynamicScopesValues?.users ?? {},
      }
    );
  }
}
