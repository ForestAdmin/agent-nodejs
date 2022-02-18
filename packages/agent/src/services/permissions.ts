import { Collection, ConditionTree } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import LruCache from 'lru-cache';
import hashObject from 'object-hash';

import { ForestAdminHttpDriverOptionsWithDefaults, HttpCode } from '../types';
import ForestHttpApi, { RenderingPerms, UserInfo } from '../utils/forest-http-api';

type RolesOptions = Pick<
  ForestAdminHttpDriverOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'isProduction' | 'permissionsCacheDurationInSeconds'
>;

type UserPermissions = {
  actions: Set<string>;
  scopes: { [collectionName: string]: ConditionTree };
};

type ScopeEntry = RenderingPerms['collections'][string]['scopes'];

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
  async can(context: Context, actionName: string, allowRefetch = true): Promise<void> {
    if (this.options.isProduction) {
      const perms = await this.getUserPermissions(context.state.user);
      const isAllowed = perms.actions.has(actionName);

      if (!isAllowed && allowRefetch) {
        this.invalidateCache(context.state.user.renderingId);

        return this.can(context, actionName, false);
      }

      if (!isAllowed) {
        context.throw(HttpCode.Forbidden, 'Forbidden');
      }
    }
  }

  async getScope(collection: Collection, context: Context): Promise<ConditionTree> {
    const perms = await this.getUserPermissions(context.state.user);

    return perms.scopes[collection.name];
  }

  /** Build "user permissions" from "rendering permissions" */
  private async getUserPermissions(user: UserInfo): Promise<UserPermissions> {
    const permissions = await this.getRenderingPermissions(user.renderingId);
    const result = { actions: new Set(permissions.actions), scopes: {} };

    for (const [collection, { actionsByUser, scopes }] of Object.entries(permissions.collections)) {
      for (const [action, allowedUserIds] of Object.entries(actionsByUser))
        if (allowedUserIds.has(user.id)) result.actions.add(`${action}:${collection}`);

      result.scopes[collection] = scopes ? this.replaceUserVariables(user, scopes) : null;
    }

    return result;
  }

  /** Get cached version of "rendering permissions" */
  private getRenderingPermissions(renderingId: number): Promise<RenderingPerms> {
    if (!this.cache.has(renderingId))
      this.cache.set(renderingId, ForestHttpApi.getPermissions(this.options, renderingId));

    // We already checked the entry is up-to-date with the .has() call => allowStale
    return this.cache.get(renderingId, { allowStale: true });
  }

  /** Generate condition tree from generic "ScopeEntry" */
  private replaceUserVariables(user: UserInfo, scopesEntry: ScopeEntry): ConditionTree {
    const { conditionTree } = scopesEntry;
    const dynamicValues = scopesEntry.dynamicScopeValues?.[user.id];

    return conditionTree.replaceLeafs(leaf => {
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
}
