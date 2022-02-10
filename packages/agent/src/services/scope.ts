import { Collection, ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import { ForestAdminHttpDriverOptionsWithDefaults } from '../types';
import ForestHttpApi, { ScopeByCollection } from '../utils/forest-http-api';

type ScopeOptions = Pick<
  ForestAdminHttpDriverOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'scopesCacheDurationInSeconds'
>;

type ScopeCacheEntry = { fetchedAt: Date; scopes: Promise<ScopeByCollection> };
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
    const { user } = ctx.state;
    const scope = await this.getScope(user.renderingId, collection.name);

    if (!scope) {
      return ConditionTreeFactory.MatchAll;
    }

    const dynamicUserValues = scope.dynamicScopesValues?.[user.id] ?? {};

    return scope.conditionTree.replaceLeafs(leaf => {
      if (typeof leaf.value !== 'string' || !leaf.value.startsWith('$currentUser')) {
        return leaf;
      }

      const key = leaf.value.substring('$currentUser.'.length);

      // Fallback to searching the information in the JWT token when we fail to get it in the
      // hashmap sent from the server
      let value: unknown;

      if (dynamicUserValues[leaf.value]) {
        value = dynamicUserValues?.[leaf.value];
      } else if (user[key]) {
        value = user[key];
      } else if (key.startsWith('tags.') && user?.tags.find(tag => `tags.${tag.key}` === key)) {
        value = user?.tags.find(tag => `tags.${tag.key}` === key).value;
      } else {
        throw new Error(`Failed to resolve value for replacement string '${leaf.value}'`);
      }

      return leaf.override({ value });
    });
  }

  /** Get scope definition from forestadmin-server */
  private async getScope(renderingId: number, collectionName: string): Promise<Scope> {
    // Do not use 'await' in this section to avoid double fetching.
    // [synchronous section]
    let shouldRefetch: boolean;

    if (this.cache[renderingId]) {
      const age = new Date().valueOf() - this.cache[renderingId].fetchedAt.valueOf();
      const expiration = this.options.scopesCacheDurationInSeconds * 1000;
      shouldRefetch = age > expiration;
    } else {
      shouldRefetch = true;
    }

    if (shouldRefetch) {
      this.cache[renderingId] = {
        fetchedAt: new Date(),
        scopes: ForestHttpApi.getScopes(this.options, renderingId),
      };
    }
    // [/synchronous section]

    const scopesByCollection = await this.cache[renderingId].scopes;

    return scopesByCollection?.[collectionName];
  }
}
