import { Collection, ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import { ForestAdminHttpDriverOptionsWithDefaults } from '../types';
import ForestHttpApi, { ScopeByCollection } from '../utils/forest-http-api';

type ScopeOptions = Pick<
  ForestAdminHttpDriverOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'scopesCacheDurationInSeconds'
>;

type ScopeCacheEntry = { fetchedAt: Date; scopes: ScopeByCollection };
type Scope = ScopeByCollection[string];

export default class ScopeService {
  private cache: Record<string, ScopeCacheEntry> = {};
  private options: ScopeOptions;

  constructor(options: ScopeOptions) {
    this.options = options;
  }

  /** Route called when scopes are modified so that we don't have to wait for expiration. */
  invalidateCache(renderingId: number): void {
    delete this.cache[renderingId];
  }

  /** Adds relevant filters to the concerned requests */
  async getConditionTree(collection: Collection, ctx: Context): Promise<ConditionTree> {
    const { id: userId, renderingId } = ctx.state.user;
    const scope = await this.getScope(renderingId, collection.name);

    if (!scope) return ConditionTreeFactory.MatchAll;

    const dynamicUserValues = scope.dynamicScopesValues?.users?.[userId];

    return scope.conditionTree.replaceLeafs(leaf =>
      typeof leaf.value === 'string' && leaf.value.startsWith('$currentUser')
        ? leaf.override({ value: dynamicUserValues[leaf.value] ?? leaf.value })
        : leaf,
    );
  }

  /** Get scope definition from forestadmin-server */
  private async getScope(renderingId: string, collectionName: string): Promise<Scope> {
    const cacheEntry = this.cache[renderingId];
    let rebuildCache: boolean;

    if (cacheEntry) {
      const age = new Date().valueOf() - cacheEntry.fetchedAt.valueOf();
      const expiration = this.options.scopesCacheDurationInSeconds * 1000;
      rebuildCache = age > expiration;
    } else {
      rebuildCache = true;
    }

    if (rebuildCache) {
      try {
        const scopes = await ForestHttpApi.getScopes(this.options, renderingId);

        this.cache[renderingId] = { fetchedAt: new Date(), scopes };
      } catch (e) {
        throw new Error(`Failed to refresh scopes for collection: ${collectionName}`);
      }
    }

    return this.cache[renderingId]?.scopes?.[collectionName];
  }
}
