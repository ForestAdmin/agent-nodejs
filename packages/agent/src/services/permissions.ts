import { Collection, ConditionTree } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import LruCache from 'lru-cache';
import hashObject from 'object-hash';

import { ForestAdminHttpDriverOptionsWithDefaults, HttpCode } from '../types';
import ForestHttpApi, { RenderingPerms } from '../utils/forest-http-api';

type RolesOptions = Pick<
  ForestAdminHttpDriverOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'isProduction' | 'permissionsCacheDurationInSeconds'
>;

export default class PermissionService {
  private options: RolesOptions;
  private cache: LruCache<number, Promise<RenderingPerms>>;

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
    const chartHash = hashObject(context.request.body, {
      respectType: false,
      excludeKeys: key => context.request.body[key] === null,
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
  private getRenderingPermissions(renderingId: number): Promise<RenderingPerms> {
    if (!this.cache.has(renderingId))
      this.cache.set(renderingId, ForestHttpApi.getPermissions(this.options, renderingId));

    // We already checked the entry is up-to-date with the .has() call => allowStale
    return this.cache.get(renderingId, { allowStale: true });
  }
}
