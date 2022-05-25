import {
  BaseDataSource,
  ConditionTreeFactory,
  DataSource,
  Filter,
  Logger,
} from '@forestadmin/datasource-toolkit';
import { CachedDataSourceOptions } from '../types';
import CachedCollection from './cached-collection';

export default class CachedDataSource extends BaseDataSource {
  private cache: DataSource;
  private options: CachedDataSourceOptions;
  private currentCursor: string;
  private currentSync: Promise<void>;

  constructor(logger: Logger, cache: DataSource, options: CachedDataSourceOptions) {
    super();

    this.cache = cache;
    this.options = options;

    for (const collection of cache.collections)
      this.addCollection(new CachedCollection(collection, this, options));
  }

  async sync(): Promise<void> {
    // wait for previous sync to end
    if (this.currentSync) {
      await this.currentSync;
    }

    // Start only if another was not triggered
    if (!this.currentSync) {
      this.currentSync = this._sync();
      await this.currentSync;
    }
  }

  private async _sync(): Promise<void> {
    let result: Awaited<ReturnType<typeof this.options.listChanges>>;

    while (!result?.done) {
      /* eslint-disable-next-line no-await-in-loop */
      result = await this.options.listChanges(this.currentCursor);
      const promises: Promise<void>[] = [];

      for (const [name, { creations, updates, deletions }] of Object.entries(result.changes)) {
        const cache = this.cache.getCollection(name);
        const deleteTree = ConditionTreeFactory.matchIds(cache.schema, deletions);

        promises.push(cache.delete(null, new Filter({ conditionTree: deleteTree })));
        promises.push(cache.create(null, creations).then());

        for (const patch of updates) {
          const updateTree = ConditionTreeFactory.matchRecords(cache.schema, [patch]);
          promises.push(cache.update(null, new Filter({ conditionTree: updateTree }), patch));
        }
      }

      /* eslint-disable-next-line no-await-in-loop */
      await Promise.all(promises);
      this.currentCursor = result?.nextCursor ?? null;
    }

    this.currentSync = null;
  }
}
