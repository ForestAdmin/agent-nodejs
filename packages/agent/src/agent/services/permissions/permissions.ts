import { Collection, ConditionTree } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import LruCache from 'lru-cache';
import hashObject from 'object-hash';

import { AgentOptionsWithDefaults, HttpCode } from '../../types';
import ForestHttpApi, { RenderingPermissions } from '../../utils/forest-http-api';

type RolesOptions = Pick<
  AgentOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'isProduction' | 'permissionsCacheDurationInSeconds'
>;

export default class PermissionService {
  private options: RolesOptions;
  private cache: LruCache<number, Promise<RenderingPermissions>>;

  constructor(options: RolesOptions) {
    this.options = options;
    this.cache = new LruCache({
      max: 256,
      ttl: this.options.permissionsCacheDurationInSeconds * 1000,
    });
  }

  invalidateCache(renderingId: number): void {
    this.cache.delete(renderingId);
  }

  /** Checks that a charting query is in the list of allowed queries */
  async canChart(context: Context): Promise<void> {
    // If the permissions level already allow the chart, no need to check further
    if (['admin', 'editor', 'developer'].includes(context.state.user.permissionLevel)) {
      return;
    }

    const chart = { ...context.request.body };

    // When the server sends the data of the allowed charts, the target column is not specified
    // for relations => allow them all.
    if (chart?.group_by_field?.includes(':'))
      chart.group_by_field = chart.group_by_field.substring(0, chart.group_by_field.indexOf(':'));

    const chartHash = hashObject(chart, {
      respectType: false,
      excludeKeys: key => chart[key] === null,
    });

    await this.can(context, `chart:${chartHash}`);
  }

  /** Check if a user is allowed to perform a specific action */
  async can(context: Context, action: string, allowRefetch = true): Promise<void> {
    const { id: userId, renderingId } = context.state.user;
    const perms = await this.getRenderingPermissions(renderingId);
    const isAllowed = perms.actions.has(action) || perms.actionsByUser[action]?.has(userId);

    if (!isAllowed && allowRefetch) {
      this.invalidateCache(renderingId);

      return this.can(context, action, false);
    }

    if (!isAllowed) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }
  }

  async getScope(collection: Collection, context: Context): Promise<ConditionTree> {
    const { user } = context.state;
    const perms = await this.getRenderingPermissions(user.renderingId);
    const scopes = perms.scopes[collection.name];

    if (!scopes) return null;

    return scopes.conditionTree.replaceLeafs(leaf => {
      const dynamicValues = scopes.dynamicScopeValues?.[user.id];

      if (typeof leaf.value === 'string' && leaf.value.startsWith('$currentUser')) {
        // Search replacement hash from forestadmin server
        if (dynamicValues) {
          return leaf.override({ value: dynamicValues[leaf.value] });
        }

        // Search JWT token (new user)
        return leaf.override({
          value: leaf.value.startsWith('$currentUser.tags.')
            ? user.tags[leaf.value.substring(18)]
            : user[leaf.value.substring(13)],
        });
      }

      return leaf;
    });
  }

  /** Get cached version of "rendering permissions" */
  private getRenderingPermissions(renderingId: number): Promise<RenderingPermissions> {
    if (!this.cache.has(renderingId))
      this.cache.set(renderingId, ForestHttpApi.getPermissions(this.options, renderingId));

    // We already checked the entry is up-to-date with the .has() call => allowStale
    return this.cache.get(renderingId, { allowStale: true });
  }
}
