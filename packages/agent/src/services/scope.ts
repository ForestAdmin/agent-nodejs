import { Collection, ConditionTree, ConditionTreeUtils } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import superagent from 'superagent';

type ScopeDef = {
  conditionTree: ConditionTree;
  dynamicScopesValues: {
    users: Record<string, Record<string, unknown>>;
  };
};

type ScopeCacheEntry = {
  fetchedAt: Date;
  scopes: {
    [collectionName: string]: {
      scope: ScopeDef;
    };
  };
};

export default class Scope {
  private cache: Record<string, ScopeCacheEntry> = {};
  private forestServerUrl: string;
  private envSecret: string;
  private scopesCacheDurationInSeconds: number;

  constructor(forestServerUrl: string, envSecret: string, scopesCacheDurationInSeconds: number) {
    this.forestServerUrl = forestServerUrl;
    this.envSecret = envSecret;
    this.scopesCacheDurationInSeconds = (scopesCacheDurationInSeconds ?? 15 * 60) * 1000;
  }

  /** Route called when scopes are modified so that we don't have to wait for expiration. */
  invalidateCache(renderingId: number): void {
    delete this.cache[renderingId];
  }

  /** Adds relevant filters to the concerned requests */
  async getConditionTree(collection: Collection, ctx: Context): Promise<ConditionTree> {
    const { id: userId, renderingId } = ctx.state.user;
    const scope = await this.getScope(renderingId, collection.name);
    const conditionTree = scope ? scope.conditionTree : ConditionTreeUtils.MatchAll;
    const dynamicUserValues = scope.dynamicScopesValues?.users?.[userId];

    return conditionTree.replaceLeafs(leaf =>
      typeof leaf.value === 'string' && leaf.value.startsWith('$currentUser')
        ? leaf.override({ value: dynamicUserValues[leaf.value] ?? leaf.value })
        : leaf,
    );
  }

  /** Get scope definition from forestadmin-server */
  private async getScope(renderingId: number, collectionName: string): Promise<ScopeDef> {
    const expiration = this.scopesCacheDurationInSeconds * 1000 || 300e3;
    const cacheEntry = this.cache[renderingId];

    if (!cacheEntry || new Date().valueOf() - cacheEntry.fetchedAt.valueOf() > expiration) {
      try {
        const response = await superagent
          .get(`${this.forestServerUrl}/liana/scopes`)
          .set('forest-secret-key', this.envSecret)
          .query(`renderingId=${renderingId}`);

        this.cache[renderingId] = { fetchedAt: new Date(), scopes: response.body };
      } catch (e) {
        throw new Error(`Failed to refresh scopes for collection: ${collectionName}`);
      }
    }

    return this.cache[renderingId]?.scopes?.[collectionName]?.scope;
  }
}
